export interface FrameMetrics {
  readonly source: string;
  readonly width: number;
  readonly height: number;
  readonly sole: number;
  readonly head: number;
}

export class DomMotionOpaqueMetrics {
  private readonly canvas = document.createElement('canvas');
  private readonly context = this.canvas.getContext('2d', { willReadFrequently: true });
  private cache: FrameMetrics | null = null;

  measure(image: HTMLImageElement, source: string): FrameMetrics | null {
    const width = image.naturalWidth;
    const height = image.naturalHeight;
    if (width < 2 || height < 2 || !this.context) return null;
    if (matchesCache(this.cache, source, width, height)) return this.cache;
    this.canvas.width = width;
    this.canvas.height = height;
    this.context.clearRect(0, 0, width, height);
    this.context.drawImage(image, 0, 0);
    const data = this.context.getImageData(0, 0, width, height).data;
    const rows = collectRows(data, width, height);
    const peak = Math.max(...rows.opaque);
    if (peak < 4) return null;
    const threshold = Math.max(4, peak * 0.22);
    const head = findFromTop(rows.opaque, threshold);
    const feet = findFromBottom(rows.opaque, threshold);
    const brownSole = findFromBottom(rows.brown, 3, head);
    const sole = resolveSole(rows.opaque, peak, head, feet, brownSole);
    this.cache = { source, width, height, sole, head };
    return this.cache;
  }

  reset(): void {
    this.cache = null;
  }
}

function collectRows(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): { opaque: number[]; brown: number[] } {
  const opaque = new Array(height).fill(0);
  const brown = new Array(height).fill(0);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      const alpha = data[index + 3];
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      if (alpha > 80) opaque[y] += 1;
      if (isBrown(alpha, red, green, blue)) brown[y] += 1;
    }
  }
  return { opaque, brown };
}

function isBrown(alpha: number, red: number, green: number, blue: number): boolean {
  return alpha > 180 && red > 60 && red < 170
    && green > 25 && green < 110 && blue < 90 && red > green + 8;
}

function findFromTop(rows: number[], threshold: number): number {
  const index = rows.findIndex((count) => count >= threshold);
  return index < 0 ? 0 : index;
}

function findFromBottom(rows: number[], threshold: number, floor = 0): number {
  for (let index = rows.length - 1; index >= floor; index -= 1) {
    if (rows[index] >= threshold) return index;
  }
  return Math.max(floor, rows.length - 1);
}

function resolveSole(
  rows: number[],
  peak: number,
  head: number,
  feet: number,
  brownSole: number,
): number {
  let sole = feet;
  const denseThreshold = Math.max(4, peak * 0.5);
  while (sole > head && rows[sole] < denseThreshold) sole -= 1;
  sole = Math.max(head + 8, sole - 8);
  return brownSole >= head && brownSole >= sole - 2 ? brownSole : sole;
}

function matchesCache(
  cache: FrameMetrics | null,
  source: string,
  width: number,
  height: number,
): cache is FrameMetrics {
  return Boolean(cache)
    && cache?.source === source
    && cache.width === width
    && cache.height === height;
}
