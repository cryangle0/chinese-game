import { Vec3 } from 'cc';

export interface SettlementBox {
  readonly size: readonly [number, number];
  readonly position: Vec3;
}

export interface SettlementLayout {
  readonly character: SettlementBox;
  readonly rankTitle: SettlementBox;
  readonly rankBase: SettlementBox;
  readonly rankRows: readonly [SettlementBox, SettlementBox, SettlementBox];
  readonly rankText: readonly [
    { name: SettlementBox; score: SettlementBox },
    { name: SettlementBox; score: SettlementBox },
    { name: SettlementBox; score: SettlementBox },
  ];
  readonly reviewTitle: SettlementBox;
  readonly achievement: SettlementBox;
  readonly reviewRows: readonly SettlementBox[];
  readonly reviewText: readonly SettlementBox[];
  readonly reviewIcon: readonly SettlementBox[];
  readonly score: SettlementBox;
  readonly stars: Readonly<{
    left: number;
    top: number;
    width: number;
    height: number;
    gap: number;
  }>;
  readonly useReviewPanel: boolean;
  readonly scoreAsSummary: boolean;
  /** Raise pinned result character (Cocos +Y) so feet/cloak clear the score plate. */
  readonly characterSoleLift?: number;
}
