import { AppConfig } from '../../shared/config/AppConfig';
import { MotionTransform } from './DomMotionTransform';

export interface MotionStageFrame {
  readonly scale: number;
  readonly left: number;
  readonly top: number;
}

interface StageLayoutInput extends MotionStageFrame {
  readonly image: HTMLImageElement;
  readonly transform: MotionTransform;
  readonly width: number;
  readonly height: number;
  readonly fit: 'contain' | 'cover' | 'fill';
  readonly objectPosition: string;
  readonly angle: number;
  readonly nodeScaleX: number;
  readonly nodeScaleY: number;
}

export function resolveMotionStageFrame(canvas: HTMLCanvasElement): MotionStageFrame {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / AppConfig.designWidth, rect.height / AppConfig.designHeight);
  return {
    scale,
    left: rect.left + (rect.width - AppConfig.designWidth * scale) / 2,
    top: rect.top + (rect.height - AppConfig.designHeight * scale) / 2,
  };
}

export function applyFullscreenMotion(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
): void {
  const host = document.getElementById('GameDiv') ?? canvas;
  const rect = host.getBoundingClientRect();
  Object.assign(image.style, {
    left: `${rect.left + rect.width / 2}px`,
    top: `${rect.top + rect.height / 2}px`,
    width: `${rect.width + 8}px`,
    height: `${rect.height + 8}px`,
    objectFit: 'cover',
    objectPosition: 'center',
    transform: 'translate(-50%, -50%)',
    transformOrigin: 'center',
  });
}

export function applyStageMotion(input: StageLayoutInput): void {
  const {
    image, transform, scale, left, top, width, height,
  } = input;
  const bottomAligned = input.objectPosition.includes('bottom');
  Object.assign(image.style, {
    objectFit: input.fit,
    objectPosition: input.objectPosition,
    left: `${left + (AppConfig.designWidth / 2 + transform.x) * scale}px`,
    top: `${top + (AppConfig.designHeight / 2 - transform.y) * scale}px`,
    width: `${width * scale * Math.abs(transform.scaleX)}px`,
    height: `${height * scale * Math.abs(transform.scaleY)}px`,
    transformOrigin: bottomAligned ? '50% 100%' : '50% 50%',
    transform: [
      'translate(-50%, -50%)',
      `rotate(${-input.angle}deg)`,
      `scale(${input.nodeScaleX}, ${input.nodeScaleY})`,
    ].join(' '),
  });
}
