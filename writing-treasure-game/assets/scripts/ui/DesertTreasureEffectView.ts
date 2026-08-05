import { resolveMotionStageFrame } from '../core/media/DomMotionLayout';
import {
  DESERT_TREASURE_FEEDBACK,
  DESERT_TREASURE_GEM_SIZES,
} from '../shared/config/DesertTreasureFeedback';

export interface DesertTreasureEffectRuntime {
  readonly document: Document;
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly loadImage: (source: string) => Promise<CanvasImageSource>;
}

interface SymbolCrop {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 760;
const EFFECT_ORIGIN_X = 500;
const EFFECT_ORIGIN_Y = 530;
const REWARD_Z_INDEX = 5;
const BURIAL_Z_INDEX = 9;
const BURIAL_STREAM_TOP_Y = 190;
const BURIAL_STREAM_BOTTOM_Y = 650;
const BURIAL_MOUND_CENTER_Y = 632;
const BURIAL_OVERALL_ALPHA = 1;
const BURIAL_STREAM_TOP_HALF_WIDTH = 156;
const BURIAL_STREAM_BOTTOM_HALF_WIDTH = 94;
const BURIAL_STREAM_TEXTURES = [
  { offset: -0.58, topWidth: 42, bottomWidth: 24, alpha: 0.15, phase: 0.4, light: false },
  { offset: -0.3, topWidth: 52, bottomWidth: 30, alpha: 0.2, phase: 1.7, light: true },
  { offset: -0.02, topWidth: 46, bottomWidth: 28, alpha: 0.13, phase: 3.1, light: false },
  { offset: 0.27, topWidth: 56, bottomWidth: 32, alpha: 0.18, phase: 4.4, light: true },
  { offset: 0.57, topWidth: 40, bottomWidth: 23, alpha: 0.14, phase: 5.8, light: false },
] as const;
const GEM_ROOT = './media/treasure/classic-reward-gems';
const GEM_SOURCES = Array.from(
  { length: 7 },
  (_, index) => `${GEM_ROOT}/gem-${String(index).padStart(2, '0')}.png`,
);
const SYMBOL_SOURCE = './media/static-feedback/desert/correct-layer-1.png';
const SYMBOL_CROPS: readonly SymbolCrop[] = [
  { x: 20, y: 144, width: 120, height: 136 },
  { x: 466, y: 104, width: 152, height: 166 },
  { x: 52, y: 290, width: 138, height: 138 },
  { x: 475, y: 305, width: 130, height: 135 },
] as const;
const SYMBOL_ANGLES = [
  -2.76, -2.36, -1.92, -1.42, -1.02, -0.64, -2.58, -0.34,
] as const;
const LIGHT_RAYS = Array.from({
  length: DESERT_TREASURE_FEEDBACK.rewardRayCount,
}, (_, index) => ({
  angle: index * Math.PI * 2 / DESERT_TREASURE_FEEDBACK.rewardRayCount + 0.05,
  length: 270 + (index % 5) * 48,
  width: 24 + (index % 4) * 9,
  alpha: 0.36 + (index % 4) * 0.07,
}));
const GEM_PARTICLES = Array.from({
  length: DESERT_TREASURE_FEEDBACK.rewardGemCount,
}, (_, index) => {
  const lane = ((index * 0.61803398875) % 1);
  const wave = index % 3;
  return {
    imageIndex: index % GEM_SOURCES.length,
    angle: -Math.PI + 0.16 + lane * (Math.PI - 0.32),
    distance: 145 + (index % 8) * 39,
    gravity: 74 + (index % 6) * 16,
    delay: wave * 0.105 + (index % 5) * 0.008,
    duration: 0.57 + (index % 5) * 0.035,
    size: DESERT_TREASURE_GEM_SIZES[
      (index * 5 + Math.floor(index / 4)) % DESERT_TREASURE_GEM_SIZES.length
    ]!,
    spin: (index % 2 === 0 ? 1 : -1) * (2.2 + (index % 5) * 0.42),
  };
});
const SYMBOL_PARTICLES = Array.from({
  length: DESERT_TREASURE_FEEDBACK.rewardSymbolCount,
}, (_, index) => ({
  cropIndex: index % SYMBOL_CROPS.length,
  angle: SYMBOL_ANGLES[index % SYMBOL_ANGLES.length]!,
  distance: 230 + (index % 4) * 62,
  delay: index < 4 ? 0.03 + index * 0.018 : 0.18 + (index - 4) * 0.02,
  duration: 0.58 + (index % 3) * 0.06,
  size: 78 + (index % 4) * 12,
  spin: (index % 2 === 0 ? 1 : -1) * (0.18 + (index % 3) * 0.1),
}));

export class DesertTreasureEffectView {
  private readonly element: HTMLCanvasElement | null;
  private readonly context: CanvasRenderingContext2D | null;
  private assetsReady: Promise<boolean> | null = null;
  private gemImages: readonly CanvasImageSource[] = [];
  private symbolSheet: CanvasImageSource | null = null;
  private animationFrame = 0;
  private runId = 0;
  private disposed = false;

