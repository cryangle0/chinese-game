import {
  Node, tween, Tween, UITransform, Vec3,
} from 'cc';
import { DomMotionSprite } from '../core/media/DomMotionSprite';
import { createUiNode } from '../core/ui/UiFactory';
import { FeedbackSequencePlan } from '../shared/config/WritingFeedbackPolicy';
import { box } from '../shared/config/WritingPlayLayout';
import {
  resolveFeedbackLayerPath, StaticFeedbackVariant,
} from '../shared/config/WritingStaticFeedback';

type ChasePlan = NonNullable<FeedbackSequencePlan['chase']>;

export class FeedbackLayerView {
  private readonly nodes: Node[] = [];
  private readonly motions: DomMotionSprite[] = [];

  constructor(parent: Node) {
    for (let index = 0; index < 2; index += 1) {
      const node = createUiNode(parent, `FeedbackLayer${index}`, 100, 100);
      node.active = false;
      this.nodes.push(node);
      this.motions.push(new DomMotionSprite(node, null, 100, 100, {
        fit: 'fill',
        zIndex: 8 + index,
      }));
    }
  }

  show(
    feedback: StaticFeedbackVariant,
    selectedIndex: number,
    chase?: ChasePlan,
    choiceColumns: readonly [number, number, number] = [0, 0, 0],
  ): void {
    this.hide();
    feedback.layers.forEach((layer, index) => {
      const node = this.nodes[index];
      const motion = this.motions[index];
      if (!node || !motion) return;
      const placed = box(layer.left, layer.top, layer.width, layer.height);
      const selectedX = choiceColumns[selectedIndex] ?? 0;
      const anchorX = layer.selectedAnchor === undefined
        ? selectedX
        : choiceColumns[layer.selectedAnchor] ?? selectedX;
      const offsetX = layer.selectedAnchor === undefined ? 0 : selectedX - anchorX;
      const finalX = placed.position.x + offsetX;
      const [width, height] = placed.size;
      node.getComponent(UITransform)?.setContentSize(width, height);
      node.setPosition(finalX, placed.position.y);
      node.active = true;
      motion.resize(width, height);
      motion.show(resolveFeedbackLayerPath(layer, selectedIndex), true);
      if (index === 0 && chase) this.playChase(node, finalX, placed.position.y, chase);
    });
  }

  hide(): void {
    this.nodes.forEach((node, index) => {
      Tween.stopAllByTarget(node);
      this.motions[index]?.hide();
      node.active = false;
    });
  }

  dispose(): void {
    this.hide();
    this.motions.forEach((motion) => motion.dispose());
  }

  private playChase(node: Node, x: number, y: number, chase: ChasePlan): void {
    node.setPosition(x + chase.fromX, y);
    tween(node).to(chase.durationMs / 1000, {
      position: new Vec3(x + chase.toX, y, 0),
    }).start();
  }
}
