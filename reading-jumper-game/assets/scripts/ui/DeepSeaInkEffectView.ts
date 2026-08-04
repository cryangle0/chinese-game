import { resolveMotionStageFrame } from '../core/media/DomMotionLayout';
import { AppConfig } from '../shared/config/AppConfig';

export interface DeepSeaInkTarget {
  readonly columnX: number;
  readonly headY: number;
}

export interface DeepSeaInkRuntime {
  readonly document: Document;
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly loadImage: (source: string) => Promise<void>;
}

export interface DeepSeaInkGeometry {
  readonly target: { readonly x: number; readonly y: number };
  readonly viewportCenter: { readonly x: number; readonly y: number };
  readonly viewportTopLeft: { readonly x: number; readonly y: number };
  readonly bodyTopRight: { readonly x: number; readonly y: number };
  readonly sprayHit: { readonly x: number; readonly y: number };
}

export interface ReadingFeedbackReadyView {
  setFeedbackVisible(visible: boolean): void;
  playDeepSeaInk(columnX: number): void;
}

const FRAME_COUNT = 26;
const FRAME_WIDTH = 256;
const FRAME_HEIGHT = 256;
const COLUMNS = 5;
const ROWS = 6;
const FPS = 15;
const FRAME_MS = 1000 / FPS;
const PLAYBACK_MS = FRAME_COUNT * FRAME_MS;
const BODY_OFFSET_X = 90;
const BODY_OFFSET_Y = -75;
const BODY_TOP_RIGHT_X = 248;
const BODY_TOP_RIGHT_Y = 8;
const HEAD_FROM_FEEDBACK_CENTER_Y = 7;
const EFFECT_Z_INDEX = 37;
const SHEET_SOURCE = './media/reward-props/deep-sea/ink-squid-sheet.png';
const DYNAMIC_BODY_DIAGNOSTICS = [
  'deepSeaInkFrame',
  'deepSeaInkTarget',
  'deepSeaInkSprayHit',
  'deepSeaInkBodyTopRight',
  'deepSeaInkViewportCenter',
  'deepSeaInkFps',
  'deepSeaInkFrameCount',
] as const;

export function deepSeaInkTarget(columnX: number, feedbackY: number): DeepSeaInkTarget {
  return {
    columnX,
    headY: AppConfig.designHeight / 2 - feedbackY + HEAD_FROM_FEEDBACK_CENTER_Y,
  };
}

export function deepSeaInkGeometry(target: DeepSeaInkTarget): DeepSeaInkGeometry {
  const targetX = AppConfig.designWidth / 2 + target.columnX;
  const viewportCenter = {
    x: targetX + BODY_OFFSET_X,
    y: target.headY + BODY_OFFSET_Y,
  };
  const viewportTopLeft = {
    x: viewportCenter.x - FRAME_WIDTH / 2,
    y: viewportCenter.y - FRAME_HEIGHT / 2,
  };
  return {
    target: { x: targetX, y: target.headY },
    viewportCenter,
    viewportTopLeft,
    bodyTopRight: {
      x: viewportTopLeft.x + BODY_TOP_RIGHT_X,
      y: viewportTopLeft.y + BODY_TOP_RIGHT_Y,
    },
    // The late-frame stream crosses this local point (38, 203), so aligning it
    // with the measured head target keeps the squid itself above and to the right.
    sprayHit: {
      x: viewportTopLeft.x + FRAME_WIDTH / 2 - BODY_OFFSET_X,
      y: viewportTopLeft.y + FRAME_HEIGHT / 2 - BODY_OFFSET_Y,
    },
  };
}

export function createReadingFeedbackReadyHandler(
  view: ReadingFeedbackReadyView,
  themeId: string,
  correct: boolean,
  columnX: number,
): () => void {
  return () => {
    view.setFeedbackVisible(true);
    if (themeId === 'deep-sea' && !correct) view.playDeepSeaInk(columnX);
  };
}

export class DeepSeaInkEffectView {
  private readonly element: HTMLDivElement | null;
  private sheetReady: Promise<boolean> | null = null;
  private animationFrame = 0;
  private runId = 0;
  private disposed = false;

  constructor(private readonly runtime: DeepSeaInkRuntime | null = browserRuntime()) {
    if (!runtime) {
      this.element = null;
      return;
    }
    this.element = runtime.document.createElement('div');
    this.element.id = 'DeepSeaInkEffect';
    this.element.dataset.deepSeaInkEffect = '1';
    this.element.setAttribute('aria-hidden', 'true');
    Object.assign(this.element.style, {
      position: 'fixed',
      display: 'none',
      overflow: 'hidden',
      pointerEvents: 'none',
      userSelect: 'none',
      backgroundImage: `url("${SHEET_SOURCE}")`,
      backgroundRepeat: 'no-repeat',
      zIndex: String(EFFECT_Z_INDEX),
      maxWidth: 'none',
      maxHeight: 'none',
      imageRendering: 'auto',
    });
  }

  play(target: DeepSeaInkTarget): void {
    if (this.disposed || !this.runtime || !this.element) return;
    this.stopActive();
    const runId = this.runId;
    void this.ensureSheetReady().then((ready) => {
      if (!ready || runId !== this.runId || this.disposed) return;
      const canvas = this.runtime!.document
        .getElementById('GameCanvas') as HTMLCanvasElement | null;
      if (!canvas || typeof canvas.getBoundingClientRect !== 'function') return;
      this.startPlayback(canvas, target, runId);
    });
  }

