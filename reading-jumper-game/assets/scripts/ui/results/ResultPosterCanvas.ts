import { GameTheme } from '../../shared/types/Theme';
import { ResultPosterModel } from './ResultPosterModel';

export async function renderResultPoster(
  model: ResultPosterModel,
  theme: GameTheme,
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 900;
  canvas.height = 1200;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('result-poster-canvas-unavailable');
  context.fillStyle = theme.palette.primary;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#FFFFFF';
  context.fillRect(72, 72, 756, 1056);
  context.textAlign = 'center';
  drawText(context, model.gameTitle, 450, 190, theme.palette.primary, 64, 700);
  drawText(context, model.sceneTitle, 450, 265, '#455A64', 38, 600);
  drawText(context, model.scoreText, 450, 455, '#EF6C00', 112, 800);
  drawText(context, model.starsText, 450, 565, '#F2A900', 68, 700);
  drawText(context, model.answerSummary, 450, 680, '#37474F', 44, 600);
  context.fillStyle = theme.palette.secondary;
  context.fillRect(150, 770, 600, 110);
  drawText(context, '积分排行榜', 450, 842, '#FFFFFF', 48, 700);
  drawText(context, '继续挑战，巩固阅读知识', 450, 1010, '#607D8B', 32, 500);
  return encodePng(canvas);
}

export async function shareResultPoster(
  blob: Blob,
  model: ResultPosterModel,
): Promise<boolean> {
  if (typeof navigator === 'undefined' || typeof File === 'undefined' || !navigator.share) {
    return false;
  }
  const file = new File([blob], model.fileName, { type: 'image/png' });
  const payload = { title: model.gameTitle, text: model.scoreText, files: [file] };
  if (!(navigator.canShare?.(payload) ?? false)) return false;
  try {
    await navigator.share(payload);
    return true;
  } catch {
    return false;
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('result-poster-read-failed'));
    reader.readAsDataURL(blob);
  });
}

function drawText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  fill: string,
  size: number,
  weight: number,
): void {
  context.fillStyle = fill;
  context.font = `${weight} ${size}px "PingFang SC","Microsoft YaHei",sans-serif`;
  context.fillText(text, x, y);
}

function encodePng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('result-poster-encode-failed'));
    }, 'image/png');
  });
}
