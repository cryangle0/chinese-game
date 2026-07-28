import { SETTLEMENT_HOME_CHIP } from '../assets/scripts/shared/config/SettlementHomeChipLayout';

describe('SettlementHomeChip', () => {
  it('places a compact top-right chip away from bottom CTAs', () => {
    expect(SETTLEMENT_HOME_CHIP.label).toBe('返回首页');
    expect(SETTLEMENT_HOME_CHIP.width).toBeLessThan(220);
    expect(SETTLEMENT_HOME_CHIP.x).toBeGreaterThan(400);
    expect(SETTLEMENT_HOME_CHIP.y).toBeGreaterThan(250);
  });
});
