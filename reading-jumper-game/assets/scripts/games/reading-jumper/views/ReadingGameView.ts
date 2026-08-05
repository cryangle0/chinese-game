import { Node, Vec3 } from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { createUiNode } from '../../../core/ui/UiFactory';
import { applyStretchXBackdrop } from '../../../core/ui/ResponsiveRoot';
import { AppConfig } from '../../../shared/config/AppConfig';
import { GameTheme } from '../../../shared/types/Theme';
import {
  DeepSeaInkEffectView,
  deepSeaInkTarget,
} from '../../../ui/DeepSeaInkEffectView';
import { FeedbackView } from '../../../ui/FeedbackView';
import { HudView } from '../../../ui/HudView';
import { QuestionBoardView } from '../../../ui/QuestionBoardView';
import { ScoreCoinEffectView } from '../../../ui/ScoreCoinEffectView';
import type { ScoreCoinSnapshot } from '../../../ui/ScoreCoinEffectView';
import type { ScoreFlightVisual } from '../../../ui/ScoreCoinDom';
import { WrongFeedbackTopEffectView } from '../../../ui/WrongFeedbackTopEffectView';
import { BrickGroupView } from './BrickGroupView';
import { DeerView } from './DeerView';
import { readingJumpHeight, readingLayout } from '../config/ReadingLayout';
import { ReadingTransitionView } from './ReadingTransitionView';

export class ReadingGameView {
  readonly background: Node;
  readonly hud: HudView;
  readonly board: QuestionBoardView;
  readonly bricks: BrickGroupView;
  readonly deer: DeerView;
  readonly feedback: FeedbackView;
  private readonly transition: ReadingTransitionView;
  private readonly scoreCoins: ScoreCoinEffectView;
  private readonly wrongTopEffect: WrongFeedbackTopEffectView;
  private readonly deepSeaInk: DeepSeaInkEffectView;
  private mountedThemeId = '';
  private readonly syncBackdrop = () => {
    const sx = applyStretchXBackdrop(this.background);
    if (typeof document !== 'undefined') {
      document.body.dataset.playBackdropScale = sx.toFixed(6);
    }
  };

  constructor(
    private readonly root: Node,
    firstTheme: GameTheme | undefined,
    onChoose: (index: number) => void,
  ) {
    this.background = createUiNode(
      root, 'Background', AppConfig.designWidth, AppConfig.designHeight,
    );
    this.syncBackdrop();
    if (typeof window !== 'undefined') window.addEventListener('resize', this.syncBackdrop);
    this.hud = new HudView(root, firstTheme?.assets);
    this.board = new QuestionBoardView(root);
    this.bricks = new BrickGroupView(
      root,
      firstTheme?.assets.option ?? '',
      firstTheme?.assets.optionWrong ?? '',
      onChoose,
    );
    this.deer = new DeerView(
      root,
      firstTheme?.assets.characterIdle ?? '',
      firstTheme?.assets.characterAction ?? '',
      firstTheme?.assets.characterIdleAnimation,
      firstTheme?.assets.characterActionAnimation,
      firstTheme?.assets.characterRunLeftAnimation,
      firstTheme?.assets.characterRunRightAnimation,
      firstTheme?.assets.motion,
    );
    this.feedback = new FeedbackView(
      root,
      new Vec3(0, readingLayout(firstTheme?.id ?? 'mario').feedback.y),
      readingLayout(firstTheme?.id ?? 'mario').feedback.width,
      readingLayout(firstTheme?.id ?? 'mario').feedback.height,
    );
    this.transition = new ReadingTransitionView(root);
    this.scoreCoins = new ScoreCoinEffectView(root);
    this.wrongTopEffect = new WrongFeedbackTopEffectView(root);
    this.deepSeaInk = new DeepSeaInkEffectView();
  }

  setActive(active: boolean): void {
    if (!active) {
      this.feedback.hide();
      this.wrongTopEffect.hide();
      this.deepSeaInk.hide();
    }
    [this.background, this.hud.root, this.board.root, this.deer.root].forEach((node) => {
      node.active = active;
    });
    this.root.children.filter((node) => node.name.startsWith('Brick')).forEach((node) => {
      node.active = active;
    });
  }

