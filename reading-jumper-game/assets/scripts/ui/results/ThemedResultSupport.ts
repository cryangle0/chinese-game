import { Node, Vec3 } from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import { createLabel, createUiNode } from '../../core/ui/UiFactory';
import { GameResult } from '../../shared/types/GameTypes';

export function dominantKnowledgePoint(result: GameResult): string {
  const counts = new Map<string, number>();
  result.answers.forEach((answer) => {
    if (answer.knowledgePoint) {
      counts.set(answer.knowledgePoint, (counts.get(answer.knowledgePoint) ?? 0) + 1);
    }
  });
  let chapter = '';
  let best = 0;
  counts.forEach((count, name) => {
    if (count > best) {
      best = count;
      chapter = name;
    }
  });
  return chapter;
}

export function addResultHeading(
  parent: Node,
  name: string,
  asset: string | undefined,
  text: string,
  x: number,
  y: number,
  color: string,
  outlineColor: string,
  size: { width: number; height: number } = { width: 310, height: 78 },
  overlayText = false,
): void {
  if (asset) {
    const node = createUiNode(parent, name, size.width, size.height, new Vec3(x, y));
    spriteLoader.apply(node, asset, 'contain');
    if (!overlayText) return;
  }
  const label = createLabel(parent, text, {
    size: 30, color, width: size.width, height: size.height, bold: true,
    outlineColor, outlineWidth: 2,
  });
  label.node.setPosition(x, y);
}
