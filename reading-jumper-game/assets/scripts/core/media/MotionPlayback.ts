/**
 * Actual packaged animated-webp durations (ANMF sum), plus small buffer.
 * Used so we do not cut playback short (“跳帧 / 不完整”).
 */
const TRANSITION_MS: Readonly<Record<string, number>> = {
  '1': 1400,
  '2': 1750,
  '3': 1400,
  '4': 2000,
};

/**
 * Measured ANMF duration of every packaged feedback effect, per scene.
 * `FeedbackMotionTiming.spec.ts` re-measures customer-media and fails on drift.
 */
const FEEDBACK_DURATION_MS: Readonly<Record<string, { correct: number; wrong: number }>> = {
  mario: { correct: 866, wrong: 2599 },
  'deep-sea': { correct: 2799, wrong: 2866 },
  space: { correct: 2732, wrong: 2799 },
  food: { correct: 2866, wrong: 3066 },
  poetry: { correct: 1066, wrong: 1999 },
};

/** Longest packaged effect, so an unknown scene still plays to the end. */
const DEFAULT_FEEDBACK_DURATION = { correct: 2866, wrong: 3066 };

/** Beat on the held final frame before the stage advances (effects play once). */
export const FEEDBACK_TAIL_MS = 240;

export function transitionHoldMs(source: string | undefined): number {
  if (!source) return 2000;
  const match = /transitions\/(\d+)\.webp/i.exec(source);
  const key = match?.[1] ?? '';
  return TRANSITION_MS[key] ?? 2000;
}

export function feedbackDurationMs(sceneId: string, correct: boolean): number {
  const row = FEEDBACK_DURATION_MS[sceneId] ?? DEFAULT_FEEDBACK_DURATION;
  return correct ? row.correct : row.wrong;
}

export function feedbackHoldMs(sceneId: string, correct: boolean): number {
  return feedbackDurationMs(sceneId, correct) + FEEDBACK_TAIL_MS;
}
