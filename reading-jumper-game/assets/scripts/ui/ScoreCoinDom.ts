import { MotionStageFrame } from '../core/media/DomMotionLayout';
import { ScoreCoinPoint } from '../shared/config/ScoreCoinMotion';

export const SCORE_COIN_ASSET = './effects/score-coin.png';
const COIN_WIDTH = 52;
const COIN_HEIGHT = 55;
const EFFECT_STYLE_ID = 'score-coin-effect-styles';

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
  100% { opacity: 0; transform: translate(-50%, -50%) scale(2.65); }
}
@keyframes score-coin-flash {
  0% { opacity: 0; transform: translate(-50%, -50%) rotate(0deg) scale(.2); }
  16% { opacity: 1; }
  58% { opacity: .9; }
  100% { opacity: 0; transform: translate(-50%, -50%) rotate(45deg) scale(2.2); }
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

export function createScoreCoinElement(index: number): HTMLImageElement {
  const element = document.createElement('img');
  element.alt = '';
  element.draggable = false;
  element.src = SCORE_COIN_ASSET;
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
): ScoreCoinPoint {
  const x = frame.left + (720 + point.x) * frame.scale;
  const y = frame.top + (405 - point.y) * frame.scale;
  const entry = Math.min(1, progress / 0.14);
  const pop = 0.34 + (1 - ((1 - entry) ** 3)) * 0.76;
  const pulse = 0.9 + Math.sin(Math.PI * progress) * 0.2;
  const flip = 0.48 + Math.abs(Math.cos(progress * Math.PI * 4.4 + index)) * 0.52;
  const depth = 0.88 + (index % 4) * 0.055;
  const opacity = progress < 0.95 ? 1 : Math.max(0, (1 - progress) / 0.05);
  Object.assign(element.style, {
    visibility: 'visible',
    left: `${x}px`,
    top: `${y}px`,
    width: `${COIN_WIDTH * frame.scale}px`,
    height: `${COIN_HEIGHT * frame.scale}px`,
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
): number {
  const screen = stageScreenPoint(point, frame);
  const count = mode === 'source' ? 14 : 9;
  const duration = mode === 'source' ? 920 : 520;
  const flash = document.createElement('span');
  const flashSize = (mode === 'source' ? 28 : 22) * frame.scale;
  Object.assign(flash.style, {
    position: 'fixed',
    left: `${screen.x}px`,
    top: `${screen.y}px`,
    width: `${flashSize}px`,
    height: `${flashSize}px`,
    background: '#FFF7A8',
    clipPath: 'polygon(50% 0, 59% 39%, 100% 50%, 59% 61%, 50% 100%, 41% 61%, 0 50%, 41% 39%)',
    filter: 'drop-shadow(0 0 10px #FFD21F) drop-shadow(0 0 18px rgba(255, 210, 31, .9))',
    pointerEvents: 'none',
    animation: `score-coin-flash ${Math.round(duration * 0.72)}ms ease-out forwards`,
  });
  container.appendChild(flash);
  const ring = document.createElement('span');
  const ringSize = (mode === 'source' ? 38 : 30) * frame.scale;
  Object.assign(ring.style, {
    position: 'fixed',
    left: `${screen.x}px`,
    top: `${screen.y}px`,
    width: `${ringSize}px`,
    height: `${ringSize}px`,
    border: `${Math.max(2, 3 * frame.scale)}px solid rgba(255, 226, 74, .95)`,
    borderRadius: '50%',
    boxShadow: '0 0 16px rgba(255, 218, 42, .9)',
    pointerEvents: 'none',
    animation: `score-coin-ring ${duration}ms ease-out forwards`,
  });
  container.appendChild(ring);
  for (let index = 0; index < count; index += 1) {
    const spark = document.createElement('span');
    spark.dataset.scoreCoinSpark = `${mode}-${index}`;
    const fraction = index / (count - 1);
    const angle = mode === 'source'
      ? Math.PI * (0.08 + fraction * 0.84)
      : Math.PI * 2 * fraction;
    const distance = (mode === 'source' ? 38 : 22) + (index % 4) * 12;
    const size = ((mode === 'source' ? 12 : 9) + (index % 3) * 3) * frame.scale;
    Object.assign(spark.style, {
      position: 'fixed',
      left: `${screen.x}px`,
      top: `${screen.y}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: index % 3 === 0 ? '#FFFFFF' : (index % 2 === 0 ? '#FFF8A8' : '#FFD62F'),
      clipPath: 'polygon(50% 0, 61% 37%, 100% 50%, 61% 63%, 50% 100%, 39% 63%, 0 50%, 39% 37%)',
      filter: 'drop-shadow(0 0 7px rgba(255, 207, 25, 1))',
      pointerEvents: 'none',
      animation: `score-coin-spark ${duration}ms ${index * 13}ms ease-out forwards`,
    });
    spark.style.setProperty('--coin-dx', `${Math.cos(angle) * distance * frame.scale}px`);
    spark.style.setProperty('--coin-dy', `${-Math.sin(angle) * distance * frame.scale}px`);
    container.appendChild(spark);
  }
  window.setTimeout(() => {
    flash.remove();
    ring.remove();
    container.querySelectorAll(`[data-score-coin-spark^="${mode}-"]`).forEach((node) => node.remove());
  }, duration + count * 13 + 80);
  return count;
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
