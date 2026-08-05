export const CLASSIC_TREASURE_FEEDBACK = {
  optionBobLift: 16,
  optionBobDip: 10,
  optionSinkY: -82,
  optionSinkMs: 360,
  holeSurfaceY: -24,
  actorDigGroundOffsetY: 91,
  actorDigScale: 0.9,
  actorSinkOffsetY: -76,
  actorChestInsetY: -8,
  actorSinkMs: 340,
  actorLaunchApexY: 235,
  actorLaunchMs: 360,
  actorLandMs: 460,
  actorLandingOffsetX: 165,
  actorLandingHoldMs: 520,
  actorWrongFrameWidth: 600,
  actorWrongFrameHeight: 670,
  actorWrongFirstCenterX: 283,
  actorWrongFirstBottomY: 554,
  actorWrongLastCenterX: 347.5,
  actorWrongLastBottomY: 572,
  actorWrongTravelApexLiftY: 34,
  actorWrongFallbackWidth: 339,
  actorWrongFallbackHeight: 291,
  actorWrongFallbackBottomY: 290,
  effectAnchorY: -160,
  correctRewardDelayMs: 360,
  rewardDurationMs: 1600,
  rewardCompletionTailMs: 160,
  scoreCoinDelayMs: 560,
  rewardGemCount: 60,
  rewardGemMinDistance: 72,
  rewardGemDistanceStep: 46,
  rewardGemDistanceBands: 12,
  rewardGemWaveCount: 3,
  rewardGemWaveDelayProgress: 0.15,
  rewardGemFlightMinProgress: 0.54,
  rewardGemFlightStepProgress: 0.02,
  rewardRayCount: 18,
  rewardRayMinLength: 380,
  rewardRayLengthStep: 44,
  rewardRayLengthBands: 6,
  dirtChunksPerImpact: 18,
  dirtDustPuffsPerImpact: 8,
  explosionFrameCount: 29,
  explosionFps: 24,
  explosionBurstFrame: 10,
  explosionScale: 1.48,
} as const;

export const CLASSIC_TREASURE_GEM_COLORS = [
  '#24D8FF',
  '#FF4FCB',
  '#FFD84A',
  '#62F08A',
  '#9D68FF',
  '#FF6A45',
] as const;

export function classicTreasureExplosionFrame(elapsedMs: number): number {
  const frameMs = 1000 / CLASSIC_TREASURE_FEEDBACK.explosionFps;
  return Math.min(
    CLASSIC_TREASURE_FEEDBACK.explosionFrameCount - 1,
    Math.max(0, Math.floor(elapsedMs / frameMs)),
  );
}

export function classicTreasureExplosionDurationMs(): number {
  return (
    CLASSIC_TREASURE_FEEDBACK.explosionFrameCount
    * 1000
    / CLASSIC_TREASURE_FEEDBACK.explosionFps
  );
}
