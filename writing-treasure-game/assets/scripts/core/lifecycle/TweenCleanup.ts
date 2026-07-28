import { Node, Tween } from 'cc';

export function stopTweensRecursively(node: Node): void {
  for (const child of node.children) stopTweensRecursively(child);
  Tween.stopAllByTarget(node);
}
