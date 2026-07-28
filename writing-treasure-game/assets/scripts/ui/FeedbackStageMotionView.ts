import { Node, Vec3 } from 'cc';
import { DomMotionSprite } from '../core/media/DomMotionSprite';
import { createUiNode } from '../core/ui/UiFactory';

const STAGE_WIDTH = 1440;
const STAGE_HEIGHT = 810;

/** Transparent feedback animation aligned exactly to the Cocos design stage. */
export class FeedbackStageMotionView {
  private readonly root: Node;
  private readonly motion: DomMotionSprite;

  constructor(parent: Node) {
    this.root = createUiNode(
      parent,
      'FeedbackStageMotion',
      STAGE_WIDTH,
      STAGE_HEIGHT,
      Vec3.ZERO,
    );
    this.root.active = false;
    this.motion = new DomMotionSprite(
      this.root,
      null,
      STAGE_WIDTH,
      STAGE_HEIGHT,
      { fit: 'fill', zIndex: 8, suppressFallback: true },
    );
  }

  show(path: string): void {
    this.root.active = true;
    this.motion.show(path, true);
  }

  hide(): void {
    this.motion.hide();
    this.root.active = false;
  }

  dispose(): void {
    this.hide();
    this.motion.dispose();
  }
}
