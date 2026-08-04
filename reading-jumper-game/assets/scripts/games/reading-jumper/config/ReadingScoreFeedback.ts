import type { ScoreFlightVisual } from '../../../ui/ScoreCoinDom';

const MEDIA = './media/reward-props';

const feedback: Readonly<Record<string, {
  readonly correct: ScoreFlightVisual;
  readonly wrong?: ScoreFlightVisual;
}>> = {
  mario: {
    correct: {
      asset: `${MEDIA}/mario/reward.png`,
      width: 52,
      height: 55,
      trail: 'gold',
      terminal: 'spark',
    },
    wrong: {
      asset: `${MEDIA}/mario/penalty.png`,
      width: 66,
      height: 90,
      count: 1,
      trail: 'danger',
      terminal: 'explosion',
      rotationTurns: 0.7,
      minFlipScale: 0.72,
    },
  },
  'deep-sea': {
    correct: {
      asset: `${MEDIA}/deep-sea/reward.png`,
      width: 52,
      height: 56,
      trail: 'aqua',
      terminal: 'spark',
    },
  },
  space: {
    correct: {
      asset: `${MEDIA}/space/reward.png`,
      width: 56,
      height: 53,
      trail: 'space',
      terminal: 'spark',
    },
    wrong: {
      asset: `${MEDIA}/space/penalty.png`,
      width: 100,
      height: 72,
      count: 1,
      trail: 'space',
      terminal: 'vortex',
      rotationTurns: 1.6,
      minFlipScale: 0.72,
    },
  },
  food: {
    correct: {
      asset: `${MEDIA}/food/reward.png`,
      width: 70,
      height: 46,
      trail: 'candy',
      terminal: 'spark',
      rotationTurns: 0.55,
    },
  },
  poetry: {
    correct: {
      asset: `${MEDIA}/poetry/reward.png`,
      width: 52,
      height: 53,
      trail: 'gold',
      terminal: 'spark',
    },
    wrong: {
      asset: `${MEDIA}/poetry/penalty.png`,
      width: 94,
      height: 105,
      count: 1,
      trail: 'ink',
      terminal: 'ink',
      rotationTurns: 0.35,
      minFlipScale: 0.78,
    },
  },
};

export function readingScoreFeedback(
  sceneId: string,
  correct: boolean,
): ScoreFlightVisual | undefined {
  const scene = feedback[sceneId] ?? feedback.mario;
  return correct ? scene.correct : scene.wrong;
}

export function readingScoreFeedbackAssets(sceneId?: string): string[] {
  const scenes = sceneId
    ? [feedback[sceneId] ?? feedback.mario]
    : Object.values(feedback);
  return scenes.flatMap((scene) => [
    scene.correct.asset,
    scene.wrong?.asset,
  ].filter((asset): asset is string => Boolean(asset)));
}

export function preloadReadingScoreFeedbackAssets(sceneId?: string): void {
  if (typeof Image === 'undefined') return;
  readingScoreFeedbackAssets(sceneId).forEach((asset) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = asset;
  });
}
