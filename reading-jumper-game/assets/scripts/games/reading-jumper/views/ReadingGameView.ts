import { Node, Vec3 } from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { createUiNode } from '../../../core/ui/UiFactory';
import { applyStretchXBackdrop } from '../../../core/ui/ResponsiveRoot';
import { AppConfig } from '../../../shared/config/AppConfig';
import { GameTheme } from '../../../shared/types/Theme';
import { FeedbackView } from '../../../ui/FeedbackView';
import { HudView } from '../../../ui/HudView';
import { QuestionBoardView } from '../../../ui/QuestionBoardView';
import { BrickGroupView } from './BrickGroupView';
import { DeerView } from './DeerView';
import { readingLayout } from '../config/ReadingLayout';
import { ReadingTransitionView } from './ReadingTransitionView';

export class ReadingGameView {
  readonly background: Node;
  readonly hud: HudView;
  readonly board: QuestionBoardView;
  readonly bricks: BrickGroupView;
  readonly deer: DeerView;
  readonly feedback: FeedbackView;
  private readonly transition: ReadingTransitionView;
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
      firstTheme?.assets.motion,
    );
    this.feedback = new FeedbackView(
      root,
      new Vec3(0, readingLayout(firstTheme?.id ?? 'mario').feedback.y),
      readingLayout(firstTheme?.id ?? 'mario').feedback.width,
      readingLayout(firstTheme?.id ?? 'mario').feedback.height,
    );
    this.transition = new ReadingTransitionView(root);
  }

  setActive(active: boolean): void {
    if (!active) this.feedback.hide();
    [this.background, this.hud.root, this.board.root, this.deer.root].forEach((node) => {
      node.active = active;
    });
    this.root.children.filter((node) => node.name.startsWith('Brick')).forEach((node) => {
      node.active = active;
    });
  }

  mount(theme: GameTheme): void {
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
    this.feedback.setLayout(layout.feedback);
    this.deer.setLayout(layout.deer, layout.option.columns);
    this.deer.setTheme(
      theme.assets.characterIdle,
      theme.assets.characterAction,
      theme.assets.characterIdleAnimation,
      theme.assets.characterActionAnimation,
      theme.assets.motion,
    );
  }

  playTransition(source: string | undefined): void {
    this.transition.play(source);
  }

  setFeedbackVisible(visible: boolean): void {
    this.deer.root.active = !visible;
    if (!visible) this.feedback.hide();
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
    this.deer.dispose();
    this.feedback.dispose();
  }
}
