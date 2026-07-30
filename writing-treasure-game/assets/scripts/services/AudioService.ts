import {
  AudioCatalog, AudioDefinition, AudioTheme, defaultAudioCatalog, MusicName, SoundName,
} from './AudioCatalog';
import { MediaAudioPlayer } from './MediaAudioPlayer';
import { playTone } from './TonePlayer';
export type { SoundName } from './AudioCatalog';
const musicNames: readonly MusicName[] = ['bgm', 'ambient'];
const voiceCaptureMusicMultiplier = 0.08;
const voiceCaptureRestoreDelayMs = 280;
export class AudioService {
  private context: AudioContext | null = null;
  private readonly media = new MediaAudioPlayer();
  private enabled = true;
  private paused = false;
  private pending: SoundName | null = null;
  private gestureHandler: (() => void) | null = null;
  private contextResuming = false;
  private mediaUnlocking = false;
  private mediaUnlocked = false;
  private disposed = false;
  private theme: AudioTheme = {}; private musicRequested = false;
  private voiceCaptureActive = false;
  private voiceCaptureRestoreTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly catalog: AudioCatalog = defaultAudioCatalog) {
    this.bindUnlockGesture();
  }
  unlock(): void {
    const audioGlobal = globalThis as typeof globalThis & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextClass = audioGlobal.AudioContext ?? audioGlobal.webkitAudioContext;
    if (this.disposed || !this.enabled || this.paused || !AudioContextClass) return;
    this.context ??= new AudioContextClass();
    const unlockUrl = this.definition('unlock').url;
    if (unlockUrl && !this.mediaUnlocked && !this.mediaUnlocking) {
      this.mediaUnlocking = true;
      void this.media.unlock(unlockUrl)
        .then((unlocked) => { this.mediaUnlocked ||= unlocked; })
        .finally(() => { this.mediaUnlocking = false; });
    }
    if (this.context.state === 'suspended') {
      this.resumeContext();
      return;
    }
    this.flushPending();
  }

  play(name: SoundName): void {
    if (this.disposed || !this.enabled || this.paused) return;
    this.unlock();
    void this.playDefinition(name);
  }

  private async playDefinition(name: SoundName): Promise<void> {
    const definition = this.definition(name);
    if (definition.url
      && await this.media.play(definition.url, definition.volume ?? 1)) return;
    const context = this.context;
    if (!context || context.state !== 'running') {
      if (definition.tone) this.pending = name;
      return;
    }
    playTone(context, definition);
  }
  playMusic(): void {
    this.musicRequested = true;
    if (this.disposed || !this.enabled || this.paused) return;
    for (const name of musicNames) {
      const music = this.definition(name);
      if (music.url) void this.media.play(music.url, this.musicVolume(name), true);
    }
  }

  setVoiceCaptureActive(active: boolean): void {
    if (this.disposed) return;
    this.clearVoiceCaptureRestoreTimer();
    if (active) {
      this.voiceCaptureActive = true;
      this.applyMusicVolumes();
      return;
    }
    if (!this.voiceCaptureActive) return;
    this.voiceCaptureRestoreTimer = setTimeout(() => {
      this.voiceCaptureRestoreTimer = null;
      if (this.disposed) return;
      this.voiceCaptureActive = false;
      this.applyMusicVolumes();
    }, voiceCaptureRestoreDelayMs);
  }

  setTheme(theme: AudioTheme = {}): void {
    if (this.disposed) return;
    const previousMusic = new Map(musicNames.map((name) => [name, this.definition(name).url]));
    this.theme = theme;
    let changed = false;
    for (const name of musicNames) {
      const previousUrl = previousMusic.get(name);
      const nextUrl = this.definition(name).url;
      if (previousUrl === nextUrl) continue;
      changed = true;
      if (previousUrl) this.media.stop(previousUrl);
    }
    this.media.retain(
      Object.values({ ...this.catalog, ...theme })
        .flatMap((definition) => definition?.url ? [definition.url] : []),
    );
    this.preload(theme);
    if (changed && this.musicRequested) this.playMusic();
    else this.applyMusicVolumes();
  }

  preload(theme: AudioTheme): void {
    if (this.disposed) return;
    Object.values(theme).forEach((definition) => {
      if (definition?.url) this.media.preload(definition.url);
    });
  }

  setEnabled(enabled: boolean): void {
    if (this.disposed) return;
    this.enabled = enabled;
    if (!enabled) this.pending = null;
    this.media.setPaused(!enabled || this.paused);
    if (enabled) {
      this.unlock();
      this.playMusic();
    }
  }

  isEnabled(): boolean { return this.enabled; }
  setPaused(paused: boolean): void {
    if (this.disposed) return;
    this.paused = paused;
    this.media.setPaused(paused);
    if (!this.context) return;
    if (paused && this.context.state === 'running') {
      void this.context.suspend()
        .then(() => {
          if (!this.paused) this.resumeContext();
        })
        .catch(() => undefined);
    }
    if (!paused && this.enabled) {
      this.resumeContext();
      this.playMusic();
    }
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.pending = null;
    this.clearVoiceCaptureRestoreTimer();
    this.unbindUnlockGesture();
    this.media.dispose();
    const context = this.context;
    this.context = null;
    if (context && context.state !== 'closed') void context.close();
  }

  private resumeContext(): void {
    const context = this.context;
    if (this.disposed || !this.enabled || this.paused || this.contextResuming
      || !context || context.state !== 'suspended') return;
    this.contextResuming = true;
    void context.resume()
      .then(() => {
        if (!this.disposed && !this.paused) this.flushPending();
      })
      .catch(() => undefined)
      .finally(() => { this.contextResuming = false; });
  }

  private flushPending(): void {
    const pending = this.pending;
    this.pending = null;
    if (pending) this.play(pending);
  }

  private definition(name: SoundName | MusicName): AudioDefinition {
    return this.theme[name] ?? this.catalog[name];
  }
  private musicVolume(name: MusicName): number {
    const volume = this.definition(name).volume ?? 0.25;
    return this.voiceCaptureActive ? volume * voiceCaptureMusicMultiplier : volume;
  }
  private applyMusicVolumes(): void {
    for (const name of musicNames) {
      const music = this.definition(name);
      if (music.url) this.media.setVolume(music.url, this.musicVolume(name));
    }
  }
  private clearVoiceCaptureRestoreTimer(): void {
    if (this.voiceCaptureRestoreTimer !== null) {
      clearTimeout(this.voiceCaptureRestoreTimer);
    }
    this.voiceCaptureRestoreTimer = null;
  }
  private bindUnlockGesture(): void {
    if (typeof document === 'undefined') return;
    this.gestureHandler = () => {
      this.unlock();
      this.unbindUnlockGesture();
    };
    document.addEventListener('pointerdown', this.gestureHandler, { capture: true, passive: true });
    document.addEventListener('touchend', this.gestureHandler, { capture: true, passive: true });
    document.addEventListener('keydown', this.gestureHandler, { capture: true });
  }

  private unbindUnlockGesture(): void {
    if (!this.gestureHandler || typeof document === 'undefined') return;
    document.removeEventListener('pointerdown', this.gestureHandler, true);
    document.removeEventListener('touchend', this.gestureHandler, true);
    document.removeEventListener('keydown', this.gestureHandler, true);
    this.gestureHandler = null;
  }
}
