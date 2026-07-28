import { Button, Node, Tween, tween, Vec3 } from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { createUiNode } from '../core/ui/UiFactory';
import { applyStretchXBackdrop } from '../core/ui/ResponsiveRoot';
import { AppConfig } from '../shared/config/AppConfig';
import { IntroTheme } from '../shared/types/Theme';
import { IntroBookPicker } from './IntroBookPicker';
import { playIntroStartTransition } from './IntroStartTransition';

export interface GameIntroStartOptions {
  /** Fires once when the start FX begins (click or jump). */
  onBeginFx?: () => void;
  /** Prefill cover book (e.g. `?book=`). */
  initialBook?: string;
}

export class GameIntroView {
  readonly root: Node;
  private started = false;
  private readonly bookPicker: IntroBookPicker;
  private readonly background: Node;
  private readonly button: Node;
  private readonly character: Node;
  private readonly startControl: Button;
  private readonly onStart: (book: string) => void;
  private readonly onBeginFx?: () => void;
  private readonly syncBackdrop = () => applyStretchXBackdrop(this.background);

  constructor(
    parent: Node,
    theme: IntroTheme,
    start: (book: string) => void,
    options: GameIntroStartOptions = {},
  ) {
    this.onStart = start;
    this.onBeginFx = options.onBeginFx;
    this.root = createUiNode(parent, 'GameIntro', 1440, 810);
    this.background = createUiNode(
      this.root, 'Background', AppConfig.designWidth, AppConfig.designHeight,
    );
    spriteLoader.apply(this.background, theme.background, 'cover');
    this.syncBackdrop();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.syncBackdrop);
      this.root.once(Node.EventType.NODE_DESTROYED, () => {
        window.removeEventListener('resize', this.syncBackdrop);
      });
    }
    if (theme.rewardTube) {
      const rewardTube = createUiNode(this.root, 'RewardTube', 172, 194, new Vec3(-545, 310));
      spriteLoader.apply(rewardTube, theme.rewardTube, 'contain');
    }
    const title = createUiNode(this.root, 'Title', 748, 156, new Vec3(-9, 220));
    spriteLoader.apply(title, theme.title, 'contain');
    const guide = createUiNode(this.root, 'Guide', 370, 36, new Vec3(0, 115));
    spriteLoader.apply(guide, theme.guide, 'contain');
    this.button = createUiNode(this.root, 'Start', 410, 105, new Vec3(0, 40));
    spriteLoader.apply(this.button, theme.startButton, 'contain');
    const pipeBack = createUiNode(this.root, 'PipeBack', 205, 90, new Vec3(0, -286));
    if (theme.pipeBack) spriteLoader.apply(pipeBack, theme.pipeBack, 'stretch');
    else pipeBack.active = false;
    this.character = createUiNode(this.root, 'Character', 138, 242, new Vec3(0, -161));
    spriteLoader.apply(this.character, theme.character, 'contain');
    const pipeFront = createUiNode(this.root, 'PipeFront', 205, 90, new Vec3(0, -286));
    if (theme.pipeFront) spriteLoader.apply(pipeFront, theme.pipeFront, 'stretch');
    else pipeFront.active = false;
    if (theme.startLabel) {
      const label = createUiNode(this.button, 'StartLabel', 132, 78);
      spriteLoader.apply(label, theme.startLabel, 'contain');
    }
    this.startControl = this.button.addComponent(Button);
    this.startControl.transition = Button.Transition.SCALE;

    this.bookPicker = new IntroBookPicker(this.root, options.initialBook, {
      y: 348,
      chip: { rim: '#D45512', fill: '#FFD24A' },
      icon: { cover: '#E85D4C', pages: '#FFF8E8' },
      caret: { fill: '#FF9A45', rim: '#C44E14' },
      text: '#6B2E0A',
      outline: '#FFF6D8',
      dropdown: {
        fill: '#FFF8E8',
        rim: '#D45512',
        rowActive: '#FFD24A',
        rowIdle: '#FFFFFF',
        labelColor: '#6B2E0A',
      },
    });

    this.button.on(Button.EventType.CLICK, this.triggerStart);
    tween(this.character)
      .repeatForever(tween().by(0.8, { position: new Vec3(0, 12) }).by(0.8, { position: new Vec3(0, -12) }))
      .start();
    if (typeof window !== 'undefined'
      && /(?:\?|&)qa=intro-fx(?:&|$)/.test(window.location.search)) {
      (window as unknown as { __triggerIntroStart?: () => void })
        .__triggerIntroStart = () => this.triggerStart();
    }
  }

  /** Click or pose-jump entry — plays shatter FX, then start callback. */
  triggerStart = (): void => {
    if (this.started) return;
    this.started = true;
    this.startControl.interactable = false;
    this.button.off(Button.EventType.CLICK, this.triggerStart);
    this.bookPicker.close();
    Tween.stopAllByTarget(this.character);
    Tween.stopAllByTarget(this.bookPicker.root);
    if (typeof document !== 'undefined') {
      document.body.dataset.introStartFx = '1';
    }
    this.onBeginFx?.();
    playIntroStartTransition({
      root: this.root,
      button: this.button,
      character: this.character,
      onDone: () => {
        if (typeof document !== 'undefined') {
          document.body.dataset.introStartFx = 'done';
        }
        this.onStart(this.bookPicker.selectedBook());
      },
    });
  };
}
