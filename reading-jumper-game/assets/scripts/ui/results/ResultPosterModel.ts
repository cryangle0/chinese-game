import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';

export interface ResultPosterModel {
  readonly answerSummary: string;
  readonly fileName: string;
  readonly gameTitle: string;
  readonly sceneTitle: string;
  readonly scoreText: string;
  readonly starsText: string;
}

export function buildResultPosterModel(
  result: GameResult,
  theme: GameTheme,
): ResultPosterModel {
  return {
    answerSummary: `答对 ${result.correct} / ${result.answered} 题`,
    fileName: `reading-jumper-${theme.id}-${result.score}.png`,
    gameTitle: '阅读跳跳乐成绩',
    sceneTitle: theme.name,
    scoreText: `${result.score} 分`,
    starsText: '★'.repeat(result.stars) + '☆'.repeat(5 - result.stars),
  };
}
