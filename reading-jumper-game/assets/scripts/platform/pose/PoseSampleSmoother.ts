import type { PoseMotionSample } from './PoseInputTypes';

export interface SmoothedPoseSample {
  x: number;
  y: number;
  bodyScale: number;
}

export class PoseSampleSmoother {
  private x: number | null = null;
  private y: number | null = null;
  private bodyScale: number | null = null;

  push(sample: PoseMotionSample, smoothingAlpha: number): SmoothedPoseSample {
    const alpha = Math.min(1, Math.max(0, smoothingAlpha));
    this.x = blend(this.x, sample.x, alpha);
    this.y = blend(this.y, sample.y, alpha);
    this.bodyScale = blend(this.bodyScale, sample.bodyScale, alpha);
    return { x: this.x, y: this.y, bodyScale: this.bodyScale };
  }

  reset(): void {
    this.x = null;
    this.y = null;
    this.bodyScale = null;
  }

  currentX(): number | null {
    return this.x;
  }

  currentBodyScale(): number | null {
    return this.bodyScale;
  }
}

function blend(previous: number | null, current: number, alpha: number): number {
  return previous === null ? current : previous * (1 - alpha) + current * alpha;
}
