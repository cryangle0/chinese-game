import { resolveMotionStageFrame } from '../core/media/DomMotionLayout';
import {
  DINOSAUR_TREASURE_FEEDBACK,
  dinosaurCorrectFrameIndex,
  dinosaurCorrectSequenceDurationMs,
  dinosaurCorrectStagePoint,
} from '../shared/config/DinosaurTreasureFeedback';
import type { ScoreCoinSnapshot } from './ScoreCoinEffectView';

export interface DinosaurTreasureCorrectCallbacks {
  readonly onHatch?: (source: ScoreCoinSnapshot | null) => void;
  readonly onComplete?: () => void;
}

export interface DinosaurTreasureCorrectRuntime {
  readonly document: Document;
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly loadJson: (source: string) => Promise<unknown>;
  readonly loadImage: (source: string) => Promise<CanvasImageSource>;
}

interface DinosaurCorrectManifestFrame {
  readonly index: number;
  readonly file: string;
}

interface DinosaurCorrectManifest {
  readonly version: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly fps: number;
  readonly hatchFrame: number;
  readonly finalHoldMs: number;
  readonly anchor: {
    readonly x: number;
    readonly baselineY: number;
  };
  readonly placementAnchor: {
    readonly x: number;
    readonly baselineY: number;
  };
  readonly babyHead: {
    readonly frame: number;
    readonly x: number;
    readonly y: number;
  };
  readonly frames: readonly DinosaurCorrectManifestFrame[];
}

const MANIFEST_SOURCE = './media/dinosaur/correct-hatch-frames/manifest.json'
  + `?v=${DINOSAUR_TREASURE_FEEDBACK.assetVersion}`;
const FRAME_ROOT = './media/dinosaur/correct-hatch-frames';
const EFFECT_Z_INDEX = 8;

export class DinosaurTreasureCorrectEffectView {
  private readonly element: HTMLCanvasElement | null;
  private readonly context: CanvasRenderingContext2D | null;
  private assetsReady: Promise<boolean> | null = null;
  private manifest: DinosaurCorrectManifest | null = null;
  private frames: readonly CanvasImageSource[] = [];
  private animationFrame = 0;
  private runId = 0;
  private disposed = false;

  constructor(
    private readonly runtime: DinosaurTreasureCorrectRuntime | null =
      browserRuntime(),
  ) {
    if (!runtime) {
      this.element = null;
      this.context = null;
      return;
    }
    const element = runtime.document.createElement('canvas');
    const context = element.getContext('2d');
    if (!context) {
      this.element = null;
      this.context = null;
      return;
    }
    this.element = element;
    this.context = context;
    element.id = 'DinosaurTreasureCorrectEffect';
    element.width = 1;
    element.height = 1;
    element.dataset.dinosaurTreasureCorrectCanvas = '1';
    element.setAttribute('aria-hidden', 'true');
    Object.assign(element.style, {
      position: 'fixed',
      display: 'none',
      overflow: 'visible',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: String(EFFECT_Z_INDEX),
      maxWidth: 'none',
      maxHeight: 'none',
      imageRendering: 'auto',
    });
    this.configureContext();
  }

  preload(): void {
    if (this.disposed) return;
    void this.ensureAssetsReady();
  }

