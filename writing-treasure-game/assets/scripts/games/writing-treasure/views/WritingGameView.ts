import { Node } from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { DomMotionSprite } from '../../../core/media/DomMotionSprite';
import { createUiNode } from '../../../core/ui/UiFactory';
import { applyStretchXBackdrop } from '../../../core/ui/ResponsiveRoot';
import { AppConfig } from '../../../shared/config/AppConfig';
import { GameTheme } from '../../../shared/types/Theme';
import { ActionPromptView } from '../../../ui/ActionPromptView';
import { FeedbackView } from '../../../ui/FeedbackView';
import { HudView } from '../../../ui/HudView';
import { QuestionBoardView } from '../../../ui/QuestionBoardView';
import { VoiceAnswerView } from '../../../ui/VoiceAnswerView';
import { ScoreCoinEffectView } from '../../../ui/ScoreCoinEffectView';
import {
  ClassicTreasureEffectView,
  type ClassicTreasureExplosionCallbacks,
} from '../../../ui/ClassicTreasureEffectView';
import { DesertTreasureEffectView } from '../../../ui/DesertTreasureEffectView';
import {
  DinosaurTreasureCorrectEffectView,
  type DinosaurTreasureCorrectCallbacks,
} from '../../../ui/DinosaurTreasureCorrectEffectView';
import {
  DinosaurTreasureWrongEffectView,
  type DinosaurTreasureWrongCallbacks,
} from '../../../ui/DinosaurTreasureWrongEffectView';
import {
  DunhuangTreasureWrongEffectView,
  type DunhuangTreasureWrongEffectCallbacks,
} from '../../../ui/DunhuangTreasureWrongEffectView';
import { MagicBookGroupView } from './MagicBookGroupView';
import { WizardDeerView } from './WizardDeerView';

export class WritingGameView {
  readonly background: Node;
  readonly hud: HudView;
  readonly board: QuestionBoardView;
  readonly books: MagicBookGroupView;
  readonly deer: WizardDeerView;
  readonly feedback: FeedbackView;
  readonly prompt: ActionPromptView;
  readonly voice: VoiceAnswerView;
  readonly scoreCoins: ScoreCoinEffectView;
  private readonly classicTreasureEffect: ClassicTreasureEffectView;
  private readonly desertTreasureEffect: DesertTreasureEffectView;
  private readonly dinosaurTreasureCorrectEffect:
    DinosaurTreasureCorrectEffectView;
  private readonly dinosaurTreasureWrongEffect:
    DinosaurTreasureWrongEffectView;
  private readonly dunhuangTreasureWrongEffect: DunhuangTreasureWrongEffectView;
  private readonly transitionAnchor: Node;
  private readonly transition: DomMotionSprite;
  private transitionTimer = 0;
  private readonly syncBackdrop = () => {
    const sx = applyStretchXBackdrop(this.background);
    this.books?.setBackdropScale(sx);
    this.feedback?.setChoiceColumns(this.books?.columns() ?? [0, 0, 0], sx);
    if (typeof document !== 'undefined') {
      document.body.dataset.playBackdropScale = sx.toFixed(6);
    }
  };

