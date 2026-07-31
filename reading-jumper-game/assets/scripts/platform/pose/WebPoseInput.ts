import { acquireCameraStream, cameraFallbackLabel } from '../camera/CameraCapture';
import { CameraOverlay, CameraOverlayState } from '../camera/CameraOverlay';
import { PoseInputMapper } from './PoseInputMapper';
import { createMoveNetDetector, MoveNetDetector, MoveNetKeypoint } from './PoseRuntimeLoader';
import {
  hipMotionSample,
  MAX_CONSECUTIVE_INFERENCE_FAILURES,
  MODEL_START_TIMEOUT_MS,
  poseErrorReason,
  poseInferenceIntervalMs,
  poseInteractionStatusLabel,
  withTimeout,
} from './PoseRuntimePolicy';
import type { WebPoseInputCallbacks } from './PoseRuntimePolicy';
import { runtimeConfig } from '../../shared/config/RuntimeConfig';
export class WebPoseInput {
  private readonly mapper = new PoseInputMapper(runtimeConfig().pose);
  private overlay: CameraOverlay | null = null; private stream: MediaStream | null = null;
  private detector: MoveNetDetector | null = null;
  private raf = 0; private startToken = 0; private lastInferAt = 0;
  private inputEnabled = false; private paused = false; private disposed = false;
  private state: CameraOverlayState | null = null;
  private stateLabel = '';
  private frames = 0; private inferenceAverage = 0; private inferenceFailures = 0;
  private readonly inferIntervalMs = poseInferenceIntervalMs();
  constructor(private readonly callbacks: WebPoseInputCallbacks) {
    if (typeof document !== 'undefined') this.overlay = new CameraOverlay(() => { void this.restart(); });
  }
  async start(): Promise<void> {
    if (this.disposed || this.stream || typeof document === 'undefined') return;
    const token = ++this.startToken;
    const overlay = this.overlay; if (!overlay) return;
    this.setState('requesting');
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      this.fallback('camera-unavailable');
      return;
    }
    try { await this.openCamera(token, overlay); }
    catch (error) {
      if (!this.isCurrent(token)) return; console.warn('[WebPoseInput] start failed', error);
      this.fallback(poseErrorReason(error));
    }
  }
  setInputEnabled(enabled: boolean, graceMs = 0): void {
    this.inputEnabled = enabled;
    if (!enabled) this.mapper.suspendActions();
    else this.mapper.resumeActions(Date.now(), graceMs);
    if (enabled && this.state === 'ready') this.callbacks.onColumn(this.mapper.currentColumn());
  }
  setPaused(paused: boolean): void {
    this.paused = paused;
    this.overlay?.setPaused(paused);
    this.stream?.getVideoTracks().forEach((track) => { track.enabled = !paused; });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.startToken += 1;
    this.releaseRuntime(); this.overlay?.destroy(); this.overlay = null;
  }
  private async openCamera(token: number, overlay: CameraOverlay): Promise<void> {
    const stream = await acquireCameraStream();
    if (!this.isCurrent(token)) { stream.getTracks().forEach((track) => track.stop()); return; }
    this.stream = stream;
    overlay.setStream(stream);
    await overlay.video.play().catch(() => undefined);
    this.setState('loading');
    const loadedAt = performance.now();
    const runtime = await withTimeout(
      createMoveNetDetector(), MODEL_START_TIMEOUT_MS, 'pose-model-timeout',
      (lateRuntime) => lateRuntime.detector.dispose?.(),
    );
    if (!this.isCurrent(token)) { runtime.detector.dispose?.(); return; }
    this.detector = runtime.detector;
    this.callbacks.onState('loading', {
      backend: runtime.backend, loadMs: Math.round(performance.now() - loadedAt),
    });
    this.schedule();
  }
  private async restart(): Promise<void> {
    this.startToken += 1; this.releaseRuntime(); this.mapper.reset();
    this.disposed = false; await this.start();
  }
  private schedule(): void {
    if (this.disposed || !this.detector) return;
    this.raf = requestAnimationFrame(this.tick);
  }
  private tick = async (now: number): Promise<void> => {
    if (!this.detector || !this.overlay || this.disposed) return;
    if (!this.paused && !document.hidden && now - this.lastInferAt >= this.inferIntervalMs
      && this.overlay.video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      this.lastInferAt = now;
      const started = performance.now();
      try {
        const poses = await this.detector.estimatePoses(
          this.overlay.video, { flipHorizontal: false, maxPoses: 1 },
        );
        if (this.disposed) return; this.inferenceFailures = 0;
        this.frames += 1;
        this.inferenceAverage += (performance.now() - started - this.inferenceAverage)
          / Math.min(this.frames, 30);
        this.consume(poses[0]?.keypoints ?? []);
      } catch (error) {
        if (this.disposed) return; console.warn('[WebPoseInput] inference failed', error);
        this.inferenceFailures += 1;
        if (this.inferenceFailures >= MAX_CONSECUTIVE_INFERENCE_FAILURES) {
          this.fallback('pose-inference-failed'); return;
        }
      }
    }
    this.dispatchActions();
    this.schedule();
  };
  private consume(keypoints: readonly MoveNetKeypoint[]): void {
    const video = this.overlay?.video; if (!video) return;
    const sample = hipMotionSample(keypoints, video.videoWidth, video.videoHeight);
    const wasInteractionReady = this.mapper.isInteractionReady();
    const tracking = this.mapper.ingest(sample, Date.now());
    const interactionReady = this.mapper.isInteractionReady();
    const interactionStatus = this.mapper.interactionStatus();
    const bodyScale = this.mapper.currentBodyScale();
    this.overlay?.setDiagnostics(bodyScale, interactionReady, interactionStatus);
    if (!tracking) {
      this.setState('lost');
      return;
    }
    if (!interactionReady) {
      this.setState('positioning', poseInteractionStatusLabel(interactionStatus), {
        bodyScale: Number((bodyScale ?? 0).toFixed(4)),
        interactionStatus,
      });
      return;
    }
    this.setState('ready', undefined, {
      inferenceMs: Math.round(this.inferenceAverage),
      frames: this.frames,
      bodyScale: Number((bodyScale ?? 0).toFixed(4)),
      interactionStatus,
    });
    if (!wasInteractionReady && this.inputEnabled) {
      this.callbacks.onColumn(this.mapper.currentColumn());
    }
  }
  private dispatchActions(): void {
    const result = this.mapper.poll(Date.now(), this.inputEnabled);
    if (!this.inputEnabled || !result.tracking || !result.interactionReady) return;
    if (result.column !== undefined) this.callbacks.onColumn(result.column);
    if (result.jump) this.callbacks.onJump(this.mapper.currentColumn());
  }
  private setState(
    state: CameraOverlayState,
    statusOverride?: string,
    details?: Readonly<Record<string, string | number>>,
  ): void {
    const label = statusOverride ?? '';
    if (this.disposed || (this.state === state && this.stateLabel === label)) return;
    this.state = state;
    this.stateLabel = label;
    this.overlay?.setState(state, statusOverride);
    this.callbacks.onState(state, details ?? (state === 'ready' ? {
      inferenceMs: Math.round(this.inferenceAverage), frames: this.frames,
    } : undefined));
  }
  private fallback(reason: string): void {
    if (this.disposed) return; this.releaseRuntime();
    this.state = 'fallback';
    this.overlay?.setState('fallback', cameraFallbackLabel(reason));
    this.callbacks.onState('fallback', { reason });
  }
  private releaseRuntime(): void {
    cancelAnimationFrame(this.raf); this.raf = 0;
    this.detector?.dispose?.(); this.detector = null; this.inferenceFailures = 0;
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null; this.overlay?.clearStream();
  }
  private isCurrent(token: number): boolean {
    return !this.disposed && token === this.startToken;
  }
}
