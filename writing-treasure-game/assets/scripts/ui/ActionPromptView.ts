import { Label, Node, Vec3 } from 'cc';
import { createLabel, createUiNode, drawPanel } from '../core/ui/UiFactory';

export class ActionPromptView {
  private readonly root: Node;
  private readonly label: Label;

  constructor(parent: Node) {
    this.root = createUiNode(parent, 'ActionPrompt', 520, 64, new Vec3(0, 200));
    drawPanel(this.root, '#10253B', 14, 230);
    this.label = createLabel(this.root, '', { size: 26, width: 480, height: 54, bold: true });
    this.root.active = false;
  }

  show(tool: string, remaining: number): void {
    this.label.string = `点击宝箱，用${tool}敲击 ${remaining} 次`;
    this.root.active = true;
  }

  hide(): void {
    this.root.active = false;
  }
}
