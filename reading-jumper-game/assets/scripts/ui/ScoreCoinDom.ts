import { MotionStageFrame } from '../core/media/DomMotionLayout';
import { ScoreCoinPoint } from '../shared/config/ScoreCoinMotion';

export const SCORE_COIN_ASSET = './effects/score-coin.png';
const COIN_WIDTH = 52;
const COIN_HEIGHT = 55;
const EFFECT_STYLE_ID = 'score-coin-effect-styles';
const SCORE_COIN_BURST_METRICS = {
  source: {
    count: 14,
    durationMs: 920,
    sparkDelayMs: 13,
    cleanupBufferMs: 80,
    flashSize: 28,
    ringSize: 38,
    ringScale: 2.65,
    flashScale: 2.2,
    distanceBase: 38,
    distanceStep: 12,
    sizeBase: 12,
    sizeStep: 3,
  },
  arrival: {
    count: 16,
    durationMs: 650,
    sparkDelayMs: 10,
    cleanupBufferMs: 70,
    flashSize: 46,
    ringSize: 58,
    ringScale: 3.15,
    flashScale: 2.8,
    distanceBase: 46,
    distanceStep: 14,
    sizeBase: 13,
    sizeStep: 4,
  },
} as const;

export type ScoreFlightTrail = 'gold' | 'candy' | 'space' | 'aqua' | 'danger' | 'ink';
export type ScoreFlightTerminal = 'spark' | 'explosion' | 'vortex' | 'ink';

export interface ScoreFlightVisual {
  readonly asset: string;
  readonly width?: number;
  readonly height?: number;
  readonly count?: number;
  readonly trail?: ScoreFlightTrail;
  readonly terminal?: ScoreFlightTerminal;
  readonly rotationTurns?: number;
  readonly minFlipScale?: number;
}

const TERMINAL_METRICS = {
  explosion: {
    width: 240,
    height: 210,
    flashWidth: 128,
    flashHeight: 128,
    ringWidth: 176,
    ringHeight: 154,
    fragments: 20,
    peakMs: 205,
    durationMs: 820,
    removeAfterMs: 900,
  },
  vortex: {
    imageScale: 2.4,
    ringWidth: 198,
    ringHeight: 162,
    flashWidth: 94,
    flashHeight: 94,
    fragments: 16,
    durationMs: 820,
    removeAfterMs: 900,
  },
  ink: {
    mainWidth: 168,
    mainHeight: 126,
    ringWidth: 150,
    ringHeight: 110,
    droplets: 24,
    durationMs: 920,
    removeAfterMs: 980,
  },
} as const;

export function scoreTerminalMetrics(
  terminal: keyof typeof TERMINAL_METRICS,
): (typeof TERMINAL_METRICS)[keyof typeof TERMINAL_METRICS] {
  return TERMINAL_METRICS[terminal];
}

export function scoreTerminalDurationMs(
  visual: Pick<ScoreFlightVisual, 'terminal'>,
): number {
  const terminal = visual.terminal ?? 'spark';
  if (terminal === 'spark') {
    const metrics = SCORE_COIN_BURST_METRICS.arrival;
    return metrics.durationMs
      + metrics.count * metrics.sparkDelayMs
      + metrics.cleanupBufferMs;
  }
  return TERMINAL_METRICS[terminal].removeAfterMs;
}

