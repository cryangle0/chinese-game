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

export interface WritingActionTiming {
  readonly holdMs: number;
  readonly impactAtMs: readonly number[];
}

export interface AnchoredFeedbackLayerPlacement {
  readonly x: number;
  readonly width: number;
}

const actionTiming: Readonly<Record<string, WritingActionTiming>> = {
  treasure: { holdMs: 1500, impactAtMs: [280, 880, 1320] },
  desert: { holdMs: 1200, impactAtMs: [280, 720, 1080] },
  dinosaur: { holdMs: 1200, impactAtMs: [280, 760, 1080] },
  dunhuang: { holdMs: 2600, impactAtMs: [280, 1320, 2280] },
  magic: { holdMs: 2000, impactAtMs: [280, 1040, 1760] },
};

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

export function writingActionTiming(sceneId: string): WritingActionTiming {
  return actionTiming[sceneId] ?? actionTiming.treasure;
}

export function anchoredFeedbackLayerPlacement(
  placedX: number,
  width: number,
  selectedIndex: number,
  anchorIndex: number | undefined,
  choiceColumns: readonly number[],
  backdropScaleX: number,
  stretchWithBackdrop = false,
): AnchoredFeedbackLayerPlacement {
  if (anchorIndex === undefined) return { x: placedX, width };
  const scaleX = Number.isFinite(backdropScaleX) && backdropScaleX > 0
    ? backdropScaleX
    : 1;
  const selected = Math.max(0, Math.min(choiceColumns.length - 1, selectedIndex));
  const anchor = Math.max(0, Math.min(choiceColumns.length - 1, anchorIndex));
  const selectedX = choiceColumns[selected] ?? placedX;
  const scaledAnchorX = choiceColumns[anchor] ?? selectedX;
  const designAnchorX = scaledAnchorX / scaleX;
  const localOffsetX = placedX - designAnchorX;
  return {
    x: selectedX + localOffsetX * scaleX,
    width: stretchWithBackdrop ? width * scaleX : width,
  };
}

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

/** Select the dinosaur chase rendered for the answered egg column. */
export function feedbackStageMotionPath(path: string, selectedIndex: number): string {
  const index = Math.max(0, Math.min(2, Math.trunc(selectedIndex))) + 1;
  return path.replace(/\.webp(?:[?#].*)?$/i, `-${index}.webp`);
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
