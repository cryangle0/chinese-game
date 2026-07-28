import { SETTLEMENT_HOME_CHIP } from '../assets/scripts/shared/config/SettlementHomeChipLayout';

describe('SettlementHomeChip', () => {
  it('places a compact top-right chip away from bottom CTAs', () => {
    expect(SETTLEMENT_HOME_CHIP.label).toBe('返回首页');
    expect(SETTLEMENT_HOME_CHIP.width).toBeLessThan(220);
    expect(SETTLEMENT_HOME_CHIP.x).toBeGreaterThan(300);
    expect(SETTLEMENT_HOME_CHIP.y).toBeGreaterThan(250);
  });

  it('keeps the mini-program system capsule clear', () => {
    const viewport = { width: 915, height: 412 };
    const stageScale = Math.min(viewport.width / 1440, viewport.height / 810);
    const offsetX = (viewport.width - 1440 * stageScale) / 2;
    const stretchX = viewport.width / (1440 * stageScale);
    const centerX = offsetX + (720 + SETTLEMENT_HOME_CHIP.x * stretchX) * stageScale;
    const right = centerX
      + SETTLEMENT_HOME_CHIP.width * SETTLEMENT_HOME_CHIP.scale * stageScale / 2;
    expect(right).toBeLessThan(750);
  });
});