  private ensureSheetReady(): Promise<boolean> {
    if (this.sheetReady) return this.sheetReady;
    if (!this.runtime || this.disposed) return Promise.resolve(false);
    const attempt = this.runtime.loadImage(SHEET_SOURCE).then(
      () => true,
      () => false,
    );
    this.sheetReady = attempt;
    void attempt.then((ready) => {
      if (!ready && this.sheetReady === attempt) this.sheetReady = null;
    });
    return attempt;
  }

  hide(): void {
    this.stopActive();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopActive();
  }

  private startPlayback(
    canvas: HTMLCanvasElement,
    target: DeepSeaInkTarget,
    runId: number,
  ): void {
    if (!this.runtime || !this.element || runId !== this.runId || this.disposed) return;
    if (!this.element.isConnected) this.runtime.document.body.appendChild(this.element);
    this.element.style.display = 'block';
    const startedAt = this.runtime.now();
    this.renderFrame(canvas, target, 0);
    this.markActive(target);

    const tick = (now: number): void => {
      if (runId !== this.runId || this.disposed) return;
      this.animationFrame = 0;
      const elapsed = Math.max(0, now - startedAt);
      if (elapsed >= PLAYBACK_MS) {
        this.stopActive();
        return;
      }
      const frameIndex = Math.min(FRAME_COUNT - 1, Math.floor(elapsed / FRAME_MS));
      this.renderFrame(canvas, target, frameIndex);
      this.animationFrame = this.runtime!.requestFrame(tick);
    };
    this.animationFrame = this.runtime.requestFrame(tick);
  }

  private renderFrame(
    canvas: HTMLCanvasElement,
    target: DeepSeaInkTarget,
    frameIndex: number,
  ): void {
    if (!this.element) return;
    const stage = resolveMotionStageFrame(canvas);
    const geometry = deepSeaInkGeometry(target);
    const column = frameIndex % COLUMNS;
    const row = Math.floor(frameIndex / COLUMNS);
    const backgroundX = column === 0 ? 0 : -column * FRAME_WIDTH * stage.scale;
    const backgroundY = row === 0 ? 0 : -row * FRAME_HEIGHT * stage.scale;
    Object.assign(this.element.style, {
      left: `${stage.left + geometry.viewportTopLeft.x * stage.scale}px`,
      top: `${stage.top + geometry.viewportTopLeft.y * stage.scale}px`,
      width: `${FRAME_WIDTH * stage.scale}px`,
      height: `${FRAME_HEIGHT * stage.scale}px`,
      backgroundSize: `${COLUMNS * FRAME_WIDTH * stage.scale}px `
        + `${ROWS * FRAME_HEIGHT * stage.scale}px`,
      backgroundPosition: `${backgroundX}px ${backgroundY}px`,
    });
    this.element.dataset.deepSeaInkFrame = String(frameIndex);
    this.element.dataset.deepSeaInkTarget = pointText(geometry.target);
    this.element.dataset.deepSeaInkSprayHit = pointText(geometry.sprayHit);
    if (this.runtime) {
      this.runtime.document.body.dataset.deepSeaInkFrame = String(frameIndex);
    }
  }

  private markActive(target: DeepSeaInkTarget): void {
    if (!this.runtime) return;
    const geometry = deepSeaInkGeometry(target);
    Object.assign(this.runtime.document.body.dataset, {
      deepSeaInkActive: 'true',
      deepSeaInkTarget: pointText(geometry.target),
      deepSeaInkSprayHit: pointText(geometry.sprayHit),
      deepSeaInkBodyTopRight: pointText(geometry.bodyTopRight),
      deepSeaInkViewportCenter: pointText(geometry.viewportCenter),
      deepSeaInkFps: String(FPS),
      deepSeaInkFrameCount: String(FRAME_COUNT),
    });
  }

  private stopActive(): void {
    this.runId += 1;
    if (this.animationFrame && this.runtime) this.runtime.cancelFrame(this.animationFrame);
    this.animationFrame = 0;
    if (this.element) {
      this.element.style.display = 'none';
      this.element.remove();
    }
    if (this.runtime) {
      const dataset = this.runtime.document.body.dataset;
      dataset.deepSeaInkActive = 'false';
      DYNAMIC_BODY_DIAGNOSTICS.forEach((field) => {
        delete dataset[field];
      });
    }
  }
}

function browserRuntime(): DeepSeaInkRuntime | null {
  if (
    typeof document === 'undefined'
    || typeof requestAnimationFrame !== 'function'
    || typeof cancelAnimationFrame !== 'function'
  ) {
    return null;
  }
  return {
    document,
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    loadImage: (source) => loadDecodedImage(source),
  };
}

function loadDecodedImage(source: string): Promise<void> {
  const image = new Image();
  if (typeof image.decode === 'function') {
    image.src = source;
    return image.decode();
  }
  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => resolve(), { once: true });
    image.addEventListener('error', () => reject(new Error(`Failed to load ${source}`)), {
      once: true,
    });
    image.src = source;
  });
}

function pointText(point: { readonly x: number; readonly y: number }): string {
  return `${point.x},${point.y}`;
}
