import { resolveMotionStageFrame } from '../core/media/DomMotionLayout';
import {
  CLASSIC_TREASURE_FEEDBACK,
  classicTreasureExplosionDurationMs,
  classicTreasureExplosionFrame,
} from '../shared/config/ClassicTreasureFeedback';

export interface ClassicTreasureExplosionCallbacks {
  readonly onStart?: () => void;
  readonly onBurst?: () => void;
  readonly onComplete?: () => void;
}

export interface ClassicTreasureEffectRuntime {
  readonly document: Document;
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly loadImage: (source: string) => Promise<CanvasImageSource>;
}

type ClassicTreasureEffectMode = 'reward' | 'explosion';

const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 900;
const EFFECT_ORIGIN_X = 600;
const EFFECT_ORIGIN_Y = 500;
const REWARD_ORIGIN_X = EFFECT_ORIGIN_X;
const REWARD_ORIGIN_Y = EFFECT_ORIGIN_Y + 25;
const EXPLOSION_FRAME_WIDTH = 256;
const EXPLOSION_FRAME_HEIGHT = 224;
const EXPLOSION_BASE_Y = EFFECT_ORIGIN_Y + 74;
const EFFECT_Z_INDEX = 66;
const FRAME_ROOT = './media/treasure/classic-explosion-frames';
const FRAME_SOURCES = Array.from(
  { length: CLASSIC_TREASURE_FEEDBACK.explosionFrameCount },
  (_, index) => `${FRAME_ROOT}/frame-${String(index).padStart(2, '0')}.png`,
);
const REWARD_GEM_ROOT = './media/treasure/classic-reward-gems';
const REWARD_GEM_SOURCES = Array.from(
  { length: 7 },
  (_, index) => `${REWARD_GEM_ROOT}/gem-${String(index).padStart(2, '0')}.png`,
);
const GEM_SIZE_VARIANTS = [30, 38, 46, 56, 68, 82, 98, 118] as const;
const GEM_WAVE_SIZE = Math.ceil(
  CLASSIC_TREASURE_FEEDBACK.rewardGemCount
  / CLASSIC_TREASURE_FEEDBACK.rewardGemWaveCount,
);
const GEM_PARTICLES = Array.from({
  length: CLASSIC_TREASURE_FEEDBACK.rewardGemCount,
}, (_, index) => {
  const wave = Math.floor(index / GEM_WAVE_SIZE);
  const lane = index % GEM_WAVE_SIZE;
  const distanceBand = (index * 5 + wave * 3)
    % CLASSIC_TREASURE_FEEDBACK.rewardGemDistanceBands;
  return {
    imageIndex: index % REWARD_GEM_SOURCES.length,
    angle: ((index * 137.5 + wave * 23 + 188) % 360) * Math.PI / 180,
    startDistance: 14 + (index % 5) * 9,
    distance: CLASSIC_TREASURE_FEEDBACK.rewardGemMinDistance
      + distanceBand * CLASSIC_TREASURE_FEEDBACK.rewardGemDistanceStep,
    gravity: 44 + (index % 7) * 16,
    delay: wave * CLASSIC_TREASURE_FEEDBACK.rewardGemWaveDelayProgress
      + (lane % 5) * 0.012
      + Math.floor(lane / 5) * 0.006,
    duration: CLASSIC_TREASURE_FEEDBACK.rewardGemFlightMinProgress
      + (lane % 5) * CLASSIC_TREASURE_FEEDBACK.rewardGemFlightStepProgress,
    size: GEM_SIZE_VARIANTS[
      (index * 5 + Math.floor(index / 7)) % GEM_SIZE_VARIANTS.length
    ]!,
    spin: (index % 2 === 0 ? 1 : -1) * (2.4 + (index % 7) * 0.48),
  };
});
const LIGHT_RAYS = Array.from({
  length: CLASSIC_TREASURE_FEEDBACK.rewardRayCount,
}, (_, index) => ({
  angle: index * Math.PI * 2 / CLASSIC_TREASURE_FEEDBACK.rewardRayCount + 0.08,
  length: CLASSIC_TREASURE_FEEDBACK.rewardRayMinLength
    + (index % CLASSIC_TREASURE_FEEDBACK.rewardRayLengthBands)
    * CLASSIC_TREASURE_FEEDBACK.rewardRayLengthStep,
  width: 30 + (index % 4) * 10,
  alpha: 0.48 + (index % 4) * 0.07,
}));

