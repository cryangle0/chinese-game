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
  readonly fillOpaque: boolean;
  readonly angle: number;
  readonly nodeScaleX: number;
  readonly nodeScaleY: number;
}

export class DomMotionOpaqueLayout {
  private readonly metrics = new DomMotionOpaqueMetrics();

  apply(input: OpaqueLayoutInput): boolean {
    const metrics = this.metrics.measure(input.image, input.source);
    if (!metrics) return false;
    const contentHeight = Math.max(8, metrics.feet - metrics.head + 1);
    const opaqueHeight = input.fillOpaque
      ? contentHeight
      : Math.max(Math.round(metrics.height * 0.38), contentHeight);
    const targetHeight = Math.min(input.height, 450);
    const containScale = Math.min(
      input.width / metrics.width,
      input.height / metrics.height,
    );
    const designScale = input.fillOpaque
      ? Math.max(containScale * 1.25, targetHeight / opaqueHeight)
      : containScale;
    applyPinnedImage(input, metrics, designScale);
    markDiagnostics(input, opaqueHeight, designScale);
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
  input.image.style.objectPosition = 'center bottom';
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

function markDiagnostics(
  input: OpaqueLayoutInput,
  opaqueHeight: number,
  designScale: number,
): void {
  if (typeof document === 'undefined') return;
  document.body.dataset.deerPinScale = designScale.toFixed(4);
  document.body.dataset.deerPinBox = `${input.width}x${input.height}`;
  document.body.dataset.deerOpaqueH = String(opaqueHeight);
}
