import { speechAudioConstraints } from './SpeechRecordingSupport';

function normalizeStreamError(error: unknown): Error {
  const record = error && typeof error === 'object'
    ? error as { readonly message?: unknown; readonly name?: unknown }
    : {};
  const failure = error instanceof Error
    ? error
    : new Error(typeof record.message === 'string' ? record.message : String(error));
  if (typeof record.name === 'string') failure.name = record.name;
  return failure;
}

export class SpeechStreamPool {
  private stream: MediaStream | null = null;
  private task: Promise<MediaStream> | null = null;
  private permissionFailure: Error | null = null;
  private disposed = false;

  acquire(): Promise<MediaStream> {
    if (this.disposed) return Promise.reject(new Error('speech stream pool disposed'));
    if (this.permissionFailure) return Promise.reject(this.permissionFailure);
    const live = this.stream?.getTracks().some((track) => track.readyState !== 'ended') ?? false;
    if (this.stream && live) {
      this.stream.getTracks().forEach((track) => { track.enabled = true; });
      return Promise.resolve(this.stream);
    }
    if (this.stream) this.disposeStream(this.stream);
    this.stream = null;
    if (this.task) return this.task;
    const task = navigator.mediaDevices.getUserMedia({ audio: speechAudioConstraints })
      .then((stream) => {
        if (this.disposed) {
          this.disposeStream(stream);
          throw new Error('speech service disposed');
        }
        this.stream = stream;
        return stream;
      })
      .catch((error: unknown) => {
        const failure = normalizeStreamError(error);
        if (failure.name === 'NotAllowedError' || failure.name === 'SecurityError') {
          this.permissionFailure = failure;
        }
        throw failure;
      })
      .finally(() => {
        if (this.task === task) this.task = null;
      });
    this.task = task;
    return task;
  }

  park(stream: MediaStream | null = this.stream): void {
    if (!stream) return;
    // A disabled live track can keep Windows/mobile audio in communications mode.
    // Stop it so output routing and volume are restored as soon as recording ends.
    this.disposeStream(stream);
    if (this.stream === stream) this.stream = null;
  }

  disposeStream(stream: MediaStream | null): void {
    stream?.getTracks().forEach((track) => {
      if (track.readyState === 'ended') return;
      track.enabled = false;
      track.stop();
    });
  }

  close(): void {
    this.disposed = true;
    this.disposeStream(this.stream);
    this.stream = null;
  }
}
