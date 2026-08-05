import { resolveMotionStageFrame } from '../core/media/DomMotionLayout';
import { DUNHUANG_TREASURE_FEEDBACK } from '../shared/config/DunhuangTreasureFeedback';

export interface DunhuangTreasureWrongEffectCallbacks {
  readonly onLiftStart?: () => void;
  readonly onReveal?: () => void;
  readonly onComplete?: () => void;
}

export interface DunhuangTreasureWrongEffectRuntime {
  readonly document: Document;
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
}

const CANVAS_WIDTH = 900;
const CANVAS_HEIGHT = 900;
const EFFECT_ORIGIN_X = 450;
const IMPACT_CANVAS_Y = 720;
const EFFECT_Z_INDEX = 7;
const TORNADO_BOTTOM_HALF_WIDTH = 38;
const TORNADO_RING_COUNT = 11;
const TORNADO_PARTICLE_COUNT = 44;
const TORNADO_DEBRIS_COUNT = 13;

const CRACK_RAYS = Array.from({ length: 13 }, (_, index) => ({
  angle: -Math.PI + 0.12 + index * (Math.PI - 0.24) / 12,
  length: 48 + (index * 37) % 98,
  fork: 0.34 + (index % 4) * 0.1,
  width: 2.4 + (index % 3) * 0.8,
}));

export class DunhuangTreasureWrongEffectView {
  private readonly element: HTMLCanvasElement | null;
  private readonly context: CanvasRenderingContext2D | null;
  private animationFrame = 0;
  private runId = 0;
  private disposed = false;

