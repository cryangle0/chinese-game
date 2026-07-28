export interface DomMotionImageOptions {
  readonly fit?: 'contain' | 'cover' | 'fill';
  readonly objectPosition?: string;
  readonly zIndex?: number;
}

export class DomMotionImage {
  readonly element: HTMLImageElement;
  private sourceValue = '';
  private loadedSource = '';

  constructor(
    options: DomMotionImageOptions,
    onReady: () => void,
    onError: () => void,
  ) {
    const image = document.createElement('img');
    image.alt = '';
    Object.assign(image.style, {
      position: 'fixed',
      display: 'none',
      pointerEvents: 'none',
      userSelect: 'none',
      objectFit: options.fit ?? 'contain',
      objectPosition: options.objectPosition ?? 'center',
      zIndex: String(options.zIndex ?? 6),
      maxWidth: 'none',
      maxHeight: 'none',
      transformOrigin: 'center',
    });
    image.addEventListener('load', () => {
      if (!this.matchesCurrentSource()) return;
      this.loadedSource = this.sourceValue;
      onReady();
    });
    image.addEventListener('error', () => {
      this.loadedSource = '';
      onError();
    });
    document.body.appendChild(image);
    this.element = image;
  }

  show(source: string, restart: boolean): { changed: boolean; hadMotion: boolean } {
    const changed = source !== this.sourceValue;
    const hadMotion = Boolean(this.loadedSource) && this.element.style.display !== 'none';
    if (changed || restart) {
      this.sourceValue = source;
      this.loadedSource = '';
      if (restart && !changed) {
        this.element.removeAttribute('src');
        void this.element.offsetWidth;
      }
      this.element.src = source;
    }
    if (this.element.complete && this.element.naturalWidth > 1 && this.matchesCurrentSource()) {
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
    this.element.style.display = visible ? 'block' : 'none';
  }

  dispose(): void {
    this.element.remove();
  }

  private matchesCurrentSource(): boolean {
    if (!this.sourceValue) return false;
    if (this.element.getAttribute('src') === this.sourceValue) return true;
    if (typeof location === 'undefined') return false;
    try {
      const absolute = new URL(this.sourceValue, location.href).href;
      return this.element.currentSrc === absolute || this.element.src === absolute;
    } catch {
      return false;
    }
  }
}
