import { PoseInteractionGate } from './PoseInteractionGate';
import { PoseSampleSmoother } from './PoseSampleSmoother';
import type {
  PoseInputMapperOptions,
  PoseInteractionStatus,
  PoseMotionResult,
  PoseMotionSample,
} from './PoseInputTypes';
import type { SmoothedPoseSample } from './PoseSampleSmoother';

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
  private readonly smoother = new PoseSampleSmoother();
  private readonly interactionGate: PoseInteractionGate;
  private column: 0 | 1 | 2 = 1;
  private candidate: 0 | 1 | 2 = 1;
  private candidateSince = 0;
  private baselineY = 0.5;
  private rise = 0;
  private lastJumpAt = Number.NEGATIVE_INFINITY;
  private lastValidAt = 0;
  private tracking = false;
  private actionsReadyAt = 0;
  private neutralX = 0.5;

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
    this.interactionGate = new PoseInteractionGate(options, this.minScore);
  }

  push(sample: PoseMotionSample, now = Date.now(), actionsEnabled = true): PoseMotionResult {
    if (!this.ingest(sample, now)) return this.result(false);
    return this.poll(now, actionsEnabled);
  }

  ingest(sample: PoseMotionSample, now = Date.now()): boolean {
    if (!Number.isFinite(sample.x) || !Number.isFinite(sample.y)
      || sample.score < this.minScore) return this.consumeInvalid(now);
    this.lastValidAt = now;
    this.tracking = true;
    const smoothed = this.smoother.push(sample, this.smoothingAlpha);
    const interaction = this.interactionGate.update(sample, smoothed, now);
    if (interaction.armed) this.armInteraction(smoothed, now);
    if (interaction.ready) {
      this.updateBaseline(smoothed.y);
      this.rise = this.baselineY - smoothed.y;
    } else {
      this.rise = 0;
    }
    return true;
  }

  poll(now = Date.now(), actionsEnabled = true): PoseMotionResult {
    const result = this.result(this.tracking);
    const x = this.smoother.currentX();
    if (!this.tracking || x === null || !actionsEnabled
      || !this.interactionGate.isReady() || now < this.actionsReadyAt) return result;
    const column = this.updateColumn(x, now);
    if (column !== undefined) result.column = column;
    if (this.updateJump(now)) result.jump = true;
    return result;
  }

  currentColumn(): 0 | 1 | 2 { return this.column; }
  isInteractionReady(): boolean { return this.interactionGate.isReady(); }
  interactionStatus(): PoseInteractionStatus { return this.interactionGate.status(); }
  currentBodyScale(): number | null { return this.smoother.currentBodyScale(); }

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
    this.smoother.reset();
    this.baselineY = 0.5;
    this.rise = 0;
    this.lastJumpAt = Number.NEGATIVE_INFINITY;
    this.lastValidAt = 0;
    this.tracking = false;
    this.actionsReadyAt = 0;
    this.neutralX = 0.5;
    this.interactionGate.reset();
  }

  private consumeInvalid(now: number): boolean {
    this.interactionGate.disarm('searching');
    this.rise = 0;
    if (this.tracking && now - this.lastValidAt >= this.trackingLostMs) {
      this.tracking = false;
      this.smoother.reset();
      this.baselineY = 0.5;
    }
    return this.tracking;
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
    if (this.rise <= this.jumpThreshold
      || now - this.lastJumpAt < this.jumpCooldownMs) return false;
    this.lastJumpAt = now;
    return true;
  }

  private updateBaseline(y: number): void {
    this.baselineY = this.baselineY * 0.97 + y * 0.03;
  }

  private classify(x: number): 0 | 1 | 2 {
    const offset = (x - this.neutralX) * this.movementSensitivity;
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

  private armInteraction(smoothed: SmoothedPoseSample, now: number): void {
    this.neutralX = smoothed.x;
    this.column = 1;
    this.candidate = 1;
    this.candidateSince = now;
    this.baselineY = smoothed.y;
    this.rise = 0;
    this.lastJumpAt = Number.NEGATIVE_INFINITY;
  }

  private result(tracking: boolean): PoseMotionResult {
    return {
      tracking,
      interactionReady: this.interactionGate.isReady(),
      interactionStatus: this.interactionGate.status(),
    };
  }
}