  mount(theme: GameTheme): void {
    if (this.mountedThemeId === theme.id) return;
    this.deepSeaInk.hide();
    this.mountedThemeId = theme.id;
    const layout = readingLayout(theme.id);
    spriteLoader.apply(this.background, theme.assets.background, 'cover');
    this.syncBackdrop();
    this.hud.setLayout(layout);
    this.hud.setTheme(theme.assets);
    this.hud.setTextStyle(layout.text.hudOutline);
    this.board.setLayout({
      ...layout.question,
      padTopExtra: layout.questionPadTopExtra,
      padX: layout.questionPadX,
    });
    this.board.setTexture(theme.assets.questionBoard);
    this.board.setTextStyle(layout.text.questionOutline);
    this.bricks.setLayout(layout.option);
    this.bricks.setTheme(theme.assets.option, theme.assets.optionWrong);
    this.bricks.setTextStyle(layout.text.optionOutline);
    this.feedback.setLayout(layout.feedback, theme.id);
    this.deer.setLayout(
      layout.deer,
      layout.option.columns,
      readingJumpHeight(layout),
    );
    this.deer.setTheme(
      theme.assets.characterIdle,
      theme.assets.characterAction,
      theme.assets.characterIdleAnimation,
      theme.assets.characterActionAnimation,
      theme.assets.characterRunLeftAnimation,
      theme.assets.characterRunRightAnimation,
      theme.assets.motion,
    );
    if (theme.id === 'deep-sea') this.deepSeaInk.preload();
  }

  playTransition(source: string | undefined): void {
    this.transition.play(source);
  }

  setFeedbackVisible(visible: boolean): void {
    this.deer.root.active = !visible;
    if (!visible) {
      this.feedback.hide();
      this.wrongTopEffect.hide();
      this.deepSeaInk.hide();
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackActorHandoff = visible ? 'feedback-ready' : 'actor-visible';
    }
  }

  captureScoreRewardOrigin(index: number): ScoreCoinSnapshot | null {
    const origin = this.bricks.scoreRewardOrigin(index);
    return origin ? this.scoreCoins.capture(origin) : null;
  }

  playScoreReward(
    source: ScoreCoinSnapshot | null,
    score: number,
    awarded: number,
    visual: ScoreFlightVisual | undefined,
    onFirstArrival?: () => void,
    onTerminalComplete?: () => void,
  ): void {
    if (!source) {
      if (awarded > 0) this.hud.showScoreReward(score);
      onFirstArrival?.();
      onTerminalComplete?.();
      return;
    }
    this.scoreCoins.play({
      source,
      target: { node: this.hud.scoreRewardTarget() },
      awarded,
      visual,
      onFirstArrival: () => {
        if (awarded > 0) this.hud.showScoreReward(score);
        onFirstArrival?.();
      },
      onTerminalComplete,
    });
  }

  showWrongFeedbackTop(sceneId: string): void {
    this.wrongTopEffect.show(sceneId);
  }

  playDeepSeaInkPopup(index: number, onComplete: () => void): void {
    const layout = readingLayout('deep-sea');
    const columnX = layout.option.columns[index] ?? 0;
    this.deepSeaInk.playPopup(
      deepSeaInkTarget(columnX, layout.option, layout.feedback),
      onComplete,
    );
  }

  playDeepSeaInkSpray(onComplete: () => void): void {
    this.deepSeaInk.playSpray(onComplete);
  }

  renderHud(
    seconds: number,
    score: number,
    lives: number,
    stageIndex: number,
    stageTotal: number,
    stageName: string,
    combo: number,
  ): void {
    this.hud.render({
      seconds, score, lives, stageIndex, stageTotal, stageName, combo,
    });
  }

  dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.syncBackdrop);
    this.transition.dispose();
    this.scoreCoins.dispose();
    this.wrongTopEffect.dispose();
    this.deepSeaInk.dispose();
    this.deer.dispose();
    this.feedback.dispose();
  }
}