  constructor(
    private readonly runtime: DunhuangTreasureWrongEffectRuntime | null = browserRuntime(),
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
    element.id = 'DunhuangTreasureWrongEffect';
    element.width = CANVAS_WIDTH;
    element.height = CANVAS_HEIGHT;
    element.dataset.dunhuangTreasureWrongEffectCanvas = '1';
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

  play(
    columnX: number,
    callbacks: DunhuangTreasureWrongEffectCallbacks = {},
  ): void {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.context
      || !this.prepare(columnX)
    ) {
      callbacks.onLiftStart?.();
      callbacks.onReveal?.();
      callbacks.onComplete?.();
      return;
    }
    const runId = this.runId;
    const startedAt = this.runtime.now();
    let liftStarted = false;
    let revealed = false;
    const tick = (now: number): void => {
      if (runId !== this.runId || this.disposed) return;
      this.animationFrame = 0;
      const elapsedMs = Math.max(0, now - startedAt);
      this.draw(elapsedMs);
      this.positionAt(columnX);
      if (
        !liftStarted
        && elapsedMs >= DUNHUANG_TREASURE_FEEDBACK.wrongActorLiftStartMs
      ) {
        liftStarted = true;
        callbacks.onLiftStart?.();
      }
      if (
        !revealed
        && elapsedMs >= DUNHUANG_TREASURE_FEEDBACK.wrongRevealMs
      ) {
        revealed = true;
        callbacks.onReveal?.();
      }
      if (typeof document !== 'undefined') {
        document.body.dataset.dunhuangTreasureWrongEffectProgress = clamp(
          elapsedMs / DUNHUANG_TREASURE_FEEDBACK.wrongEffectDurationMs,
        ).toFixed(3);
      }
      if (elapsedMs >= DUNHUANG_TREASURE_FEEDBACK.wrongEffectDurationMs) {
        if (!liftStarted) callbacks.onLiftStart?.();
        if (!revealed) callbacks.onReveal?.();
        this.finish(callbacks.onComplete);
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

  private prepare(columnX: number): boolean {
    if (
      !this.runtime
      || !this.element
      || !this.context
      || !this.stageCanvas()
    ) return false;
    this.stopActive();
    if (!this.element.isConnected) this.runtime.document.body.appendChild(this.element);
    this.element.style.display = 'block';
    this.positionAt(columnX);
    Object.assign(this.runtime.document.body.dataset, {
      dunhuangTreasureWrongEffect: 'floor-impact',
      dunhuangTreasureWrongRenderer: 'programmatic-tornado-canvas',
      dunhuangTreasureWrongColumnX: columnX.toFixed(2),
    });
    return true;
  }

  private draw(elapsedMs: number): void {
    if (!this.context) return;
    const context = this.context;
    context.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    const impactProgress = clamp(
      elapsedMs / DUNHUANG_TREASURE_FEEDBACK.wrongImpactDurationMs,
    );
    drawFloorImpact(context, impactProgress);
    const tornadoElapsedMs = Math.max(
      0,
      elapsedMs - DUNHUANG_TREASURE_FEEDBACK.wrongTornadoStartMs,
    );
    if (tornadoElapsedMs <= 0) return;
    const grow = easeOutCubic(clamp(
      tornadoElapsedMs / DUNHUANG_TREASURE_FEEDBACK.wrongTornadoGrowMs,
    ));
    const fade = 1 - easeInCubic(clamp(
      (
        elapsedMs - DUNHUANG_TREASURE_FEEDBACK.wrongTornadoFadeStartMs
      ) / DUNHUANG_TREASURE_FEEDBACK.wrongTornadoFadeMs,
    ));
    drawTornado(context, elapsedMs / 1000, grow, fade);
    if (typeof document !== 'undefined') {
      document.body.dataset.dunhuangTreasureWrongEffect =
        grow < 0.96 ? 'tornado-growing' : fade < 0.98 ? 'tornado-fading' : 'tornado-full';
      document.body.dataset.dunhuangTreasureTornadoHeight = (
        DUNHUANG_TREASURE_FEEDBACK.wrongTornadoHeight * grow
      ).toFixed(1);
    }
  }

  private positionAt(columnX: number): void {
    if (!this.element) return;
    const canvas = this.stageCanvas();
    if (!canvas) return;
    const stage = resolveMotionStageFrame(canvas);
    const designX = 720 + columnX;
    const designY = 405 - DUNHUANG_TREASURE_FEEDBACK.wrongImpactY;
    Object.assign(this.element.style, {
      left: `${stage.left + (designX - EFFECT_ORIGIN_X) * stage.scale}px`,
      top: `${stage.top + (designY - IMPACT_CANVAS_Y) * stage.scale}px`,
      width: `${CANVAS_WIDTH * stage.scale}px`,
      height: `${CANVAS_HEIGHT * stage.scale}px`,
    });
  }

  private stageCanvas(): HTMLCanvasElement | null {
    return this.runtime?.document.getElementById('GameCanvas') as HTMLCanvasElement | null;
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
        'dunhuangTreasureWrongEffect',
        'dunhuangTreasureWrongRenderer',
        'dunhuangTreasureWrongColumnX',
        'dunhuangTreasureWrongEffectProgress',
        'dunhuangTreasureTornadoHeight',
      ].forEach((field) => {
        delete this.runtime!.document.body.dataset[field];
      });
    }
  }
}

function drawFloorImpact(
  context: CanvasRenderingContext2D,
  progress: number,
): void {
  if (progress <= 0) return;
  const reveal = easeOutCubic(clamp(progress / 0.32));
  const fade = 1 - easeInCubic(clamp((progress - 0.58) / 0.42));
  context.save();
  context.translate(EFFECT_ORIGIN_X, IMPACT_CANVAS_Y);
  context.globalCompositeOperation = 'screen';
  context.shadowColor = 'rgba(255,221,72,0.92)';
  context.shadowBlur = 18;
  CRACK_RAYS.forEach((ray, index) => {
    const length = ray.length * reveal;
    const bend = Math.sin(index * 2.31) * 14;
    const endX = Math.cos(ray.angle) * length;
    const endY = Math.sin(ray.angle) * length * 0.34;
    const midX = endX * ray.fork + bend;
    const midY = endY * ray.fork - 3 - (index % 3) * 2;
    context.strokeStyle = `rgba(255,239,124,${0.9 * fade})`;
    context.lineWidth = ray.width;
    context.beginPath();
    context.moveTo(0, 0);
    context.lineTo(midX, midY);
    context.lineTo(endX, endY);
    context.stroke();
    if (index % 2 === 0) {
      context.strokeStyle = `rgba(255,255,225,${0.82 * fade})`;
      context.lineWidth = Math.max(1, ray.width * 0.36);
      context.beginPath();
      context.moveTo(0, 0);
      context.lineTo(midX, midY);
      context.lineTo(endX, endY);
      context.stroke();
    }
  });
  const flash = context.createRadialGradient(0, 0, 0, 0, 0, 86 * reveal);
  flash.addColorStop(0, `rgba(255,255,232,${0.96 * fade})`);
  flash.addColorStop(0.28, `rgba(255,220,64,${0.68 * fade})`);
  flash.addColorStop(1, 'rgba(255,178,34,0)');
  context.fillStyle = flash;
  context.beginPath();
  context.ellipse(0, 0, 86 * reveal, 24 * reveal, 0, 0, Math.PI * 2);
  context.fill();
  context.restore();

  context.save();
  context.globalAlpha = fade * clamp(progress / 0.2);
  for (let index = 0; index < 18; index += 1) {
    const angle = -Math.PI + index * Math.PI / 17;
    const distance = (24 + (index * 19) % 78) * reveal;
    const x = EFFECT_ORIGIN_X + Math.cos(angle) * distance;
    const y = IMPACT_CANVAS_Y
      + Math.sin(angle) * distance * 0.2
      - Math.sin(progress * Math.PI) * (18 + (index % 5) * 7);
    context.fillStyle = index % 3 === 0
      ? 'rgba(255,211,98,0.78)'
      : 'rgba(201,126,48,0.68)';
    context.beginPath();
    context.arc(x, y, 3 + (index % 4) * 1.5, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawTornado(
  context: CanvasRenderingContext2D,
  timeSeconds: number,
  grow: number,
  fade: number,
): void {
  if (grow <= 0 || fade <= 0) return;
  const height = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoHeight;
  const visibleHeight = (height + 70) * grow;
  const topY = IMPACT_CANVAS_Y - height;
  const pulse = 0.97 + Math.sin(timeSeconds * 8.4) * 0.03;
  context.save();
  context.beginPath();
  context.rect(
    0,
    IMPACT_CANVAS_Y - visibleHeight - 42,
    CANVAS_WIDTH,
    visibleHeight + 112,
  );
  context.clip();
  context.globalAlpha = fade;

  drawTornadoOuterDust(context, timeSeconds, grow);

  context.save();
  context.shadowColor = 'rgba(202,139,35,0.3)';
  context.shadowBlur = 28;
  const core = context.createLinearGradient(
    EFFECT_ORIGIN_X - 250,
    0,
    EFFECT_ORIGIN_X + 250,
    0,
  );
  core.addColorStop(0, 'rgba(211,148,43,0.34)');
  core.addColorStop(0.18, 'rgba(229,171,66,0.78)');
  core.addColorStop(0.43, 'rgba(246,202,112,0.9)');
  core.addColorStop(0.64, 'rgba(221,158,48,0.82)');
  core.addColorStop(0.86, 'rgba(241,190,89,0.74)');
  core.addColorStop(1, 'rgba(201,136,34,0.28)');
  context.fillStyle = core;
  traceTornadoBody(context, timeSeconds, pulse);
  context.fill();
  context.restore();

  drawTornadoRibbons(context, timeSeconds, pulse);
  drawTornadoRings(context, timeSeconds, pulse);
  drawTornadoDebris(context, timeSeconds, grow);
  drawTornadoParticles(context, timeSeconds, grow);

  context.save();
  context.globalCompositeOperation = 'screen';
  context.globalAlpha = 0.24 + grow * 0.18;
  const highlight = context.createLinearGradient(
    EFFECT_ORIGIN_X - 70,
    0,
    EFFECT_ORIGIN_X + 110,
    0,
  );
  highlight.addColorStop(0, 'rgba(255,221,135,0)');
  highlight.addColorStop(0.45, 'rgba(255,222,140,0.68)');
  highlight.addColorStop(0.62, 'rgba(255,238,181,0.48)');
  highlight.addColorStop(1, 'rgba(255,210,116,0)');
  context.fillStyle = highlight;
  traceTornadoBody(context, timeSeconds + 0.28, 0.48);
  context.fill();
  context.restore();

  drawTornadoCap(context, timeSeconds, topY, grow);
  drawTornadoBase(context, timeSeconds, grow);
  context.restore();
}

function traceTornadoBody(
  context: CanvasRenderingContext2D,
  timeSeconds: number,
  widthScale: number,
): void {
  const height = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoHeight;
  const topHalfWidth = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoTopWidth / 2;
  const left: Array<readonly [number, number]> = [];
  const right: Array<readonly [number, number]> = [];
  const steps = 30;
  for (let index = 0; index <= steps; index += 1) {
    const ratio = index / steps;
    const y = IMPACT_CANVAS_Y - height * ratio;
    const widening = ratio ** 0.7;
    const edgeWave = Math.sin(ratio * 15.6 - timeSeconds * 8.8) * (8 + ratio * 18)
      + Math.sin(ratio * 31.4 + timeSeconds * 5.2) * (3 + ratio * 7);
    const centerWave = Math.sin(ratio * 9.2 + timeSeconds * 4.6) * (7 + ratio * 24)
      + Math.sin(ratio * 19.4 - timeSeconds * 3.3) * (2 + ratio * 8);
    const halfWidth = (
      TORNADO_BOTTOM_HALF_WIDTH
      + (topHalfWidth - TORNADO_BOTTOM_HALF_WIDTH) * widening
    ) * widthScale;
    left.push([EFFECT_ORIGIN_X + centerWave - halfWidth - edgeWave, y]);
    right.push([EFFECT_ORIGIN_X + centerWave + halfWidth + edgeWave * 0.72, y]);
  }
  context.beginPath();
  context.moveTo(left[0]![0], left[0]![1]);
  left.slice(1).forEach(([x, y]) => context.lineTo(x, y));
  [...right].reverse().forEach(([x, y]) => context.lineTo(x, y));
  context.closePath();
}

function drawTornadoRibbons(
  context: CanvasRenderingContext2D,
  timeSeconds: number,
  pulse: number,
): void {
  const height = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoHeight;
  const topHalfWidth = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoTopWidth / 2;
  const ribbonColors = [
    'rgba(214,151,43,0.28)',
    'rgba(248,205,118,0.3)',
    'rgba(225,166,57,0.32)',
    'rgba(255,218,139,0.26)',
    'rgba(207,142,35,0.3)',
    'rgba(239,184,80,0.28)',
  ] as const;
  ribbonColors.forEach((fill, ribbonIndex) => {
    const left: Array<readonly [number, number]> = [];
    const right: Array<readonly [number, number]> = [];
    const steps = 24;
    for (let index = 0; index <= steps; index += 1) {
      const ratio = index / steps;
      const y = IMPACT_CANVAS_Y - height * ratio;
      const halfWidth = (
        TORNADO_BOTTOM_HALF_WIDTH
        + (topHalfWidth - TORNADO_BOTTOM_HALF_WIDTH) * ratio ** 0.72
      ) * pulse;
      const orbit = Math.sin(
        ratio * (13.2 + ribbonIndex * 0.74)
        - timeSeconds * (7.2 + ribbonIndex * 0.46)
        + ribbonIndex * 1.18,
      );
      const centerWave = Math.sin(ratio * 8.5 + timeSeconds * 4.2) * ratio * 20;
      const centerX = EFFECT_ORIGIN_X
        + centerWave
        + orbit * halfWidth * (0.42 + (ribbonIndex % 3) * 0.1);
      const bandHalfWidth = 8 + ratio * (12 + (ribbonIndex % 3) * 5);
      left.push([centerX - bandHalfWidth, y]);
      right.push([centerX + bandHalfWidth, y]);
    }
    context.save();
    context.fillStyle = fill;
    context.shadowColor = fill;
    context.shadowBlur = 12;
    context.beginPath();
    context.moveTo(left[0]![0], left[0]![1]);
    left.slice(1).forEach(([x, y]) => context.lineTo(x, y));
    [...right].reverse().forEach(([x, y]) => context.lineTo(x, y));
    context.closePath();
    context.fill();
    context.restore();
  });
}

function drawTornadoRings(
  context: CanvasRenderingContext2D,
  timeSeconds: number,
  pulse: number,
): void {
  const height = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoHeight;
  const topWidth = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoTopWidth;
  for (let index = 0; index < TORNADO_RING_COUNT; index += 1) {
    const ratio = (index + 0.5) / TORNADO_RING_COUNT;
    const y = IMPACT_CANVAS_Y - height * ratio
      + Math.sin(timeSeconds * 6.4 + index * 1.7) * (4 + ratio * 8);
    const width = (
      82 + (topWidth - 82) * ratio ** 0.72
    ) * pulse;
    const centerX = EFFECT_ORIGIN_X
      + Math.sin(timeSeconds * 4.8 + ratio * 10.2) * ratio * 30;
    const tilt = Math.sin(timeSeconds * 3.6 + index * 0.91) * 0.12;
    const alpha = 0.26 + (index % 4) * 0.055;
    context.save();
    context.translate(centerX, y);
    context.rotate(tilt);
    context.strokeStyle = `rgba(235,169,82,${alpha})`;
    context.lineWidth = 12 + ratio * 24;
    context.lineCap = 'round';
    context.shadowColor = 'rgba(199,136,34,0.3)';
    context.shadowBlur = 12;
    context.beginPath();
    context.ellipse(
      0,
      0,
      width / 2,
      12 + ratio * 22,
      0,
      -Math.PI * 0.88 + ((index + 1) % 3) * 0.18,
      Math.PI * 0.58 + (index % 2) * 0.28,
    );
    context.stroke();
    context.strokeStyle = `rgba(215,150,42,${alpha * 0.72})`;
    context.lineWidth = 6 + ratio * 12;
    context.beginPath();
    context.ellipse(
      0,
      2,
      width * 0.44,
      9 + ratio * 17,
      0,
      -Math.PI * 0.18,
      Math.PI * 0.94,
    );
    context.stroke();
    context.restore();
  }
}

function drawTornadoCap(
  context: CanvasRenderingContext2D,
  timeSeconds: number,
  topY: number,
  grow: number,
): void {
  const width = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoTopWidth;
  const wobble = Math.sin(timeSeconds * 4.8) * 18;
  context.save();
  context.translate(EFFECT_ORIGIN_X + wobble, topY + 18);
  context.rotate(Math.sin(timeSeconds * 3.2) * 0.045);
  const cap = context.createRadialGradient(-48, -9, 24, 0, 0, width * 0.56);
  cap.addColorStop(0, 'rgba(249,207,120,0.86)');
  cap.addColorStop(0.48, 'rgba(226,166,61,0.78)');
  cap.addColorStop(0.82, 'rgba(240,190,88,0.52)');
  cap.addColorStop(1, 'rgba(205,139,34,0)');
  context.fillStyle = cap;
  context.shadowColor = 'rgba(205,140,35,0.4)';
  context.shadowBlur = 30;
  context.beginPath();
  context.ellipse(0, 0, width * 0.57 * grow, 66 * grow, 0, 0, Math.PI * 2);
  context.fill();
  context.strokeStyle = 'rgba(245,189,101,0.52)';
  context.lineWidth = 24;
  context.beginPath();
  context.ellipse(0, -4, width * 0.48 * grow, 36 * grow, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();
}

function drawTornadoBase(
  context: CanvasRenderingContext2D,
  timeSeconds: number,
  grow: number,
): void {
  context.save();
  context.translate(EFFECT_ORIGIN_X, IMPACT_CANVAS_Y + 5);
  const base = context.createRadialGradient(0, 0, 6, 0, 0, 172);
  base.addColorStop(0, `rgba(246,185,91,${0.78 * grow})`);
  base.addColorStop(0.36, `rgba(226,164,57,${0.62 * grow})`);
  base.addColorStop(1, 'rgba(202,136,32,0)');
  context.fillStyle = base;
  context.beginPath();
  context.ellipse(
    Math.sin(timeSeconds * 5.4) * 8,
    0,
    176 * grow,
    39 * grow,
    0,
    0,
    Math.PI * 2,
  );
  context.fill();
  context.restore();
}

function drawTornadoOuterDust(
  context: CanvasRenderingContext2D,
  timeSeconds: number,
  grow: number,
): void {
  const height = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoHeight;
  const topWidth = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoTopWidth;
  context.save();
  context.globalAlpha = 0.24 + grow * 0.22;
  context.shadowColor = 'rgba(207,141,35,0.38)';
  context.shadowBlur = 24;
  for (let index = 0; index < 15; index += 1) {
    const ratio = ((index / 15) + timeSeconds * 0.07) % 1;
    const width = 68 + (topWidth - 68) * ratio ** 0.72;
    const orbit = timeSeconds * 2.9 + index * 1.91;
    const x = EFFECT_ORIGIN_X
      + Math.cos(orbit) * width * (0.34 + (index % 3) * 0.08);
    const y = IMPACT_CANVAS_Y - height * ratio
      + Math.sin(orbit * 1.3) * 16;
    const radius = 24 + ratio * 36 + (index % 4) * 7;
    context.fillStyle = index % 2 === 0
      ? 'rgba(239,185,82,0.5)'
      : 'rgba(218,155,48,0.44)';
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawTornadoParticles(
  context: CanvasRenderingContext2D,
  timeSeconds: number,
  grow: number,
): void {
  const height = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoHeight;
  const topWidth = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoTopWidth;
  context.save();
  for (let index = 0; index < TORNADO_PARTICLE_COUNT; index += 1) {
    const ratio = ((index / TORNADO_PARTICLE_COUNT) + timeSeconds * 0.16) % 1;
    if (ratio > grow + 0.08) continue;
    const width = 64 + (topWidth - 64) * ratio ** 0.72;
    const orbit = timeSeconds * (4.4 + (index % 5) * 0.22) + index * 2.17;
    const x = EFFECT_ORIGIN_X
      + Math.cos(orbit) * width * (0.32 + (index % 4) * 0.08);
    const y = IMPACT_CANVAS_Y - height * ratio
      + Math.sin(orbit * 1.4) * 9;
    const radius = 2.5 + (index % 5) * 1.35 + ratio * 3;
    context.globalAlpha = 0.34 + (index % 4) * 0.1;
    context.fillStyle = index % 3 === 0 ? '#F6CB7D' : '#D99B36';
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
  }
  context.restore();
}

function drawTornadoDebris(
  context: CanvasRenderingContext2D,
  timeSeconds: number,
  grow: number,
): void {
  const height = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoHeight;
  const topWidth = DUNHUANG_TREASURE_FEEDBACK.wrongTornadoTopWidth;
  for (let index = 0; index < TORNADO_DEBRIS_COUNT; index += 1) {
    const ratio = ((index / TORNADO_DEBRIS_COUNT) + timeSeconds * 0.11) % 1;
    if (ratio > grow + 0.04) continue;
    const width = 70 + (topWidth - 70) * ratio ** 0.7;
    const orbit = timeSeconds * (3.1 + (index % 4) * 0.24) + index * 2.63;
    const x = EFFECT_ORIGIN_X
      + Math.cos(orbit) * width * (0.37 + (index % 3) * 0.08);
    const y = IMPACT_CANVAS_Y - height * ratio;
    const size = 7 + (index % 4) * 3;
    context.save();
    context.translate(x, y);
    context.rotate(orbit * 0.74);
    context.globalAlpha = 0.48 + (index % 3) * 0.12;
    context.fillStyle = index % 2 === 0 ? '#E9B454' : '#CE902E';
    context.beginPath();
    context.moveTo(-size, -size * 0.38);
    context.lineTo(size * 0.82, -size * 0.58);
    context.lineTo(size, size * 0.32);
    context.lineTo(-size * 0.72, size * 0.62);
    context.closePath();
    context.fill();
    context.restore();
  }
}

function browserRuntime(): DunhuangTreasureWrongEffectRuntime | null {
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
  };
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
