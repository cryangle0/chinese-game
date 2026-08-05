import { resolveMotionStageFrame } from '../core/media/DomMotionLayout';
import { AppConfig } from '../shared/config/AppConfig';

interface DeepSeaInkOptionLayout {
  readonly width: number;
  readonly height: number;
  readonly y: number;
}

interface DeepSeaInkFeedbackLayout {
  readonly width: number;
  readonly height: number;
  readonly y: number;
}

export interface DeepSeaInkTarget {
  readonly columnX: number;
  readonly option: DeepSeaInkOptionLayout;
  readonly feedback: DeepSeaInkFeedbackLayout;
}

export interface DeepSeaInkRuntime {
  readonly document: Document;
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly loadImage: (source: string) => Promise<CanvasImageSource>;
}

export interface DeepSeaInkGeometry {
  readonly target: { readonly x: number; readonly y: number };
  readonly characterHeadBounds: {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
  };
  readonly optionTopRight: { readonly x: number; readonly y: number };
  readonly viewportCenter: { readonly x: number; readonly y: number };
  readonly viewportTopLeft: { readonly x: number; readonly y: number };
  readonly bodyTopRight: { readonly x: number; readonly y: number };
  readonly sprayViewportTopLeft: { readonly x: number; readonly y: number };
  readonly sprayBodyTopRight: { readonly x: number; readonly y: number };
  readonly sprayHit: { readonly x: number; readonly y: number };
}

export interface ReadingFeedbackReadyView {
  setFeedbackVisible(visible: boolean): void;
}

type DeepSeaInkPhase = 'idle' | 'popup' | 'hold' | 'reposition' | 'spray' | 'impact';

const FRAME_COUNT = 26;
const FRAME_WIDTH = 261;
const FRAME_HEIGHT = 241;
const POPUP_END_FRAME = 8;
const REPOSITION_FRAME = 12;
const SPRAY_START_FRAME = 13;
const FPS = 24;
const FRAME_MS = 1000 / FPS;
const SPRAY_REPOSITION_MS = 100;
const SPRAY_IMPACT_HOLD_MS = 180;
const BODY_TOP_RIGHT_X = FRAME_WIDTH - 1;
const BODY_TOP_RIGHT_Y = 0;
const POP_ABOVE_OPTION_Y = 18;
const SPRAY_HIT_X = 45;
const SPRAY_HIT_Y = 235;
const FEEDBACK_HEAD_TARGET_X_OFFSET = 5;
const FEEDBACK_HEAD_TARGET_Y_OFFSET = 98;
const FEEDBACK_HEAD_HALF_WIDTH_FACTOR = 0.25;
const FEEDBACK_HEAD_TOP_FACTOR = 0.145;
const FEEDBACK_HEAD_BOTTOM_FACTOR = 0.13;
const EFFECT_Z_INDEX = 37;
const FRAME_ROOT = './media/reward-props/deep-sea/ink-squid-frames';
const FRAME_SOURCES = Array.from(
  { length: FRAME_COUNT },
  (_, index) => `${FRAME_ROOT}/frame-${String(index).padStart(2, '0')}.png`,
);
const DYNAMIC_BODY_DIAGNOSTICS = [
  'deepSeaInkFrame',
  'deepSeaInkFrameSource',
  'deepSeaInkPhase',
  'deepSeaInkTarget',
  'deepSeaInkSprayHit',
  'deepSeaInkBodyTopRight',
  'deepSeaInkSprayBodyTopRight',
  'deepSeaInkOptionTopRight',
  'deepSeaInkCharacterHeadBounds',
  'deepSeaInkViewportCenter',
  'deepSeaInkViewportTopLeft',
  'deepSeaInkSprayViewportTopLeft',
  'deepSeaInkFps',
  'deepSeaInkFrameCount',
] as const;

export function deepSeaInkTarget(
  columnX: number,
  option: DeepSeaInkOptionLayout,
  feedback: DeepSeaInkFeedbackLayout,
): DeepSeaInkTarget {
  return { columnX, option, feedback };
}

