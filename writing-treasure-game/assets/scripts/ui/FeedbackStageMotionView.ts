import { Node, Vec3 } from 'cc';
import { DomMotionSprite } from '../core/media/DomMotionSprite';
import { applyStretchXBackdrop } from '../core/ui/ResponsiveRoot';
import { createUiNode } from '../core/ui/UiFactory';

const STAGE_WIDTH = 1440;
const STAGE_HEIGHT = 810;

/** Transparent feedback animation aligned exactly to the Cocos design stage. */
export class FeedbackStageMotionView {
  private readonly root: Node;
  private readonly motion: DomMotionSprite;
  private readonly syncLayout = (): void => {
    const scaleX = applyStretchXBackdrop(this.root);
    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackStageScaleX = scaleX.toFixed(6);
    }
  };

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
    this.syncLayout();
    if (typeof window !== 'undefined') window.addEventListener('resize', this.syncLayout);
  }

  show(path: string, selectedIndex: number): void {
    this.syncLayout();
    this.root.active = true;
    this.motion.show(path, true);
    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackStageMotion = path;
      document.body.dataset.feedbackStageSelected = String(selectedIndex);
    }
  }

  hide(): void {
    this.motion.hide();
    this.root.active = false;
  }

  dispose(): void {
    if (typeof window !== 'undefined') window.removeEventListener('resize', this.syncLayout);
    this.hide();
    this.motion.dispose();
  }
}
