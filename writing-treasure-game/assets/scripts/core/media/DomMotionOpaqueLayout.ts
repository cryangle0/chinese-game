import { MotionTransform } from './DomMotionTransform';
import {
  DomMotionOpaqueMetrics, FrameMetrics,
} from './DomMotionOpaqueMetrics';

interface OpaqueLayoutInput {
  readonly image: HTMLImageElement;
  readonly source: string;
  readonly width: number;
  readonly height: number;
  readonly canvasScale: number;
  readonly contentLeft: number;
  readonly contentTop: number;
  readonly transform: MotionTransform;
  readonly angle: number;
  readonly nodeScaleX: number;
  readonly nodeScaleY: number;
}

export class DomMotionOpaqueLayout {
  private readonly metrics = new DomMotionOpaqueMetrics();

  apply(input: OpaqueLayoutInput): boolean {
    const metrics = this.metrics.measure(input.image, input.source);
    if (!metrics) return false;
    const contentHeight = Math.max(8, metrics.sole - metrics.head + 1);
    const frameFit = Math.min(input.width / metrics.width, input.height / metrics.height);
    const designScale = Math.min(
      input.height / Math.max(contentHeight, metrics.height * 0.72),
      input.width / metrics.width,
      frameFit * 1.08,
    );
    applyPinnedImage(input, metrics, designScale);
    return true;
  }

  reset(): void {
    this.metrics.reset();
  }
}

function applyPinnedImage(
  input: OpaqueLayoutInput,
  metrics: FrameMetrics,
  designScale: number,
): void {
  const imageWidth = metrics.width * designScale * input.canvasScale * Math.abs(input.transform.scaleX);
  const imageHeight = metrics.height * designScale * input.canvasScale * Math.abs(input.transform.scaleY);
  const boxBottom = input.transform.y - input.height / 2;
  const feetX = input.contentLeft + (720 + input.transform.x) * input.canvasScale;
  const feetY = input.contentTop + (405 - boxBottom) * input.canvasScale;
  input.image.style.objectFit = 'fill';
  input.image.style.objectPosition = 'center';
  input.image.style.transformOrigin = `${imageWidth / 2}px ${(metrics.sole / metrics.height) * imageHeight}px`;
  input.image.style.width = `${imageWidth}px`;
  input.image.style.height = `${imageHeight}px`;
  input.image.style.left = `${feetX - imageWidth / 2}px`;
  input.image.style.top = `${feetY - (metrics.sole / metrics.height) * imageHeight}px`;
  input.image.style.transform = [
    `rotate(${-input.angle}deg)`,
    `scale(${input.nodeScaleX}, ${input.nodeScaleY})`,
  ].join(' ');
}
