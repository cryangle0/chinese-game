import {
  GameTheme, SpriteSheetAnimation, ThemeAssets, ThemePalette,
} from '../../../shared/types/Theme';
import { AudioTheme } from '../../../services/AudioCatalog';
const readingAudioBase = './audio/reading';
const marioAudioBase = './audio/mario';
const locomotionIdleSheetFps = 20;
const locomotionTravelSheetFps = 15;
const locomotionSheetColumns = 4;
const locomotionSheetSpecs = {
  mario: {
    width: 218, height: 340, idle: 17, runLeft: 16, runRight: 13,
  },
  'deep-sea': {
    width: 397, height: 341, idle: 17, runLeft: 15, runRight: 15,
  },
  space: {
    width: 270, height: 330, idle: 13, runLeft: 15, runRight: 15,
  },
  food: {
    width: 125, height: 219, idle: 16, runLeft: 16, runRight: 16,
  },
  poetry: {
    width: 240, height: 324, idle: 15, runLeft: 14, runRight: 14,
  },
} as const;
type LocomotionSceneId = keyof typeof locomotionSheetSpecs;

function locomotionSheet(
  id: LocomotionSceneId,
  action: 'idle' | 'run-left' | 'run-right',
  frames: number,
): SpriteSheetAnimation {
  const spec = locomotionSheetSpecs[id];
  return {
    path: `themes/reading/${id}/locomotion-${action}`,
    frameWidth: spec.width,
    frameHeight: spec.height,
    columns: locomotionSheetColumns,
    frames,
    padding: 0,
    fps: action === 'idle' ? locomotionIdleSheetFps : locomotionTravelSheetFps,
  };
}

function locomotionAnimations(id: LocomotionSceneId): Pick<
  ThemeAssets,
  'characterIdleAnimation' | 'characterRunLeftAnimation' | 'characterRunRightAnimation'