export class ClassicTreasureEffectView {
  private readonly element: HTMLCanvasElement | null;
  private readonly context: CanvasRenderingContext2D | null;
  private framesReady: Promise<boolean> | null = null;
  private frames: readonly CanvasImageSource[] = [];
  private rewardImagesReady: Promise<boolean> | null = null;
  private rewardImages: readonly CanvasImageSource[] = [];
  private animationFrame = 0;
  private runId = 0;
  private disposed = false;

  constructor(
    private readonly runtime: ClassicTreasureEffectRuntime | null = browserRuntime(),
  ) {
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
    element.id = 'ClassicTreasureEffect';
    element.width = CANVAS_WIDTH;
    element.height = CANVAS_HEIGHT;
    element.dataset.classicTreasureEffectCanvas = '1';
    element.setAttribute('aria-hidden', 'true');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    Object.assign(element.style, {
      position: 'fixed',
      display: 'none',
      overflow: 'visible',
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
    void this.ensureRewardImagesReady();
  }

  playReward(columnX: number, onComplete: () => void = () => undefined): void {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.context
    ) {
      onComplete();
      return;
    }
    this.stopActive();
    const runId = this.runId;
    void this.ensureRewardImagesReady().then((ready) => {
      if (runId !== this.runId || this.disposed) return;
      if (!ready || !this.prepare('reward', columnX, false)) {
        this.markLoadFailure('reward-load-error');
        onComplete();
        return;
      }
      const startedAt = this.runtime!.now();
      const tick = (now: number): void => {
        if (runId !== this.runId || this.disposed) return;
        this.animationFrame = 0;
        const elapsed = Math.max(0, now - startedAt);
        const progress = clamp(elapsed / CLASSIC_TREASURE_FEEDBACK.rewardDurationMs);
        this.drawReward(progress);
        this.positionAt(columnX);
        if (typeof document !== 'undefined') {
          document.body.dataset.classicTreasureRewardProgress = progress.toFixed(3);
        }
        if (progress >= 1) {
          this.finish(onComplete);
          return;
        }
        this.animationFrame = this.runtime!.requestFrame(tick);
      };
      tick(startedAt);
    });
  }

  playExplosion(
    columnX: number,
    callbacks: ClassicTreasureExplosionCallbacks = {},
  ): void {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.context
    ) {
      callbacks.onStart?.();
      callbacks.onBurst?.();
      callbacks.onComplete?.();
      return;
    }
    this.stopActive();
    const runId = this.runId;
    void this.ensureFramesReady().then((ready) => {
      if (runId !== this.runId || this.disposed) return;
      if (!ready || !this.prepare('explosion', columnX, false)) {
        this.markLoadFailure('explosion-load-error');
        callbacks.onStart?.();
        callbacks.onBurst?.();
        callbacks.onComplete?.();
        return;
      }
      const startedAt = this.runtime!.now();
      const durationMs = classicTreasureExplosionDurationMs();
      let burstCalled = false;
      callbacks.onStart?.();
      const tick = (now: number): void => {
        if (runId !== this.runId || this.disposed) return;
        this.animationFrame = 0;
        const elapsed = Math.max(0, now - startedAt);
        const frameIndex = classicTreasureExplosionFrame(elapsed);
        this.drawExplosion(frameIndex);
        this.positionAt(columnX);
        this.markExplosionFrame(frameIndex);
        if (
          !burstCalled
          && frameIndex >= CLASSIC_TREASURE_FEEDBACK.explosionBurstFrame
        ) {
          burstCalled = true;
          if (typeof document !== 'undefined') {
            document.body.dataset.classicTreasureExplosionBurst = 'true';
          }
          callbacks.onBurst?.();
        }
        if (elapsed >= durationMs) {
          if (!burstCalled) callbacks.onBurst?.();
          this.finish(callbacks.onComplete);
          return;
        }
        this.animationFrame = this.runtime!.requestFrame(tick);
      };
      tick(startedAt);
    });
  }