function ensureScoreCoinStyles(): void {
  if (document.getElementById(EFFECT_STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = EFFECT_STYLE_ID;
  style.textContent = `
@keyframes score-coin-spark {
  0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(.15); }
  14% { opacity: 1; }
  62% { opacity: .95; }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--coin-dx), var(--coin-dy)) rotate(170deg) scale(.05); }
}
@keyframes score-coin-ring {
  0% { opacity: .95; transform: translate(-50%, -50%) scale(.35); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(var(--coin-ring-scale, 2.65)); }
}
@keyframes score-coin-flash {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(0deg) scale(.2); }
  16% { opacity: 1; }
  58% { opacity: .9; }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(45deg) scale(var(--coin-flash-scale, 2.2)); }
}
@keyframes score-terminal-explosion-cloud {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(-8deg) scale(.18); }
  25.7% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1.04); }
  58% { opacity: .96; transform: translate(-50%, -50%) rotate(2deg) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(5deg) scale(1.32); }
}
@keyframes score-terminal-explosion-flash {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(-18deg) scale(.12); }
  25.7% { opacity: 1; transform: translate(-50%, -50%) rotate(0deg) scale(1); }
  52% { opacity: .82; transform: translate(-50%, -50%) rotate(10deg) scale(.84); }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(28deg) scale(1.28); }
}
@keyframes score-terminal-explosion-ring {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.28); }
  25.7% { opacity: .96; transform: translate(-50%, -50%) scale(.82); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.72); }
}
@keyframes score-terminal-explosion-fragment {
  0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(.2); }
  25.7% { opacity: 1; transform: translate(-50%, -50%) translate(var(--fragment-peak-dx), var(--fragment-peak-dy)) rotate(var(--fragment-peak-rotation)) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--fragment-dx), var(--fragment-dy)) rotate(var(--fragment-rotation)) scale(.46); }
}
@keyframes score-terminal-vortex {
  0% { opacity: .15; transform: translate(-50%, -50%) rotate(0deg) scale(.2); }
  38% { opacity: 1; transform: translate(-50%, -50%) rotate(190deg) scale(1.22); }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(720deg) scale(.05); }
}
@keyframes score-terminal-vortex-ring {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(0deg) scale(.22); }
  28% { opacity: .95; transform: translate(-50%, -50%) rotate(110deg) scale(.9); }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(420deg) scale(1.8); }
}
@keyframes score-terminal-vortex-flash {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(0deg) scale(.16); }
  26% { opacity: 1; transform: translate(-50%, -50%) rotate(35deg) scale(1.12); }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(155deg) scale(2.05); }
}
@keyframes score-terminal-vortex-fragment {
  0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(.16); }
  28% { opacity: 1; transform: translate(-50%, -50%) translate(var(--vortex-peak-dx), var(--vortex-peak-dy)) rotate(var(--vortex-peak-rotation)) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--vortex-dx), var(--vortex-dy)) rotate(var(--vortex-rotation)) scale(.24); }
}
@keyframes score-terminal-ink-main {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(-7deg) scale(.14); }
  24% { opacity: .96; transform: translate(-50%, -50%) rotate(1deg) scale(1.03); }
  66% { opacity: .9; transform: translate(-50%, -50%) rotate(-1deg) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(3deg) scale(1.16); }
}
@keyframes score-terminal-ink-ring {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(.28); }
  24% { opacity: .38; transform: translate(-50%, -50%) scale(.72); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.8); }
}
@keyframes score-terminal-ink-droplet {
  0% { opacity: 0; transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(.14); }
  24% { opacity: .92; transform: translate(-50%, -50%) translate(var(--ink-peak-dx), var(--ink-peak-dy)) rotate(var(--ink-peak-rotation)) scale(1); }
  100% { opacity: 0; transform: translate(-50%, -50%) translate(var(--ink-dx), var(--ink-dy)) rotate(var(--ink-rotation)) scale(.72); }
}`;
  document.head.appendChild(style);
}

export function createScoreCoinContainer(id: string): HTMLDivElement {
  ensureScoreCoinStyles();
  const container = document.createElement('div');
  container.id = id;
  Object.assign(container.style, {
    position: 'fixed',
    inset: '0',
    overflow: 'hidden',
    pointerEvents: 'none',
    zIndex: '64',
    display: 'none',
  });
  document.body.appendChild(container);
  const preload = new Image();
  preload.src = SCORE_COIN_ASSET;
  return container;
}

export function createScoreCoinElement(
  index: number,
  visual: ScoreFlightVisual = { asset: SCORE_COIN_ASSET },
): HTMLImageElement {
  const element = document.createElement('img');
  element.alt = '';
  element.draggable = false;
  element.src = visual.asset;
  element.dataset.scoreCoin = String(index);
  Object.assign(element.style, {
    position: 'fixed',
    left: '0',
    top: '0',
    width: '0',
    height: '0',
    opacity: '0',
    visibility: 'hidden',
    pointerEvents: 'none',
    userSelect: 'none',
    willChange: 'left, top, transform, opacity',
    filter: 'drop-shadow(0 2px 2px rgba(117, 67, 0, 0.28))',
  });
  return element;
}

export function renderScoreCoin(
  element: HTMLImageElement,
  frame: MotionStageFrame,
  point: ScoreCoinPoint,
  progress: number,
  index: number,
  rotation: number,
  visual: ScoreFlightVisual = { asset: SCORE_COIN_ASSET },
): ScoreCoinPoint {
  const x = frame.left + (720 + point.x) * frame.scale;
  const y = frame.top + (405 - point.y) * frame.scale;
  const entry = Math.min(1, progress / 0.14);
  const pop = 0.34 + (1 - ((1 - entry) ** 3)) * 0.76;
  const pulse = 0.9 + Math.sin(Math.PI * progress) * 0.2;
  const minFlipScale = visual.minFlipScale ?? 0.48;
  const flip = minFlipScale
    + Math.abs(Math.cos(progress * Math.PI * 4.4 + index)) * (1 - minFlipScale);
  const depth = 0.88 + (index % 4) * 0.055;
  const opacity = progress < 0.95 ? 1 : Math.max(0, (1 - progress) / 0.05);
  Object.assign(element.style, {
    visibility: 'visible',
    left: `${x}px`,
    top: `${y}px`,
    width: `${(visual.width ?? COIN_WIDTH) * frame.scale}px`,
    height: `${(visual.height ?? COIN_HEIGHT) * frame.scale}px`,
    opacity: opacity.toFixed(3),
    transform: [
      'translate(-50%, -50%)',
      `rotate(${rotation * progress}deg)`,
      `scale(${(pop * pulse * flip * depth).toFixed(3)}, ${(pop * pulse * depth).toFixed(3)})`,
    ].join(' '),
  });
  return { x, y };
}

export function spawnScoreCoinBurst(
  container: HTMLDivElement,
  frame: MotionStageFrame,
  point: ScoreCoinPoint,
  mode: 'source' | 'arrival',
  trail: ScoreFlightTrail = 'gold',
): number {
  const screen = mode === 'arrival'
    ? terminalScreenPoint(point, frame, 'spark')
    : stageScreenPoint(point, frame);
  const metrics = SCORE_COIN_BURST_METRICS[mode];
  const count = metrics.count;
  const duration = metrics.durationMs;
  const colors = trailColors(trail);
  const flash = document.createElement('span');
  const flashSize = metrics.flashSize * frame.scale;
  Object.assign(flash.style, {
    position: 'fixed',
    left: `${screen.x}px`,
    top: `${screen.y}px`,
    width: `${flashSize}px`,
    height: `${flashSize}px`,
    background: colors.flash,
    clipPath: 'polygon(50% 0, 59% 39%, 100% 50%, 59% 61%, 50% 100%, 41% 61%, 0 50%, 41% 39%)',
    filter: `drop-shadow(0 0 10px ${colors.rim}) drop-shadow(0 0 18px ${colors.glow})`,
    pointerEvents: 'none',
    animation: `score-coin-flash ${Math.round(duration * 0.72)}ms ease-out forwards`,
  });
  flash.style.setProperty('--coin-flash-scale', String(metrics.flashScale));
  container.appendChild(flash);
  const ring = document.createElement('span');
  const ringSize = metrics.ringSize * frame.scale;
  Object.assign(ring.style, {
    position: 'fixed',
    left: `${screen.x}px`,
    top: `${screen.y}px`,
    width: `${ringSize}px`,
    height: `${ringSize}px`,
    border: `${Math.max(2, 3 * frame.scale)}px solid ${colors.ring}`,
    borderRadius: '50%',
    boxShadow: `0 0 16px ${colors.glow}`,
    pointerEvents: 'none',
    animation: `score-coin-ring ${duration}ms ease-out forwards`,
  });
  ring.style.setProperty('--coin-ring-scale', String(metrics.ringScale));
  container.appendChild(ring);
  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement('span');
    spark.dataset.scoreCoinSpark = `${mode}-${index}`;
    const fraction = index / (count - 1);
    const angle = mode === 'source'
      ? Math.PI * (0.08 + fraction * 0.84)
      : Math.PI * 2 * fraction;
    const distance = metrics.distanceBase + (index % 5) * metrics.distanceStep;
    const size = (metrics.sizeBase + (index % 4) * metrics.sizeStep) * frame.scale;
    Object.assign(spark.style, {
      position: 'fixed',
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: index % 3 === 0 ? colors.flash : (index % 2 === 0 ? colors.light : colors.rim),
      clipPath: 'polygon(50% 0, 61% 37%, 100% 50%, 61% 63%, 50% 100%, 39% 63%, 0 50%, 39% 37%)',
      filter: `drop-shadow(0 0 7px ${colors.glow})`,
      pointerEvents: 'none',
      animation: `score-coin-spark ${duration}ms ${index * metrics.sparkDelayMs}ms ease-out forwards`,
    });
    spark.style.setProperty('--coin-dx', `${Math.cos(angle) * distance * frame.scale}px`);
    spark.style.setProperty('--coin-dy', `${-Math.sin(angle) * distance * frame.scale}px`);
    container.appendChild(spark);
  }
  window.setTimeout(() => {
    flash.remove();
    ring.remove();
    container.querySelectorAll(`[data-score-coin-spark^="${mode}-"]`).forEach((node) => node.remove());
  }, duration + count * metrics.sparkDelayMs + metrics.cleanupBufferMs);
  return count;
}

export function spawnScoreTerminalEffect(
  container: HTMLDivElement,
  frame: MotionStageFrame,
  point: ScoreCoinPoint,
  visual: ScoreFlightVisual,
): number {
  const terminal = visual.terminal ?? 'spark';
  if (terminal === 'spark') {
    return spawnScoreCoinBurst(container, frame, point, 'arrival', visual.trail);
  }
  const screen = terminalScreenPoint(point, frame, terminal);
  if (terminal === 'vortex') {
    const metrics = TERMINAL_METRICS.vortex;
    const nodes: HTMLElement[] = [];
    const vortex = document.createElement('img');
    vortex.dataset.scoreTerminalLayer = 'vortex-image';
    vortex.src = visual.asset;
    vortex.alt = '';
    const width = Number(
      ((visual.width ?? 72) * metrics.imageScale * frame.scale).toFixed(3),
    );
    const height = Number(
      ((visual.height ?? 52) * metrics.imageScale * frame.scale).toFixed(3),
    );
    Object.assign(vortex.style, {
      position: 'fixed',
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      width: `${width}px`,
      height: `${height}px`,
      pointerEvents: 'none',
      filter: 'drop-shadow(0 0 22px rgba(92, 96, 255, .98)) drop-shadow(0 0 34px rgba(68, 203, 255, .74))',
      animation: `score-terminal-vortex ${metrics.durationMs}ms ease-in forwards`,
    });
    container.appendChild(vortex);
    nodes.push(vortex);

    const ring = document.createElement('span');
    ring.dataset.scoreTerminalLayer = 'vortex-ring';
    Object.assign(ring.style, {
      position: 'fixed',
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      width: `${metrics.ringWidth * frame.scale}px`,
      height: `${metrics.ringHeight * frame.scale}px`,
      border: `${Math.max(3, 5 * frame.scale)}px solid rgba(108, 224, 255, .92)`,
      borderRadius: '50%',
      boxShadow: '0 0 15px rgba(104, 231, 255, .94), inset 0 0 14px rgba(91, 97, 255, .78)',
      pointerEvents: 'none',
      animation: `score-terminal-vortex-ring ${metrics.durationMs}ms ease-out forwards`,
    });
    container.appendChild(ring);
    nodes.push(ring);

    const flash = document.createElement('span');
    flash.dataset.scoreTerminalLayer = 'vortex-flash';
    Object.assign(flash.style, {
      position: 'fixed',
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      width: `${metrics.flashWidth * frame.scale}px`,
      height: `${metrics.flashHeight * frame.scale}px`,
      background: 'radial-gradient(circle, #FFFFFF 0 18%, #B8F5FF 34%, #7487FF 60%, rgba(72, 75, 203, .08) 72%)',
      clipPath: 'polygon(50% 0, 59% 37%, 86% 14%, 64% 41%, 100% 50%, 64% 59%, 86% 86%, 59% 63%, 50% 100%, 41% 63%, 14% 86%, 36% 59%, 0 50%, 36% 41%, 14% 14%, 41% 37%)',
      filter: 'drop-shadow(0 0 10px rgba(225, 252, 255, 1)) drop-shadow(0 0 20px rgba(104, 121, 255, .94))',
      pointerEvents: 'none',
      animation: `score-terminal-vortex-flash ${metrics.durationMs}ms ease-out forwards`,
    });
    container.appendChild(flash);
    nodes.push(flash);

    for (let index = 0; index < metrics.fragments; index += 1) {
      const fragment = document.createElement('span');
      fragment.dataset.scoreTerminalFragment = `vortex-${index}`;
      const angle = index / metrics.fragments * Math.PI * 2
        + (index % 2 === 0 ? 0.08 : -0.05);
      const distance = (92 + (index % 5) * 15) * frame.scale;
      const size = (8 + (index % 4) * 3.5) * frame.scale;
      Object.assign(fragment.style, {
        position: 'fixed',
        left: `${screen.x}px`,
        top: `${screen.y}px`,
        width: `${size}px`,
        height: `${size * (index % 3 === 0 ? 1.6 : 0.72)}px`,
        borderRadius: '58% 42% 64% 36%',
        background: index % 3 === 0 ? '#D8FBFF' : (index % 2 === 0 ? '#79DFFF' : '#7582FF'),
        boxShadow: '0 0 7px rgba(92, 203, 255, .92)',
        pointerEvents: 'none',
        animation: `score-terminal-vortex-fragment ${metrics.durationMs}ms ease-out forwards`,
      });
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const rotation = index % 2 === 0 ? 260 + index * 21 : -230 - index * 19;
      fragment.style.setProperty('--vortex-dx', `${dx}px`);
      fragment.style.setProperty('--vortex-dy', `${dy}px`);
      fragment.style.setProperty('--vortex-peak-dx', `${dx * 0.25}px`);
      fragment.style.setProperty('--vortex-peak-dy', `${dy * 0.25}px`);
      fragment.style.setProperty('--vortex-rotation', `${rotation}deg`);
      fragment.style.setProperty('--vortex-peak-rotation', `${rotation * 0.3}deg`);
      container.appendChild(fragment);
      nodes.push(fragment);
    }
    window.setTimeout(
      () => nodes.forEach((node) => node.remove()),
      metrics.removeAfterMs,
    );
    return metrics.fragments;
  }
  if (terminal === 'ink') {
    const metrics = TERMINAL_METRICS.ink;
    const nodes: HTMLElement[] = [];
    const main = document.createElement('span');
    main.dataset.scoreTerminalLayer = 'ink-main';
    Object.assign(main.style, {
      position: 'fixed',
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      width: `${metrics.mainWidth * frame.scale}px`,
      height: `${metrics.mainHeight * frame.scale}px`,
      borderRadius: '58% 42% 63% 37% / 44% 57% 43% 56%',
      background: [
        'radial-gradient(ellipse at 33% 36%, rgba(40, 57, 70, .98) 0 24%, transparent 25%)',
        'radial-gradient(ellipse at 69% 31%, rgba(13, 26, 37, .98) 0 29%, transparent 30%)',
        'radial-gradient(ellipse at 50% 61%, #07131F 0 58%, #02070C 76%, transparent 77%)',
      ].join(','),
      boxShadow: '0 0 6px rgba(5, 13, 20, .78), 0 5px 10px rgba(2, 7, 12, .34)',
      pointerEvents: 'none',
      animation: `score-terminal-ink-main ${metrics.durationMs}ms ease-out forwards`,
    });
    container.appendChild(main);
    nodes.push(main);

    const ring = document.createElement('span');
    ring.dataset.scoreTerminalLayer = 'ink-ring';
    Object.assign(ring.style, {
      position: 'fixed',
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      width: `${metrics.ringWidth * frame.scale}px`,
      height: `${metrics.ringHeight * frame.scale}px`,
      border: `${Math.max(2, 3 * frame.scale)}px solid rgba(28, 48, 64, .42)`,
      borderRadius: '52% 48% 57% 43% / 45% 55% 44% 56%',
      boxShadow: '0 0 12px rgba(20, 38, 54, .18)',
      pointerEvents: 'none',
      animation: `score-terminal-ink-ring ${metrics.durationMs}ms ease-out forwards`,
    });
    container.appendChild(ring);
    nodes.push(ring);

    for (let index = 0; index < metrics.droplets; index += 1) {
      const droplet = document.createElement('span');
      droplet.dataset.scoreTerminalDroplet = String(index);
      const angle = index / metrics.droplets * Math.PI * 2
        + ((index % 3) - 1) * 0.09;
      const distance = (58 + (index % 6) * 13) * frame.scale;
      const size = (7 + (index % 6) * 2.8) * frame.scale;
      Object.assign(droplet.style, {
        position: 'fixed',
        left: `${screen.x}px`,
        top: `${screen.y}px`,
        width: `${size}px`,
        height: `${size * (0.58 + (index % 4) * 0.22)}px`,
        borderRadius: index % 3 === 0
          ? '62% 38% 55% 45% / 48% 62% 38% 52%'
          : '50% 58% 44% 56% / 57% 43% 61% 39%',
        background: index % 4 === 0 ? '#13263A' : '#07131F',
        boxShadow: '0 0 4px rgba(5, 13, 20, .75)',
        pointerEvents: 'none',
        animation: `score-terminal-ink-droplet ${metrics.durationMs}ms ease-out forwards`,
      });
      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;
      const rotation = index % 2 === 0 ? 90 + index * 17 : -72 - index * 13;
      droplet.style.setProperty('--ink-dx', `${dx}px`);
      droplet.style.setProperty('--ink-dy', `${dy}px`);
      droplet.style.setProperty('--ink-peak-dx', `${dx * 0.22}px`);
      droplet.style.setProperty('--ink-peak-dy', `${dy * 0.22}px`);
      droplet.style.setProperty(
        '--ink-rotation',
        `${rotation}deg`,
      );
      droplet.style.setProperty('--ink-peak-rotation', `${rotation * 0.3}deg`);
      container.appendChild(droplet);
      nodes.push(droplet);
    }
    window.setTimeout(
      () => nodes.forEach((node) => node.remove()),
      metrics.removeAfterMs,
    );
    return metrics.droplets;
  }

  const metrics = TERMINAL_METRICS.explosion;
  const nodes: HTMLElement[] = [];
  const cloud = document.createElement('span');
  cloud.dataset.scoreTerminalLayer = 'explosion-cloud';
  Object.assign(cloud.style, {
    position: 'fixed',
    left: `${screen.x}px`,
    top: `${screen.y}px`,
    width: `${metrics.width * frame.scale}px`,
    height: `${metrics.height * frame.scale}px`,
    background: [
      'radial-gradient(circle at 50% 17%, #FF6A36 0 19%, transparent 20%)',
      'radial-gradient(circle at 73% 25%, #F04424 0 21%, transparent 22%)',
      'radial-gradient(circle at 87% 49%, #D72D1D 0 18%, transparent 19%)',
      'radial-gradient(circle at 72% 75%, #EF3E22 0 22%, transparent 23%)',
      'radial-gradient(circle at 49% 84%, #C92319 0 21%, transparent 22%)',
      'radial-gradient(circle at 27% 75%, #F04A27 0 22%, transparent 23%)',
      'radial-gradient(circle at 13% 50%, #D92B1C 0 18%, transparent 19%)',
      'radial-gradient(circle at 28% 26%, #FF5730 0 21%, transparent 22%)',
      'radial-gradient(ellipse at 50% 52%, #EE3A20 0 42%, #B91913 67%, transparent 68%)',
    ].join(','),
    filter: 'drop-shadow(0 0 12px rgba(255, 66, 32, .92)) drop-shadow(0 0 24px rgba(210, 24, 16, .72))',
    pointerEvents: 'none',
    animation: `score-terminal-explosion-cloud ${metrics.durationMs}ms ease-out forwards`,
  });
  container.appendChild(cloud);
  nodes.push(cloud);

  const ring = document.createElement('span');
  ring.dataset.scoreTerminalLayer = 'explosion-ring';
  Object.assign(ring.style, {
    position: 'fixed',
    left: `${screen.x}px`,
    top: `${screen.y}px`,
    width: `${metrics.ringWidth * frame.scale}px`,
    height: `${metrics.ringHeight * frame.scale}px`,
    border: `${Math.max(3, 5 * frame.scale)}px solid rgba(255, 91, 37, .94)`,
    borderRadius: '50%',
    boxShadow: '0 0 10px rgba(255, 159, 45, .9), inset 0 0 9px rgba(255, 58, 28, .72)',
    pointerEvents: 'none',
    animation: `score-terminal-explosion-ring ${metrics.durationMs}ms ease-out forwards`,
  });
  container.appendChild(ring);
  nodes.push(ring);

  const flash = document.createElement('span');
  flash.dataset.scoreTerminalLayer = 'explosion-flash';
  Object.assign(flash.style, {
    position: 'fixed',
    left: `${screen.x}px`,
    top: `${screen.y}px`,
    width: `${metrics.flashWidth * frame.scale}px`,
    height: `${metrics.flashHeight * frame.scale}px`,
    background: 'radial-gradient(circle, #FFFFFF 0 24%, #FFF6A8 43%, #FFD431 68%, rgba(255, 185, 36, .24) 69%)',
    clipPath: 'polygon(50% 0, 59% 35%, 85% 15%, 65% 41%, 100% 50%, 65% 59%, 85% 85%, 59% 65%, 50% 100%, 41% 65%, 15% 85%, 35% 59%, 0 50%, 35% 41%, 15% 15%, 41% 35%)',
    filter: 'drop-shadow(0 0 8px rgba(255, 247, 178, 1)) drop-shadow(0 0 15px rgba(255, 170, 25, .96))',
    pointerEvents: 'none',
    animation: `score-terminal-explosion-flash ${metrics.durationMs}ms ease-out forwards`,
  });
  container.appendChild(flash);
  nodes.push(flash);

  for (let index = 0; index < metrics.fragments; index += 1) {
    const fragment = document.createElement('span');
    fragment.dataset.scoreTerminalFragment = String(index);
    const angle = index / metrics.fragments * Math.PI * 2
      + (index % 2 === 0 ? 0.06 : -0.04);
    const distance = (104 + (index % 5) * 14) * frame.scale;
    const size = (10 + (index % 5) * 3) * frame.scale;
    Object.assign(fragment.style, {
      position: 'fixed',
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      width: `${size}px`,
      height: `${size * (index % 3 === 0 ? 1.55 : 0.78)}px`,
      borderRadius: index % 3 === 0 ? '55% 45% 42% 58%' : '24% 66% 28% 72%',
      background: index % 3 === 0
        ? '#FFF06A'
        : (index % 2 === 0 ? '#FF812F' : '#E52B1B'),
      boxShadow: '0 0 6px rgba(255, 75, 26, .74)',
      pointerEvents: 'none',
      animation: `score-terminal-explosion-fragment ${metrics.durationMs}ms ease-out forwards`,
    });
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const rotation = index % 2 === 0 ? 210 + index * 19 : -190 - index * 17;
    fragment.style.setProperty('--fragment-dx', `${dx}px`);
    fragment.style.setProperty('--fragment-dy', `${dy}px`);
    fragment.style.setProperty('--fragment-peak-dx', `${dx * 0.24}px`);
    fragment.style.setProperty('--fragment-peak-dy', `${dy * 0.24}px`);
    fragment.style.setProperty(
      '--fragment-rotation',
      `${rotation}deg`,
    );
    fragment.style.setProperty(
      '--fragment-peak-rotation',
      `${rotation * 0.28}deg`,
    );
    container.appendChild(fragment);
    nodes.push(fragment);
  }
  window.setTimeout(
    () => nodes.forEach((node) => node.remove()),
    metrics.removeAfterMs,
  );
  return metrics.fragments;
}

export function pointText(point: ScoreCoinPoint): string {
  return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
}

export function screenPointText(point: ScoreCoinPoint, frame: MotionStageFrame): string {
  const screen = stageScreenPoint(point, frame);
  return [screen.x, screen.y].map((value) => value.toFixed(2)).join(',');
}

function stageScreenPoint(point: ScoreCoinPoint, frame: MotionStageFrame): ScoreCoinPoint {
  return {
    x: frame.left + (720 + point.x) * frame.scale,
    y: frame.top + (405 - point.y) * frame.scale,
  };
}

function terminalScreenPoint(
  point: ScoreCoinPoint,
  frame: MotionStageFrame,
  terminal: ScoreFlightTerminal,
): ScoreCoinPoint {
  const screen = stageScreenPoint(point, frame);
  const inset = terminal === 'vortex'
    ? 118
    : terminal === 'explosion' ? 112 : 100;
  const horizontalInset = inset * frame.scale;
  const verticalInset = Math.min(inset, 112) * frame.scale;
  const stageRight = frame.left + 1440 * frame.scale;
  const stageBottom = frame.top + 810 * frame.scale;
  return {
    x: Math.min(
      stageRight - horizontalInset,
      Math.max(frame.left + horizontalInset, screen.x),
    ),
    y: Math.min(
      stageBottom - verticalInset,
      Math.max(frame.top + verticalInset, screen.y),
    ),
  };
}

function trailColors(trail: ScoreFlightTrail): {
  readonly flash: string;
  readonly light: string;
  readonly rim: string;
  readonly ring: string;
  readonly glow: string;
} {
  switch (trail) {
    case 'candy':
      return {
        flash: '#FFFFFF', light: '#FFD8F1', rim: '#FF6BA8',
        ring: 'rgba(255, 129, 188, .95)', glow: 'rgba(255, 82, 153, .9)',
      };
    case 'space':
      return {
        flash: '#FFFFFF', light: '#A9EEFF', rim: '#6D7BFF',
        ring: 'rgba(114, 205, 255, .95)', glow: 'rgba(83, 98, 255, .9)',
      };
    case 'aqua':
      return {
        flash: '#FFFFFF', light: '#A7FFF2', rim: '#29C9E8',
        ring: 'rgba(95, 238, 255, .95)', glow: 'rgba(29, 187, 224, .9)',
      };
    case 'danger':
      return {
        flash: '#FFF6B0', light: '#FF9F43', rim: '#FF3B24',
        ring: 'rgba(255, 92, 42, .96)', glow: 'rgba(255, 46, 24, .92)',
      };
    case 'ink':
      return {
        flash: '#D8ECFF', light: '#52708C', rim: '#14283B',
        ring: 'rgba(42, 68, 91, .95)', glow: 'rgba(7, 20, 31, .88)',
      };
    case 'gold':
    default:
      return {
        flash: '#FFFFFF', light: '#FFF8A8', rim: '#FFD62F',
        ring: 'rgba(255, 226, 74, .95)', glow: 'rgba(255, 207, 25, .95)',
      };
  }
}