  constructor(
    root: Node,
    firstTheme: GameTheme | undefined,
    onInteract: (index: number) => void,
    onVoiceDown: () => void,
    onVoiceUp: () => void,
    onVoiceCancel: () => void = () => undefined,
  ) {
    this.background = createUiNode(
      root, 'Background', AppConfig.designWidth, AppConfig.designHeight,
    );
    // Stretch-X fills ultrawide letterbox so left/right never show black bars.
    this.hud = new HudView(root, firstTheme?.assets);
    this.board = new QuestionBoardView(root, firstTheme?.assets.questionBoard);
    // Books before deer so Cocos fallback sprites stay under option stones;
    // DomMotion still caps width so idle webp cannot cover option A.
    this.books = new MagicBookGroupView(
      root, firstTheme?.assets, firstTheme?.id ?? 'treasure', onInteract,
    );
    this.deer = new WizardDeerView(
      root,
      firstTheme?.assets.characterIdle ?? '',
      firstTheme?.assets.characterAction ?? '',
      firstTheme?.assets.motion,
      firstTheme?.id ?? 'treasure',
      firstTheme?.assets.feedbackWrong ?? '',
    );
    this.feedback = new FeedbackView(root, this.background);
    this.syncBackdrop();
    if (typeof window !== 'undefined') window.addEventListener('resize', this.syncBackdrop);
    this.prompt = new ActionPromptView(root);
    this.voice = new VoiceAnswerView(
      root, onVoiceDown, onVoiceUp, firstTheme?.assets, onVoiceCancel,
    );
    this.transitionAnchor = createUiNode(root, 'CustomerTransition', 1440, 810);
    this.transitionAnchor.active = false;
    this.transition = new DomMotionSprite(
      this.transitionAnchor,
      null,
      1440,
      810,
      { fit: 'cover', zIndex: 40, fullscreen: true },
    );
    this.scoreCoins = new ScoreCoinEffectView(root);
    this.classicTreasureEffect = new ClassicTreasureEffectView();
    this.desertTreasureEffect = new DesertTreasureEffectView();
    this.dinosaurTreasureCorrectEffect =
      new DinosaurTreasureCorrectEffectView();
    this.dinosaurTreasureWrongEffect =
      new DinosaurTreasureWrongEffectView();
    this.dunhuangTreasureWrongEffect = new DunhuangTreasureWrongEffectView();
  }

  setActive(active: boolean): void {
    if (!active) {
      this.feedback.hide();
      this.prompt.hide();
      this.hideClassicTreasureEffect();
    }
    this.background.active = active;
    this.deer.root.active = active;
    this.setPlayUiVisible(active);
  }

  setPlayUiVisible(visible: boolean): void {
    [this.hud.root, this.board.root, this.voice.root].forEach((node) => {
      node.active = visible;
    });
    this.books.setVisible(visible);
  }

  mount(theme: GameTheme): void {
    spriteLoader.apply(this.background, theme.assets.background, 'cover');
    this.syncBackdrop();
    this.hud.setTheme(theme.assets);
    this.board.setTexture(theme.assets.questionBoard);
    this.deer.setTheme(
      theme.assets.characterIdle,
      theme.assets.characterAction,
      theme.assets.motion,
      theme.id,
      theme.assets.feedbackWrong,
    );
    this.books.setTheme(theme.assets, theme.id);
    this.syncBackdrop();
    this.voice.setTheme(theme.assets);
    if (theme.id === 'treasure' || theme.id === 'magic') {
      this.classicTreasureEffect.preload();
    }
    else this.classicTreasureEffect.hide();
    if (theme.id === 'desert') this.desertTreasureEffect.preload();
    else this.desertTreasureEffect.hide();
    if (theme.id === 'dinosaur') {
      this.dinosaurTreasureCorrectEffect.preload();
      this.dinosaurTreasureWrongEffect.preload();
    } else {
      this.dinosaurTreasureCorrectEffect.hide();
      this.dinosaurTreasureWrongEffect.hide();
    }
  }

  playClassicTreasureDig(
    index: number,
    holdMs: number,
    impactAtMs: readonly number[],
    bobOption = true,
  ): void {
    this.books.playClassicTreasureDig(index, holdMs, impactAtMs, bobOption);
  }

  sinkClassicTreasureOption(index: number): Promise<void> {
    return this.books.sinkClassicTreasureOption(index);
  }

  playDesertTreasureDig(
    index: number,
    impactAtMs: readonly number[],
  ): void {
    this.books.playDesertTreasureDig(index, impactAtMs);
  }

  playDunhuangTreasureCast(
    index: number,
    impactAtMs: readonly number[],
  ): void {
    this.books.playDunhuangTreasureCast(index, impactAtMs);
  }

  breakDunhuangTreasureWall(index: number): Promise<void> {
    return this.books.breakDunhuangTreasureWall(index);
  }

  dropDunhuangTreasureActor(index: number): Promise<void> {
    return this.deer.descendWithDunhuangRubble(this.books.columnX(index));
  }

  openDunhuangTreasureWrongCavity(index: number): Promise<void> {
    return this.books.openDunhuangTreasureWrongCavity(index);
  }

