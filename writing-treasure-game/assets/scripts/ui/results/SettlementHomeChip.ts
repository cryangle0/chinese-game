import { Node, Vec3 } from 'cc';
import { createGameActionButton } from '../../core/ui/UiFactory';
import { SETTLEMENT_HOME_CHIP } from '../../shared/config/SettlementHomeChipLayout';
import { createResultActionGate } from './ResultActionGate';

export { SETTLEMENT_HOME_CHIP } from '../../shared/config/SettlementHomeChipLayout';

/**
 * Compact candy-chip "返回首页" for stage settlement only.
 * Final campaign result keeps the bottom-row home CTA.
 */
export function addSettlementHomeChip(parent: Node, onReturnHome: () => void): Node {
  const activate = createResultActionGate(onReturnHome);
  const node = createGameActionButton(
    parent,
    SETTLEMENT_HOME_CHIP.label,
    SETTLEMENT_HOME_CHIP.width,
    activate,
    { rim: '#1A4F8A', fill: '#5AA8F0', gloss: 0.12, text: '#123A66' },
  );
  node.name = 'SettlementHomeChip';
  const syncPosition = (): void => {
    const sx = typeof document === 'undefined'
      ? 1
      : Number(document.body.dataset.resultPositionScaleX) || 1;
    node.setPosition(new Vec3(SETTLEMENT_HOME_CHIP.x * sx, SETTLEMENT_HOME_CHIP.y, 0));
  };
  syncPosition();
  node.setScale(SETTLEMENT_HOME_CHIP.scale, SETTLEMENT_HOME_CHIP.scale, 1);
  if (typeof window !== 'undefined') window.addEventListener('resize', syncPosition);
  if (typeof document !== 'undefined') {
    document.body.dataset.stageHomeChip = '1';
    parent.once(Node.EventType.NODE_DESTROYED, () => {
      window.removeEventListener('resize', syncPosition);
      delete document.body.dataset.stageHomeChip;
    });
  }
  return node;
}
