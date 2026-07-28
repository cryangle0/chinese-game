import { Graphics, Node, Tween, tween, Vec3 } from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { applyStretchXBackdrop } from '../core/ui/ResponsiveRoot';
import {
  createLabel, createUiNode, drawCuteBookChip, drawPanel,
} from '../core/ui/UiFactory';
import { color } from '../core/ui/colors';
import { AppConfig } from '../shared/config/AppConfig';
import { box } from '../shared/config/WritingPlayLayout';
import { writingIntro } from '../shared/config/WritingIntroTheme';

/** Matches writing intro sky so letterbox margins never flash dark. */
const SKY = '#6BC4F5';

/** Same layout as GameIntro — homepage first, game-style loader on top. */
const Intro = {
  title: box(483, 76, 899, 286),
  character: box(104, 112, 338, 343),
  guide: box(691, 337, 510, 57),
  start: box(720, 406, 435, 120),
} as const;

export class LoadingView {
  readonly root: Node;
  private readonly background: Node;
  private readonly syncBackdrop = () => applyStretchXBackdrop(this.background);

  constructor(parent: Node) {
    this.root = createUiNode(parent, 'Loading', 1440, 810);
    const theme = writingIntro;

    this.background = createUiNode(
      this.root, 'Background', AppConfig.designWidth, AppConfig.designHeight,
    );
    const fill = createUiNode(
      this.background, 'Fill', AppConfig.designWidth, AppConfig.designHeight,
    );
    drawPanel(fill, SKY, 0);
    const art = createUiNode(
      this.background, 'Art', AppConfig.designWidth, AppConfig.designHeight,
    );
    spriteLoader.apply(art, theme.background, 'cover');
    this.syncBackdrop();
    if (typeof window !== 'undefined') {
      window.addEventListener('resize', this.syncBackdrop);
      this.root.once(Node.EventType.NODE_DESTROYED, () => {
        window.removeEventListener('resize', this.syncBackdrop);
      });
    }
    if (typeof document !== 'undefined') {
      document.body.style.setProperty('background', SKY, 'important');
      document.body.style.setProperty('background-color', SKY, 'important');
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
    const start = createUiNode(
      this.root, 'Start', Intro.start.size[0], Intro.start.size[1], Intro.start.position,
    );
    spriteLoader.apply(start, theme.startButton, 'contain');

    mountGameLoadingBadge(this.root, new Vec3(111, -250));
  }
}

function mountGameLoadingBadge(parent: Node, position: Vec3): void {
  const badge = createUiNode(parent, 'LoadingBadge', 320, 72, position);
  drawCuteBookChip(badge, { rim: '#A86A28', fill: '#FFE6A8', gloss: 0 });

  const coin = createUiNode(badge, 'Coin', 44, 44, new Vec3(-108, 1));
  const g = coin.addComponent(Graphics);
  g.fillColor = color('#E8A020');
  g.circle(0, 0, 18);
  g.fill();
  g.fillColor = color('#FFD86A');
  g.circle(0, 0, 14);
  g.fill();
  g.fillColor = color('#C47A10');
  g.circle(0, 0, 5);
  g.fill();

  createLabel(badge, '加载中...', {
    size: 28,
    width: 180,
    height: 48,
    bold: true,
    color: '#5A3210',
    outlineColor: '#FFF8E8',
    outlineWidth: 3,
  }).node.setPosition(24, 1);

  Tween.stopAllByTarget(coin);
  tween(coin)
    .repeatForever(
      tween()
        .to(0.35, { position: new Vec3(-108, 10, 0) }, { easing: 'sineOut' })
        .to(0.35, { position: new Vec3(-108, 1, 0) }, { easing: 'sineIn' }),
    )
    .start();
  Tween.stopAllByTarget(badge);
  tween(badge)
    .repeatForever(
      tween()
        .to(0.7, { scale: new Vec3(1.04, 1.04, 1) })
        .to(0.7, { scale: Vec3.ONE }),
    )
    .start();
}
