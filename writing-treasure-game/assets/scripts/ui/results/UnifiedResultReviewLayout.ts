import { Vec3 } from 'cc';
import type { SettlementBox } from '../../shared/config/WritingSettlementLayout';
import type { DomReviewBox } from './DomResultReview';

export const unifiedReviewRows = [9, -47, -103, -159, -215] as const;

export function unifiedReviewPanelBox(index: number): {
  readonly width: number;
  readonly height: number;
  readonly position: Vec3;
} {
  return {
    width: 409,
    height: 46,
    position: new Vec3(415.5, unifiedReviewRows[index]),
  };
}

export function unifiedReviewTextBox(index: number): DomReviewBox {
  return {
    width: 351,
    height: 46,
    position: { x: 386.5, y: unifiedReviewRows[index] },
  };
}

export function unifiedReviewIconBox(index: number): SettlementBox {
  return {
    size: [34, 34],
    position: new Vec3(591, unifiedReviewRows[index]),
  };
}
