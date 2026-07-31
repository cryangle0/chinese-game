export interface PoseMotionSample {
  x: number;
  y: number;
  score: number;
  bodyScale: number;
  bodyScaleScore: number;
}

export type PoseInteractionStatus =
  | 'searching'
  | 'too-close'
  | 'too-far'
  | 'off-center'
  | 'stabilizing'
  | 'ready';

export interface PoseMotionResult {
  tracking: boolean;
  interactionReady: boolean;
  interactionStatus: PoseInteractionStatus;
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
  minimumBodyScale?: number;
  maximumBodyScale?: number;
  interactionStableMs?: number;
  interactionCenterTolerance?: number;
  interactionScaleTolerance?: number;
  interactionPositionTolerance?: number;
}
