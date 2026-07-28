const prefetched = new Set<string>();
const preloadTasks = new Map<string, Promise<void>>();
const MOTION_PRELOAD_TIMEOUT_MS = 8000;

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

export function preloadMotion(...sources: Array<string | undefined>): Promise<void> {
  if (typeof Image === 'undefined') return Promise.resolve();
  const unique = Array.from(new Set(
    sources.filter((source): source is string => Boolean(source)),
  ));
  return Promise.all(unique.map((source) => preloadOne(source))).then(() => undefined);
}

function preloadOne(source: string): Promise<void> {
  const pending = preloadTasks.get(source);
  if (pending) return pending;
  const task = new Promise<void>((resolve) => {
    const image = new Image();
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      resolve();
    };
    const timeout = setTimeout(finish, MOTION_PRELOAD_TIMEOUT_MS);
    image.decoding = 'async';
    image.addEventListener('load', () => {
      const decode = image.decode?.();
      if (decode) void decode.catch(() => undefined).finally(finish);
      else finish();
    }, { once: true });
    image.addEventListener('error', finish, { once: true });
    image.src = source;
    if (image.complete && image.naturalWidth > 1) finish();
  });
  preloadTasks.set(source, task);
  return task;
}
