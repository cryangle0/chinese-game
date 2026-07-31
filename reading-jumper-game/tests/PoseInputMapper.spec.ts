import { PoseInputMapper } from '../assets/scripts/platform/pose/PoseInputMapper';
import type { PoseMotionSample } from '../assets/scripts/platform/pose/PoseInputTypes';

function sample(
  x = 0.5,
  y = 0.5,
  bodyScale = 0.25,
  score = 0.9,
): PoseMotionSample {
  return {
    x,
    y,
    score,
    bodyScale,
    bodyScaleScore: score,
  };
}

function immediateMapper(
  options: ConstructorParameters<typeof PoseInputMapper>[0] = {},
): PoseInputMapper {
  return new PoseInputMapper({ interactionStableMs: 0, ...options });
}

describe('PoseInputMapper', () => {
  it('calibrates the stable interaction position before applying lane hysteresis', () => {
    const mapper = immediateMapper({ moveDebounceMs: 100, smoothingAlpha: 1 });
    expect(mapper.push(sample(), 0).interactionReady).toBe(true);
    expect(mapper.push(sample(0.32), 10).column).toBeUndefined();
    expect(mapper.push(sample(0.32), 120).column).toBe(0);
    expect(mapper.push(sample(0.47), 140).column).toBeUndefined();
    expect(mapper.push(sample(0.47), 250).column).toBe(1);
    expect(mapper.push(sample(0.7), 270).column).toBeUndefined();
    expect(mapper.push(sample(0.7), 380).column).toBe(2);
  });

  it('polls the latest stable pose every render frame', () => {
    const mapper = immediateMapper({ moveDebounceMs: 150, smoothingAlpha: 1 });
    mapper.ingest(sample(), 0);
    expect(mapper.ingest(sample(0.32), 10)).toBe(true);
    expect(mapper.poll(10).column).toBeUndefined();
    expect(mapper.poll(159).column).toBeUndefined();
    expect(mapper.poll(160).column).toBe(0);
  });

  it('amplifies or dampens horizontal movement using configured sensitivity', () => {
    const sensitive = immediateMapper({
      movementSensitivity: 2,
      moveDebounceMs: 100,
      smoothingAlpha: 1,
    });
    sensitive.push(sample(), 0);
    expect(sensitive.push(sample(0.56), 10).column).toBeUndefined();
    expect(sensitive.push(sample(0.56), 120).column).toBe(2);

    const gentle = immediateMapper({
      movementSensitivity: 0.5,
      moveDebounceMs: 100,
      smoothingAlpha: 1,
    });
    gentle.push(sample(), 0);
    gentle.push(sample(0.68), 10);
    expect(gentle.push(sample(0.68), 120).column).toBeUndefined();
    expect(gentle.currentColumn()).toBe(1);
  });

  it('keeps jump sensitivity and cooldown after interaction is armed', () => {
    const mapper = immediateMapper({
      jumpCooldownMs: 500,
      jumpThreshold: 0.045,
      smoothingAlpha: 0.35,
    });
    mapper.push(sample(), 0);
    expect(mapper.push(sample(0.5, 0.35), 100).jump).toBe(true);
    expect(mapper.push(sample(0.5, 0.35), 300).jump).toBeUndefined();
    expect(mapper.push(sample(0.5, 0.35), 601).jump).toBe(true);
  });

  it('does not consume jump cooldown while answer input is disabled', () => {
    const mapper = immediateMapper({
      jumpCooldownMs: 700,
      jumpThreshold: 0.045,
      smoothingAlpha: 0.35,
    });
    mapper.push(sample(), 0);
    expect(mapper.push(sample(0.5, 0.35), 100, false).jump).toBeUndefined();
    expect(mapper.push(sample(0.5, 0.35), 120, true).jump).toBe(true);
  });

  it('restarts movement debounce from the current lane after input is suspended', () => {
    const mapper = immediateMapper({ moveDebounceMs: 150, smoothingAlpha: 1 });
    mapper.push(sample(), 0);
    mapper.push(sample(0.72), 10);
    mapper.suspendActions(100);
    expect(mapper.push(sample(0.72), 200).column).toBeUndefined();
    expect(mapper.push(sample(0.72), 360).column).toBe(2);
  });

  it('settles the pose baseline before accepting a jump on a new question', () => {
    const mapper = immediateMapper({
      jumpThreshold: 0.045,
      smoothingAlpha: 1,
    });
    mapper.push(sample(), 0);
    mapper.suspendActions(100);
    mapper.resumeActions(100, 600);

    expect(mapper.push(sample(0.5, 0.35), 699).jump).toBeUndefined();
    expect(mapper.poll(700).jump).toBe(true);
  });

  it('tracks a close seated player but blocks standing and backing transitions', () => {
    const mapper = new PoseInputMapper({
      smoothingAlpha: 1,
      interactionStableMs: 700,
      interactionScaleTolerance: 0.02,
      interactionPositionTolerance: 0.04,
    });

    expect(mapper.push(sample(0.5, 0.68, 0.5), 0)).toMatchObject({
      tracking: true,
      interactionReady: false,
      interactionStatus: 'too-close',
    });
    expect(mapper.push(sample(0.56, 0.62, 0.35), 100).jump).toBeUndefined();
    expect(mapper.push(sample(0.54, 0.56, 0.31), 300).column).toBeUndefined();
    expect(mapper.push(sample(0.5, 0.5, 0.25), 500)).toMatchObject({
      interactionReady: false,
      interactionStatus: 'stabilizing',
    });
    expect(mapper.push(sample(0.5, 0.5, 0.25), 1199).interactionReady).toBe(false);
    expect(mapper.push(sample(0.5, 0.5, 0.25), 1200)).toMatchObject({
      interactionReady: true,
      interactionStatus: 'ready',
    });
  });

  it('allows both lateral movement and a real jump after stable positioning', () => {
    const mapper = new PoseInputMapper({
      smoothingAlpha: 1,
      moveDebounceMs: 150,
      interactionStableMs: 700,
    });
    mapper.push(sample(), 0);
    expect(mapper.push(sample(), 700).interactionReady).toBe(true);

    expect(mapper.push(sample(0.34), 710).column).toBeUndefined();
    expect(mapper.poll(860).column).toBe(0);
    expect(mapper.push(sample(0.34, 0.35), 900).jump).toBe(true);
  });

  it('disarms both actions outside the interaction distance and resets the jump baseline', () => {
    const mapper = new PoseInputMapper({
      smoothingAlpha: 1,
      interactionStableMs: 700,
    });
    mapper.push(sample(), 0);
    mapper.push(sample(), 700);
    expect(mapper.push(sample(0.32, 0.35, 0.1), 800)).toMatchObject({
      interactionReady: false,
      interactionStatus: 'too-far',
    });

    mapper.push(sample(0.5, 0.42), 900);
    expect(mapper.push(sample(0.5, 0.42), 1600)).toMatchObject({
      interactionReady: true,
    });
    expect(mapper.push(sample(0.5, 0.3), 1700).jump).toBe(true);
  });

  it('marks tracking lost only after the configured timeout', () => {
    const mapper = immediateMapper({ trackingLostMs: 800 });
    expect(mapper.push(sample(), 100).tracking).toBe(true);
    expect(mapper.push(sample(0, 0, 0, 0), 700).tracking).toBe(true);
    expect(mapper.push(sample(0, 0, 0, 0), 901).tracking).toBe(false);
  });
});
