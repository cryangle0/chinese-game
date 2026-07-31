import { parseRuntimeConfig } from '../assets/scripts/shared/config/RuntimeConfig';

describe('RuntimeConfig', () => {
  it('uses the responsive production defaults when movement settings are absent or invalid', () => {
    expect(parseRuntimeConfig(null).pose).toMatchObject({
      movementSensitivity: 1.15,
      moveDebounceMs: 100,
    });
    expect(parseRuntimeConfig({ pose: { movementSensitivity: 'fast' } })
      .pose.movementSensitivity).toBe(1.15);
  });

  it('clamps movement sensitivity to the supported range', () => {
    expect(parseRuntimeConfig({ pose: { movementSensitivity: 0.1 } })
      .pose.movementSensitivity).toBe(0.5);
    expect(parseRuntimeConfig({ pose: { movementSensitivity: 1.4 } })
      .pose.movementSensitivity).toBe(1.4);
    expect(parseRuntimeConfig({ pose: { movementSensitivity: 5 } })
      .pose.movementSensitivity).toBe(2);
  });

  it('provides and clamps the interaction-position gate settings', () => {
    const defaults = parseRuntimeConfig(null).pose;
    expect(defaults).toMatchObject({
      minimumBodyScale: 0.16,
      maximumBodyScale: 0.38,
      interactionStableMs: 700,
      interactionCenterTolerance: 0.22,
      interactionScaleTolerance: 0.025,
      interactionPositionTolerance: 0.055,
    });

    const clamped = parseRuntimeConfig({
      pose: {
        minimumBodyScale: 0.01,
        maximumBodyScale: 1,
        interactionStableMs: 20,
        interactionCenterTolerance: 1,
        interactionScaleTolerance: 0,
        interactionPositionTolerance: 1,
      },
    }).pose;
    expect(clamped).toMatchObject({
      minimumBodyScale: 0.08,
      maximumBodyScale: 0.65,
      interactionStableMs: 200,
      interactionCenterTolerance: 0.35,
      interactionScaleTolerance: 0.01,
      interactionPositionTolerance: 0.12,
    });
  });
});
