import { Node } from 'cc';
import { createGameActionButton } from '../../core/ui/UiFactory';
import { createResultActionGate } from './ResultActionGate';

export interface CustomerResultOptions {
  readonly primaryLabel?: string;
  readonly homeLabel?: string;
  readonly primaryOnly?: boolean;
}

/** Horizontal center of 排行榜 + 答题回顾 band (html ~480..1355 → cocos x). */
const ACTIONS_CENTER_X = 198;
/** Sit under the board after the whole settlement shifts down. */
const ACTIONS_Y = -318;
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

export function addCustomerActions(
  root: Node,
  replay: () => void,
  home: (() => void) | null,
  share: (() => boolean | Promise<boolean>) | undefined,
  options: CustomerResultOptions,
): void {
  if (options.primaryOnly) {
    createGameActionButton(
      root, options.primaryLabel ?? '再玩一次', BTN_W, replay,
      { rim: '#0E6B45', fill: '#4AD68A', gloss: 0, text: '#14452C' },
    ).setPosition(ACTIONS_CENTER_X, ACTIONS_Y);
    if (typeof document !== 'undefined') delete document.body.dataset.resultShare;
    return;
  }

  type Slot = { build: (x: number) => void };
  const slots: Slot[] = [];
  const addPrimary = (): void => {
    slots.push({
      build: (x) => {
        createGameActionButton(
          root, options.primaryLabel ?? '再玩一次', BTN_W, replay,
          { rim: '#0E6B45', fill: '#4AD68A', gloss: 0, text: '#14452C' },
        ).setPosition(x, ACTIONS_Y);
      },
    });
  };
  const addShare = (): void => {
    if (!share) return;
    slots.push({
      build: (x) => {
        const activate = createResultActionGate(() => { void Promise.resolve(share()); });
        createGameActionButton(
          root, '分享成绩', BTN_W, activate,
          { rim: '#A85A12', fill: '#FFC04A', gloss: 0, text: '#6B2E0A' },
        ).setPosition(x, ACTIONS_Y);
        installCanvasFallback(root, x, activate);
      },
    });
  };
  const addHome = (): void => {
    if (!home) return;
    slots.push({
      build: (x) => {
        createGameActionButton(
          root, options.homeLabel ?? '返回首页', BTN_W, home,
          { rim: '#1A4F8A', fill: '#5AA8F0', gloss: 0, text: '#123A66' },
        ).setPosition(x, ACTIONS_Y);
      },
    });
  };

  // Stage: 分享成绩 | 进入下一关 — share sits left of the green CTA.
  // Final: 再玩一次 | 分享成绩 | 返回首页
  if (!home && share) {
    addShare();
    addPrimary();
  } else {
    addPrimary();
    addShare();
    addHome();
  }

  const startX = ACTIONS_CENTER_X - ((slots.length - 1) * BTN_STEP) / 2;
  slots.forEach((slot, index) => slot.build(startX + index * BTN_STEP));

  if (typeof document !== 'undefined') {
    if (share) document.body.dataset.resultShare = '1';
    else delete document.body.dataset.resultShare;
  }
}
