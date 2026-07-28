import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';
import {
  blobToDataUrl, renderResultPoster, shareResultPoster,
} from './ResultPosterCanvas';
import { buildResultPosterModel } from './ResultPosterModel';
import { ResultPosterOverlay } from './ResultPosterOverlay';

export { buildResultPosterModel } from './ResultPosterModel';
export type { ResultPosterModel } from './ResultPosterModel';

export type ResultPosterOutcome = 'shared' | 'previewed' | 'failed';

export class ResultPosterController {
  private readonly overlay = new ResultPosterOverlay();

  async present(
    result: GameResult,
    theme: GameTheme,
    configureHost: () => boolean | Promise<boolean>,
  ): Promise<ResultPosterOutcome> {
    if (typeof document === 'undefined') return 'failed';
    const model = buildResultPosterModel(result, theme);
    try {
      const blob = await renderResultPoster(model, theme);
      const dataUrl = await blobToDataUrl(blob);
      if (await shareResultPoster(blob, model)) return 'shared';
      await Promise.resolve(configureHost()).catch(() => false);
      this.overlay.show(dataUrl, model);
      return 'previewed';
    } catch (error) {
      console.warn('[ResultPoster] generation failed', error);
      this.overlay.show(null, model);
      return 'failed';
    }
  }

  dispose(): void {
    this.overlay.dispose();
  }
}