  dropDunhuangTreasureWrongActor(index: number): Promise<void> {
    return this.deer.dropToDunhuangFloor(this.books.columnX(index));
  }

  liftDunhuangTreasureWrongActor(index: number): Promise<void> {
    return this.deer.liftWithDunhuangTornado(this.books.columnX(index));
  }

  playDunhuangTreasureWrongEffect(
    index: number,
    callbacks: DunhuangTreasureWrongEffectCallbacks,
  ): void {
    this.dunhuangTreasureWrongEffect.play(this.books.columnX(index), callbacks);
  }

  playMagicAcademyCast(index: number): void {
    this.books.playMagicAcademyCast(index);
  }

  openMagicAcademyCavity(index: number): Promise<void> {
    return this.books.openMagicAcademyCavity(index);
  }

  dropMagicAcademyActor(
    index: number,
    sitting = false,
  ): Promise<void> {
    return this.deer.dropToMagicAcademyBook(
      this.books.columnX(index),
      sitting,
    );
  }

  prepareMagicAcademyWrongActor(index: number): void {
    this.books.placeMagicAcademyActorBehindBook(index, this.deer.root);
  }

  unlockMagicAcademyBook(
    index: number,
    onOpen?: () => void,
  ): Promise<void> {
    return this.books.unlockMagicAcademyBook(index, onOpen);
  }

  riseMagicAcademyActor(index: number): Promise<void> {
    return this.deer.riseFromMagicAcademyBook(this.books.columnX(index));
  }

  showMagicAcademyWrongBook(index: number): Promise<void> {
    return this.books.showMagicAcademyWrongBook(index);
  }

  launchMagicAcademyWrongActor(index: number): Promise<void> {
    this.books.restoreMagicAcademyActorLayer();
    return this.deer.launchFromMagicAcademyExplosion(
      this.books.columnX(index),
    );
  }

  dropDesertTreasureOption(index: number): Promise<void> {
    return this.books.dropDesertTreasureOption(index);
  }

  prepareDesertWrongSarcophagus(index: number): Promise<void> {
    return this.books.prepareDesertWrongSarcophagus(index);
  }

  dropDesertWrongSarcophagus(index: number): Promise<void> {
    return this.books.dropDesertWrongSarcophagus(index);
  }

  dropDesertTreasureActor(index: number): Promise<void> {
    return this.deer.dropToDesertTreasureChest(this.books.columnX(index));
  }

  dropDesertWrongActor(index: number): Promise<void> {
    return this.deer.dropToDesertTreasurePit(this.books.columnX(index));
  }

  playDesertTreasureReward(index: number): void {
    this.desertTreasureEffect.play(this.books.columnX(index));
  }

  playDesertTreasureBurial(
    index: number,
    onCovered: () => void,
  ): void {
    this.desertTreasureEffect.playBurial(this.books.columnX(index), onCovered);
  }

  prepareDinosaurTreasureCorrect(index: number): void {
    this.books.prepareDinosaurCorrect(index);
  }

  jumpDinosaurTreasureActor(index: number): Promise<void> {
    return this.deer.jumpIntoDinosaurPit(this.books.columnX(index));
  }

  playDinosaurTreasureCorrect(
    index: number,
    callbacks: DinosaurTreasureCorrectCallbacks,
  ): void {
    this.dinosaurTreasureCorrectEffect.play(
      this.books.columnX(index),
      callbacks,
    );
  }

  prepareDinosaurTreasureWrong(index: number): void {
    this.books.prepareDinosaurWrong(index);
    this.books.placeDinosaurWrongEggInFront(index, this.deer.root);
  }

  jumpDinosaurTreasureWrongActor(index: number): Promise<void> {
    return this.deer.jumpIntoDinosaurWrongPit(this.books.columnX(index));
  }

  watchDinosaurTreasureWrongEgg(index: number): Promise<void> {
    return this.books.shakeDinosaurWrongEgg(index);
  }

  hideDinosaurTreasureWrongEgg(index: number): void {
    this.books.hideDinosaurWrongEgg(index);
  }

