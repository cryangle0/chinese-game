import { Node, Vec3 } from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { DomMotionSprite } from '../core/media/DomMotionSprite';
import { createLabel, createUiNode, drawPanel } from '../core/ui/UiFactory';
import {
  applyStretchXBackdrop,
  clearResultLayoutDiagnostics,
  setResultLayoutDiagnostics,
} from '../core/ui/ResponsiveRoot';
import { AppConfig } from '../shared/config/AppConfig';
import { WritingSettlementLayout } from '../shared/config/WritingSettlementLayout';
import { GameResult } from '../shared/types/GameTypes';
import { GameTheme } from '../shared/types/Theme';
import { buildStandardResult } from './results/StandardResultView';
import { buildTreasureResult } from './results/TreasureResultView';
import {
  addCustomerActions, buildCustomerResult,
} from './results/CustomerResultView';
import { createResultCharacterMotion } from './results/ResultCharacterMotion';

export interface ResultViewOptions {
  readonly title?: string;
  readonly primaryLabel?: string;
  readonly homeLabel?: string;
  readonly primaryOnly?: boolean;
}

export class ResultView {
  readonly root: Node;
  private readonly background: Node;
  private readonly artwork: Node;
  private readonly foregroundPositions = new WeakMap<Node, Vec3>();
  private readonly motion: DomMotionSprite | null;
  private readonly resize = () => this.applyBackdropTransform();

  constructor(
    parent: Node,
    result: GameResult,
    replay: () => void,
    home: (() => void) | null,
    theme: GameTheme,
    share?: (imageUrl?: string) => boolean | Promise<boolean>,
    options: ResultViewOptions = {},
  ) {
    this.root = createUiNode(parent, 'ResultOverlay', AppConfig.designWidth, AppConfig.designHeight);
    this.background = createUiNode(
      this.root, 'ResultBackground', AppConfig.designWidth, AppConfig.designHeight,
    );
    this.artwork = createUiNode(
      this.root, 'ResultArtwork', AppConfig.designWidth, AppConfig.designHeight,
    );
    const resultBackground = theme.assets.resultBackground ?? theme.assets.background;
    spriteLoader.apply(this.background, resultBackground, 'cover');
    this.applyBackdropTransform();
    if (typeof window !== 'undefined') window.addEventListener('resize', this.resize);
    this.motion = createResultCharacterMotion(this.artwork, this.root, theme);
    const hostShare = share
      ? () => Promise.resolve(share()).then((accepted) => accepted !== false)
      : undefined;
    const builtCustomer = this.buildCustomerResult(
      result, theme, replay, home, hostShare, options,
    );
    const builtTreasure = builtCustomer
      ? false
      : this.buildTreasureResult(result, theme, replay, home, hostShare, options);
    if (!builtCustomer && !builtTreasure) {
      buildStandardResult(
        this.root, result, theme, replay, home, hostShare, options, this.title(result),
      );
    }
    this.applyBackdropTransform();
  }

  private buildCustomerResult(
    result: GameResult,
    theme: GameTheme,
    replay: () => void,
    home: (() => void) | null,
    share: (() => boolean | Promise<boolean>) | undefined,
    options: ResultViewOptions,
  ): boolean {
    const useCustomerResult = Boolean(theme.assets.resultBackground)
      && Boolean(theme.assets.resultRankLabels?.length)
      && Boolean(WritingSettlementLayout[theme.id]);
    if (!useCustomerResult) return false;
    this.addFailureTitle(this.artwork, result);
    buildCustomerResult(this.artwork, result, theme, this.root);
    addCustomerActions(this.artwork, replay, home, share, options);
    this.applyBackdropTransform();
    return true;
  }

  private buildTreasureResult(
    result: GameResult,
    theme: GameTheme,
    replay: () => void,
    home: (() => void) | null,
    share: (() => boolean | Promise<boolean>) | undefined,
    options: ResultViewOptions,
  ): boolean {
    if (!theme.assets.resultBackground || theme.id !== 'treasure') return false;
    buildTreasureResult(
      this.artwork, this.artwork, result, theme.assets,
      options.title ?? this.title(result), replay, home, share, options,
    );
    this.applyBackdropTransform();
    return true;
  }

  dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.resize);
    clearResultLayoutDiagnostics();
    this.motion?.dispose();
    this.root.destroy();
  }

  private applyBackdropTransform(): void {
    // Fill the viewport with the background only; settlement artwork remains 1:1.
    const sx = applyStretchXBackdrop(this.background);
    this.artwork.setScale(1, 1, 1);
    this.artwork.setPosition(0, 0);
    this.applyForegroundPositionScale(sx);
    setResultLayoutDiagnostics(sx, 1, 1, 0);
    if (typeof document !== 'undefined') {
      document.body.style.setProperty('background', '#68B03A', 'important');
      document.body.style.setProperty('background-color', '#68B03A', 'important');
      document.body.dataset.resultUniform = '1';
      document.body.dataset.resultBleedMode = 'stretch-x';
      document.body.dataset.resultPositionScaleX = sx.toFixed(6);
    }
  }

  private applyForegroundPositionScale(sx: number): void {
    const visit = (parent: Node): void => {
      parent.children.forEach((child) => {
        if (child === this.background) return;
        let base = this.foregroundPositions.get(child);
        if (!base) {
          base = child.position.clone();
          this.foregroundPositions.set(child, base);
        }
        child.setPosition(base.x * sx, base.y, base.z);
        visit(child);
      });
    };
    visit(this.root);
  }

  private addFailureTitle(parent: Node, result: GameResult): void {
    if (result.reason === 'completed') return;
    const frame = createUiNode(parent, 'FailureTitleFrame', 300, 70, new Vec3(0, 300));
    drawPanel(frame, '#773914', 24, 250);
    const panel = createUiNode(frame, 'FailureTitlePanel', 288, 58);
    drawPanel(panel, '#E88A2C', 20, 255);
    const title = createLabel(panel, this.title(result), {
      size: 30, color: '#FFF8D8', width: 250, height: 52, bold: true,
      outlineColor: '#8A3B12', outlineWidth: 3,
    });
    title.node.setPosition(0, 1);
  }

  private title(result: GameResult): string {
    const titles = {
      completed: '闯关完成',
      lives: '本次挑战结束',
      timeout: '时间到',
      empty: '暂无可用题目',
      error: '游戏暂时无法继续',
      exit: '游戏已结束',
    } as const;
    return titles[result.reason];
  }
}
