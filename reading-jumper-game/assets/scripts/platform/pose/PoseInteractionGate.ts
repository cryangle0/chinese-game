import type {
  PoseInputMapperOptions,
  PoseInteractionStatus,
  PoseMotionSample,
} from './PoseInputTypes';
import type { SmoothedPoseSample } from './PoseSampleSmoother';

export interface PoseInteractionGateResult {
  ready: boolean;
  status: PoseInteractionStatus;
  armed: boolean;
}

export class PoseInteractionGate {
  private readonly minimumBodyScale: number;
  private readonly maximumBodyScale: number;
  private readonly stableMs: number;
  private readonly centerTolerance: number;
  private readonly scaleTolerance: number;
  private readonly positionTolerance: number;
  private ready = false;
  private statusValue: PoseInteractionStatus = 'searching';
  private candidateSince: number | null = null;
  private anchorX = 0.5;
  private anchorY = 0.5;
  private anchorScale = 0;

  constructor(
    options: PoseInputMapperOptions,
    private readonly minScore: number,
  ) {
    this.minimumBodyScale = options.minimumBodyScale ?? 0.16;
    this.maximumBodyScale = options.maximumBodyScale ?? 0.38;
    this.stableMs = options.interactionStableMs ?? 700;
    this.centerTolerance = options.interactionCenterTolerance ?? 0.22;
    this.scaleTolerance = options.interactionScaleTolerance ?? 0.025;
    this.positionTolerance = options.interactionPositionTolerance ?? 0.055;
  }

  update(
    sample: PoseMotionSample,
    smoothed: SmoothedPoseSample,
    now: number,
  ): PoseInteractionGateResult {
    const invalidStatus = this.invalidStatus(sample, smoothed);
    if (invalidStatus) {
      this.disarm(invalidStatus);
      return this.result(false);
    }
    if (this.ready) {
      this.statusValue = 'ready';
      return this.result(false);
    }
    if (this.isUnstable(smoothed)) this.beginCandidate(smoothed, now);
    this.statusValue = 'stabilizing';
    if (now - (this.candidateSince ?? now) < this.stableMs) return this.result(false);
    this.ready = true;
    this.statusValue = 'ready';
    return this.result(true);
  }

  disarm(status: PoseInteractionStatus): void {
    this.ready = false;
    this.statusValue = status;
    this.candidateSince = null;
  }

  reset(): void {
    this.disarm('searching');
    this.anchorX = 0.5;
    this.anchorY = 0.5;
    this.anchorScale = 0;
  }

  isReady(): boolean {
    return this.ready;
  }

  status(): PoseInteractionStatus {
    return this.statusValue;
  }

  private invalidStatus(
    sample: PoseMotionSample,
    smoothed: SmoothedPoseSample,
  ): PoseInteractionStatus | null {
    if (!Number.isFinite(sample.bodyScale)
      || sample.bodyScaleScore < this.minScore
      || smoothed.bodyScale <= 0) return 'searching';
    if (smoothed.bodyScale > this.maximumBodyScale) return 'too-close';
    if (smoothed.bodyScale < this.minimumBodyScale) return 'too-far';
    if (Math.abs(smoothed.x - 0.5) > this.centerTolerance) return 'off-center';
    return null;
  }

  private isUnstable(smoothed: SmoothedPoseSample): boolean {
    if (this.candidateSince === null) return true;
    return Math.abs(smoothed.bodyScale - this.anchorScale) > this.scaleTolerance
      || Math.abs(smoothed.x - this.anchorX) > this.positionTolerance
      || Math.abs(smoothed.y - this.anchorY) > this.positionTolerance;
  }

  private beginCandidate(smoothed: SmoothedPoseSample, now: number): void {
    this.candidateSince = now;
    this.anchorX = smoothed.x;
    this.anchorY = smoothed.y;
    this.anchorScale = smoothed.bodyScale;
  }

  private result(armed: boolean): PoseInteractionGateResult {
    return { ready: this.ready, status: this.statusValue, armed };
  }
}
