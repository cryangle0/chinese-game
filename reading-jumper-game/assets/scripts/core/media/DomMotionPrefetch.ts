const prefetched = new Set<string>();

export function prefetchMotion(...sources: Array<string | undefined>): void {
  if (typeof document === 'undefined') return;
  sources.filter((source): source is string => Boolean(source)).forEach((source) => {
    if (prefetched.has(source)) return;
    prefetched.add(source);
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.as = 'image';
    link.href = source;
    document.head.appendChild(link);
  });
}