export function deepSeaInkGeometry(target: DeepSeaInkTarget): DeepSeaInkGeometry {
  const columnCenterX = AppConfig.designWidth / 2 + target.columnX;
  const optionTopRight = {
    x: columnCenterX + target.option.width / 2,
    y: AppConfig.designHeight / 2 - (
      target.option.y + target.option.height / 2
    ),
  };
  const bodyTopRight = {
    x: optionTopRight.x,
    y: optionTopRight.y - POP_ABOVE_OPTION_Y,
  };
  const viewportTopLeft = {
    x: bodyTopRight.x - BODY_TOP_RIGHT_X,
    y: bodyTopRight.y - BODY_TOP_RIGHT_Y,
  };
  const feedbackCenterY = AppConfig.designHeight / 2 - target.feedback.y;
  const feedbackHeadTarget = {
    x: columnCenterX + FEEDBACK_HEAD_TARGET_X_OFFSET,
    y: feedbackCenterY + FEEDBACK_HEAD_TARGET_Y_OFFSET,
  };
  const sprayViewportTopLeft = {
    x: feedbackHeadTarget.x - SPRAY_HIT_X,
    y: feedbackHeadTarget.y - SPRAY_HIT_Y,
  };
  const characterHeadBounds = {
    left: columnCenterX - target.feedback.width * FEEDBACK_HEAD_HALF_WIDTH_FACTOR,
    top: feedbackHeadTarget.y - target.feedback.height * FEEDBACK_HEAD_TOP_FACTOR,
    right: columnCenterX + target.feedback.width * FEEDBACK_HEAD_HALF_WIDTH_FACTOR,
    bottom: feedbackHeadTarget.y + target.feedback.height * FEEDBACK_HEAD_BOTTOM_FACTOR,
  };
  return {
    target: feedbackHeadTarget,
    characterHeadBounds,
    optionTopRight,
    viewportCenter: {
      x: viewportTopLeft.x + FRAME_WIDTH / 2,
      y: viewportTopLeft.y + FRAME_HEIGHT / 2,
    },
    viewportTopLeft,
    bodyTopRight,
    sprayViewportTopLeft,
    sprayBodyTopRight: {
      x: sprayViewportTopLeft.x + BODY_TOP_RIGHT_X,
      y: sprayViewportTopLeft.y + BODY_TOP_RIGHT_Y,
    },
    sprayHit: {
      x: sprayViewportTopLeft.x + SPRAY_HIT_X,
      y: sprayViewportTopLeft.y + SPRAY_HIT_Y,
    },
  };
}

export function createReadingFeedbackReadyHandler(
  view: ReadingFeedbackReadyView,
  afterReady?: () => void,
): () => void {
  return () => {
    view.setFeedbackVisible(true);
    afterReady?.();
  };
}

export class DeepSeaInkEffectView {
  private readonly element: HTMLCanvasElement | null;
  private readonly context: CanvasRenderingContext2D | null;
  private framesReady: Promise<boolean> | null = null;
  private frames: readonly CanvasImageSource[] = [];
  private animationFrame = 0;
  private runId = 0;
  private lastDrawnFrame = -1;
  private target: DeepSeaInkTarget | null = null;
  private stageCanvas: HTMLCanvasElement | null = null;
  private phase: DeepSeaInkPhase = 'idle';
  private disposed = false;

  constructor(private readonly runtime: DeepSeaInkRuntime | null = browserRuntime()) {
    if (!runtime) {
      this.element = null;
      this.context = null;
      return;
    }
    const element = runtime.document.createElement('canvas');
    const context = element.getContext('2d');
    if (!context) {
      this.element = null;
      this.context = null;
      return;
    }
    this.element = element;
    this.context = context;
    this.element.id = 'DeepSeaInkEffect';
    this.element.width = FRAME_WIDTH;
    this.element.height = FRAME_HEIGHT;
    this.element.dataset.deepSeaInkEffect = '1';
    this.element.setAttribute('aria-hidden', 'true');
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
    Object.assign(this.element.style, {
      position: 'fixed',
      display: 'none',
      overflow: 'hidden',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: String(EFFECT_Z_INDEX),
      maxWidth: 'none',
      maxHeight: 'none',
      imageRendering: 'auto',
    });
  }

  preload(): void {
    if (this.disposed) return;
    void this.ensureFramesReady();
  }

