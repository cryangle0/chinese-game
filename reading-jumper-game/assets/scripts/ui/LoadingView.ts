import { Graphics, Node, Tween, tween, Vec3 } from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { applyStretchXBackdrop } from '../core/ui/ResponsiveRoot';
import {
  createLabel, createUiNode, drawCuteBookChip, drawPanel,
} from '../core/ui/UiFactory';
import { color } from '../core/ui/colors';
import { AppConfig } from '../shared/config/AppConfig';
import { readingIntro } from '../shared/config/ReadingIntroTheme';

/** Matches reading intro sky so letterbox margins never flash dark. */
const SKY = '#5BB8F5';

export class LoadingView {
  readonly root: Node;
  private readonly background: Node;
  private readonly syncBackdrop = () => applyStretchXBackdrop(this.background);

  constructor(parent: Node) {
    this.root = createUiNode(parent, 'Loading', 1440, 810);
    const theme = readingIntro;

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

    if (theme.rewardTube) {
      const rewardTube = createUiNode(this.root, 'RewardTube', 172, 194, new Vec3(-545, 310));
      spriteLoader.apply(rewardTube, theme.rewardTube, 'contain');
    }
    const title = createUiNode(this.root, 'Title', 748, 156, new Vec3(-9, 220));
    spriteLoader.apply(title, theme.title, 'contain');
    const guide = createUiNode(this.root, 'Guide', 370, 36, new Vec3(0, 115));
    spriteLoader.apply(guide, theme.guide, 'contain');
    const start = createUiNode(this.root, 'Start', 410, 105, new Vec3(0, 40));
    spriteLoader.apply(start, theme.startButton, 'contain');
    if (theme.startLabel) {
      const label = createUiNode(start, 'StartLabel', 132, 78);
      spriteLoader.apply(label, theme.startLabel, 'contain');
    }
    const pipeBack = createUiNode(this.root, 'PipeBack', 205, 90, new Vec3(0, -286));
    if (theme.pipeBack) spriteLoader.apply(pipeBack, theme.pipeBack, 'stretch');
    const character = createUiNode(this.root, 'Character', 138, 242, new Vec3(0, -161));
    spriteLoader.apply(character, theme.character, 'contain');
    const pipeFront = createUiNode(this.root, 'PipeFront', 205, 90, new Vec3(0, -286));
    if (theme.pipeFront) spriteLoader.apply(pipeFront, theme.pipeFront, 'stretch');

    mountGameLoadingBadge(this.root, new Vec3(0, -360));
  }
}

function mountGameLoadingBadge(parent: Node, position: Vec3): void {
  const badge = createUiNode(parent, 'LoadingBadge', 320, 72, position);
  drawCuteBookChip(badge, { rim: '#D45512', fill: '#FFD24A', gloss: 0 });

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
    color: '#6B2E0A',
    outlineColor: '#FFF6D8',
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