  playDinosaurTreasureWrong(
    index: number,
    callbacks: DinosaurTreasureWrongCallbacks,
  ): void {
    this.dinosaurTreasureWrongEffect.play(
      this.books.columnX(index),
      callbacks,
    );
  }

  escapeDinosaurTreasureWrongActor(index: number): Promise<void> {
    return this.deer.escapeFromDinosaurWrongPit(this.books.columnX(index));
  }

  chaseDinosaurTreasureWrongActor(index: number): Promise<void> {
    return this.deer.chaseDinosaurTreasureWrongActor(
      this.books.columnX(index),
    );
  }

  playDinosaurTreasureWrongChase(index: number): Promise<void> {
    return new Promise((resolve) => {
      this.dinosaurTreasureWrongEffect.playChase({
        onComplete: resolve,
      });
    });
  }

  returnDinosaurTreasureWrongActor(index: number): Promise<void> {
    return this.deer.returnDinosaurTreasureWrongActor(
      this.books.columnX(index),
    );
  }

  sinkClassicTreasureActor(index: number): Promise<void> {
    return this.deer.sinkToClassicTreasureChest(this.books.columnX(index));
  }

  launchClassicTreasureActor(index: number): Promise<void> {
    return this.deer.launchFromClassicTreasureChest(this.books.columnX(index));
  }

  playClassicTreasureReward(index: number): void {
    this.classicTreasureEffect.playReward(this.books.columnX(index));
  }

  playClassicTreasureExplosion(
    index: number,
    callbacks: ClassicTreasureExplosionCallbacks,
  ): void {
    this.classicTreasureEffect.playExplosion(this.books.columnX(index), callbacks);
  }

  hideClassicTreasureEffect(): void {
    this.classicTreasureEffect.hide();
    this.books.hideClassicTreasureHole();
    this.desertTreasureEffect.hide();
    this.books.hideDesertTreasureHole();
    this.dinosaurTreasureCorrectEffect.hide();
    this.dinosaurTreasureWrongEffect.hide();
    this.dunhuangTreasureWrongEffect.hide();
    this.books.hideDunhuangTreasureBreak();
    this.books.hideMagicAcademyBreak();
  }

  playTransition(source: string | undefined): void {
    if (!source || typeof window === 'undefined') return;
    if (this.transitionTimer) window.clearTimeout(this.transitionTimer);
    this.transitionAnchor.active = true;
    this.ensureTransitionUnderlay(true);
    this.transition.show(source, true);
    if (typeof document !== 'undefined') {
      document.body.dataset.transitionActive = 'true';
      document.body.dataset.transitionSrc = source;
    }
    this.transitionTimer = window.setTimeout(() => {
      this.transition.hide();
      this.transitionAnchor.active = false;
      this.ensureTransitionUnderlay(false);
      this.transitionTimer = 0;
      if (typeof document !== 'undefined') {
        delete document.body.dataset.transitionActive;
      }
    }, AppConfig.transitionSeconds * 1000);
  }

  private ensureTransitionUnderlay(show: boolean): void {
    if (typeof document === 'undefined') return;
    let underlay = document.getElementById('CustomerTransitionUnderlay');
    if (!underlay) {
      underlay = document.createElement('div');
      underlay.id = 'CustomerTransitionUnderlay';
      Object.assign(underlay.style, {
        position: 'fixed',
        inset: '0',
        background: '#6BC4F5',
        zIndex: '39',
        display: 'none',
        pointerEvents: 'none',
      });
      document.body.appendChild(underlay);
    }
    underlay.style.display = show ? 'block' : 'none';
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', this.syncBackdrop);
      if (this.transitionTimer) window.clearTimeout(this.transitionTimer);
    }
    this.transition.dispose();
    this.scoreCoins.dispose();
    this.classicTreasureEffect.dispose();
    this.desertTreasureEffect.dispose();
    this.dinosaurTreasureCorrectEffect.dispose();
    this.dinosaurTreasureWrongEffect.dispose();
    this.dunhuangTreasureWrongEffect.dispose();
    this.deer.dispose();
    this.feedback.dispose();
  }
}
