import { Node, Vec3 } from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { DomMotionSprite } from '../core/media/DomMotionSprite';
import {
  createLabel, createUiNode, drawPanel,
} from '../core/ui/UiFactory';
import {
  applyStretchXBackdrop, clearResultLayoutDiagnostics, setResultLayoutDiagnostics,
} from '../core/ui/ResponsiveRoot';
import { AppConfig } from '../shared/config/AppConfig';
import { GameResult } from '../shared/types/GameTypes';
import { GameTheme } from '../shared/types/Theme';
import { ResultReviewView } from './results/ResultReviewView';
import { addReadingResultActions } from './results/ReadingResultActions';
import { ResultSummaryView } from './results/ResultSummaryView';
import { ThemedResultContent } from './results/ThemedResultContent';
import { resultThemeLayout } from './results/ResultThemeLayout';
import { ResultViewOptions } from './results/ResultViewOptions';

export type { ResultViewOptions } from './results/ResultViewOptions';

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
    const hasThemedBackground = Boolean(theme.assets.resultBackground);
    this.root = createUiNode(parent, 'ResultOverlay', AppConfig.designWidth, AppConfig.designHeight);
    this.background = createUiNode(
      this.root,
      'ResultBackground',
      AppConfig.designWidth,
      AppConfig.designHeight,
    );
    this.artwork = createUiNode(
      this.root,
      'ResultArtwork',
      AppConfig.designWidth,
      AppConfig.designHeight,
    );
    const resultBackground = theme.assets.resultBackground ?? theme.assets.background;
    spriteLoader.apply(this.background, resultBackground, 'cover');
    this.applyBackdropTransform();
    if (typeof window !== 'undefined') window.addEventListener('resize', this.resize);
    this.motion = this.addResultMotion(theme, this.artwork);
    const panel = createUiNode(
      this.root,
      'ResultPanel',
      1050,
      620,
      new Vec3(hasThemedBackground ? 200 : 115, 0),
    );
    if (hasThemedBackground) {
      new ThemedResultContent(
        this.artwork,
        result,
        theme,
        options.rankingMaxScore,
      );
      this.addFailureTitle(this.artwork, result);
    } else {
      this.addLegacyContent(panel, result, theme, options);
    }
    const hostShare = share
      ? () => Promise.resolve(share()).then((accepted) => accepted !== false)
      : undefined;
    addReadingResultActions(this.artwork, replay, home, hostShare, options, theme);
    this.applyBackdropTransform();
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
      document.body.dataset.resultUniform = '1';
      document.body.dataset.resultBleedMode = 'stretch-x';
      document.body.dataset.resultPositionScaleX = sx.toFixed(6);
    }
  }

  private applyForegroundPositionScale(sx: number): void {
    const scalePosition = (node: Node): void => {
      let base = this.foregroundPositions.get(node);
      if (!base) {
        base = node.position.clone();
        this.foregroundPositions.set(node, base);
      }
      node.setPosition(base.x * sx, base.y, base.z);
    };
    this.root.children.forEach((child) => {
      if (child === this.background) return;
      scalePosition(child);
      // Artwork children are positioned against the stretched background.
      // Their nested labels remain local to their own material bounds.
      if (child === this.artwork) child.children.forEach(scalePosition);
    });
  }

  private addResultMotion(theme: GameTheme, parent: Node): DomMotionSprite | null {
    if (!theme.assets.resultBackground || !theme.assets.motion?.result) return null;
    const layout = resultThemeLayout(theme.id).motion;
    const character = createUiNode(
      parent,
      'ResultCharacterMotion',
      layout.width,
      layout.height,
      new Vec3(layout.x, layout.y),
    );
    const fallback = createUiNode(
      character,
      'ResultCharacterFallback',
      layout.width,
      layout.height,
    );
    spriteLoader.apply(fallback, theme.assets.characterIdle, 'contain');
    const motion = new DomMotionSprite(
      character,
      fallback,
      layout.width,
      layout.height,
      { zIndex: 7, contentRoot: this.root, fit: 'contain', objectPosition: 'center bottom' },
    );
    motion.show(theme.assets.motion.result);
    return motion;
  }

  private addLegacyContent(
    panel: Node,
    result: GameResult,
    theme: GameTheme,
    options: ResultViewOptions,
  ): void {
    drawPanel(panel, theme.palette.panel, 24, 224);
    const title = createLabel(this.root, options.title ?? this.title(result), {
      size: 44, color: '#FFFFFF', width: 520, height: 64, bold: true,
    });
    title.node.setPosition(115, 320);
    const character = createUiNode(this.root, 'ResultCharacter', 300, 420, new Vec3(-565, -65));
    spriteLoader.apply(character, theme.assets.characterIdle, 'contain');
    new ResultSummaryView(panel, result, theme.palette);
    new ResultReviewView(panel, result, theme.palette);
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
