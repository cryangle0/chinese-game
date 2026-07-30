import { Node } from 'cc';
import { retainThemes } from '../core/assets/ThemePreloader';
import { writingThemes } from '../games/writing-treasure/config/WritingTheme';
import { hostAdapter, HostMessenger } from '../platform/HostAdapter';
import { GameServices } from '../services/GameServices';
import { AppConfig } from '../shared/config/AppConfig';
import { GameResult } from '../shared/types/GameTypes';
import { ResultView } from '../ui/ResultView';

interface WritingResultOptions {
  readonly appRoot: Node;
  readonly services: GameServices;
  readonly messenger: HostMessenger | null;
  readonly result: GameResult;
  readonly replay: () => void;
  readonly home: () => void;
}

export function createWritingResultView(options: WritingResultOptions): ResultView | null {
  const {
    appRoot, services, messenger, result, replay, home,
  } = options;
  const theme = writingThemes.find((item) => item.id === result.scene)
    ?? writingThemes[writingThemes.length - 1];
  if (!theme) return null;
  retainThemes([theme]);
  markResultDataset(result);
  services.analytics.track({
    name: 'result_view',
    game: 'writing-treasure',
    properties: { score: result.score, stars: result.stars },
  });
  messenger?.result(result);
  return new ResultView(
    appRoot, result, replay, home, theme,
    () => shareWritingResult(services, result),
    {
      rankingMaxScore: AppConfig.scoreCorrect
        * AppConfig.maxQuestions
        * AppConfig.campaignStages,
    },
  );
}

function markResultDataset(result: GameResult): void {
  if (typeof document === 'undefined') return;
  Object.assign(document.body.dataset, {
    gameView: 'result',
    finishReason: result.reason,
    gameAnswered: String(result.answered),
    gameScore: String(result.score),
    shareTitle: `挖宝：${result.score} 分`,
  });
}

function shareWritingResult(services: GameServices, result: GameResult): boolean | Promise<boolean> {
  services.analytics.track({
    name: 'share_score',
    game: 'writing-treasure',
    properties: { score: result.score, stars: result.stars, pool: 'global-rank' },
  });
  const title = `挖宝：${result.score} 分`;
  return hostAdapter.share({
    title,
    url: typeof location === 'undefined' ? undefined : location.href,
  });
}