> {
  const spec = locomotionSheetSpecs[id];
  return {
    characterIdleAnimation: locomotionSheet(id, 'idle', spec.idle),
    characterRunLeftAnimation: locomotionSheet(id, 'run-left', spec.runLeft),
    characterRunRightAnimation: locomotionSheet(id, 'run-right', spec.runRight),
  };
}
const sharedReadingAudio: AudioTheme = {
  bgm: { url: `${readingAudioBase}/bgm.mp3`, volume: 0.22 },
  coin: { url: './audio/shared/score-coin.mp3', volume: 0.68 },
  button: { url: `${marioAudioBase}/button.mp3`, volume: 0.8 },
  strike: { url: `${marioAudioBase}/strike.mp3`, volume: 0.78 },
  run: { url: `${marioAudioBase}/run.mp3`, volume: 0.34 },
  reward: { url: `${marioAudioBase}/reward.mp3`, volume: 0.42 },
  danger: { url: `${marioAudioBase}/danger.mp3`, volume: 0.46 },
  timer: { url: `${marioAudioBase}/timer.mp3`, volume: 0.5 },
  result: { url: `${marioAudioBase}/result.mp3`, volume: 0.8 },
  firework: { url: `${marioAudioBase}/firework.mp3`, volume: 0.8 },
};
export const marioAudio: AudioTheme = {
  ...sharedReadingAudio,
  introTitle: { url: `${marioAudioBase}/intro-title.mp3`, volume: 0.64 },
  startAppear: { url: `${marioAudioBase}/start-appear.mp3`, volume: 0.62 },
  correct: { url: `${marioAudioBase}/correct.mp3`, volume: 0.82 },
  wrong: { url: `${marioAudioBase}/wrong.mp3`, volume: 0.78 },
  transition: { url: `${marioAudioBase}/transition.mp3`, volume: 0.78 },
};
export function readingAudio(id: string): AudioTheme {
  if (id === 'mario') return marioAudio;
  const base = `${readingAudioBase}/${id}`;
  return {
    ...sharedReadingAudio,
    ambient: id === 'deep-sea' ? { url: `${base}/ambient.mp3`, volume: 0.12 } : {},
    correct: { url: `${base}/correct.mp3`, volume: 0.8 },
    wrong: { url: `${base}/wrong.mp3`, volume: 0.76 },
    transition: { url: `${base}/transition.mp3`, volume: 0.72 },
  };
}
const deepSeaAssets: ThemeAssets = {
  ...locomotionAnimations('deep-sea'),
  background: 'themes/reading/deep-sea/background',
  characterIdle: 'themes/reading/deep-sea/deer',
  characterAction: 'themes/reading/deep-sea/deer',
  hudTimer: 'themes/reading/deep-sea/hud-timer',
  hudScore: 'themes/reading/deep-sea/hud-score',
  scoreIcon: 'themes/reading/deep-sea/score-icon',
  questionBoard: 'themes/reading/deep-sea/question-board',
  option: 'themes/reading/deep-sea/option',
  optionWrong: 'themes/reading/deep-sea/option-wrong',
  feedbackCorrect: 'themes/reading/deep-sea/feedback-correct',
  feedbackWrong: 'themes/reading/deep-sea/feedback-wrong',
  resultBackground: 'themes/reading/deep-sea/result-background',
  resultRankRows: [
    'themes/reading/deep-sea/result-rank-1',
    'themes/reading/deep-sea/result-rank-2',
    'themes/reading/deep-sea/result-rank-3',
  ],
  resultStars: ['themes/reading/deep-sea/result-star'],
  resultCorrect: 'themes/reading/deep-sea/result-correct',
  resultWrong: 'themes/reading/deep-sea/result-wrong',
  motion: motionAssets('deep-sea', 1),
};
const marioAssets: ThemeAssets = {
  ...locomotionAnimations('mario'),
  background: 'themes/reading/mario/background',
  // Static fallback only. DeerView keeps the front-facing run-in-place motion visible in play.
  characterIdle: 'themes/reading/intro/deer',
  characterAction: 'themes/reading/intro/deer',
  hudTimer: 'themes/reading/mario/hud-timer',
  hudScore: 'themes/reading/mario/hud-score',
  scoreIcon: 'themes/reading/mario/score-icon',
  questionBoard: 'themes/reading/mario/question',
  option: 'themes/reading/mario/option',
  optionWrong: 'themes/reading/mario/option-selected',
  feedbackCorrect: 'themes/reading/mario/correct',
  feedbackWrong: 'themes/reading/mario/wrong',
  resultBackground: 'themes/reading/mario/result-background',
  resultRankTitle: 'themes/reading/mario/result-rank-title',
  resultReviewTitle: 'themes/reading/mario/result-review-title',
  resultRankRows: [
    'themes/reading/mario/result-rank-1',
    'themes/reading/mario/result-rank-2',
    'themes/reading/mario/result-rank-3',
  ],
  resultStars: ['themes/reading/mario/result-star-1'],
  resultCorrect: 'themes/reading/mario/result-correct',
  resultWrong: 'themes/reading/mario/result-wrong',
  motion: motionAssets('mario', 0),
};
function motionAssets(id: string, index: number): NonNullable<ThemeAssets['motion']> {
  const media = `./media/${id}`;
  return {
    action: `${media}/action.webp`,
    correct: `${media}/correct.webp`,
    wrong: `${media}/wrong.webp`,
    result: `${media}/result.webp`,
    transition: index > 0 ? `./media/transitions/${index}.webp` : undefined,
  };
}
function themeAssets(id: LocomotionSceneId, index: number): ThemeAssets {
  const base = `themes/reading/${id}`;
  const hasTitles = id === 'food' || id === 'poetry';
  const hasOwnRankRows = id === 'food';
  return {
    ...locomotionAnimations(id),
    background: `${base}/background`,
    characterIdle: `${base}/deer`,
    characterAction: `${base}/deer`,
    hudTimer: `${base}/hud-timer`,
    hudScore: `${base}/hud-score`,
    scoreIcon: `${base}/score-icon`,
    questionBoard: `${base}/question-board`,
    option: `${base}/option`,
    optionWrong: `${base}/option-wrong`,
    feedbackCorrect: `${base}/feedback-correct`,
    feedbackWrong: `${base}/feedback-wrong`,
    resultBackground: `${base}/result-background`,
    // 无自有排行榜切图时不要回退玛丽（会带奖牌图标）；走白条文字
    resultRankTitle: hasTitles ? `${base}/result-rank-title` : undefined,
    resultReviewTitle: hasTitles ? `${base}/result-review-title` : undefined,
    resultRankRows: hasOwnRankRows
      ? [
        `${base}/result-rank-1`,
        `${base}/result-rank-2`,
        `${base}/result-rank-3`,
      ] as const
      : undefined,
    resultStars: id === 'poetry'
      ? [`${base}/result-star-1`]
      : [`${base}/result-star`],
    resultCorrect: `${base}/result-correct`,
    resultWrong: `${base}/result-wrong`,
    motion: motionAssets(id, index),
  };
}
const palettes: readonly ThemePalette[] = [
  { primary: '#E96A19', secondary: '#F2C14E', text: '#FFFFFF', panel: '#6C3A25', correct: '#55D49B', wrong: '#E95766' },
  { primary: '#087CB8', secondary: '#5C4DCC', text: '#FFFFFF', panel: '#075A91', correct: '#22C98B', wrong: '#E95766' },
  { primary: '#3158A8', secondary: '#E9C46A', text: '#FFFFFF', panel: '#203D78', correct: '#55D49B', wrong: '#F06A78' },
  { primary: '#B54B3C', secondary: '#F2C14E', text: '#FFFFFF', panel: '#76372E', correct: '#58C68D', wrong: '#D94C5C' },
  { primary: '#477A62', secondary: '#C59445', text: '#FFFFFF', panel: '#315645', correct: '#55C98E', wrong: '#D95F68' },
];

function stage(
  id: string,
  name: string,
  index: number,
  assets: ThemeAssets,
  materialStatus: GameTheme['materialStatus'],
  assetSource: string,
): GameTheme {
  return {
    id,
    name,
    available: true,
    materialStatus,
    assetSource,
    game: 'reading-jumper',
    palette: palettes[index],
    assets,
  };
}

export const readingThemes: readonly GameTheme[] = [
  stage('mario', '超级玛丽', 0, marioAssets, 'complete', 'mario'),
  stage('deep-sea', '深海龙宫', 1, deepSeaAssets, 'complete', 'deep-sea'),
  stage('space', '星际穿越', 2, themeAssets('space', 2), 'complete', 'space'),
  stage('food', '美食大冒险', 3, themeAssets('food', 3), 'complete', 'food'),
  stage('poetry', '诗词山水', 4, themeAssets('poetry', 4), 'complete', 'poetry'),
];

export const marioTheme = readingThemes[0];
export const deepSeaTheme = readingThemes[1];
export { readingIntro } from '../../../shared/config/ReadingIntroTheme';
