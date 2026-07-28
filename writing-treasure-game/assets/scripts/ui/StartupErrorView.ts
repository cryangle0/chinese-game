import { Node, Vec3 } from 'cc';
import {
  createButton, createLabel, createUiNode, drawPanel,
} from '../core/ui/UiFactory';

export class StartupErrorView {
  readonly root: Node;

  constructor(parent: Node, retry: () => void) {
    this.root = createUiNode(parent, 'StartupError', 1440, 810);
    drawPanel(this.root, '#102A43', 0);
    const panel = createUiNode(this.root, 'ErrorPanel', 720, 360);
    drawPanel(panel, '#FFFFFF', 18, 245);
    const title = createLabel(panel, '游戏加载失败', {
      size: 42, color: '#B4233D', width: 600, height: 70, bold: true,
    });
    title.node.setPosition(0, 105);
    const message = createLabel(panel, '请检查网络后重试，若仍失败请联系活动客服', {
      size: 28, color: '#334E68', width: 620, height: 92,
    });
    message.node.setPosition(0, 15);
    const button = createButton(panel, '重新加载', 260, retry, '#1677FF');
    button.setPosition(new Vec3(0, -105));
  }
}
