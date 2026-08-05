import { GameTheme, ThemeAssets, ThemePalette } from '../../../shared/types/Theme';
import { AudioTheme } from '../../../services/AudioCatalog';

const writingAudioBase = './audio/writing';
const sharedWritingAssets = 'themes/writing/shared';

export function writingAudio(id: string): AudioTheme {
  const base = `${writingAudioBase}/${id}`;
  return {
    bgm: { url: `${writingAudioBase}/bgm.mp3`, volume: 0.22 },
    coin: { url: './audio/shared/score-coin.mp3', volume: 0.68 },
    opening: { url: `${writingAudioBase}/opening.mp3`, volume: 0.68 },
    start: { url: `${writingAudioBase}/start.mp3`, volume: 0.7 },
    question: { url: `${writingAudioBase}/question.mp3`, volume: 0.68 },
    voiceStart: { url: `${writingAudioBase}/voice-start.mp3`, volume: 0.72 },
    voiceComplete: { url: `${writingAudioBase}/voice-complete.mp3`, volume: 0.72 },
    button: { url: `${writingAudioBase}/button.mp3`, volume: 0.76 },
    walk: { url: `${base}/walk.mp3`, volume: 0.42 },
    strike: { url: `${base}/strike.mp3`, volume: 0.76 },
    unlock: { url: `${base}/unlock.mp3`, volume: 0.7 },
    reveal: id === 'magic' ? { url: `${base}/reveal.mp3`, volume: 0.72 } : {},
    correct: { url: `${base}/correct.mp3`, volume: 0.8 },
    wrong: { url: `${base}/wrong.mp3`, volume: 0.76 },
    transition: { url: `${base}/transition.mp3`, volume: 0.72 },
    result: { url: `${base}/result.mp3`, volume: 0.76 },
  };
}

function sharedHudAssets(id: string, base: string): Pick<ThemeAssets, 'hudTimer' | 'hudScore'> {
  const shared = ['treasure', 'desert', 'dinosaur'].includes(id);
  return {
    hudTimer: shared ? 'themes/writing/intro/hudTimer' : `${base}/hudTimer`,
    hudScore: shared ? 'themes/writing/intro/hudScore' : `${base}/hudScore`,
  };
}

function resultAssets(id: string, base: string): Partial<ThemeAssets> {
  const assets: Partial<ThemeAssets> = {
    resultRank: `${sharedWritingAssets}/resultRankTitle`,
    resultRankBase: `${base}/resultRankBase`,
    resultReview: `${base}/resultReview`,
    resultCorrect: `${base}/resultCorrect`,
    resultWrong: `${base}/resultWrong`,
    resultStars: id === 'treasure'
      ? [1, 2, 3, 4, 5].map((index) => `${base}/resultStars-${index}`)
      : [`${base}/resultStars${id === 'magic' ? '-1' : ''}`],
  };
  assets.resultRankLabels = [1, 2, 3]
    .map((index) => `${sharedWritingAssets}/resultRankLabel${index}`);
  if (['desert', 'dinosaur', 'dunhuang', 'magic'].includes(id)) {
    assets.resultReviewPanel = `${base}/resultReviewPanel`;
  }
  assets.resultDecoration = `${base}/resultDecoration`;
  return assets;
}

