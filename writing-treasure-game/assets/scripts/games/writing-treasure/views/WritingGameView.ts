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
  private readonly transitionAnchor: Node;
  private readonly transition: DomMotionSprite;
  private transitionTimer = 0;
  private readonly syncBackdrop = () => {
    const sx = applyStretchXBackdrop(this.background);
    this.books?.setBackdropScale(sx);
    this.feedback?.setChoiceColumns(this.books?.columns() ?? [0, 0, 0]);
    if (typeof document !== 'undefined') {
      document.body.dataset.playBackdropScale = sx.toFixed(6);
    }
  };

  constructor(
    private readonly root: Node,
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
  }

  setActive(active: boolean): void {
    if (!active) {
      this.feedback.hide();
      this.prompt.hide();
    }
    [this.background, this.hud.root, this.board.root, this.deer.root, this.voice.root].forEach((node) => {
      node.active = active;
    });
    this.root.children.filter((node) => node.name.startsWith('MagicBook')).forEach((node) => {
      node.active = active;
    });
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
    );
    this.books.setTheme(theme.assets, theme.id);
    this.syncBackdrop();
    this.voice.setTheme(theme.assets);
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
    this.deer.dispose();
    this.feedback.dispose();
  }
}
