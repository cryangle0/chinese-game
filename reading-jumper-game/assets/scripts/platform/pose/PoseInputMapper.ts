import {
  PoseInputMapperOptions, PoseMotionResult, PoseMotionSample,
} from './PoseInputTypes';

export class PoseInputMapper {
  private readonly minScore: number;
  private readonly movementSensitivity: number;
  private readonly enterThreshold: number;
  private readonly returnThreshold: number;
  private readonly moveDebounceMs: number;
  private readonly smoothingAlpha: number;
  private readonly jumpThreshold: number;
  private readonly jumpCooldownMs: number;
  private readonly trackingLostMs: number;
  private column: 0 | 1 | 2 = 1;
  private candidate: 0 | 1 | 2 = 1;
  private candidateSince = 0;
  private smoothedX: number | null = null;
  private smoothedY: number | null = null;
  private baselineY = 0.5;
  private rise = 0;
  private lastJumpAt = Number.NEGATIVE_INFINITY;
  private lastValidAt = 0;
  private tracking = false;
  private actionsReadyAt = 0;

  constructor(options: PoseInputMapperOptions = {}) {
    this.minScore = options.minScore ?? 0.3;
    const sensitivity = options.movementSensitivity ?? 1;
    this.movementSensitivity = Number.isFinite(sensitivity)
      ? Math.min(2, Math.max(0.5, sensitivity)) : 1;
    this.enterThreshold = options.enterThreshold ?? 0.1;
    this.returnThreshold = options.returnThreshold ?? 0.04;
    this.moveDebounceMs = options.moveDebounceMs ?? 150;
    this.smoothingAlpha = options.smoothingAlpha ?? 0.35;
    this.jumpThreshold = options.jumpThreshold ?? 0.045;
    this.jumpCooldownMs = options.jumpCooldownMs ?? 700;
    this.trackingLostMs = options.trackingLostMs ?? 900;
  }

  push(
    sample: PoseMotionSample,
    now = Date.now(),
    actionsEnabled = true,
  ): PoseMotionResult {
    const tracking = this.ingest(sample, now);
    if (!tracking) return { tracking: false };
    return this.poll(now, actionsEnabled);
  }

  ingest(sample: PoseMotionSample, now = Date.now()): boolean {
    if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y)
      || sample.score < this.minScore) {
      return this.consumeInvalid(now).tracking;
    }
    this.lastValidAt = now;
    this.tracking = true;
    const smoothed = this.smooth(sample);
    this.updateBaseline(smoothed.y);
    this.rise = this.baselineY - smoothed.y;
    return true;
  }

  poll(now = Date.now(), actionsEnabled = true): PoseMotionResult {
    const result: PoseMotionResult = { tracking: this.tracking };
    if (!this.tracking || this.smoothedX === null) return result;
    if (!actionsEnabled) {
      return result;
    }
    if (now < this.actionsReadyAt) return result;
    const column = this.updateColumn(this.smoothedX, now);
    if (column !== undefined) result.column = column;
    if (this.updateJump(now)) result.jump = true;
    return result;
  }

  currentColumn(): 0 | 1 | 2 {
    return this.column;
  }

  suspendActions(now = Date.now()): void {
    this.candidate = this.column;
    this.candidateSince = now;
  }

  resumeActions(now = Date.now(), graceMs = 0): void {
    this.actionsReadyAt = now + Math.max(0, graceMs);
  }

  reset(): void {
    this.column = 1;
    this.candidate = 1;
    this.candidateSince = 0;
    this.smoothedX = null;
    this.smoothedY = null;
    this.baselineY = 0.5;
    this.rise = 0;
    this.lastJumpAt = Number.NEGATIVE_INFINITY;
    this.lastValidAt = 0;
    this.tracking = false;
    this.actionsReadyAt = 0;
  }

  private consumeInvalid(now: number): PoseMotionResult {
    if (this.tracking && now - this.lastValidAt >= this.trackingLostMs) {
      this.tracking = false;
      this.smoothedX = null;
      this.smoothedY = null;
      this.baselineY = 0.5;
      this.rise = 0;
    }
    return { tracking: this.tracking };
  }

  private smooth(sample: PoseMotionSample): { x: number; y: number } {
    const alpha = Math.min(1, Math.max(0, this.smoothingAlpha));
    this.smoothedX = this.smoothedX === null
      ? sample.x
      : this.smoothedX * (1 - alpha) + sample.x * alpha;
    this.smoothedY = this.smoothedY === null
      ? sample.y
      : this.smoothedY * (1 - alpha) + sample.y * alpha;
    return { x: this.smoothedX, y: this.smoothedY };
  }

  private updateColumn(x: number, now: number): 0 | 1 | 2 | undefined {
    const next = this.classify(x);
    if (next !== this.candidate) {
      this.candidate = next;
      this.candidateSince = now;
    } else if (next !== this.column && now - this.candidateSince >= this.moveDebounceMs) {
      this.column = next;
      return next;
    }
    return undefined;
  }

  private updateJump(now: number): boolean {
    if (this.rise > this.jumpThreshold && now - this.lastJumpAt >= this.jumpCooldownMs) {
      this.lastJumpAt = now;
      return true;
    }
    return false;
  }

  private updateBaseline(y: number): void {
    this.baselineY = this.baselineY * 0.97 + y * 0.03;
  }

  private classify(x: number): 0 | 1 | 2 {
    const offset = (x - 0.5) * this.movementSensitivity;
    if (this.candidate === 0) {
      if (offset < -this.returnThreshold) return 0;
      return offset > this.enterThreshold ? 2 : 1;
    }
    if (this.candidate === 2) {
      if (offset > this.returnThreshold) return 2;
      return offset < -this.enterThreshold ? 0 : 1;
    }
    if (offset < -this.enterThreshold) return 0;
    if (offset > this.enterThreshold) return 2;
    return 1;
  }
}
