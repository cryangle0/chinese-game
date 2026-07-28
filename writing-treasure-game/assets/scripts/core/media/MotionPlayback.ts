/**
 * Measured ANMF duration of every packaged feedback effect, per scene.
 * A single hardcoded hold cut the longer scenes off mid-effect and left the
 * shorter ones idling, so the stage now waits exactly as long as the artwork runs.
 * `FeedbackMotionTiming.spec.ts` re-measures customer-media and fails on drift.
 */
const FEEDBACK_DURATION_MS: Readonly<Record<string, { correct: number; wrong: number }>> = {
  treasure: { correct: 1066, wrong: 1732 },
  desert: { correct: 3066, wrong: 2066 },
  dinosaur: { correct: 2999, wrong: 3000 },
  dunhuang: { correct: 2999, wrong: 2199 },
  magic: { correct: 1732, wrong: 1399 },
};

/** Longest packaged effect, so an unknown scene still plays to the end. */
const DEFAULT_FEEDBACK_DURATION = { correct: 3066, wrong: 2999 };

/** Beat on the held final frame before the stage advances (effects play once). */
export const FEEDBACK_TAIL_MS = 240;

export function feedbackDurationMs(sceneId: string, correct: boolean): number {
  const row = FEEDBACK_DURATION_MS[sceneId] ?? DEFAULT_FEEDBACK_DURATION;
  return correct ? row.correct : row.wrong;
}

export function feedbackHoldMs(sceneId: string, correct: boolean): number {
  return feedbackDurationMs(sceneId, correct) + FEEDBACK_TAIL_MS;
}
