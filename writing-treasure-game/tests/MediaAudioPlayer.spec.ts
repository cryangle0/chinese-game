import { MediaAudioPlayer } from '../assets/scripts/services/MediaAudioPlayer';

class FakeAudio {
  static reject = false;
  static playCalls = 0;
  static readonly instances = new Map<string, FakeAudio>();
  currentTime = 0;
  ended = false;
  loop = false;
  paused = true;
  preload = '';
  volume = 1;
  private source = '';
  private endedListener: (() => void) | null = null;

  get src(): string { return this.source; }
  set src(value: string) {
    this.source = value;
    FakeAudio.instances.set(value, this);
  }

  load(): void {}

  pause(): void {
    this.paused = true;
  }

  play(): Promise<void> {
    FakeAudio.playCalls += 1;
    if (FakeAudio.reject) return Promise.reject(new Error('blocked'));
    this.paused = false;
    return Promise.resolve();
  }

  addEventListener(type: string, listener: () => void): void {
    if (type === 'ended') this.endedListener = listener;
  }

  finish(): void {
    this.ended = true;
    this.endedListener?.();
  }

  removeAttribute(): void {}
}

describe('MediaAudioPlayer', () => {
  const originalAudio = global.Audio;

  beforeEach(() => {
    FakeAudio.reject = false;
    FakeAudio.playCalls = 0;
    FakeAudio.instances.clear();
    global.Audio = FakeAudio as unknown as typeof Audio;
  });

  afterEach(() => {
    global.Audio = originalAudio;
  });

  it('reports browser playback rejection so callers can use a fallback', async () => {
    const player = new MediaAudioPlayer();
    expect(await player.play('/ok.wav', 0.5)).toBe(true);
    FakeAudio.reject = true;
    expect(await player.play('/blocked.wav', 1)).toBe(false);
    player.dispose();
  });

  it('performs a silent user-gesture unlock and pauses cleanly', async () => {
    const player = new MediaAudioPlayer();
    expect(await player.unlock('/unlock.wav')).toBe(true);
    player.setPaused(true);
    expect(await player.play('/later.wav', 1)).toBe(false);
    player.dispose();
  });

  it('preloads each media URL only once', () => {
    const player = new MediaAudioPlayer();
    player.preload('/next.mp3');
    player.preload('/next.mp3');
    expect(FakeAudio.instances.size).toBe(1);
    expect(FakeAudio.instances.get('/next.mp3')?.preload).toBe('metadata');
    player.dispose();
  });

  it('resumes a paused loop from its previous position', async () => {
    const player = new MediaAudioPlayer();
    player.retain(['/bgm.mp3']);
    await player.play('/bgm.mp3', 0.2, true);
    const bgm = FakeAudio.instances.get('/bgm.mp3');
    if (bgm) bgm.currentTime = 37;
    player.setPaused(true);
    player.setPaused(false);
    await player.play('/bgm.mp3', 0.2, true);
    expect(bgm?.currentTime).toBe(37);
    expect(FakeAudio.playCalls).toBe(2);
    player.dispose();
  });

  it('releases media elements that are no longer retained by the active themes', async () => {
    const player = new MediaAudioPlayer();
    player.preload('/keep.mp3');
    player.preload('/release.mp3');
    const released = FakeAudio.instances.get('/release.mp3');

    player.retain(['/keep.mp3']);
    await player.play('/release.mp3', 1);

    expect(released?.paused).toBe(true);
    expect(FakeAudio.instances.get('/release.mp3')).not.toBe(released);
    player.dispose();
  });

  it('keeps a playing transition until it ends, then releases it', async () => {
    const player = new MediaAudioPlayer();
    await player.play('/transition.mp3', 0.8);
    const transition = FakeAudio.instances.get('/transition.mp3');

    player.retain(['/next.mp3']);
    expect(transition?.paused).toBe(false);
    transition?.finish();
    await player.play('/transition.mp3', 0.8);

    expect(FakeAudio.instances.get('/transition.mp3')).not.toBe(transition);
    player.dispose();
  });
});
