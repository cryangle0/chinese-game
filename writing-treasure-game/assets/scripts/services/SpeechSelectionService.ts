import { matchSpokenOption, matchSpokenTranscripts } from './SpeechOptionMatcher';
import { maxRecordingMs, minimumAudioBytes, preferredRecordingMimeType,
} from './SpeechRecordingSupport';
import { recognizeSpeechAudio, speechHttpStatus } from './SpeechRecognitionAttempt';
import { SpeechStreamPool } from './SpeechStreamPool';
import { VoiceAttemptDiagnostics, VoiceDiagnosticSink } from './VoiceDiagnostics';
export { matchSpokenOption, matchSpokenTranscripts };
export type SpeechState = 'idle' | 'preparing' | 'listening' | 'processing' | 'not-ready'
  | 'unsupported' | 'no-match' | 'error' | 'disabled';
const recorderStartFallbackMs = 120;
const recorderFlushGraceMs = 180;
export class SpeechSelectionService {
  private recorder: MediaRecorder | null = null;
  private recordTimer: ReturnType<typeof setTimeout> | null = null;
  private recorderStartTimer: ReturnType<typeof setTimeout> | null = null;
  private recorderFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private requestAbort: AbortController | null = null;
  private readonly streams: SpeechStreamPool;
  private readonly ownsStreams: boolean;
  private active = false;
  private disposed = false;
  private generation = 0;
  private finishRequested = false;
  private stateListener: ((state: SpeechState) => void) | null = null;
  private lastState: SpeechState | null = null;
  private captureActive = false;
  private recorderReady = false;
  private pressStartedAt = 0;
  private recorderStartedAt = 0;
  private activeDiagnostic: VoiceAttemptDiagnostics | null = null;
  constructor(
    private readonly onDiagnostic?: VoiceDiagnosticSink,
    streams?: SpeechStreamPool,
    private readonly onCaptureActive?: (active: boolean) => void,
  ) {
    this.streams = streams ?? new SpeechStreamPool();
    this.ownsStreams = !streams;
  }
  supported(): boolean {
    return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)
      && typeof MediaRecorder !== 'undefined';
  }
  listen(options: readonly string[], onMatch: (index: number, attemptId: string) => void,
    onState: (state: SpeechState) => void): void {
    this.stop();
    const diagnostic = new VoiceAttemptDiagnostics(this.onDiagnostic, options.length);
    if (typeof window === 'undefined' || !this.supported()) {
      diagnostic.emit('asr_error', { errorName: 'UnsupportedError' });
      onState('unsupported');
      return;
    }
    const generation = ++this.generation;
    this.active = true;
    this.finishRequested = false;
    this.stateListener = onState;
    this.lastState = null;
    this.recorderReady = false;
    this.pressStartedAt = Date.now();
    this.recorderStartedAt = 0;
    this.activeDiagnostic = diagnostic;
    this.setCaptureActive(true);
    this.emitState('preparing', generation);
    // Start getUserMedia in the same gesture turn (iOS WKWebView requirement).
    const gum = this.streams.acquire();
    void this.recordAndRecognize(
      gum, [...options], onMatch, generation, diagnostic,
    );
  }
  finish(): void {
    if (!this.active || this.finishRequested) return;
    this.finishRequested = true;
    this.clearRecordTimer();
    const timing = this.captureTiming();
    this.activeDiagnostic?.emit('release_requested', timing);
    if (!this.recorderReady) {
      this.activeDiagnostic?.emit('released_before_ready', timing);
      this.emitState('not-ready', this.generation);
      this.active = false;
      this.stopRecorder();
      this.setCaptureActive(false);
      return;
    }
    this.emitState('processing', this.generation);
    this.flushAndStopRecorder();
  }
  stop(): void {
    this.generation += 1;
    this.active = false;
    this.finishRequested = false;
    this.clearRecordTimer();
    this.clearRecorderStartTimer();
    this.clearRecorderFlushTimer();
    this.requestAbort?.abort();
    this.requestAbort = null;
    this.stopRecorder();
    this.recorder = null;
    this.recorderReady = false;
    this.pressStartedAt = 0;
    this.recorderStartedAt = 0;
    this.activeDiagnostic = null;
    this.streams.park();
    this.setCaptureActive(false);
    this.stateListener = null;
    this.lastState = null;
  }
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    if (this.ownsStreams) this.streams.close();
  }
  private stopRecorder(recorder: MediaRecorder | null = this.recorder): void {
    if (recorder?.state === 'recording') {
      try { recorder.stop(); } catch { /* already stopping */ }
    }
  }
  private flushAndStopRecorder(recorder: MediaRecorder | null = this.recorder): void {
    if (!recorder || recorder.state !== 'recording') return;
    if (typeof recorder.requestData === 'function') {
      try { recorder.requestData(); } catch { /* recorder is already stopping */ }
    }
    this.clearRecorderFlushTimer();
    this.recorderFlushTimer = setTimeout(() => {
      this.recorderFlushTimer = null;
      this.stopRecorder(recorder);
    }, recorderFlushGraceMs);
  }
  private async recordAndRecognize(
    gum: Promise<MediaStream>, options: readonly string[],
    onMatch: (index: number, attemptId: string) => void,
    generation: number,
    diagnostic: VoiceAttemptDiagnostics,
  ): Promise<void> {
    let stream: MediaStream | null = null;
    try {
      stream = await gum;
      if (!this.isCurrent(generation)) {
        if (this.disposed) this.streams.disposeStream(stream);
        else if (!this.active) this.streams.park(stream);
        return;
      }
      diagnostic.emit('microphone_ready');
      const audio = await this.captureAudio(stream, generation, diagnostic);
      if (!this.isCurrent(generation)) return;
      if (!audio) {
        this.emitState('no-match', generation);
        return;
      }
      this.emitState('processing', generation);
      const abort = new AbortController();
      this.requestAbort = abort;
      const matchedIndex = await recognizeSpeechAudio(audio, options, abort, diagnostic)
        .finally(() => {
          if (this.requestAbort === abort) this.requestAbort = null;
        });
      if (!this.isCurrent(generation)) return;
      if (matchedIndex === null) {
        this.emitState('no-match', generation);
        return;
      }
      this.emitState('idle', generation);
      try { onMatch(matchedIndex, diagnostic.attemptId); }
      catch (error) { console.error('[SpeechSelectionService] match callback failed', error); }
    } catch (error) {
      if (this.isCurrent(generation)) {
        diagnostic.emit('asr_error', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          httpStatus: speechHttpStatus(error),
        });
        console.warn('[SpeechSelectionService] recognition failed', error);
        this.emitState('error', generation);
      }
    } finally {
      this.clearRecordTimer();
      this.clearRecorderStartTimer();
      this.clearRecorderFlushTimer();
      if (!this.active) this.streams.park(stream);
      if (this.generation === generation) {
        this.active = false;
        this.recorder = null;
        this.recorderReady = false;
        this.pressStartedAt = 0;
        this.recorderStartedAt = 0;
        this.activeDiagnostic = null;
        this.setCaptureActive(false);
        this.stateListener = null;
        this.lastState = null;
      }
    }
  }
  private async captureAudio(
    stream: MediaStream,
    generation: number,
    diagnostic: VoiceAttemptDiagnostics,
  ): Promise<Blob | null> {
    const chunks: Blob[] = [];
    let chunkCount = 0;
    const mimeType = preferredRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    this.recorder = recorder;
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      chunks.push(event.data);
      chunkCount += 1;
    };
    const finished = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('media recorder failed'));
    });
    const markRecorderReady = () => {
      this.clearRecorderStartTimer();
      if (recorder.state !== 'recording' || !this.isCurrent(generation)
        || this.finishRequested || this.recorderReady) return;
      this.recorderReady = true;
      diagnostic.emit('recorder_ready', this.captureTiming());
      this.emitState('listening', generation);
    };
    recorder.onstart = markRecorderReady;
    recorder.start(250);
    this.recorderStartedAt = Date.now();
    this.recorderStartTimer = setTimeout(markRecorderReady, recorderStartFallbackMs);
    this.recordTimer = setTimeout(() => {
      if (recorder.state === 'recording') this.finish();
    }, maxRecordingMs);
    try { await finished; }
    finally {
      this.clearRecordTimer();
      this.clearRecorderStartTimer();
      this.clearRecorderFlushTimer();
      this.streams.park(stream);
      this.setCaptureActive(false);
    }
    if (this.recorder === recorder) this.recorder = null;
    const type = recorder.mimeType || mimeType || chunks[0]?.type || 'audio/webm';
    const audio = new Blob(chunks, { type });
    const timing = this.captureTiming();
    if (audio.size < minimumAudioBytes) {
      if (this.isCurrent(generation)) {
        diagnostic.emit('capture_empty', {
          ...timing,
          audioBytes: audio.size,
          chunkCount,
        });
      }
      return null;
    }
    diagnostic.emit('capture_ready', {
      ...timing,
      audioBytes: audio.size,
      chunkCount,
      mimeType: audio.type,
    });
    return audio;
  }
  private isCurrent(generation: number): boolean {
    return this.active && this.generation === generation;
  }
  private clearRecordTimer(): void {
    if (this.recordTimer !== null) clearTimeout(this.recordTimer);
    this.recordTimer = null;
  }
  private clearRecorderStartTimer(): void {
    if (this.recorderStartTimer !== null) clearTimeout(this.recorderStartTimer);
    this.recorderStartTimer = null;
  }
  private clearRecorderFlushTimer(): void {
    if (this.recorderFlushTimer !== null) clearTimeout(this.recorderFlushTimer);
    this.recorderFlushTimer = null;
  }
  private captureTiming(): { pressMs: number; recordingMs: number } {
    const now = Date.now();
    return {
      pressMs: this.pressStartedAt ? Math.max(0, now - this.pressStartedAt) : 0,
      recordingMs: this.recorderStartedAt ? Math.max(0, now - this.recorderStartedAt) : 0,
    };
  }
  private emitState(state: SpeechState, generation: number): void {
    if (this.generation !== generation || this.lastState === state) return;
    this.lastState = state;
    this.stateListener?.(state);
  }
  private setCaptureActive(active: boolean): void {
    if (this.captureActive === active) return;
    this.captureActive = active;
    try { this.onCaptureActive?.(active); }
    catch { /* audio handling must never block voice input */ }
  }
}
