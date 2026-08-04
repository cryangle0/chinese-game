import {
  Color, Graphics, Node, Tween, UIOpacity, Vec3, tween,
} from 'cc';
import { responsiveBackdropScale } from '../core/ui/ResponsiveRoot';
import { createUiNode } from '../core/ui/UiFactory';
import { AppConfig } from '../shared/config/AppConfig';

const DESIGN_WIDTH = AppConfig.designWidth;
const DESIGN_HEIGHT = 178;
const DESIGN_Y = (AppConfig.designHeight - DESIGN_HEIGHT) / 2;
const BACKGROUND_SIBLING_INDEX = 1;

interface DripMotion {
  readonly node: Node;
  readonly graphics: Graphics;
  readonly base: Vec3;
  readonly width: number;
  readonly height: number;
  readonly colorIndex: number;
  readonly amplitude: number;
  readonly duration: number;
  readonly delay: number;
}

const SCENE_DRIP_COLORS: Readonly<Record<string, readonly [Color, Color]>> = {
  mario: [
    new Color(190, 67, 32, 216),
    new Color(235, 106, 25, 174),
  ],
  'deep-sea': [
    new Color(0, 83, 139, 216),
    new Color(8, 145, 184, 174),
  ],
  space: [
    new Color(50, 59, 151, 218),
    new Color(91, 85, 199, 176),
  ],
  food: [
    new Color(151, 47, 40, 216),
    new Color(208, 83, 52, 174),
  ],
  poetry: [
    new Color(32, 91, 71, 218),
    new Color(66, 129, 91, 176),
  ],
};
const DEFAULT_DRIP_COLORS = SCENE_DRIP_COLORS.mario;

export class WrongFeedbackTopEffectView {
  readonly root: Node;
  private readonly opacity: UIOpacity;
  private readonly drips: DripMotion[] = [];
  private readonly syncBackdrop = () => {
    const scaleX = responsiveBackdropScale();
    this.root.setScale(scaleX, 1, 1);
    this.root.setPosition(0, DESIGN_Y, 0);
    if (typeof document !== 'undefined') {
      document.body.dataset.wrongTopEffectScaleX = scaleX.toFixed(6);
    }
  };

  constructor(parent: Node) {
    this.root = createUiNode(
      parent,
      'WrongFeedbackTopBackground',
      DESIGN_WIDTH,
      DESIGN_HEIGHT,
      new Vec3(0, DESIGN_Y),
    );
    this.root.setSiblingIndex(Math.min(BACKGROUND_SIBLING_INDEX, parent.children.length - 1));
    this.opacity = this.root.addComponent(UIOpacity);
    this.opacity.opacity = 0;
    this.drawDrips();
    this.syncBackdrop();
    this.root.active = false;
    if (typeof window !== 'undefined') window.addEventListener('resize', this.syncBackdrop);
  }

  show(sceneId: string): void {
    this.stopMotion();
    this.root.setSiblingIndex(BACKGROUND_SIBLING_INDEX);
    this.root.active = true;
    this.syncBackdrop();
    this.applySceneColors(sceneId);
    this.opacity.opacity = 0;
    tween(this.opacity)
      .to(0.24, { opacity: 190 }, { easing: 'cubicOut' })
      .repeatForever(
        tween()
          .to(0.72, { opacity: 174 }, { easing: 'sineInOut' })
          .to(0.72, { opacity: 194 }, { easing: 'sineInOut' }),
      )
      .start();
    this.drips.forEach((drip) => {
      drip.node.setPosition(drip.base);
      drip.node.setScale(Vec3.ONE);
      tween(drip.node)
        .delay(drip.delay)
        .repeatForever(
          tween()
            .to(drip.duration, {
              position: new Vec3(drip.base.x, drip.base.y - drip.amplitude, 0),
              scale: new Vec3(1, 1.08, 1),
            }, { easing: 'sineInOut' })
            .to(drip.duration, {
              position: drip.base,
              scale: Vec3.ONE,
            }, { easing: 'sineInOut' }),
        )
        .start();
    });
    if (typeof document !== 'undefined') {
      Object.assign(document.body.dataset, {
        wrongTopEffect: 'active',
        wrongTopEffectScene: sceneId,
        wrongTopEffectBox: `0,0,${DESIGN_WIDTH},${DESIGN_HEIGHT}`,
        wrongTopEffectLayer: 'background',
        wrongTopEffectSibling: String(this.root.getSiblingIndex()),
        wrongTopEffectStyle: 'vertical-lines-only',
        wrongTopEffectColorScene: SCENE_DRIP_COLORS[sceneId] ? sceneId : 'mario',
      });
    }
  }

  hide(): void {
    this.stopMotion();
    this.opacity.opacity = 0;
    this.root.active = false;
    if (typeof document !== 'undefined') {
      document.body.dataset.wrongTopEffect = 'hidden';
      delete document.body.dataset.wrongTopEffectScene;
    }
  }

  dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.syncBackdrop);
    this.hide();
    this.root.destroy();
  }

  private drawDrips(): void {
    const count = 34;
    const widths = [4, 7, 5, 9, 4, 6, 8] as const;
    const heights = [54, 96, 72, 132, 84, 116, 148, 64] as const;
    const spacing = DESIGN_WIDTH / count;
    for (let index = 0; index < count; index += 1) {
      const width = widths[index % widths.length];
      const height = heights[index % heights.length];
      const x = -DESIGN_WIDTH / 2 + spacing * (index + 0.5)
        + ((index % 3) - 1) * spacing * 0.12;
      const y = DESIGN_HEIGHT / 2 - height / 2 + 4;
      const node = createUiNode(
        this.root,
        `WrongDrip${index}`,
        width,
        height,
        new Vec3(x, y),
      );
      const graphics = node.addComponent(Graphics);
      this.drips.push({
        node,
        graphics,
        base: node.position.clone(),
        width,
        height,
        colorIndex: index % 4 === 0 ? 0 : 1,
        amplitude: 4 + (index % 5) * 1.5,
        duration: 0.55 + (index % 6) * 0.07,
        delay: (index % 8) * 0.025,
      });
    }
    this.applySceneColors('mario');
  }

  private applySceneColors(sceneId: string): void {
    const colors = SCENE_DRIP_COLORS[sceneId] ?? DEFAULT_DRIP_COLORS;
    this.drips.forEach((drip) => {
      drip.graphics.clear();
      drip.graphics.fillColor = colors[drip.colorIndex];
      drip.graphics.roundRect(
        -drip.width / 2,
        -drip.height / 2,
        drip.width,
        drip.height,
        Math.min(4, drip.width / 2),
      );
      drip.graphics.fill();
    });
  }

  private stopMotion(): void {
    Tween.stopAllByTarget(this.opacity);
    this.drips.forEach((drip) => Tween.stopAllByTarget(drip.node));
  }
}
