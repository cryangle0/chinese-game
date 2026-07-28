import { Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { DomMotionSprite } from '../../../core/media/DomMotionSprite';
import { createUiNode } from '../../../core/ui/UiFactory';
import { sceneCharacter } from '../../../shared/config/WritingSceneCharacter';
import { MotionAssets } from '../../../shared/types/Theme';

export class WizardDeerView {
  readonly root: Node;
  private readonly visual: Node;
  private readonly motion: DomMotionSprite;
  private idleAsset: string;
  private motionAssets?: MotionAssets;
  private actionColumnX = 0;
  private sceneId = 'treasure';

  constructor(
    parent: Node,
    idleAsset: string,
    private actionAsset: string,
    motionAssets?: MotionAssets,
    sceneId = 'treasure',
  ) {
    this.idleAsset = idleAsset;
    this.motionAssets = motionAssets;
    this.sceneId = sceneId;
    const idle = sceneCharacter(sceneId).idle;
    const [w, h] = idle.size;
    this.root = createUiNode(parent, 'WizardDeer', w, h, idle.position.clone());
    this.visual = createUiNode(this.root, 'WizardDeerFallback', w, h);
    this.motion = new DomMotionSprite(this.root, this.visual, w, h, {
      fit: 'contain',
      objectPosition: 'center bottom',
      pinFeet: true,
    });
    spriteLoader.apply(this.visual, idleAsset, 'contain');
    this.motion.show(motionAssets?.idle);
  }

  /**
   * Run to a chest column. `digHold` keeps the dig pose (`action.webp`) before `done`.
   * Both correct and wrong answers dig, then open/break the chest.
   */
  castAt(columnX: number, done: () => void, digHold = 0.9): void {
    Tween.stopAllByTarget(this.root);
    this.actionColumnX = columnX;
    const action = sceneCharacter(this.sceneId).action;
    this.motion.setPinFeet(false);
    this.motion.setFit('fill');
    this.applyFrame(action.size[0], action.size[1]);
    spriteLoader.apply(this.visual, this.actionAsset, 'contain');
    const idleX = sceneCharacter(this.sceneId).idle.position.x;
    this.motion.show(
      columnX < idleX
        ? this.motionAssets?.runLeft ?? this.motionAssets?.action
        : this.motionAssets?.runRight ?? this.motionAssets?.action,
    );
    if (typeof document !== 'undefined') {
      document.body.dataset.deerActionW = String(action.size[0]);
      document.body.dataset.deerActionH = String(action.size[1]);
      document.body.dataset.deerScene = this.sceneId;
    }
    const move = tween(this.root)
      .to(0.28, {
        position: new Vec3(columnX, action.position.y, 0),
        scale: Vec3.ONE,
      }, { easing: 'quadOut' });
    if (digHold > 0) {
      move
        .call(() => this.motion.show(this.motionAssets?.action))
        .delay(digHold)
        .call(done)
        .start();
    } else {
      move.call(done).start();
    }
  }

  idle(preserveColumn = false): void {
    Tween.stopAllByTarget(this.root);
    const idle = sceneCharacter(this.sceneId).idle;
    const x = preserveColumn ? this.root.position.x : idle.position.x;
    this.motion.setFit('contain');
    this.motion.setPinFeet(true);
    this.applyFrame(idle.size[0], idle.size[1]);
    this.root.active = true;
    this.root.setPosition(x, idle.position.y, 0);
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    spriteLoader.apply(this.visual, this.idleAsset, 'contain');
    this.motion.show(this.motionAssets?.idle);
  }

  hide(): void {
    Tween.stopAllByTarget(this.root);
    this.motion.hide();
    this.root.active = false;
  }

  setTheme(
    idleAsset: string,
    actionAsset: string,
    motionAssets?: MotionAssets,
    sceneId = 'treasure',
  ): void {
    this.idleAsset = idleAsset;
    this.actionAsset = actionAsset;
    this.motionAssets = motionAssets;
    this.sceneId = sceneId;
    this.idle();
  }

  strike(done: () => void): void {
    Tween.stopAllByTarget(this.root);
    const action = sceneCharacter(this.sceneId).action;
    this.motion.setPinFeet(false);
    this.motion.setFit('fill');
    this.applyFrame(action.size[0], action.size[1]);
    this.root.setPosition(this.actionColumnX, action.position.y);
    spriteLoader.apply(this.visual, this.actionAsset, 'contain');
    this.motion.show(this.motionAssets?.action);
    tween(this.root)
      .by(0.1, { angle: -6 })
      .by(0.12, { angle: 12 })
      .by(0.1, { angle: -6 })
      .call(done)
      .start();
  }

  dispose(): void {
    this.motion.dispose();
  }

  private applyFrame(width: number, height: number): void {
    this.root.getComponent(UITransform)?.setContentSize(width, height);
    this.visual.getComponent(UITransform)?.setContentSize(width, height);
    this.motion.resize(width, height);
  }
}
