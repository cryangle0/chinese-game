import { normalizeChineseTypography } from './ChineseTextWrap';

export type FeedbackPresentation = 'motion' | 'hybrid';

export interface ChoiceFeedbackGeometry {
  readonly width: number;
  readonly height: number;
  readonly localY: number;
}

export interface FeedbackSequencePlan {
  readonly revealAfterMs: number;
  readonly chase?: {
    readonly durationMs: number;
    readonly fromX: number;
    readonly toX: number;
  };
}

const choiceFeedbackGeometry: Readonly<
Record<string, { readonly correct?: ChoiceFeedbackGeometry; readonly wrong?: ChoiceFeedbackGeometry }>
> = {
  treasure: {
    correct: { width: 235, height: 188, localY: 20 },
    wrong: { width: 219, height: 209, localY: 14 },
  },
  desert: {
    correct: { width: 313, height: 246, localY: 47 },
  },
  dunhuang: {
    correct: { width: 323, height: 350, localY: 12 },
    wrong: { width: 196, height: 150, localY: -7 },
  },
  magic: {
    correct: { width: 272, height: 355, localY: 81 },
    wrong: { width: 165, height: 161, localY: -4 },
  },
};

export function formatWritingOption(index: number, raw: string): string {
  const text = normalizeChineseTypography(
    raw.replace(/^[A-Ca-c](?:[.、．]\s*|\s+|(?=[\u3400-\u9fff]))/u, '').trim(),
  );
  return text ? `${String.fromCharCode(65 + index)}. ${text}` : '';
}

/**
 * Dinosaur correct feedback still reveals the supplied hatchling artwork.
 * Dinosaur wrong feedback is now a complete full-stage chase animation.
 */
export function feedbackPresentation(
  sceneId: string,
  correct = true,
): FeedbackPresentation {
  if (sceneId === 'dinosaur') return 'hybrid';
  return sceneId === 'desert' && !correct ? 'hybrid' : 'motion';
}

export function feedbackUsesStageMotion(sceneId: string, correct: boolean): boolean {
  return sceneId === 'dinosaur' && !correct;
}

export function feedbackSequencePlan(
  sceneId: string,
  correct: boolean,
): FeedbackSequencePlan | undefined {
  if (sceneId !== 'dinosaur') return undefined;
  if (correct) return { revealAfterMs: 1800 };
  return undefined;
}

export function revealChoiceAsset(
  _sceneId: string,
  selectedIndex: number,
  stateAsset: string | undefined,
  choiceAssets: readonly string[] | undefined,
): string | undefined {
  return stateAsset ?? choiceAssets?.[selectedIndex];
}

export function revealChoiceGeometry(
  sceneId: string,
  correct: boolean,
): ChoiceFeedbackGeometry | undefined {
  const geometry = choiceFeedbackGeometry[sceneId];
  return correct ? geometry?.correct : geometry?.wrong;
}

/** Desert wrong feedback is the explorer falling into an empty tomb. */
export function hideChoiceDuringFeedback(sceneId: string, correct: boolean): boolean {
  return sceneId === 'desert' && !correct;
}