  playPopup(target: DeepSeaInkTarget, onComplete: () => void): void {
    if (this.disposed || !this.runtime || !this.element || !this.context) {
      onComplete();
      return;
    }
    this.stopActive();
    const runId = this.runId;
    void this.ensureFramesReady().then((ready) => {
      if (runId !== this.runId || this.disposed) return;
      if (!ready) {
        this.markLoadFailure();
        onComplete();
        return;
      }
      const canvas = this.runtime!.document
        .getElementById('GameCanvas') as HTMLCanvasElement | null;
      if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
        onComplete();
        return;
      }
      this.target = target;
      this.stageCanvas = canvas;
      this.phase = 'popup';
      if (!this.element!.isConnected) this.runtime!.document.body.appendChild(this.element!);
      this.renderFrame(canvas, target, 0, deepSeaInkGeometry(target).viewportTopLeft);
      this.element!.style.display = 'block';
      this.markActive(target);
      this.playFrames(
        canvas,
        target,
        0,
        POPUP_END_FRAME,
        deepSeaInkGeometry(target).viewportTopLeft,
        runId,
        () => {
          this.phase = 'hold';
          this.markPhase();
          onComplete();
        },
      );
    });
  }

  playSpray(onComplete: () => void): void {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.context
      || !this.target
      || !this.stageCanvas
      || this.phase !== 'hold'
    ) {
      onComplete();
      return;
    }
    const runId = this.runId;
    const geometry = deepSeaInkGeometry(this.target);
    this.phase = 'reposition';
    this.markPhase();
    this.animateAnchor(
      this.stageCanvas,
      this.target,
      geometry.viewportTopLeft,
      geometry.sprayViewportTopLeft,
      runId,
      () => {
        if (
          runId !== this.runId
          || this.disposed
          || !this.stageCanvas
          || !this.target
        ) return;
        this.phase = 'spray';
        this.markPhase();
        this.playFrames(
          this.stageCanvas,
          this.target,
          SPRAY_START_FRAME,
          FRAME_COUNT - 1,
          geometry.sprayViewportTopLeft,
          runId,
          () => this.holdImpact(runId, onComplete),
        );
      },
    );
  }

  hide(): void {
    this.stopActive();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopActive();
  }

  private ensureFramesReady(): Promise<boolean> {
    if (this.framesReady) return this.framesReady;
    if (!this.runtime || this.disposed) return Promise.resolve(false);
    const attempt = Promise.all(
      FRAME_SOURCES.map((source) => this.runtime!.loadImage(source)),
    ).then(
      (frames) => {
        this.frames = frames;
        return true;
      },
      () => false,
    );
    this.framesReady = attempt;
    void attempt.then((ready) => {
      if (!ready && this.framesReady === attempt) this.framesReady = null;
    });
    return attempt;
  }

  private playFrames(
    canvas: HTMLCanvasElement,
    target: DeepSeaInkTarget,
    startFrame: number,
    endFrame: number,
    viewportTopLeft: { readonly x: number; readonly y: number },
    runId: number,
    onComplete: () => void,
  ): void {
    if (!this.runtime || runId !== this.runId || this.disposed) return;
    const startedAt = this.runtime.now();
    const duration = (endFrame - startFrame + 1) * FRAME_MS;
    this.renderFrame(canvas, target, startFrame, viewportTopLeft);

    const tick = (now: number): void => {
      if (runId !== this.runId || this.disposed) return;
      this.animationFrame = 0;
      const elapsed = Math.max(0, now - startedAt);
      if (elapsed >= duration) {
        this.renderFrame(canvas, target, endFrame, viewportTopLeft);
        onComplete();
        return;
      }
      const frameIndex = Math.min(
        endFrame,
        startFrame + Math.floor(elapsed / FRAME_MS),
      );
      this.renderFrame(canvas, target, frameIndex, viewportTopLeft);
      this.animationFrame = this.runtime!.requestFrame(tick);
    };
    this.animationFrame = this.runtime.requestFrame(tick);
  }

  private animateAnchor(
    canvas: HTMLCanvasElement,
    target: DeepSeaInkTarget,
    from: { readonly x: number; readonly y: number },
    to: { readonly x: number; readonly y: number },
    runId: number,
    onComplete: () => void,
  ): void {
    if (!this.runtime || runId !== this.runId || this.disposed) return;
    const startedAt = this.runtime.now();
    const tick = (now: number): void => {
      if (runId !== this.runId || this.disposed) return;
      this.animationFrame = 0;
      const progress = Math.min(1, Math.max(0, (now - startedAt) / SPRAY_REPOSITION_MS));
      const eased = easeInOutCubic(progress);
      const viewportTopLeft = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased,
      };
      this.renderFrame(canvas, target, REPOSITION_FRAME, viewportTopLeft);
      if (progress >= 1) {
        onComplete();
        return;
      }
      this.animationFrame = this.runtime!.requestFrame(tick);
    };
    this.animationFrame = this.runtime.requestFrame(tick);
  }

  private holdImpact(runId: number, onComplete: () => void): void {
    if (!this.runtime || runId !== this.runId || this.disposed) return;
    this.phase = 'impact';
    this.markPhase();
    const startedAt = this.runtime.now();
    const tick = (now: number): void => {
      if (runId !== this.runId || this.disposed) return;
      this.animationFrame = 0;
      if (now - startedAt < SPRAY_IMPACT_HOLD_MS) {
        this.animationFrame = this.runtime!.requestFrame(tick);
        return;
      }
      this.runtime!.document.body.dataset.deepSeaInkCompletedAt = now.toFixed(1);
      this.stopActive();
      onComplete();
    };
    this.animationFrame = this.runtime.requestFrame(tick);
  }

  private renderFrame(
    canvas: HTMLCanvasElement,
    target: DeepSeaInkTarget,
    frameIndex: number,
    viewportTopLeft: { readonly x: number; readonly y: number },
  ): void {
    if (!this.element || !this.context) return;
    const stage = resolveMotionStageFrame(canvas);
    const source = FRAME_SOURCES[frameIndex] ?? FRAME_SOURCES[0];
    const frame = this.frames[frameIndex] ?? this.frames[0];
    if (frame && this.lastDrawnFrame !== frameIndex) {
      this.context.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
      this.context.drawImage(frame, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
      this.lastDrawnFrame = frameIndex;
    }
    Object.assign(this.element.style, {
      left: `${stage.left + viewportTopLeft.x * stage.scale}px`,
      top: `${stage.top + viewportTopLeft.y * stage.scale}px`,
      width: `${FRAME_WIDTH * stage.scale}px`,
      height: `${FRAME_HEIGHT * stage.scale}px`,
    });
    this.element.dataset.deepSeaInkFrame = String(frameIndex);
    this.element.dataset.deepSeaInkFrameSource = source;
    this.element.dataset.deepSeaInkTarget = pointText(deepSeaInkGeometry(target).target);
    this.element.dataset.deepSeaInkSprayHit = pointText(deepSeaInkGeometry(target).sprayHit);
    if (this.runtime) {
      Object.assign(this.runtime.document.body.dataset, {
        deepSeaInkFrame: String(frameIndex),
        deepSeaInkFrameSource: source,
      });
    }
  }

  private markActive(target: DeepSeaInkTarget): void {
    if (!this.runtime) return;
    const geometry = deepSeaInkGeometry(target);
    const bounds = geometry.characterHeadBounds;
    delete this.runtime.document.body.dataset.deepSeaInkCompletedAt;
    Object.assign(this.runtime.document.body.dataset, {
      deepSeaInkActive: 'true',
      deepSeaInkAssetMode: 'customer-original-frames',
      deepSeaInkRenderer: 'predecoded-canvas',
      deepSeaInkTarget: pointText(geometry.target),
      deepSeaInkSprayHit: pointText(geometry.sprayHit),
      deepSeaInkBodyTopRight: pointText(geometry.bodyTopRight),
      deepSeaInkSprayBodyTopRight: pointText(geometry.sprayBodyTopRight),
      deepSeaInkOptionTopRight: pointText(geometry.optionTopRight),
      deepSeaInkCharacterHeadBounds:
        `${bounds.left},${bounds.top},${bounds.right},${bounds.bottom}`,
      deepSeaInkViewportCenter: pointText(geometry.viewportCenter),
      deepSeaInkViewportTopLeft: pointText(geometry.viewportTopLeft),
      deepSeaInkSprayViewportTopLeft: pointText(geometry.sprayViewportTopLeft),
      deepSeaInkFps: String(FPS),
      deepSeaInkFrameCount: String(FRAME_COUNT),
    });
    this.markPhase();
  }

  private markPhase(): void {
    if (!this.runtime) return;
    this.runtime.document.body.dataset.deepSeaInkPhase = this.phase;
  }

  private markLoadFailure(): void {
    if (!this.runtime) return;
    this.runtime.document.body.dataset.deepSeaInkActive = 'load-error';
    this.runtime.document.body.dataset.deepSeaInkAssetMode = 'customer-original-frames';
    this.runtime.document.body.dataset.deepSeaInkRenderer = 'predecoded-canvas';
  }

  private stopActive(): void {
    this.runId += 1;
    if (this.animationFrame && this.runtime) this.runtime.cancelFrame(this.animationFrame);
    this.animationFrame = 0;
    this.lastDrawnFrame = -1;
    this.target = null;
    this.stageCanvas = null;
    this.phase = 'idle';
    if (this.context) this.context.clearRect(0, 0, FRAME_WIDTH, FRAME_HEIGHT);
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

function loadDecodedImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = source;
  if (typeof image.decode === 'function') {
    return image.decode().then(() => image);
  }
  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(new Error(`Failed to load ${source}`)), {
      once: true,
    });
  });
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - ((-2 * value + 2) ** 3) / 2;
}

function pointText(point: { readonly x: number; readonly y: number }): string {
  return `${point.x},${point.y}`;
}
