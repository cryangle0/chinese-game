export interface DomMotionImageOptions {
  readonly fit?: 'contain' | 'cover' | 'fill';
  readonly objectPosition?: string;
  readonly zIndex?: number;
}

export class DomMotionImage {
  private image: HTMLImageElement;
  private sourceValue = '';
  private playbackSource = '';
  private loadedSource = '';
  private replayCount = 0;

  constructor(
    private readonly options: DomMotionImageOptions,
    private readonly onReady: () => void,
    private readonly onError: () => void,
  ) {
    this.image = this.createElement();
    document.body.appendChild(this.image);
  }

  get element(): HTMLImageElement {
    return this.image;
  }

  private createElement(template?: HTMLImageElement): HTMLImageElement {
    const image = document.createElement('img');
    image.alt = '';
    if (template) {
      image.className = template.className;
      image.dataset.customerMotion = template.dataset.customerMotion ?? '';
      image.style.cssText = template.style.cssText;
    } else {
      Object.assign(image.style, {
        position: 'fixed',
        display: 'none',
        pointerEvents: 'none',
        userSelect: 'none',
        objectFit: this.options.fit ?? 'contain',
        objectPosition: this.options.objectPosition ?? 'center',
        zIndex: String(this.options.zIndex ?? 6),
        maxWidth: 'none',
        maxHeight: 'none',
        transformOrigin: 'center',
        imageRendering: 'auto',
      });
    }
    image.addEventListener('load', () => {
      if (image !== this.image || !this.matchesCurrentSource()) return;
      this.loadedSource = this.sourceValue;
      this.onReady();
    });
    image.addEventListener('error', () => {
      if (image !== this.image) return;
      this.loadedSource = '';
      this.onError();
    });
    return image;
  }

  show(
    source: string,
    restart: boolean,
    isolateTimeline = false,
  ): { changed: boolean; hadMotion: boolean } {
    const changed = source !== this.sourceValue;
    const hadMotion = Boolean(this.loadedSource) && this.image.style.display !== 'none';
    if (changed || restart) {
      this.sourceValue = source;
      this.loadedSource = '';
      if (restart) {
        const previous = this.image;
        this.image = this.createElement(previous);
        previous.replaceWith(this.image);
        this.replayCount += 1;
      }
      this.image.dataset.motionReplay = String(this.replayCount);
      this.playbackSource = isolateTimeline
        ? isolatedPlaybackSource(source, this.replayCount)
        : source;
      this.image.src = this.playbackSource;
    }
    if (this.image.complete && this.image.naturalWidth > 1 && this.matchesCurrentSource()) {
      this.loadedSource = this.sourceValue;
    }
    return { changed, hadMotion };
  }

  source(): string {
    return this.sourceValue;
  }

  ready(): boolean {
    return this.loadedSource === this.sourceValue && Boolean(this.sourceValue);
  }

  setVisible(visible: boolean): void {
    this.image.style.display = visible ? 'block' : 'none';
  }

  dispose(): void {
    this.image.remove();
  }

  private matchesCurrentSource(): boolean {
    if (!this.playbackSource) return false;
    if (this.image.getAttribute('src') === this.playbackSource) return true;
    if (typeof location === 'undefined') return false;
    try {
      const absolute = new URL(this.playbackSource, location.href).href;
      return this.image.currentSrc === absolute || this.image.src === absolute;
    } catch {
      return false;
    }
  }
}

function isolatedPlaybackSource(source: string, replayCount: number): string {
  const hashAt = source.indexOf('#');
  const base = hashAt >= 0 ? source.slice(0, hashAt) : source;
  const hash = hashAt >= 0 ? source.slice(hashAt) : '';
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}motionReplay=${replayCount}${hash}`;
}
