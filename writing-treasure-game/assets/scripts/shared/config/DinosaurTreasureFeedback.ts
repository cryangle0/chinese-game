export interface DinosaurFramePoint {
  readonly x: number;
  readonly y: number;
}

export interface DinosaurFrameAnchor {
  readonly x: number;
  readonly baselineY: number;
}

export interface DinosaurFrameBlend {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly mix: number;
}

export const DINOSAUR_TREASURE_FEEDBACK = {
  assetVersion: 'dinosaur-correct-hatch-20260805-gpt2-smooth-v1',
  wrongAssetVersion: 'dinosaur-wrong-hatch-20260805-gpt2-smooth-v1',
  actorJumpLiftY: 78,
  actorJumpUpMs: 180,
  actorDropMs: 480,
  actorPitY: -162,
  correctActorPitOffsetX: -103,
  correctActorPitY: -164,
  effectScale: 0.56,
  effectBaselineY: -298,
  completionTailMs: 180,
  wrongActorPitOffsetX: -36,
  wrongEggWatchMs: 560,
  wrongActorEscapeAtMs: 520,
  wrongDinosaurJumpAtMs: 820,
  wrongDinosaurJumpMs: 620,
  wrongSequenceDurationMs: 1440,
  wrongActorEscapeUpMs: 260,
  wrongActorEscapeDownMs: 360,
  wrongActorEscapeApexLiftY: 118,
  wrongWatchEggScale: 1.18,
  wrongShellScale: 0.92,
  wrongShellBaselineY: -318,
  wrongDinosaurScale: 0.62,
  wrongDinosaurHatchStartY: -300,
  wrongDinosaurHatchFeetY: -238,
  wrongDinosaurGroundFeetY: -15,
  wrongDinosaurLandingOffsetX: -225,
  wrongDinosaurChaseOffsetX: -390,
  wrongDinosaurChaseGapEaseProgress: 0.2,
  wrongDinosaurRunBobY: 7,
  wrongDinosaurRunCyclesPerSecond: 4,
  wrongDinosaurJumpApexLiftY: 160,
  wrongActorChaseEndX: 1360,
  wrongChasePixelsPerSecond: 620,
  wrongChaseMinMs: 1050,
  wrongActorReturnPixelsPerSecond: 900,
  wrongActorReturnMinMs: 700,
  wrongCompletionTailMs: 650,
} as const;

export function dinosaurCorrectFrameIndex(
  elapsedMs: number,
  frameCount: number,
  fps: number,
): number {
  if (frameCount <= 1 || fps <= 0) return 0;
  return Math.min(
    frameCount - 1,
    Math.max(0, Math.floor(elapsedMs * fps / 1000)),
  );
}

export function dinosaurCorrectFrameBlend(
  elapsedMs: number,
  frameCount: number,
  fps: number,
): DinosaurFrameBlend {
  if (frameCount <= 1 || fps <= 0) {
    return { fromIndex: 0, toIndex: 0, mix: 0 };
  }
  const lastIndex = frameCount - 1;
  const framePosition = Math.max(0, elapsedMs) * fps / 1000;
  const fromIndex = Math.min(lastIndex, Math.floor(framePosition));
  const toIndex = Math.min(lastIndex, fromIndex + 1);
  if (fromIndex === toIndex) {
    return { fromIndex, toIndex, mix: 0 };
  }
  const rawMix = Math.max(0, Math.min(1, framePosition - fromIndex));
  const mix = rawMix * rawMix * (3 - 2 * rawMix);
  return { fromIndex, toIndex, mix };
}

export function dinosaurCorrectSequenceDurationMs(
  frameCount: number,
  fps: number,
  finalHoldMs: number,
): number {
  if (frameCount <= 0 || fps <= 0) return Math.max(0, finalHoldMs);
  return frameCount * 1000 / fps + Math.max(0, finalHoldMs);
}

export function dinosaurCorrectStagePoint(
  columnX: number,
  point: DinosaurFramePoint,
  anchor: DinosaurFrameAnchor,
): DinosaurFramePoint {
  const scale = DINOSAUR_TREASURE_FEEDBACK.effectScale;
  return {
    x: columnX + (point.x - anchor.x) * scale,
    y: DINOSAUR_TREASURE_FEEDBACK.effectBaselineY
      - (point.y - anchor.baselineY) * scale,
  };
}

export function dinosaurWrongFrameIndex(
  elapsedMs: number,
  frameCount: number,
  fps: number,
): number {
  if (frameCount <= 1 || fps <= 0) return 0;
  return Math.floor(Math.max(0, elapsedMs) * fps / 1000) % frameCount;
}

export function dinosaurWrongFrameBlend(
  elapsedMs: number,
  frameCount: number,
  fps: number,
): DinosaurFrameBlend {
  if (frameCount <= 1 || fps <= 0) {
    return { fromIndex: 0, toIndex: 0, mix: 0 };
  }
  const framePosition = Math.max(0, elapsedMs) * fps / 1000;
  const wrappedPosition = framePosition % frameCount;
  const fromIndex = Math.floor(wrappedPosition);
  const toIndex = (fromIndex + 1) % frameCount;
  const rawMix = Math.max(0, Math.min(1, wrappedPosition - fromIndex));
  const mix = rawMix * rawMix * (3 - 2 * rawMix);
  return { fromIndex, toIndex, mix };
}

export function dinosaurWrongJumpPoint(
  columnX: number,
  progress: number,
): DinosaurFramePoint {
  const p = Math.max(0, Math.min(1, progress));
  const startY = DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurHatchFeetY;
  const endY = DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurGroundFeetY;
  return {
    x: columnX
      + DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurLandingOffsetX * p,
    y: startY
      + (endY - startY) * p
      + 4 * DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurJumpApexLiftY
        * p * (1 - p),
  };
}

export function dinosaurWrongChaseDurationMs(actorStartX: number): number {
  const travelDistance = Math.max(
    0,
    DINOSAUR_TREASURE_FEEDBACK.wrongActorChaseEndX - actorStartX,
  );
  return Math.max(
    DINOSAUR_TREASURE_FEEDBACK.wrongChaseMinMs,
    travelDistance
      / DINOSAUR_TREASURE_FEEDBACK.wrongChasePixelsPerSecond
      * 1000,
  );
}

export function dinosaurWrongReturnDurationMs(columnX: number): number {
  const travelDistance = Math.max(
    0,
    DINOSAUR_TREASURE_FEEDBACK.wrongActorChaseEndX - columnX,
  );
  return Math.max(
    DINOSAUR_TREASURE_FEEDBACK.wrongActorReturnMinMs,
    travelDistance
      / DINOSAUR_TREASURE_FEEDBACK.wrongActorReturnPixelsPerSecond
      * 1000,
  );
}

export function dinosaurWrongChasePoint(
  columnX: number,
  progress: number,
): DinosaurFramePoint {
  const p = Math.max(0, Math.min(1, progress));
  const actorTravelX =
    DINOSAUR_TREASURE_FEEDBACK.wrongActorChaseEndX - columnX;
  const gapProgress = Math.min(
    1,
    p / DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurChaseGapEaseProgress,
  );
  const easedGap = gapProgress * gapProgress * (3 - 2 * gapProgress);
  const dinosaurOffsetX =
    DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurLandingOffsetX
    + (
      DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurChaseOffsetX
      - DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurLandingOffsetX
    ) * easedGap;
  return {
    x: columnX
      + dinosaurOffsetX
      + actorTravelX * p,
    y: DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurGroundFeetY,
  };
}
