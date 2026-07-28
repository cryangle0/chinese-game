import { Node } from 'cc';

export class SpriteBindings {
  private readonly keys = new WeakMap<Node, string>();
  private readonly watched = new WeakSet<Node>();
  private readonly consumers = new Map<string, number>();

  constructor(private readonly released: () => void) {}

  bind(node: Node, key: string): void {
    const previous = this.keys.get(node);
    if (previous === key) return;
    if (previous) this.remove(previous);
    this.keys.set(node, key);
    this.consumers.set(key, (this.consumers.get(key) ?? 0) + 1);
    if (!this.watched.has(node)) {
      this.watched.add(node);
      node.once(Node.EventType.NODE_DESTROYED, () => this.release(node));
    }
  }

  hasConsumers(key: string): boolean {
    return Boolean(this.consumers.get(key));
  }

  private release(node: Node): void {
    const key = this.keys.get(node);
    this.keys.delete(node);
    setTimeout(() => {
      if (key) this.remove(key);
      this.released();
    }, 0);
  }

  private remove(key: string): void {
    const remaining = Math.max(0, (this.consumers.get(key) ?? 0) - 1);
    if (remaining) this.consumers.set(key, remaining);
    else this.consumers.delete(key);
  }
}