  constructor(
    private readonly runtime: DesertTreasureEffectRuntime | null = browserRuntime(),
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
    element.id = 'DesertTreasureEffect';
    element.width = CANVAS_WIDTH;
    element.height = CANVAS_HEIGHT;
    element.dataset.desertTreasureEffectCanvas = '1';
    element.setAttribute('aria-hidden', 'true');
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    Object.assign(element.style, {
      position: 'fixed',
      display: 'none',
      overflow: 'visible',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: String(REWARD_Z_INDEX),
      maxWidth: 'none',
      maxHeight: 'none',
      imageRendering: 'auto',
    });
  }

  preload(): void {
    if (this.disposed) return;
    void this.ensureAssetsReady();
  }

  play(columnX: number, onComplete: () => void = () => undefined): void {
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
    void this.ensureAssetsReady().then((ready) => {
      if (runId !== this.runId || this.disposed) return;
      if (!ready || !this.prepare(columnX, 'reward')) {
        this.markLoadFailure();
        onComplete();
        return;
      }
      const startedAt = this.runtime!.now();
      const tick = (now: number): void => {
        if (runId !== this.runId || this.disposed) return;
        this.animationFrame = 0;
        const elapsed = Math.max(0, now - startedAt);
        const progress = clamp(
          elapsed / DESERT_TREASURE_FEEDBACK.rewardDurationMs,
        );
        this.draw(progress);
        this.positionAt(columnX);
        if (typeof document !== 'undefined') {
          document.body.dataset.desertTreasureRewardProgress = progress.toFixed(3);
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

  playBurial(
    columnX: number,
    onCovered: () => void,
    onComplete: () => void = () => undefined,
  ): void {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.context
    ) {
      onCovered();
      onComplete();
      return;
    }
    this.stopActive();
    const runId = this.runId;
    if (!this.prepare(columnX, 'burial-sand')) {
      onCovered();
      onComplete();
      return;
    }
    const startedAt = this.runtime.now();
    let covered = false;
    const tick = (now: number): void => {
      if (runId !== this.runId || this.disposed) return;
      this.animationFrame = 0;
      const elapsed = Math.max(0, now - startedAt);
      const progress = clamp(
        elapsed / DESERT_TREASURE_FEEDBACK.wrongSandFallMs,
      );
      drawBurialSand(this.context!, progress);
      this.positionAt(columnX);
      if (typeof document !== 'undefined') {
        document.body.dataset.desertTreasureBurialProgress = progress.toFixed(3);
      }
      if (
        !covered
        && progress >= DESERT_TREASURE_FEEDBACK.wrongSandHandoffProgress
      ) {
        covered = true;
        if (typeof document !== 'undefined') {
          document.body.dataset.desertTreasureBurialPhase = 'covered';
        }
        onCovered();
      }
      if (progress >= 1) {
        if (!covered) onCovered();
        this.finish(onComplete);
        return;
      }
      this.animationFrame = this.runtime!.requestFrame(tick);
    };
    tick(startedAt);
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
    columnX: number,
    effect: 'reward' | 'burial-sand',
  ): boolean {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.context
      || !this.stageCanvas()
    ) return false;
    if (!this.element.isConnected) this.runtime.document.body.appendChild(this.element);
    this.element.style.display = 'block';
    this.element.style.zIndex = String(
      effect === 'burial-sand' ? BURIAL_Z_INDEX : REWARD_Z_INDEX,
    );
    this.positionAt(columnX);
    Object.assign(this.runtime.document.body.dataset, {
      desertTreasureEffect: effect,
      desertTreasureRenderer: effect === 'burial-sand'
        ? 'programmatic-sand-canvas'
        : 'customer-symbol-canvas',
      desertTreasureColumnX: columnX.toFixed(2),
    });
    if (effect === 'burial-sand') {
      this.runtime.document.body.dataset.desertTreasureBurialPhase = 'falling';
    }
    return true;
  }

  private ensureAssetsReady(): Promise<boolean> {
    if (this.assetsReady) return this.assetsReady;
    if (!this.runtime || this.disposed) return Promise.resolve(false);
    const attempt = Promise.all([
      Promise.all(GEM_SOURCES.map((source) => this.runtime!.loadImage(source))),
      this.runtime.loadImage(SYMBOL_SOURCE),
    ]).then(
      ([gems, symbols]) => {
        this.gemImages = gems;
        this.symbolSheet = symbols;
        if (typeof document !== 'undefined') {
          document.body.dataset.desertTreasureRewardAssetsReady = 'true';
        }
        return true;
      },
      () => false,
    );
    this.assetsReady = attempt;
    void attempt.then((ready) => {
      if (!ready && this.assetsReady === attempt) this.assetsReady = null;
    });
    return attempt;
  }

  private draw(progress: number): void {
    if (!this.context) return;
    this.context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    drawLight(this.context, progress);
    drawGems(this.context, this.gemImages, progress);
    if (this.symbolSheet) drawSymbols(this.context, this.symbolSheet, progress);
    drawSparkles(this.context, progress);
  }

  private positionAt(columnX: number): void {
    if (!this.element) return;
    const canvas = this.stageCanvas();
    if (!canvas) return;
    const stage = resolveMotionStageFrame(canvas);
    const designX = 720 + columnX;
    const designY = 405 - DESERT_TREASURE_FEEDBACK.effectAnchorY;
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

  private markLoadFailure(): void {
    if (!this.runtime) return;
    Object.assign(this.runtime.document.body.dataset, {
      desertTreasureEffect: 'reward-load-error',
      desertTreasureRenderer: 'customer-symbol-canvas',
    });
  }

  private finish(onComplete: () => void): void {
    this.stopActive();
    onComplete();
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
        'desertTreasureEffect',
        'desertTreasureRenderer',
        'desertTreasureColumnX',
        'desertTreasureRewardProgress',
        'desertTreasureBurialPhase',
        'desertTreasureBurialProgress',
      ].forEach((field) => {
        delete this.runtime!.document.body.dataset[field];
      });
    }
  }
}

function drawLight(context: CanvasRenderingContext2D, progress: number): void {
  const reveal = easeOutCubic(clamp(progress / 0.2));
  const fade = 1 - clamp((progress - 0.7) / 0.3) * 0.78;
  const pulse = 0.94 + Math.sin(progress * Math.PI * 8) * 0.06;
  context.save();
  context.globalCompositeOperation = 'lighter';
  LIGHT_RAYS.forEach((ray, index) => {
    const length = ray.length * reveal * pulse;
    const near = 32;
    const farHalfWidth = ray.width * (1.45 + reveal * 0.9);
    context.save();
    context.translate(EFFECT_ORIGIN_X, EFFECT_ORIGIN_Y);
    context.rotate(ray.angle);
    const beam = context.createLinearGradient(near, 0, length, 0);
    beam.addColorStop(0, `rgba(255,252,208,${ray.alpha * fade})`);
    beam.addColorStop(0.35, `rgba(255,211,70,${ray.alpha * 0.9 * fade})`);
    beam.addColorStop(1, 'rgba(255,153,18,0)');
    context.fillStyle = beam;
    context.beginPath();
    context.moveTo(near, -ray.width * 0.28);
    context.lineTo(length, -farHalfWidth);
    context.lineTo(length, farHalfWidth);
    context.lineTo(near, ray.width * 0.28);
    context.closePath();
    context.fill();
    if (index % 2 === 0) {
      const core = context.createLinearGradient(near, 0, length * 0.88, 0);
      core.addColorStop(0, `rgba(255,255,236,${0.34 * fade})`);
      core.addColorStop(1, 'rgba(255,219,92,0)');
      context.fillStyle = core;
      context.beginPath();
      context.moveTo(near, -2);
      context.lineTo(length * 0.88, -ray.width * 0.28);
      context.lineTo(length * 0.88, ray.width * 0.28);
      context.lineTo(near, 2);
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
    const x = EFFECT_ORIGIN_X + Math.cos(particle.angle) * particle.distance * travel;
    const y = EFFECT_ORIGIN_Y
      + Math.sin(particle.angle) * particle.distance * travel
      + particle.gravity * local * local;
    const alpha = clamp(local / 0.08) * (1 - clamp((local - 0.78) / 0.22));
    const scale = 0.35 + Math.sin(Math.min(1, local / 0.16) * Math.PI / 2) * 0.78;
    const image = images[particle.imageIndex];
    if (!image) return;
    context.save();
    context.translate(x, y);
    context.rotate(particle.spin * local + index * 0.22);
    context.globalAlpha = alpha;
    context.shadowColor = 'rgba(255,222,91,0.78)';
    context.shadowBlur = 20;
    const size = particle.size * scale;
    context.drawImage(image, -size / 2, -size / 2, size, size);
    context.restore();
  });
}

function drawSymbols(
  context: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  progress: number,
): void {
  SYMBOL_PARTICLES.forEach((particle, index) => {
    const local = clamp((progress - particle.delay) / particle.duration);
    if (local <= 0) return;
    const travel = easeOutCubic(local);
    const x = EFFECT_ORIGIN_X + Math.cos(particle.angle) * particle.distance * travel;
    const y = EFFECT_ORIGIN_Y
      + Math.sin(particle.angle) * particle.distance * travel
      + 52 * local * local;
    const alpha = clamp(local / 0.08) * (1 - clamp((local - 0.82) / 0.18));
    const pop = 0.4 + Math.sin(Math.min(1, local / 0.18) * Math.PI / 2) * 0.68;
    const crop = SYMBOL_CROPS[particle.cropIndex];
    if (!crop) return;
    const height = particle.size * pop;
    const width = height * crop.width / crop.height;
    context.save();
    context.translate(x, y);
    context.rotate(particle.spin * local + (index % 2 === 0 ? -0.08 : 0.08));
    context.globalAlpha = alpha;
    context.shadowColor = 'rgba(255,202,41,0.9)';
    context.shadowBlur = 24;
    context.drawImage(
      sheet,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      -width / 2,
      -height / 2,
      width,
      height,
    );
    context.restore();
  });
}

function drawSparkles(context: CanvasRenderingContext2D, progress: number): void {
  context.save();
  context.globalCompositeOperation = 'lighter';
  for (let index = 0; index < 34; index += 1) {
    const phase = (progress * 2.7 + index * 0.093) % 1;
    const angle = -Math.PI + 0.12 + index * (Math.PI - 0.24) / 33;
    const radius = 46 + phase * 360;
    const alpha = Math.sin(phase * Math.PI) * (1 - progress * 0.4);
    const x = EFFECT_ORIGIN_X + Math.cos(angle) * radius;
    const y = EFFECT_ORIGIN_Y + Math.sin(angle) * radius + phase * phase * 38;
    context.fillStyle = `rgba(255,246,163,${alpha})`;
    context.beginPath();
    context.arc(x, y, 2 + (index % 4), 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawBurialSand(
  context: CanvasRenderingContext2D,
  progress: number,
): void {
  context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const fall = easeOutCubic(clamp(progress / 0.3));
  const spread = easeOutCubic(clamp((progress - 0.15) / 0.33));
  const rise = smoothStep(clamp((progress - 0.28) / 0.5));
  const fade = 1 - easeInCubic(clamp((progress - 0.82) / 0.18));
  const sandAlpha = fade * BURIAL_OVERALL_ALPHA;
  const streamBottom = BURIAL_STREAM_TOP_Y
    + (BURIAL_STREAM_BOTTOM_Y - BURIAL_STREAM_TOP_Y) * fall;

  drawBurialMound(context, spread, rise, sandAlpha);
  if (streamBottom > BURIAL_STREAM_TOP_Y + 1 && sandAlpha > 0) {
    drawBurialStream(context, progress, streamBottom, sandAlpha);
  }
}

function drawBurialStream(
  context: CanvasRenderingContext2D,
  progress: number,
  bottom: number,
  alpha: number,
): void {
  context.save();
  context.globalAlpha = alpha * 0.28;
  context.fillStyle = '#E7A13D';
  context.shadowColor = 'rgba(218,137,40,0.68)';
  context.shadowBlur = 24;
  traceBurialCurtain(context, progress, bottom, 1.06, 0.7);
  context.fill();
  context.restore();

  context.save();
  context.globalAlpha = alpha;
  const body = context.createLinearGradient(0, BURIAL_STREAM_TOP_Y, 0, bottom);
  body.addColorStop(0, '#F3B44D');
  body.addColorStop(0.42, '#EFA33B');
  body.addColorStop(0.78, '#E18A29');
  body.addColorStop(1, '#D77A22');
  context.fillStyle = body;
  context.shadowColor = 'rgba(137,66,13,0.28)';
  context.shadowBlur = 10;
  traceBurialCurtain(context, progress, bottom, 1, 0);
  context.fill();
  context.restore();

  context.save();
  traceBurialCurtain(context, progress, bottom, 0.99, 0);
  context.clip();
  const volume = context.createLinearGradient(
    EFFECT_ORIGIN_X - BURIAL_STREAM_TOP_HALF_WIDTH,
    0,
    EFFECT_ORIGIN_X + BURIAL_STREAM_TOP_HALF_WIDTH,
    0,
  );
  volume.addColorStop(0, 'rgba(121,57,9,0.34)');
  volume.addColorStop(0.16, 'rgba(231,153,50,0.08)');
  volume.addColorStop(0.4, 'rgba(255,222,139,0.3)');
  volume.addColorStop(0.62, 'rgba(247,188,81,0.06)');
  volume.addColorStop(0.84, 'rgba(178,91,14,0.18)');
  volume.addColorStop(1, 'rgba(112,49,7,0.32)');
  context.globalAlpha = alpha;
  context.fillStyle = volume;
  traceBurialCurtain(context, progress, bottom, 0.99, 0);
  context.fill();
  drawBurialStreamTextures(context, progress, bottom, alpha);
  context.restore();
}

function traceBurialCurtain(
  context: CanvasRenderingContext2D,
  progress: number,
  bottom: number,
  widthScale: number,
  phaseOffset: number,
): void {
  const leftPoints: Array<readonly [number, number]> = [];
  const rightPoints: Array<readonly [number, number]> = [];
  const movement = progress * 24 + phaseOffset;
  const steps = 24;
  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const narrowing = smoothStep(ratio);
    const landingSpread = smoothStep(clamp((ratio - 0.88) / 0.12)) * 8;
    const halfWidth = (
      BURIAL_STREAM_TOP_HALF_WIDTH
      + (BURIAL_STREAM_BOTTOM_HALF_WIDTH - BURIAL_STREAM_TOP_HALF_WIDTH)
        * narrowing
      + landingSpread
    ) * widthScale;
    const y = BURIAL_STREAM_TOP_Y
      + (bottom - BURIAL_STREAM_TOP_Y) * ratio;
    const centerWave = Math.sin(ratio * 7.4 - movement * 0.18) * 2.6
      + Math.sin(ratio * 14.2 + movement * 0.14) * 1.4;
    const edgeStrength = 8 - ratio * 3.5;
    const leftWave = Math.sin(ratio * 21.3 - movement * 0.72) * edgeStrength
      + Math.sin(ratio * 9.1 + movement * 0.31) * 3;
    const rightWave = Math.sin(ratio * 19.7 + movement * 0.66) * edgeStrength
      + Math.sin(ratio * 10.4 - movement * 0.28) * 2.8;
    leftPoints.push([EFFECT_ORIGIN_X + centerWave - halfWidth + leftWave, y]);
    rightPoints.push([EFFECT_ORIGIN_X + centerWave + halfWidth + rightWave, y]);
  }
  context.beginPath();
  context.moveTo(leftPoints[0]![0], leftPoints[0]![1]);
  leftPoints.slice(1).forEach(([x, y]) => context.lineTo(x, y));
  [...rightPoints].reverse().forEach(([x, y]) => context.lineTo(x, y));
  context.closePath();
}

function drawBurialStreamTextures(
  context: CanvasRenderingContext2D,
  progress: number,
  bottom: number,
  alpha: number,
): void {
  BURIAL_STREAM_TEXTURES.forEach((texture) => {
    const leftPoints: Array<readonly [number, number]> = [];
    const rightPoints: Array<readonly [number, number]> = [];
    const movement = progress * 30 + texture.phase;
    const steps = 18;
    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      const narrowing = smoothStep(ratio);
      const y = BURIAL_STREAM_TOP_Y
        + (bottom - BURIAL_STREAM_TOP_Y) * ratio;
      const topCenter = texture.offset * BURIAL_STREAM_TOP_HALF_WIDTH;
      const bottomCenter = texture.offset * BURIAL_STREAM_BOTTOM_HALF_WIDTH * 0.72;
      const centerX = EFFECT_ORIGIN_X
        + topCenter
        + (bottomCenter - topCenter) * narrowing
        + Math.sin(ratio * 8.4 - movement * 0.22) * 12
        + Math.sin(ratio * 17.2 + movement * 0.17) * 5;
      const width = texture.topWidth
        + (texture.bottomWidth - texture.topWidth) * narrowing;
      const edgeWave = Math.sin(ratio * 13.6 + movement * 0.46) * 5;
      leftPoints.push([centerX - width + edgeWave, y]);
      rightPoints.push([centerX + width - edgeWave * 0.45, y]);
    }
    context.save();
    context.globalCompositeOperation = texture.light ? 'screen' : 'multiply';
    context.globalAlpha = alpha * texture.alpha;
    context.fillStyle = texture.light
      ? 'rgba(255,225,139,0.72)'
      : 'rgba(153,74,11,0.52)';
    context.shadowColor = texture.light
      ? 'rgba(255,222,126,0.5)'
      : 'rgba(129,58,7,0.34)';
    context.shadowBlur = 18;
    context.beginPath();
    context.moveTo(leftPoints[0]![0], leftPoints[0]![1]);
    leftPoints.slice(1).forEach(([x, y]) => context.lineTo(x, y));
    [...rightPoints].reverse().forEach(([x, y]) => context.lineTo(x, y));
    context.closePath();
    context.fill();
    context.restore();
  });
}

function drawBurialMound(
  context: CanvasRenderingContext2D,
  spread: number,
  rise: number,
  alpha: number,
): void {
  if (spread <= 0 || alpha <= 0) return;
  const halfWidth = 24 + 131 * spread;
  const height = 8 + 100 * rise;
  const centerY = BURIAL_MOUND_CENTER_Y + 10 + (1 - rise) * 20;
  context.save();
  context.globalAlpha = alpha;
  context.translate(EFFECT_ORIGIN_X, centerY);
  const mound = context.createRadialGradient(
    -halfWidth * 0.16,
    -height * 0.46,
    12,
    0,
    0,
    halfWidth,
  );
  mound.addColorStop(0, '#FFD978');
  mound.addColorStop(0.34, '#F4B64E');
  mound.addColorStop(0.72, '#E3902F');
  mound.addColorStop(1, '#C96B1E');
  context.fillStyle = mound;
  context.shadowColor = 'rgba(114,55,13,0.28)';
  context.shadowBlur = 20;
  context.beginPath();
  context.moveTo(-halfWidth, height * 0.25);
  context.bezierCurveTo(
    -halfWidth * 0.92,
    -height * 0.42,
    -halfWidth * 0.54,
    -height * 0.76,
    -halfWidth * 0.2,
    -height * 0.69,
  );
  context.bezierCurveTo(
    -halfWidth * 0.03,
    -height * 0.92,
    halfWidth * 0.22,
    -height * 0.84,
    halfWidth * 0.36,
    -height * 0.66,
  );
  context.bezierCurveTo(
    halfWidth * 0.72,
    -height * 0.62,
    halfWidth * 0.98,
    -height * 0.25,
    halfWidth,
    height * 0.25,
  );
  context.quadraticCurveTo(0, height * 0.58, -halfWidth, height * 0.25);
  context.closePath();
  context.fill();
  context.restore();
}

function browserRuntime(): DesertTreasureEffectRuntime | null {
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
      new Error(`Failed to load desert treasure reward asset: ${source}`),
    ), { once: true });
  });
}

function clamp(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number): number {
  return 1 - (1 - value) ** 3;
}

function easeInCubic(value: number): number {
  return value ** 3;
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value);
}