  play(
    columnX: number,
    callbacks: DinosaurTreasureCorrectCallbacks = {},
  ): void {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.context
    ) {
      callbacks.onHatch?.(null);
      callbacks.onComplete?.();
      return;
    }
    this.stopActive();
    const runId = this.runId;
    void this.ensureAssetsReady().then((ready) => {
      if (runId !== this.runId || this.disposed) return;
      const manifest = this.manifest;
      if (!ready || !manifest || !this.prepare(columnX, manifest)) {
        this.markLoadFailure();
        callbacks.onHatch?.(null);
        callbacks.onComplete?.();
        return;
      }
      const startedAt = this.runtime!.now();
      const durationMs = dinosaurCorrectSequenceDurationMs(
        manifest.frames.length,
        manifest.fps,
        manifest.finalHoldMs,
      );
      let lastFrame = -1;
      let hatchCalled = false;
      const hatchAtMs = manifest.hatchFrame * 1000 / manifest.fps;
      const tick = (now: number): void => {
        if (runId !== this.runId || this.disposed) return;
        this.animationFrame = 0;
        const elapsedMs = Math.max(0, now - startedAt);
        const frameIndex = dinosaurCorrectFrameIndex(
          elapsedMs,
          manifest.frames.length,
          manifest.fps,
        );
        this.drawFrame(frameIndex);
        if (frameIndex !== lastFrame) {
          lastFrame = frameIndex;
          this.markFrame(frameIndex);
        }
        this.positionAt(columnX, manifest);
        if (!hatchCalled && elapsedMs >= hatchAtMs) {
          hatchCalled = true;
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureCorrectPhase =
              'hatchling-visible';
          }
          callbacks.onHatch?.(this.scoreOrigin(columnX, manifest));
        }
        if (elapsedMs >= durationMs) {
          if (!hatchCalled) callbacks.onHatch?.(this.scoreOrigin(columnX, manifest));
          this.drawFrame(manifest.frames.length - 1);
          this.markFrame(manifest.frames.length - 1);
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureCorrectPhase =
              'final-frame-held';
          }
          callbacks.onComplete?.();
          return;
        }
        this.animationFrame = this.runtime!.requestFrame(tick);
      };
      tick(startedAt);
    });
  }

  hide(): void {
    this.stopActive();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopActive();
  }

  private prepare(
    columnX: number,
    manifest: DinosaurCorrectManifest,
  ): boolean {
    if (
      !this.runtime
      || !this.element
      || !this.context
      || !this.stageCanvas()
    ) return false;
    if (
      this.element.width !== manifest.frameWidth
      || this.element.height !== manifest.frameHeight
    ) {
      this.element.width = manifest.frameWidth;
      this.element.height = manifest.frameHeight;
      this.configureContext();
    }
    if (!this.element.isConnected) this.runtime.document.body.appendChild(this.element);
    this.element.style.display = 'block';
    this.positionAt(columnX, manifest);
    Object.assign(this.runtime.document.body.dataset, {
      dinosaurTreasureCorrectEffect: 'playing',
      dinosaurTreasureCorrectRenderer: 'predecoded-hd-canvas',
      dinosaurTreasureCorrectColumnX: columnX.toFixed(2),
      dinosaurTreasureCorrectVersion: manifest.version,
      dinosaurTreasureCorrectPhase: 'hatching',
      dinosaurTreasureCorrectInterpolation: 'stepped-predecoded-raf',
    });
    return true;
  }

  private ensureAssetsReady(): Promise<boolean> {
    if (this.assetsReady) return this.assetsReady;
    if (!this.runtime || this.disposed) return Promise.resolve(false);
    const attempt = this.runtime.loadJson(MANIFEST_SOURCE)
      .then((value) => {
        if (!isDinosaurCorrectManifest(value)) {
          throw new Error('Invalid dinosaur correct frame manifest');
        }
        if (value.version !== DINOSAUR_TREASURE_FEEDBACK.assetVersion) {
          throw new Error(`Unexpected dinosaur correct version ${value.version}`);
        }
        const sources = value.frames.map((frame) =>
          `${FRAME_ROOT}/${frame.file}?v=${encodeURIComponent(value.version)}`);
        return Promise.all(sources.map((source) => this.runtime!.loadImage(source)))
          .then((frames) => ({ manifest: value, frames }));
      })
      .then(
        ({ manifest, frames }) => {
          this.manifest = manifest;
          this.frames = frames;
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureCorrectFramesReady = 'true';
          }
          return true;
        },
        () => false,
      );
    this.assetsReady = attempt;
    void attempt.then((ready) => {
      if (!ready && this.assetsReady === attempt) this.assetsReady = null;
    });
    return attempt;
  }

  private drawFrame(frameIndex: number): void {
    if (!this.context || !this.element) return;
    this.context.clearRect(0, 0, this.element.width, this.element.height);
    const frame = this.frames[frameIndex];
    if (!frame) return;
    this.context.drawImage(frame, 0, 0, this.element.width, this.element.height);
  }

  private positionAt(
    columnX: number,
    manifest: DinosaurCorrectManifest,
  ): void {
    if (!this.element) return;
    const canvas = this.stageCanvas();
    if (!canvas) return;
    const stage = resolveMotionStageFrame(canvas);
    const displayScale = DINOSAUR_TREASURE_FEEDBACK.effectScale;
    const designX = 720 + columnX;
    const designY = 405 - DINOSAUR_TREASURE_FEEDBACK.effectBaselineY;
    const placementAnchor = manifest.placementAnchor;
    Object.assign(this.element.style, {
      left: `${
        stage.left
          + (designX - placementAnchor.x * displayScale) * stage.scale
      }px`,
      top: `${
        stage.top
          + (
            designY - placementAnchor.baselineY * displayScale
          ) * stage.scale
      }px`,
      width: `${manifest.frameWidth * displayScale * stage.scale}px`,
      height: `${manifest.frameHeight * displayScale * stage.scale}px`,
    });
  }

  private scoreOrigin(
    columnX: number,
    manifest: DinosaurCorrectManifest,
  ): ScoreCoinSnapshot {
    const point = dinosaurCorrectStagePoint(
      columnX,
      manifest.babyHead,
      manifest.placementAnchor,
    );
    return {
      ...point,
      name: 'DinosaurHatchlingHead',
    };
  }

  private stageCanvas(): HTMLCanvasElement | null {
    return this.runtime?.document.getElementById('GameCanvas') as HTMLCanvasElement | null;
  }

  private configureContext(): void {
    if (!this.context) return;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
  }

  private markFrame(frameIndex: number): void {
    if (!this.element || !this.runtime || !this.manifest) return;
    const frame = this.manifest.frames[frameIndex];
    const source = frame
      ? `${FRAME_ROOT}/${frame.file}?v=${encodeURIComponent(this.manifest.version)}`
      : '';
    this.element.dataset.dinosaurTreasureCorrectFrame = String(frameIndex);
    this.element.dataset.dinosaurTreasureCorrectSource = source;
    Object.assign(this.runtime.document.body.dataset, {
      dinosaurTreasureCorrectFrame: String(frameIndex),
      dinosaurTreasureCorrectSource: source,
    });
  }

  private markLoadFailure(): void {
    if (!this.runtime) return;
    Object.assign(this.runtime.document.body.dataset, {
      dinosaurTreasureCorrectEffect: 'load-error',
      dinosaurTreasureCorrectRenderer: 'predecoded-hd-canvas',
    });
  }

  private stopActive(): void {
    this.runId += 1;
    if (this.animationFrame && this.runtime) this.runtime.cancelFrame(this.animationFrame);
    this.animationFrame = 0;
    if (this.context && this.element) {
      this.context.clearRect(0, 0, this.element.width, this.element.height);
    }
    if (this.element) {
      this.element.style.display = 'none';
      this.element.remove();
    }
    if (this.runtime) {
      [
        'dinosaurTreasureCorrectEffect',
        'dinosaurTreasureCorrectRenderer',
        'dinosaurTreasureCorrectColumnX',
        'dinosaurTreasureCorrectVersion',
        'dinosaurTreasureCorrectPhase',
        'dinosaurTreasureCorrectFrame',
        'dinosaurTreasureCorrectSource',
        'dinosaurTreasureCorrectInterpolation',
      ].forEach((field) => {
        delete this.runtime!.document.body.dataset[field];
      });
    }
  }
}