function clientAssets(id: string, _index: number): ThemeAssets {
  const base = `themes/writing/${id}`;
  const media = `./media/${id}`;
  /** Prototype `data-transition` mapping (not stage order). */
  const transitionByScene: Readonly<Record<string, number>> = {
    desert: 1,
    dinosaur: 3,
    dunhuang: 2,
    magic: 4,
  };
  const transitionIndex = transitionByScene[id];
  const characterMotionVersion = id === 'treasure' ? '?v=hq-character-2' : '';
  const choiceStateAvailability: Readonly<Record<string, {
    readonly success: boolean;
    readonly fail: boolean;
  }>> = {
    treasure: { success: true, fail: true },
    desert: { success: true, fail: true },
    dinosaur: { success: false, fail: false },
    dunhuang: { success: true, fail: true },
    magic: { success: true, fail: true },
  };
  const choiceStates = choiceStateAvailability[id];
  const assets: ThemeAssets = {
    background: `${base}/background`,
    characterIdle: `${base}/characterIdle`,
    characterAction: `${base}/characterIdle`,
    ...sharedHudAssets(id, base),
    scoreIcon: id === 'dunhuang' ? undefined : `${base}/scoreIcon`,
    option: `${base}/option`,
    feedbackCorrect: `${base}/feedbackCorrect`,
    feedbackWrong: `${base}/feedbackWrong`,
    questionBoard: ['magic', 'dunhuang'].includes(id)
      ? `${base}/questionBoard` : 'themes/writing/intro/questionBoard',
    voiceIdle: 'themes/writing/intro/voiceIdle',
    voiceListening: 'themes/writing/intro/voiceListening',
    choices: [`${base}/choices-1`, `${base}/choices-2`, `${base}/choices-3`],
    successState: choiceStates?.success ? `${base}/successState` : undefined,
    successStates: ['treasure', 'desert', 'dunhuang'].includes(id)
      ? [
        `${base}/successState-red`,
        `${base}/successState`,
        `${base}/successState-green`,
      ]
      : undefined,
    failState: choiceStates?.fail ? `${base}/failState` : undefined,
    failStates: id === 'treasure'
      ? [
        `${base}/failState`,
        `${base}/failState-purple`,
        `${base}/failState-green`,
      ]
      : id === 'dunhuang'
        ? [
          `${base}/failState`,
          `${base}/failState-white`,
          `${base}/failState-green`,
        ]
        : undefined,
    dunhuangOpenTop: id === 'dunhuang' ? `${base}/openTop` : undefined,
    resultBackground: `${base}/resultBackground`,
    motion: {
      idle: `${media}/idle.webp`,
      action: `${media}/action.webp${characterMotionVersion}`,
      runLeft: `${media}/run-left.webp${characterMotionVersion}`,
      runRight: `${media}/run-right.webp${characterMotionVersion}`,
      correct: `${media}/correct.webp`,
      wrong: `${media}/wrong.webp`,
      result: `${media}/result.webp`,
      transition: transitionIndex
        ? `./media/transitions/${transitionIndex}.webp`
        : undefined,
    },
  };
  Object.assign(assets, resultAssets(id, base));
  return assets;
}

const palettes: readonly ThemePalette[] = [
  { primary: '#B85B2A', secondary: '#F0B83D', text: '#FFFFFF', panel: '#6F351F', correct: '#55D49B', wrong: '#E45C75' },
  { primary: '#A64B35', secondary: '#E5B94B', text: '#FFFFFF', panel: '#753729', correct: '#55D49B', wrong: '#E45C75' },
  { primary: '#287D68', secondary: '#E7C34F', text: '#FFFFFF', panel: '#225D50', correct: '#55D49B', wrong: '#E45C75' },
  { primary: '#9A4E31', secondary: '#3B7E85', text: '#FFFFFF', panel: '#643924', correct: '#55D49B', wrong: '#E45C75' },
  { primary: '#6E4AA8', secondary: '#E09A35', text: '#FFFFFF', panel: '#2D2F68', correct: '#55D49B', wrong: '#E45C75' },
];

function stage(id: string, name: string, tool: string, index: number): GameTheme {
  return {
    id, name, tool, available: true, materialStatus: 'complete',
    assetSource: 'customer-zip-20260716', game: 'writing-treasure',
    palette: palettes[index], assets: clientAssets(id, index),
  };
}

export const writingThemes: readonly GameTheme[] = [
  stage('treasure', '\u7ecf\u5178\u6316\u5b9d', '\u94fe\u5b50', 0),
  stage('desert', '\u6c99\u6f20\u63a2\u9669', '\u5c0f\u94f2\u5b50', 1),
  stage('dinosaur', '\u6050\u9f99\u4e16\u754c', '\u5730\u8d28\u9524', 2),
  stage('dunhuang', '\u6566\u714c\u58c1\u753b', '\u91d1\u521a\u6756', 3),
  stage('magic', '\u9b54\u6cd5\u5b66\u9662', '\u9b54\u6756', 4),
];

export const treasureTheme = writingThemes[0];
export const magicTheme = writingThemes[4];
export { writingIntro } from '../../../shared/config/WritingIntroTheme';
