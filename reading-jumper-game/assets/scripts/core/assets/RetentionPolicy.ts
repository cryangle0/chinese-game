export interface CacheCandidate {
  readonly key: string;
  readonly lastUsed: number;
}

export class RetentionPolicy {
  private retained: ReadonlySet<string> | null = null;

  retainOnly(paths: readonly string[]): void {
    this.retained = new Set(paths);
  }

  evictions(
    entries: readonly CacheCandidate[],
    hasConsumers: (key: string) => boolean,
    maxEntries: number,
  ): string[] {
    const removable = entries
      .filter(({ key }) => !hasConsumers(key))
      .sort((left, right) => left.lastUsed - right.lastUsed);
    const evictable = this.retained
      ? removable.filter(({ key }) => !this.retained?.has(key))
      : removable;
    const selected = new Set<string>();
    if (this.retained) {
      evictable.forEach(({ key }) => selected.add(key));
    }
    let remaining = entries.length - selected.size;
    for (const { key } of evictable) {
      if (remaining <= maxEntries) break;
      if (!selected.has(key)) {
        selected.add(key);
        remaining -= 1;
      }
    }
    return Array.from(selected);
  }
}
