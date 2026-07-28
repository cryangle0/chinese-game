import { Graphics, Node, UITransform } from 'cc';
import { color } from './colors';

function graphicsFor(node: Node): { graphics: Graphics; width: number; height: number } {
  const transform = node.getComponent(UITransform);
  if (!transform) throw new Error('UITransform required');
  const graphics = node.getComponent(Graphics) ?? node.addComponent(Graphics);
  const { width, height } = transform.contentSize;
  graphics.clear();
  return { graphics, width, height };
}

export function drawFramedPanel(
  node: Node,
  fill = '#FFF6D8',
  rim = '#D45512',
  radius = 18,
): Graphics {
  const { graphics, width, height } = graphicsFor(node);
  graphics.fillColor = color(rim);
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  graphics.fillColor = color(fill);
  graphics.roundRect(
    -width / 2 + 4, -height / 2 + 4, width - 8, height - 8, Math.max(8, radius - 4),
  );
  graphics.fill();
  return graphics;
}

export function drawCuteBookChip(
  node: Node,
  palette: { rim: string; fill: string; gloss?: number } = {
    rim: '#C45A1A', fill: '#FFE08A', gloss: 0,
  },
): Graphics {
  const { graphics, width, height } = graphicsFor(node);
  const radius = height / 2;
  graphics.fillColor = color(palette.rim);
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  graphics.fillColor = color(palette.fill);
  graphics.roundRect(
    -width / 2 + 5, -height / 2 + 5, width - 10, height - 10, Math.max(8, radius - 5),
  );
  graphics.fill();
  const gloss = palette.gloss ?? 0;
  if (gloss > 0) {
    graphics.fillColor = color('#FFFFFF', gloss);
    graphics.roundRect(-width / 2 + 14, height / 2 - 20, width - 28, 11, 6);
    graphics.fill();
  }
  return graphics;
}

export function drawCuteBookIcon(
  node: Node,
  cover = '#E85D4C',
  pages = '#FFF8E8',
): Graphics {
  const { graphics } = graphicsFor(node);
  const blocks = [
    { fill: '#5A2A12', box: [-14, -16, 28, 32, 4] },
    { fill: cover, box: [-12, -14, 24, 28, 3] },
    { fill: pages, box: [-4, -11, 12, 22, 2] },
    { fill: '#F6D35A', box: [-12, -2, 6, 4, 1] },
  ] as const;
  blocks.forEach(({ fill, box }) => {
    const [x, y, width, height, radius] = box;
    graphics.fillColor = color(fill);
    graphics.roundRect(x, y, width, height, radius);
    graphics.fill();
  });
  return graphics;
}

export function drawCuteCaretBadge(
  node: Node,
  fill = '#FF8A3D',
  rim = '#B84A12',
): Graphics {
  const { graphics, width, height } = graphicsFor(node);
  const radius = Math.min(width, height) / 2;
  graphics.fillColor = color(rim);
  graphics.roundRect(-width / 2, -height / 2, width, height, radius);
  graphics.fill();
  graphics.fillColor = color(fill);
  graphics.roundRect(
    -width / 2 + 3, -height / 2 + 3, width - 6, height - 6, Math.max(6, radius - 3),
  );
  graphics.fill();
  graphics.fillColor = color('#FFFFFF');
  graphics.moveTo(-7, 3);
  graphics.lineTo(7, 3);
  graphics.lineTo(0, -7);
  graphics.close();
  graphics.fill();
  return graphics;
}