function isDinosaurCorrectManifest(
  value: unknown,
): value is DinosaurCorrectManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<DinosaurCorrectManifest>;
  const anchor = manifest.anchor as DinosaurCorrectManifest['anchor'] | undefined;
  const placementAnchor = manifest.placementAnchor as
    DinosaurCorrectManifest['placementAnchor'] | undefined;
  const babyHead = manifest.babyHead as DinosaurCorrectManifest['babyHead'] | undefined;
  return typeof manifest.version === 'string'
    && Number.isFinite(manifest.frameWidth)
    && Number.isFinite(manifest.frameHeight)
    && Number.isFinite(manifest.fps)
    && Number.isFinite(manifest.hatchFrame)
    && Number.isFinite(manifest.finalHoldMs)
    && !!anchor
    && Number.isFinite(anchor.x)
    && Number.isFinite(anchor.baselineY)
    && !!placementAnchor
    && Number.isFinite(placementAnchor.x)
    && Number.isFinite(placementAnchor.baselineY)
    && !!babyHead
    && Number.isFinite(babyHead.frame)
    && Number.isFinite(babyHead.x)
    && Number.isFinite(babyHead.y)
    && Array.isArray(manifest.frames)
    && manifest.frames.length >= 12
    && manifest.frames.every((frame, index) =>
      frame.index === index && typeof frame.file === 'string');
}

function browserRuntime(): DinosaurTreasureCorrectRuntime | null {
  if (
    typeof document === 'undefined'
    || typeof requestAnimationFrame !== 'function'
    || typeof cancelAnimationFrame !== 'function'
    || typeof fetch !== 'function'
  ) return null;
  return {
    document,
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    loadJson: (source) => fetch(source, { cache: 'no-store' }).then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load dinosaur correct manifest: ${source}`);
      }
      return response.json() as Promise<unknown>;
    }),
    loadImage: (source) => loadDecodedImage(source),
  };
}

function loadDecodedImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = source;
  if (typeof image.decode === 'function') {
    return image.decode().then(() => image);
  }
  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(
      new Error(`Failed to load dinosaur correct frame: ${source}`),
    ), { once: true });
  });
}
