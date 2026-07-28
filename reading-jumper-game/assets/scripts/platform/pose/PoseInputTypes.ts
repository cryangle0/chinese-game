export interface PoseMotionSample {
  x: number;
  y: number;
  score: number;
}

export interface PoseMotionResult {
  tracking: boolean;
  column?: 0 | 1 | 2;
  jump?: boolean;
}

export interface PoseInputMapperOptions {
  minScore?: number;
  movementSensitivity?: number;
  enterThreshold?: number;
  returnThreshold?: number;
  moveDebounceMs?: number;
  smoothingAlpha?: number;
  jumpThreshold?: number;
  jumpCooldownMs?: number;
  trackingLostMs?: number;
}
