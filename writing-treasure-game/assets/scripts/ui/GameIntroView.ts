import { Button, Node, Tween, tween, Vec3 } from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { createUiNode } from '../core/ui/UiFactory';
import { applyStretchXBackdrop } from '../core/ui/ResponsiveRoot';
import { AppConfig } from '../shared/config/AppConfig';
import { box } from '../shared/config/WritingPlayLayout';
import { IntroTheme } from '../shared/types/Theme';
import { IntroBookPicker } from './IntroBookPicker';

/** From `独立HTML像素级UI原型/writing/pages/00-intro.html`. */
const Intro = {
  title: box(483, 76, 899, 286),
  // Boots into grass fringe (ridge ~Y480–500); top=112 floated badly; 160 still looked light.
  character: box(104, 178, 338, 343),
  guide: box(691, 337, 510, 57),
  start: box(720, 406, 435, 120),
} as const;

export interface GameIntroStartOptions {
  initialBook?: string;
}

export class GameIntroView {
  readonly root: Node;
  private readonly background: Node;
  private readonly bookPicker: IntroBookPicker;
  private readonly syncBackdrop = () => applyStretchXBackdrop(this.background);

  constructor(
    parent: Node,
    theme: IntroTheme,
    start: (book: string) => void,
    options: GameIntroStartOptions = {},
  ) {
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

    const title = createUiNode(
      this.root, 'Title', Intro.title.size[0], Intro.title.size[1], Intro.title.position,
    );
    spriteLoader.apply(title, theme.title, 'contain');
    const character = createUiNode(
      this.root, 'Character', Intro.character.size[0], Intro.character.size[1],
      Intro.character.position,
    );
    spriteLoader.apply(character, theme.character, 'contain');
    const guide = createUiNode(
      this.root, 'Guide', Intro.guide.size[0], Intro.guide.size[1], Intro.guide.position,
    );
    spriteLoader.apply(guide, theme.guide, 'contain');
    const button = createUiNode(
      this.root, 'Start', Intro.start.size[0], Intro.start.size[1], Intro.start.position,
    );
    spriteLoader.apply(button, theme.startButton, 'contain');
    if (theme.startLabel) {
      const label = createUiNode(button, 'StartLabel', 132, 78);
      spriteLoader.apply(label, theme.startLabel, 'contain');
    }
    const startControl = button.addComponent(Button);
    startControl.transition = Button.Transition.SCALE;

    this.bookPicker = new IntroBookPicker(this.root, options.initialBook, {
      y: 360,
      chip: { rim: '#A86A28', fill: '#FFE6A8' },
      icon: { cover: '#2FA36A', pages: '#FFF8E8' },
      caret: { fill: '#F0B24A', rim: '#8B5A2B' },
      text: '#5A3210',
      outline: '#FFF8E8',
      dropdown: {
        fill: '#FFF8E8',
        rim: '#A86A28',
        rowActive: '#FFE08A',
        rowIdle: '#FFFFFF',
        labelColor: '#5A3210',
      },
    });

    let started = false;
    const startOnce = () => {
      if (started) return;
      started = true;
      startControl.interactable = false;
      button.off(Button.EventType.CLICK, startOnce);
      this.bookPicker.close();
      Tween.stopAllByTarget(character);
      Tween.stopAllByTarget(this.bookPicker.root);
      start(this.bookPicker.selectedBook());
    };
    button.on(Button.EventType.CLICK, startOnce);
    tween(character)
      .repeatForever(
        tween()
          .to(0.8, { scale: new Vec3(1.02, 1.02, 1) })
          .to(0.8, { scale: Vec3.ONE }),
      )
      .start();
  }
}
