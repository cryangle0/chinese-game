import { GameId } from './GameTypes';

export interface ThemePalette {
  primary: string;
  secondary: string;
  text: string;
  panel: string;
  correct: string;
  wrong: string;
}

export interface SpriteSheetAnimation {
  path: string;
  frameWidth: number;
  frameHeight: number;
  columns: number;
  frames: number;
  padding: number;
  fps: number;
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
  characterIdleAnimation?: SpriteSheetAnimation;
  characterActionAnimation?: SpriteSheetAnimation;
  hudTimer: string;
  hudScore: string;
  scoreIcon: string;
  option: string;
  optionWrong?: string;
  feedbackCorrect: string;
  feedbackWrong: string;
  resultBackground?: string;
  resultRankTitle?: string;
  resultReviewTitle?: string;
  resultRankRows?: readonly [string, string, string];
  resultStars?: readonly string[];
  resultCorrect?: string;
  resultWrong?: string;
  questionBoard?: string;
  choices?: readonly [string, string, string];
  successState?: string;
  failState?: string;
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
  rewardTube?: string;
  pipeBack?: string;
  pipeFront?: string;
  startButton: string;
  startLabel?: string;
  guide: string;
}
