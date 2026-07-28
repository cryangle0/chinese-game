import { Node, UITransform, Vec3 } from 'cc';
import { resolveMotionStageFrame } from '../core/media/DomMotionLayout';
import {
  ScoreCoinPoint,
  scoreCoinCount,
  scoreCoinTrackPoint,
} from '../shared/config/ScoreCoinMotion';
import {
  createScoreCoinContainer,
  createScoreCoinElement,
  pointText,
  renderScoreCoin,
  screenPointText,
  spawnScoreCoinBurst,
} from './ScoreCoinDom';

const FLIGHT_MS = 980;
const STAGGER_MS = 34;

export interface ScoreCoinOrigin {
  readonly node: Node;
  readonly localPoint?: Vec3;
}

export interface ScoreCoinSnapshot extends ScoreCoinPoint {
  readonly name: string;
}

export interface ScoreCoinPlayOptions {
  readonly source: ScoreCoinOrigin | ScoreCoinSnapshot;
  readonly target: ScoreCoinOrigin;
  readonly awarded: number;
  readonly onFirstArrival?: () => void;
}

interface ActiveCoin {
  readonly element: HTMLImageElement;
  readonly rotation: number;
  arrived: boolean;
}

export class ScoreCoinEffectView {
  private readonly container: HTMLDivElement | null;
  private animationFrame = 0;
  private runId = 0;

  constructor(private readonly stageRoot: Node) {
    if (typeof document === 'undefined') {
      this.container = null;
      return;
    }
    this.container = createScoreCoinContainer(`ScoreCoinEffect-${stageRoot.uuid}`);
  }

  capture(origin: ScoreCoinOrigin): ScoreCoinSnapshot | null {
    const point = this.stagePoint(origin);
    return point ? { ...point, name: origin.node.name } : null;
  }

  play(options: ScoreCoinPlayOptions): void {
    const sourceIsLive = 'node' in options.source;
    const start = sourceIsLive ? this.stagePoint(options.source) : options.source;
    const end = this.stagePoint(options.target);
    const count = scoreCoinCount(options.awarded);
    if (!start || !end || !this.container || count === 0) {
      options.onFirstArrival?.();
      return;
    }
    const canvas = document.getElementById('GameCanvas');
    if (!(canvas instanceof HTMLCanvasElement)) {
      options.onFirstArrival?.();
      return;
    }

    this.stopActive();
    const runId = this.runId;
    this.container.style.display = 'block';
    const coins = Array.from({ length: count }, (_, index): ActiveCoin => {
      const element = createScoreCoinElement(index);
      this.container!.appendChild(element);
      return {
        element,
        rotation: (index % 2 === 0 ? 1 : -1) * (260 + index * 27),
        arrived: false,
      };
    });

    const initialFrame = resolveMotionStageFrame(canvas);
    Object.assign(document.body.dataset, {
      scoreCoinActive: 'true',
      scoreCoinStart: pointText(start),
      scoreCoinEnd: pointText(end),
      scoreCoinStartScreen: screenPointText(start, initialFrame),
      scoreCoinEndScreen: screenPointText(end, initialFrame),
      scoreCoinCount: String(count),
      scoreCoinAwarded: String(options.awarded),
      scoreCoinAudio: 'coin',
      scoreCoinSource: sourceIsLive ? options.source.node.name : options.source.name,
      scoreCoinSourceMode: sourceIsLive ? 'live' : 'snapshot',
      scoreCoinTarget: options.target.node.name,
      scoreCoinPhase: 'burst',
    });
    document.body.dataset.scoreCoinSparkCount =
      String(spawnScoreCoinBurst(this.container, initialFrame, start, 'source'));

    let firstArrived = false;
    const startedAt = performance.now();
    const tick = (now: number): void => {
      if (runId !== this.runId || !this.container) return;
      const stageFrame = resolveMotionStageFrame(canvas);
      let complete = true;
      coins.forEach((coin, index) => {
        const elapsed = now - startedAt - index * STAGGER_MS;
        if (elapsed < 0) {
          complete = false;
          coin.element.style.visibility = 'hidden';
          return;
        }
        const progress = Math.min(1, elapsed / FLIGHT_MS);
        if (progress < 1) complete = false;
        const point = scoreCoinTrackPoint(start, end, index, progress);
        const screen = renderScoreCoin(
          coin.element, stageFrame, point, progress, index, coin.rotation,
        );
        if (progress >= 1 && !coin.arrived) {
          coin.arrived = true;
          if (!firstArrived) {
            firstArrived = true;
            document.body.dataset.scoreCoinArrivalScreen =
              `${screen.x.toFixed(2)},${screen.y.toFixed(2)}`;
            document.body.dataset.scoreCoinPhase = 'arrival';
            spawnScoreCoinBurst(this.container!, stageFrame, end, 'arrival');
            options.onFirstArrival?.();
          }
        }
      });
      if (!firstArrived) {
        document.body.dataset.scoreCoinPhase =
          now - startedAt < FLIGHT_MS * 0.28 ? 'burst' : 'flight';
      }
      if (!complete) {
        this.animationFrame = requestAnimationFrame(tick);
        return;
      }
      this.animationFrame = 0;
      coins.forEach((coin) => coin.element.remove());
      window.setTimeout(() => {
        if (runId !== this.runId || !this.container) return;
        this.container.replaceChildren();
        this.container.style.display = 'none';
        document.body.dataset.scoreCoinActive = 'false';
        document.body.dataset.scoreCoinPhase = 'complete';
      }, 120);
    };
    this.animationFrame = requestAnimationFrame(tick);
  }

  dispose(): void {
    this.stopActive();
    this.container?.remove();
  }
  private stagePoint(origin: ScoreCoinOrigin): ScoreCoinPoint | null {
    if (!origin.node.isValid || !this.stageRoot.isValid) return null;
    const nodeTransform = origin.node.getComponent(UITransform);
    const stageTransform = this.stageRoot.getComponent(UITransform);
    if (!nodeTransform || !stageTransform) return null;
    const world = nodeTransform.convertToWorldSpaceAR(origin.localPoint?.clone() ?? Vec3.ZERO);
    const local = stageTransform.convertToNodeSpaceAR(world);
    return { x: local.x, y: local.y };
  }

  private stopActive(): void {
    this.runId += 1;
    if (this.animationFrame) cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.container?.replaceChildren();
    if (this.container) this.container.style.display = 'none';
    if (typeof document !== 'undefined') document.body.dataset.scoreCoinActive = 'false';
  }
}
