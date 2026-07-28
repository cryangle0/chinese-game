import { matchSpokenOption, matchSpokenTranscripts } from './SpeechOptionMatcher';
import { maxRecordingMs, minimumAudioBytes, preferredRecordingMimeType,
} from './SpeechRecordingSupport';
import { recognizeSpeechAudio, speechHttpStatus } from './SpeechRecognitionAttempt';
import { SpeechStreamPool } from './SpeechStreamPool';
import { VoiceAttemptDiagnostics, VoiceDiagnosticSink } from './VoiceDiagnostics';
export { matchSpokenOption, matchSpokenTranscripts };
export type SpeechState = 'idle' | 'listening' | 'processing'
  | 'unsupported' | 'no-match' | 'error' | 'disabled';
export class SpeechSelectionService {
  private recorder: MediaRecorder | null = null;
  private recordTimer: ReturnType<typeof setTimeout> | null = null;
  private requestAbort: AbortController | null = null;
  private readonly streams: SpeechStreamPool;
  private readonly ownsStreams: boolean;
  private active = false;
  private disposed = false;
  private generation = 0;
  private finishRequested = false;
  constructor(
    private readonly onDiagnostic?: VoiceDiagnosticSink,
    streams?: SpeechStreamPool,
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
    onState('listening');
    // Start getUserMedia in the same gesture turn (iOS WKWebView requirement).
    const gum = this.streams.acquire();
    void this.recordAndRecognize(
      gum, [...options], onMatch, onState, generation, diagnostic,
    );
  }
  finish(): void {
    this.finishRequested = true;
    this.clearRecordTimer();
    this.stopRecorder();
  }
  stop(): void {
    this.generation += 1;
    this.active = false;
    this.finishRequested = false;
    this.clearRecordTimer();
    this.requestAbort?.abort();
    this.requestAbort = null;
    this.stopRecorder();
    this.recorder = null;
    this.streams.park();
  }
  dispose(): void {
    if (this.disposed) return;
    this.stop();
    this.disposed = true;
    if (this.ownsStreams) this.streams.close();
  }
  private stopRecorder(): void {
    const recorder = this.recorder;
    if (recorder?.state === 'recording') {
      try { recorder.stop(); } catch { /* already stopping */ }
    }
  }
  private async recordAndRecognize(
    gum: Promise<MediaStream>, options: readonly string[],
    onMatch: (index: number, attemptId: string) => void,
    onState: (state: SpeechState) => void, generation: number,
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
      const audio = await this.captureAudio(stream);
      if (!this.isCurrent(generation)) return;
      if (!audio) {
        diagnostic.emit('capture_empty', { audioBytes: 0 });
        onState('no-match');
        return;
      }
      diagnostic.emit('capture_ready', {
        audioBytes: audio.size,
        mimeType: audio.type,
      });
      onState('processing');
      const abort = new AbortController();
      this.requestAbort = abort;
      const matchedIndex = await recognizeSpeechAudio(audio, options, abort, diagnostic)
        .finally(() => {
          if (this.requestAbort === abort) this.requestAbort = null;
        });
      if (!this.isCurrent(generation)) return;
      if (matchedIndex === null) {
        onState('no-match');
        return;
      }
      onState('idle');
      try { onMatch(matchedIndex, diagnostic.attemptId); }
      catch (error) { console.error('[SpeechSelectionService] match callback failed', error); }
    } catch (error) {
      if (this.isCurrent(generation)) {
        diagnostic.emit('asr_error', {
          errorName: error instanceof Error ? error.name : 'UnknownError',
          httpStatus: speechHttpStatus(error),
        });
        console.warn('[SpeechSelectionService] recognition failed', error);
        onState('error');
      }
    } finally {
      this.clearRecordTimer();
      if (!this.active) this.streams.park(stream);
      if (this.generation === generation) { this.active = false; this.recorder = null; }
    }
  }
  private async captureAudio(stream: MediaStream): Promise<Blob | null> {
    const chunks: Blob[] = [];
    const mimeType = preferredRecordingMimeType();
    const recorder = mimeType
      ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    this.recorder = recorder;
    recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
    const finished = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve();
      recorder.onerror = () => reject(new Error('media recorder failed'));
    });
    recorder.start(250);
    if (this.finishRequested && recorder.state === 'recording') recorder.stop();
    this.recordTimer = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, maxRecordingMs);
    try { await finished; }
    finally {
      this.clearRecordTimer();
      this.streams.park(stream);
    }
    if (this.recorder === recorder) this.recorder = null;
    const type = recorder.mimeType || mimeType || chunks[0]?.type || 'audio/webm';
    const audio = new Blob(chunks, { type });
    return audio.size >= minimumAudioBytes ? audio : null;
  }
  private isCurrent(generation: number): boolean {
    return this.active && this.generation === generation;
  }
  private clearRecordTimer(): void {
    if (this.recordTimer !== null) clearTimeout(this.recordTimer);
    this.recordTimer = null;
  }
}
