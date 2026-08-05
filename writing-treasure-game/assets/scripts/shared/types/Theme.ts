import { GameId } from './GameTypes';

export interface ThemePalette {
  primary: string;
  secondary: string;
  text: string;
  panel: string;
  correct: string;
  wrong: string;
}

export interface MotionAssets {
  idle?: string;
  action?: string;
  runLeft?: string;
  runRight?: string;
  correct?: string;
  wrong?: string;
  result?: string;
  transition?: string;
}

export interface ThemeAssets {
  background: string;
  characterIdle: string;
  characterAction: string;
  hudTimer: string;
  hudScore: string;
  scoreIcon?: string;
  option: string;
  optionWrong?: string;
  feedbackCorrect: string;
  feedbackWrong: string;
  questionBoard?: string;
  voiceIdle?: string;
  voiceListening?: string;
  choices?: readonly [string, string, string];
  successState?: string;
  successStates?: readonly [string, string, string];
  failState?: string;
  failStates?: readonly [string, string, string];
  dunhuangOpenTop?: string;
  resultBackground?: string;
  resultRank?: string;
  resultRankBase?: string;
  resultRankLabels?: readonly string[];
  resultReview?: string;
  resultReviewPanel?: string;
  resultScore?: string;
  resultCorrect?: string;
  resultWrong?: string;
  resultDecoration?: string;
  resultStars?: readonly string[];
  motion?: MotionAssets;
}

export interface GameTheme {
  id: string;
  game: GameId;
  name: string;
  available: boolean;
  materialStatus: 'complete' | 'placeholder';
  assetSource: string;
  tool?: string;
  palette: ThemePalette;
  assets: ThemeAssets;
}

export interface IntroTheme {
  background: string;
  title: string;
  character: string;
  startButton: string;
  startLabel?: string;
  guide: string;
}
