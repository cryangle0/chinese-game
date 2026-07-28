import { Node } from 'cc';
import { createGameActionButton } from '../../core/ui/UiFactory';
import { GameTheme } from '../../shared/types/Theme';
import { createResultActionGate } from './ResultActionGate';
import { resultThemeLayout } from './ResultThemeLayout';
import { ResultViewOptions } from './ResultViewOptions';

const ACTIONS_Y = -280;
const BTN_W = 220;
const BTN_STEP = 248;

function installCanvasFallback(root: Node, centerX: number, activate: () => void): void {
  if (typeof document === 'undefined') return;
  const canvas = document.getElementById('GameCanvas');
  if (!canvas) return;
  const pointerUp = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(bounds.width / 1440, bounds.height / 810);
    const offsetX = (bounds.width - 1440 * scale) / 2;
    const offsetY = (bounds.height - 810 * scale) / 2;
    const x = (event.clientX - bounds.left - offsetX) / scale - 720;
    const y = 405 - (event.clientY - bounds.top - offsetY) / scale;
    const positionScaleX = Number(document.body.dataset.resultPositionScaleX) || 1;
    if (Math.abs(x - centerX * positionScaleX) <= BTN_W / 2
      && Math.abs(y - ACTIONS_Y) <= 30) activate();
  };
  canvas.addEventListener('pointerup', pointerUp, true);
  root.once(Node.EventType.NODE_DESTROYED, () => {
    canvas.removeEventListener('pointerup', pointerUp, true);
  });
}

export function addReadingResultActions(
  parent: Node,
  replay: () => void,
  home: (() => void) | null,
  share: (() => boolean | Promise<boolean>) | undefined,
  options: ResultViewOptions,
  theme: GameTheme,
): void {
  const layout = resultThemeLayout(theme.id);
  const centerX = theme.assets.resultBackground
    ? Math.round((layout.rank.x + layout.review.x) / 2)
    : 0;
  if (options.primaryOnly) {
    addPrimary(parent, centerX, replay, options.primaryLabel);
    return;
  }
  const slots: Array<(x: number) => void> = [
    (x) => addPrimary(parent, x, replay, options.primaryLabel),
  ];
  if (share) slots.push((x) => addShare(parent, x, share));
  if (home) slots.push((x) => addHome(parent, x, home, options.homeLabel));
  const start = centerX - ((slots.length - 1) * BTN_STEP) / 2;
  slots.forEach((build, index) => build(start + index * BTN_STEP));
}

function addPrimary(
  parent: Node,
  x: number,
  replay: () => void,
  label?: string,
): void {
  createGameActionButton(
    parent, label ?? '再玩一次', BTN_W, replay,
    { rim: '#0E6B45', fill: '#4AD68A', gloss: 0, text: '#14452C' },
  ).setPosition(x, ACTIONS_Y);
}

function addShare(
  parent: Node,
  x: number,
  share: () => boolean | Promise<boolean>,
): void {
  const activate = createResultActionGate(() => { void Promise.resolve(share()); });
  createGameActionButton(
    parent, '分享成绩', BTN_W, activate,
    { rim: '#A85A12', fill: '#FFC04A', gloss: 0, text: '#6B2E0A' },
  ).setPosition(x, ACTIONS_Y);
  installCanvasFallback(parent, x, activate);
}

function addHome(
  parent: Node,
  x: number,
  home: () => void,
  label?: string,
): void {
  createGameActionButton(
    parent, label ?? '返回首页', BTN_W, home,
    { rim: '#1A4F8A', fill: '#5AA8F0', gloss: 0, text: '#123A66' },
  ).setPosition(x, ACTIONS_Y);
}
