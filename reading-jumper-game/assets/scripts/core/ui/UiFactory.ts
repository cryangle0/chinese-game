import {
  Button,
  Color,
  Graphics,
  HorizontalTextAlignment,
  Label,
  LabelOutline,
  Node,
  UITransform,
  Vec3,
  VerticalTextAlignment,
} from 'cc';
import { color } from './colors';
import { drawCuteBookChip } from './UiDecoration';
export {
  drawCuteBookChip, drawCuteBookIcon, drawCuteCaretBadge, drawFramedPanel,
} from './UiDecoration';

export interface LabelOptions {
  size?: number;
  color?: string;
  width?: number;
  height?: number;
  bold?: boolean;
  family?: string;
  outlineColor?: string;
  outlineWidth?: number;
}

export function createUiNode(
  parent: Node,
  name: string,
  width: number,
  height: number,
  position = Vec3.ZERO,
): Node {
  const node = new Node(name);
  node.layer = parent.layer;
  node.addComponent(UITransform).setContentSize(width, height);
  node.setPosition(position);
  parent.addChild(node);
  return node;
}

export function drawPanel(node: Node, fill: string, radius = 12, alpha = 255): Graphics {
  const transform = node.getComponent(UITransform);
  if (!transform) throw new Error('UITransform required');
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  const { width, height } = transform.contentSize;
  graphics.clear();
  graphics.fillColor = color(fill, alpha);
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  return graphics;
}

export function createLabel(parent: Node, text: string, options: LabelOptions = {}): Label {
  const width = options.width ?? 600;
  const height = options.height ?? 60;
  const node = createUiNode(parent, `Label:${text.slice(0, 12)}`, width, height);
  const label = node.addComponent(Label);
  label.string = text;
  label.fontFamily = options.family ?? 'Microsoft YaHei';
  label.fontSize = options.size ?? 32;
  label.lineHeight = Math.round((options.size ?? 32) * 1.25);
  label.color = color(options.color ?? '#FFFFFF');
  label.horizontalAlign = HorizontalTextAlignment.CENTER;
  label.verticalAlign = VerticalTextAlignment.CENTER;
  label.overflow = Label.Overflow.SHRINK;
  label.isBold = options.bold ?? false;
  if ((options.outlineWidth ?? 0) > 0) {
    const outline = node.addComponent(LabelOutline);
    outline.color = color(options.outlineColor ?? '#000000');
    outline.width = options.outlineWidth ?? 0;
  }
  return label;
}

export function createButton(
  parent: Node,
  text: string,
  width: number,
  onClick: () => void,
  fill = '#1677FF',
): Node {
  const node = createUiNode(parent, `Button:${text}`, width, 76);
  drawPanel(node, fill, 14);
  const label = createLabel(node, text, { size: 30, width: width - 28, height: 60, bold: true });
  label.node.setPosition(0, 1);
  const button = node.addComponent(Button);
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.96;
  node.on(Button.EventType.CLICK, onClick);
  return node;
}

/** Wood/candy chip CTA — matches writing-treasure settlement / intro book chips. */
export function createGameActionButton(
  parent: Node,
  text: string,
  width: number,
  onClick: () => void,
  palette: { rim: string; fill: string; gloss?: number; text?: string } = {
    rim: '#C45A1A', fill: '#FFE08A', gloss: 0, text: '#5A3210',
  },
): Node {
  const node = createUiNode(parent, `Button:${text}`, width, 72);
  drawCuteBookChip(node, {
    rim: palette.rim,
    fill: palette.fill,
    gloss: palette.gloss ?? 0,
  });
  const label = createLabel(node, text, {
    size: 28,
    width: width - 24,
    height: 52,
    bold: true,
    color: palette.text ?? '#5A3210',
    outlineColor: '#FFF8E8',
    outlineWidth: 3,
  });
  label.node.setPosition(0, 1);
  const button = node.addComponent(Button);
  button.transition = Button.Transition.SCALE;
  button.zoomScale = 0.96;
  node.on(Button.EventType.CLICK, onClick);
  return node;
}

export function setLabelColor(label: Label, value: string): void {
  label.color = color(value);
}

export function setLabelOutline(label: Label, value: string, width: number): void {
  const outline = label.node.getComponent(LabelOutline) ?? label.node.addComponent(LabelOutline);
  outline.color = color(value);
  outline.width = width;
  outline.enabled = width > 0;
}

export const transparent = new Color(255, 255, 255, 0);
