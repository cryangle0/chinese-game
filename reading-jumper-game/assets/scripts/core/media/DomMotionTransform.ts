import { Node } from 'cc';

export interface MotionTransformOptions {
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly contentRoot?: Node;
}

export interface MotionTransform {
  readonly x: number;
  readonly y: number;
  readonly scaleX: number;
  readonly scaleY: number;
}

export function resolveMotionTransform(
  node: Node,
  options: MotionTransformOptions,
): MotionTransform {
  if (!options.contentRoot) {
    return {
      x: node.position.x + (options.offsetX ?? 0),
      y: node.position.y + (options.offsetY ?? 0),
      scaleX: 1,
      scaleY: 1,
    };
  }
  let x = node.position.x + (options.offsetX ?? 0);
  let y = node.position.y + (options.offsetY ?? 0);
  let scaleX = 1;
  let scaleY = 1;
  let current = node.parent;
  while (current && current !== options.contentRoot) {
    x *= current.scale.x;
    y *= current.scale.y;
    scaleX *= current.scale.x;
    scaleY *= current.scale.y;
    x += current.position.x;
    y += current.position.y;
    current = current.parent;
  }
  return { x, y, scaleX, scaleY };
}
