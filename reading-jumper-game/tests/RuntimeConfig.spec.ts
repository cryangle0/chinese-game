import { parseRuntimeConfig } from '../assets/scripts/shared/config/RuntimeConfig';

describe('RuntimeConfig', () => {
  it('uses a neutral default when movement sensitivity is absent or invalid', () => {
    expect(parseRuntimeConfig(null).pose.movementSensitivity).toBe(1);
    expect(parseRuntimeConfig({ pose: { movementSensitivity: 'fast' } })
      .pose.movementSensitivity).toBe(1);
  });

  it('clamps movement sensitivity to the supported range', () => {
    expect(parseRuntimeConfig({ pose: { movementSensitivity: 0.1 } })
      .pose.movementSensitivity).toBe(0.5);
    expect(parseRuntimeConfig({ pose: { movementSensitivity: 1.4 } })
      .pose.movementSensitivity).toBe(1.4);
    expect(parseRuntimeConfig({ pose: { movementSensitivity: 5 } })
      .pose.movementSensitivity).toBe(2);
  });
});
