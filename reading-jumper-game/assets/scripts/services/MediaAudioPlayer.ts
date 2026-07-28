export class MediaAudioPlayer {
  private readonly elements = new Map<string, HTMLAudioElement>();
  private readonly playing = new Set<HTMLAudioElement>();
  private retained = new Set<string>();
  private paused = false;

  preload(url: string): void {
    if (!url || typeof Audio === 'undefined' || this.elements.has(url)) return;
    this.create(url);
  }

  retain(urls: readonly string[]): void {
    this.retained = new Set(urls.filter(Boolean));
    this.elements.forEach((audio, url) => {
      this.releaseIfUnused(url, audio);
    });
  }

  async play(url: string, volume: number, loop = false): Promise<boolean> {
    if (this.paused || typeof Audio === 'undefined') return false;
    const audio = this.elements.get(url) ?? this.create(url);
    audio.volume = Math.max(0, Math.min(1, volume));
    audio.loop = loop;
    if (loop) {
      if (!audio.paused) return true;
      if (audio.ended) audio.currentTime = 0;
    } else {
      audio.currentTime = 0;
    }
    this.playing.add(audio);
    try {
      await audio.play();
      return true;
    } catch {
      return false;
    } finally {
      this.playing.delete(audio);
      this.releaseIfUnused(url, audio);
    }
  }

  async unlock(url: string): Promise<boolean> {
    if (!url || this.paused || typeof Audio === 'undefined') return false;
    const audio = this.elements.get(url) ?? this.create(url);
    const previousVolume = audio.volume;
    audio.volume = 0;
    audio.currentTime = 0;
    this.playing.add(audio);
    try {
      await audio.play();
      audio.pause();
      audio.currentTime = 0;
      return true;
    } catch {
      return false;
    } finally {
      this.playing.delete(audio);
      audio.volume = previousVolume;
      this.releaseIfUnused(url, audio);
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    if (paused) {
      this.elements.forEach((audio, url) => {
        audio.pause();
        this.releaseIfUnused(url, audio);
      });
    }
  }

  stop(url?: string): void {
    this.elements.forEach((audio, key) => {
      if (url && key !== url) return;
      audio.pause();
      audio.currentTime = 0;
      this.releaseIfUnused(key, audio);
    });
  }

  dispose(): void {
    this.elements.forEach((audio) => {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    });
    this.elements.clear();
  }

  private create(url: string): HTMLAudioElement {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = url;
    audio.addEventListener('ended', () => this.releaseIfUnused(url, audio));
    this.elements.set(url, audio);
    return audio;
  }

  private releaseIfUnused(url: string, audio: HTMLAudioElement): void {
    if (this.retained.has(url) || this.playing.has(audio)
      || (!audio.paused && !audio.ended)) return;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    if (this.elements.get(url) === audio) this.elements.delete(url);
  }
}