  hide(): void {
    this.stopActive();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopActive();
  }

  private prepare(
    mode: ClassicTreasureEffectMode,
    columnX: number,
    stopFirst = true,
  ): boolean {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.context
      || !this.stageCanvas()
    ) return false;
    if (stopFirst) this.stopActive();
    if (!this.element.isConnected) this.runtime.document.body.appendChild(this.element);
    this.element.style.display = 'block';
    this.positionAt(columnX);
    Object.assign(this.runtime.document.body.dataset, {
      classicTreasureEffect: mode,
      classicTreasureRenderer: 'predecoded-canvas',
      classicTreasureColumnX: columnX.toFixed(2),
    });
    return true;
  }

  private ensureFramesReady(): Promise<boolean> {
    if (this.framesReady) return this.framesReady;
    if (!this.runtime || this.disposed) return Promise.resolve(false);
    const attempt = Promise.all(
      FRAME_SOURCES.map((source) => this.runtime!.loadImage(source)),
    ).then(
      (frames) => {
        this.frames = frames;
        if (typeof document !== 'undefined') {
          document.body.dataset.classicTreasureExplosionFramesReady = 'true';
        }
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

  private ensureRewardImagesReady(): Promise<boolean> {
    if (this.rewardImagesReady) return this.rewardImagesReady;
    if (!this.runtime || this.disposed) return Promise.resolve(false);
    const attempt = Promise.all(
      REWARD_GEM_SOURCES.map((source) => this.runtime!.loadImage(source)),
    ).then(
      (images) => {
        this.rewardImages = images;
        if (typeof document !== 'undefined') {
          document.body.dataset.classicTreasureRewardAssetsReady = 'true';
        }
        return true;
      },
      () => false,
    );
    this.rewardImagesReady = attempt;
    void attempt.then((ready) => {
      if (!ready && this.rewardImagesReady === attempt) {
        this.rewardImagesReady = null;
      }
    });
    return attempt;
  }

  private drawReward(progress: number): void {
    if (!this.context) return;
    const context = this.context;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawLight(context, progress);
    drawGems(context, this.rewardImages, progress);
    drawSparkles(context, progress);
  }

  private drawExplosion(frameIndex: number): void {
    if (!this.context) return;
    const context = this.context;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawExplosionFlash(context, frameIndex);
    const frame = this.frames[frameIndex] ?? this.frames[0];
    if (!frame) return;
    const width = EXPLOSION_FRAME_WIDTH * CLASSIC_TREASURE_FEEDBACK.explosionScale;
    const height = EXPLOSION_FRAME_HEIGHT * CLASSIC_TREASURE_FEEDBACK.explosionScale;
    context.drawImage(
      frame,
      EFFECT_ORIGIN_X - width / 2,
      EXPLOSION_BASE_Y - height,
      width,
      height,
    );
  }

  private positionAt(columnX: number): void {
    if (!this.element) return;
    const canvas = this.stageCanvas();
    if (!canvas) return;
    const stage = resolveMotionStageFrame(canvas);
    const designX = 720 + columnX;
    const designY = 405 - CLASSIC_TREASURE_FEEDBACK.effectAnchorY;
    Object.assign(this.element.style, {
      left: `${stage.left + (designX - EFFECT_ORIGIN_X) * stage.scale}px`,
      top: `${stage.top + (designY - EFFECT_ORIGIN_Y) * stage.scale}px`,
      width: `${CANVAS_WIDTH * stage.scale}px`,
      height: `${CANVAS_HEIGHT * stage.scale}px`,
    });
  }

  private stageCanvas(): HTMLCanvasElement | null {
    return this.runtime?.document.getElementById('GameCanvas') as HTMLCanvasElement | null;
  }

  private markExplosionFrame(frameIndex: number): void {
    if (!this.element || !this.runtime) return;
    const source = FRAME_SOURCES[frameIndex] ?? FRAME_SOURCES[0];
    this.element.dataset.classicTreasureExplosionFrame = String(frameIndex);
    this.element.dataset.classicTreasureExplosionSource = source;
    Object.assign(this.runtime.document.body.dataset, {
      classicTreasureExplosionFrame: String(frameIndex),
      classicTreasureExplosionSource: source,
    });
  }

  private markLoadFailure(mode: string): void {
    if (!this.runtime) return;
    Object.assign(this.runtime.document.body.dataset, {
      classicTreasureEffect: mode,
      classicTreasureRenderer: 'predecoded-canvas',
    });
  }

  private finish(onComplete: (() => void) | undefined): void {
    this.stopActive();
    onComplete?.();
  }

  private stopActive(): void {
    this.runId += 1;
    if (this.animationFrame && this.runtime) this.runtime.cancelFrame(this.animationFrame);
    this.animationFrame = 0;
    if (this.context) this.context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    if (this.element) {
      this.element.style.display = 'none';
      this.element.remove();
    }
    if (this.runtime) {
      [
        'classicTreasureEffect',
        'classicTreasureRenderer',
        'classicTreasureColumnX',
        'classicTreasureRewardProgress',
        'classicTreasureExplosionFrame',
        'classicTreasureExplosionSource',
        'classicTreasureExplosionBurst',
      ].forEach((field) => {
        delete this.runtime!.document.body.dataset[field];
      });
    }
  }
}

function drawLight(context: CanvasRenderingContext2D, progress: number): void {
  const reveal = easeOutCubic(clamp(progress / 0.18));
  const fade = 1 - clamp((progress - 0.7) / 0.3) * 0.78;
  const pulse = 0.94 + Math.sin(progress * Math.PI * 7) * 0.06;
  context.save();
  context.globalCompositeOperation = 'lighter';

  LIGHT_RAYS.forEach((ray, index) => {
    const length = ray.length * reveal * pulse;
    const near = 62;
    const farHalfWidth = ray.width * (1.85 + reveal * 1.2);
    context.save();
    context.translate(REWARD_ORIGIN_X, REWARD_ORIGIN_Y);
    context.rotate(ray.angle);
    const beam = context.createLinearGradient(near, 0, length, 0);
    beam.addColorStop(0, `rgba(255,248,173,${ray.alpha * fade})`);
    beam.addColorStop(0.38, `rgba(255,213,69,${ray.alpha * 0.88 * fade})`);
    beam.addColorStop(1, 'rgba(255,171,28,0)');
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(near, -ray.width * 0.32);
    context.lineTo(length, -farHalfWidth);
    context.lineTo(length, farHalfWidth);
    context.lineTo(near, ray.width * 0.32);
    context.closePath();
    context.fill();
    if (index % 2 === 0) {
      const core = context.createLinearGradient(near, 0, length * 0.92, 0);
      core.addColorStop(0, `rgba(255,255,225,${0.38 * fade})`);
      core.addColorStop(1, 'rgba(255,218,88,0)');
      context.fillStyle = core;
      context.beginPath();
      context.moveTo(near, -2.5);
      context.lineTo(length * 0.92, -ray.width * 0.36);
      context.lineTo(length * 0.92, ray.width * 0.36);
      context.lineTo(near, 2.5);
      context.closePath();
      context.fill();
    }
    context.restore();
  });
  context.restore();
}

function drawGems(
  context: CanvasRenderingContext2D,
  images: readonly CanvasImageSource[],
  progress: number,
): void {
  GEM_PARTICLES.forEach((particle, index) => {
    const local = clamp((progress - particle.delay) / particle.duration);
    if (local <= 0) return;
    const travel = easeOutCubic(local);
    const radialDistance = particle.startDistance
      + (particle.distance - particle.startDistance) * travel;
    const x = REWARD_ORIGIN_X
      + Math.cos(particle.angle) * radialDistance;
    const y = REWARD_ORIGIN_Y
      + Math.sin(particle.angle) * radialDistance
      + particle.gravity * local * local;
    const fadeIn = clamp(local / 0.08);
    const fadeOut = 1 - clamp((local - 0.78) / 0.22);
    const alpha = fadeIn * fadeOut;
    const scale = 0.38
      + Math.sin(Math.min(1, local / 0.16) * Math.PI / 2) * 0.76;
    const image = images[particle.imageIndex];
    if (!image) return;
    drawGemImage(
      context,
      image,
      x,
      y,
      particle.size * scale,
      particle.spin * local + index * 0.3,
      alpha,
    );
  });
}

function drawGemImage(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource,
  x: number,
  y: number,
  size: number,
  rotation: number,
  alpha: number,
): void {
  context.save();
  context.translate(x, y);
  context.rotate(rotation);
  context.globalAlpha = alpha;
  context.shadowColor = 'rgba(255,224,104,0.78)';
  context.shadowBlur = 22;
  context.drawImage(image, -size / 2, -size / 2, size, size);
  context.restore();
}

function drawSparkles(context: CanvasRenderingContext2D, progress: number): void {
  context.save();
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 36; index += 1) {
    const phase = (progress * 2.8 + index * 0.089) % 1;
    const angle = index * Math.PI * 2 / 36 + 0.35;
    const radius = 68 + phase * 390;
    const alpha = Math.sin(phase * Math.PI) * (1 - progress * 0.45);
    const x = REWARD_ORIGIN_X + Math.cos(angle) * radius;
    const y = REWARD_ORIGIN_Y + Math.sin(angle) * radius * 0.78;
    context.fillStyle = `rgba(255,246,172,${alpha})`;
    context.beginPath();
    context.arc(x, y, 2.2 + (index % 4), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawExplosionFlash(
  context: CanvasRenderingContext2D,
  frameIndex: number,
): void {
  const start = 3;
  const end = 18;
  if (frameIndex < start || frameIndex > end) return;
  const progress = clamp((frameIndex - start) / (end - start));
  const alpha = Math.sin(progress * Math.PI) * 0.5;
  const radius = 64 + progress * 112;
  context.save();
  context.globalCompositeOperation = 'lighter';
  const flash = context.createRadialGradient(
    EFFECT_ORIGIN_X,
    EFFECT_ORIGIN_Y + 30,
    0,
    EFFECT_ORIGIN_X,
    EFFECT_ORIGIN_Y + 30,
    radius,
  );
  flash.addColorStop(0, `rgba(255,250,215,${alpha})`);
  flash.addColorStop(0.35, `rgba(255,145,36,${alpha * 0.72})`);
  flash.addColorStop(1, 'rgba(255,75,10,0)');
  context.fillStyle = flash;
  context.beginPath();
  context.arc(EFFECT_ORIGIN_X, EFFECT_ORIGIN_Y + 30, radius, 0, Math.PI * 2);
  context.fill();
  context.restore();
}

function browserRuntime(): ClassicTreasureEffectRuntime | null {
  if (
    typeof document === 'undefined'
    || typeof requestAnimationFrame !== 'function'
    || typeof cancelAnimationFrame !== 'function'
  ) return null;
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
    image.addEventListener('error', () => reject(
      new Error(`Failed to load classic treasure frame: ${source}`),
    ), { once: true });
  });
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}
