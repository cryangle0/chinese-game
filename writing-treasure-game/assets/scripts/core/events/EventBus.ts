type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private readonly listeners = new Map<keyof Events, Set<Listener<unknown>>>();

  on<K extends keyof Events>(event: K, listener: Listener<Events[K]>): () => void {
    const group = this.listeners.get(event) ?? new Set<Listener<unknown>>();
    group.add(listener as Listener<unknown>);
    this.listeners.set(event, group);
    return () => group.delete(listener as Listener<unknown>);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    this.listeners.get(event)?.forEach((listener) => listener(payload));
  }

  clear(): void {
    this.listeners.clear();
  }
}

