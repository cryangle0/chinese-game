export interface DomMotionImageOptions {
  readonly fit?: 'contain' | 'cover' | 'fill';
  readonly objectPosition?: string;
  readonly zIndex?: number;
}

const PLAYBACK_SESSION = createPlaybackSession();
let isolatedPlaybackSerial = 0;

export class DomMotionImage {
  private image: HTMLImageElement;
  private sourceValue = '';
  private playbackSource = '';
  private loadedSource = '';
  private replayCount = 0;
  private playbackGeneration = 0;
  private sourceAssignmentFrame = 0;

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
      if (!this.matchesGeneration(image) || !this.matchesCurrentSource(image)) return;
      this.loadedSource = this.sourceValue;
      this.onReady();
    });
    image.addEventListener('error', () => {
      if (!this.matchesGeneration(image)) return;
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
      this.cancelSourceAssignment();
      this.sourceValue = source;
      this.loadedSource = '';
      this.playbackGeneration += 1;
      if (restart) {
        // Reusing one <img> for a completed animated WebP is unreliable in
        // Chromium/WebView: assigning the same URL can retain its final frame.
        // Use a fresh element so the current DOM node has no retained state.
        const previous = this.image;
        previous.removeAttribute('src');
        this.image = this.createElement(previous);
        previous.replaceWith(this.image);
        this.replayCount += 1;
      }
      this.image.dataset.motionReplay = String(this.replayCount);
      this.image.dataset.motionGeneration = String(this.playbackGeneration);
      // Prefetched animated WebPs can still share a completed decoder timeline
      // with fresh elements. Strict playback uses a unique request URL so the
      // browser starts a new animation timeline at frame 1.
      this.playbackSource = isolateTimeline
        ? isolatedPlaybackSource(source, this.replayCount, this.playbackGeneration)
        : source;
      this.assignPlaybackSource(isolateTimeline);
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
    this.cancelSourceAssignment();
    this.image.removeAttribute('src');
    this.image.remove();
  }

  private assignPlaybackSource(deferOneFrame: boolean): void {
    const image = this.image;
    const source = this.playbackSource;
    const generation = this.playbackGeneration;
    const assign = (): void => {
      this.sourceAssignmentFrame = 0;
      if (image !== this.image || generation !== this.playbackGeneration) return;
      image.src = source;
      if (image.complete
        && image.naturalWidth > 1
        && this.matchesGeneration(image)
        && this.matchesCurrentSource(image)) {
        this.loadedSource = this.sourceValue;
        this.onReady();
      }
    };
    if (deferOneFrame && typeof requestAnimationFrame === 'function') {
      this.sourceAssignmentFrame = requestAnimationFrame(assign);
      return;
    }
    assign();
  }

  private cancelSourceAssignment(): void {
    if (!this.sourceAssignmentFrame) return;
    cancelAnimationFrame(this.sourceAssignmentFrame);
    this.sourceAssignmentFrame = 0;
  }

  private matchesGeneration(image: HTMLImageElement): boolean {
    return image === this.image
      && image.dataset.motionGeneration === String(this.playbackGeneration);
  }

  private matchesCurrentSource(image = this.image): boolean {
    if (!this.playbackSource) return false;
    if (image.getAttribute('src') === this.playbackSource) return true;
    if (typeof location === 'undefined') return false;
    try {
      const absolute = new URL(this.playbackSource, location.href).href;
      return image.currentSrc === absolute || image.src === absolute;
    } catch {
      return false;
    }
  }
}

function isolatedPlaybackSource(
  source: string,
  replayCount: number,
  generation: number,
): string {
  const hashAt = source.indexOf('#');
  const base = hashAt >= 0 ? source.slice(0, hashAt) : source;
  const hash = hashAt >= 0 ? source.slice(hashAt) : '';
  const separator = base.includes('?') ? '&' : '?';
  isolatedPlaybackSerial += 1;
  return `${base}${separator}motionReplay=${replayCount}`
    + `&motionSession=${PLAYBACK_SESSION}`
    + `&motionNonce=${generation}-${isolatedPlaybackSerial}${hash}`;
}

function createPlaybackSession(): string {
  const now = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `${now}-${random}`;
}
