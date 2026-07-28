import { PoseInputMapper } from '../assets/scripts/platform/pose/PoseInputMapper';

describe('PoseInputMapper', () => {
  it('matches reference EMA smoothing, hysteresis and movement debounce', () => {
    const mapper = new PoseInputMapper({ moveDebounceMs: 100, smoothingAlpha: 1 });
    expect(mapper.push({ x: 0.32, y: 0.5, score: 0.9 }, 0).column).toBeUndefined();
    expect(mapper.push({ x: 0.32, y: 0.5, score: 0.9 }, 120).column).toBe(0);
    expect(mapper.push({ x: 0.47, y: 0.5, score: 0.9 }, 140).column).toBeUndefined();
    expect(mapper.push({ x: 0.47, y: 0.5, score: 0.9 }, 260).column).toBe(1);
    expect(mapper.push({ x: 0.7, y: 0.5, score: 0.9 }, 280).column).toBeUndefined();
    expect(mapper.push({ x: 0.7, y: 0.5, score: 0.9 }, 400).column).toBe(2);
  });

  it('polls the latest pose every render frame like the reference Cocos update loop', () => {
    const mapper = new PoseInputMapper({ moveDebounceMs: 150, smoothingAlpha: 1 });
    expect(mapper.ingest({ x: 0.32, y: 0.5, score: 0.9 }, 0)).toBe(true);
    expect(mapper.poll(0).column).toBeUndefined();
    expect(mapper.poll(149).column).toBeUndefined();
    expect(mapper.poll(150).column).toBe(0);
  });

  it('amplifies or dampens horizontal movement using configured sensitivity', () => {
    const sensitive = new PoseInputMapper({
      movementSensitivity: 2,
      moveDebounceMs: 100,
      smoothingAlpha: 1,
    });
    expect(sensitive.push({ x: 0.56, y: 0.5, score: 0.9 }, 0).column).toBeUndefined();
    expect(sensitive.push({ x: 0.56, y: 0.5, score: 0.9 }, 120).column).toBe(2);

    const gentle = new PoseInputMapper({
      movementSensitivity: 0.5,
      moveDebounceMs: 100,
      smoothingAlpha: 1,
    });
    gentle.push({ x: 0.68, y: 0.5, score: 0.9 }, 0);
    expect(gentle.push({ x: 0.68, y: 0.5, score: 0.9 }, 120).column).toBeUndefined();
    expect(gentle.currentColumn()).toBe(1);
  });

  it('uses the reference drifting baseline and jump cooldown without rearming', () => {
    const mapper = new PoseInputMapper({
      jumpCooldownMs: 500,
      jumpThreshold: 0.045,
      smoothingAlpha: 0.35,
    });
    mapper.push({ x: 0.5, y: 0.5, score: 0.9 }, 0);
    expect(mapper.push({ x: 0.5, y: 0.35, score: 0.9 }, 100).jump).toBe(true);
    expect(mapper.push({ x: 0.5, y: 0.35, score: 0.9 }, 300).jump).toBeUndefined();
    expect(mapper.push({ x: 0.5, y: 0.35, score: 0.9 }, 601).jump).toBe(true);
  });

  it('retains EMA state across valid samples instead of settling every question', () => {
    const mapper = new PoseInputMapper({ smoothingAlpha: 0.35 });
    mapper.push({ x: 0.5, y: 0.5, score: 0.9 }, 0);
    expect(mapper.push({ x: 0.5, y: 0.35, score: 0.9 }, 100).jump).toBe(true);
  });

  it('does not consume jump cooldown while answer input is disabled', () => {
    const mapper = new PoseInputMapper({
      jumpCooldownMs: 700,
      jumpThreshold: 0.045,
      smoothingAlpha: 0.35,
    });
    mapper.push({ x: 0.5, y: 0.5, score: 0.9 }, 0);
    expect(mapper.push({ x: 0.5, y: 0.35, score: 0.9 }, 100, false).jump)
      .toBeUndefined();
    expect(mapper.push({ x: 0.5, y: 0.35, score: 0.9 }, 120, true).jump).toBe(true);
  });

  it('restarts movement debounce from the current lane after input is suspended', () => {
    const mapper = new PoseInputMapper({ moveDebounceMs: 150, smoothingAlpha: 1 });
    mapper.push({ x: 0.72, y: 0.5, score: 0.9 }, 0);
    mapper.suspendActions(100);
    expect(mapper.push({ x: 0.72, y: 0.5, score: 0.9 }, 200).column).toBeUndefined();
    expect(mapper.push({ x: 0.72, y: 0.5, score: 0.9 }, 360).column).toBe(2);
  });

  it('settles the pose baseline before accepting a jump on a new question', () => {
    const mapper = new PoseInputMapper({
      jumpThreshold: 0.045,
      smoothingAlpha: 1,
    });
    mapper.push({ x: 0.5, y: 0.5, score: 0.9 }, 0);
    mapper.suspendActions(100);
    mapper.resumeActions(100, 600);

    expect(mapper.push({ x: 0.5, y: 0.35, score: 0.9 }, 699).jump).toBeUndefined();
    expect(mapper.poll(700).jump).toBe(true);
  });

  it('marks tracking lost only after the configured timeout', () => {
    const mapper = new PoseInputMapper({ trackingLostMs: 800 });
    expect(mapper.push({ x: 0.5, y: 0.5, score: 0.9 }, 100).tracking).toBe(true);
    expect(mapper.push({ x: 0, y: 0, score: 0 }, 700).tracking).toBe(true);
    expect(mapper.push({ x: 0, y: 0, score: 0 }, 901).tracking).toBe(false);
  });
});
