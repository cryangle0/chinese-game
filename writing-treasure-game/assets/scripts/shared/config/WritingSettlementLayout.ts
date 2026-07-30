import { Vec3 } from 'cc';
import { box } from './WritingPlayLayout';
import {
  DUNHUANG_REVIEW_SHIFT_X,
  MAGIC_SCORE_SHIFT_Y,
  TREASURE_RANK_SCORE_WIDTH,
  TREASURE_RANK_TEXT_ROW_OFFSET_Y,
  WRITING_RANK_TEXT_OFFSET_Y,
} from './WritingSettlementTuning';
import type { SettlementBox, SettlementLayout } from './WritingSettlementTypes';

export type { SettlementBox, SettlementLayout } from './WritingSettlementTypes';

function fromHtml(
  left: number, top: number, width: number, height: number,
): SettlementBox {
  return box(left, top, width, height);
}

function parseBox(csv: string): SettlementBox {
  const [left, top, width, height] = csv.split(',').map(Number);
  return fromHtml(left, top, width, height);
}

function reviews(
  rowLeft: number,
  rowTop: number,
  rowW: number,
  rowH: number,
  rowGap: number,
  textInset: number,
  iconLeft: number,
  iconTopOffset: number,
) {
  const reviewRows: SettlementBox[] = [];
  const reviewText: SettlementBox[] = [];
  const reviewIcon: SettlementBox[] = [];
  for (let index = 0; index < 5; index += 1) {
    const top = rowTop + index * rowGap;
    reviewRows.push(fromHtml(rowLeft, top, rowW, rowH));
    reviewText.push(fromHtml(rowLeft + textInset, top, rowW - textInset - 70, rowH));
    reviewIcon.push(fromHtml(iconLeft, top + iconTopOffset, 39, 39));
  }
  return { reviewRows, reviewText, reviewIcon };
}

function rankText(names: string[], scores: string[]): SettlementLayout['rankText'] {
  return [
    { name: parseBox(names[0]), score: parseBox(scores[0]) },
    { name: parseBox(names[1]), score: parseBox(scores[1]) },
    { name: parseBox(names[2]), score: parseBox(scores[2]) },
  ];
}

function scene(
  character: SettlementBox,
  rankTitle: SettlementBox,
  rankBase: SettlementBox,
  rankRows: SettlementLayout['rankRows'],
  names: string[],
  scores: string[],
  reviewTitle: SettlementBox,
  achievement: SettlementBox,
  reviewArgs: Parameters<typeof reviews>,
  score: SettlementBox,
  stars: SettlementLayout['stars'],
  flags: {
    useReviewPanel: boolean;
    scoreAsSummary: boolean;
    characterSoleLift?: number;
    rankTextOffsetY?: number;
    rankTextRowOffsetY?: readonly [number, number, number];
  },
): SettlementLayout {
  return {
    character,
    rankTitle,
    rankBase,
    rankRows,
    rankText: rankText(names, scores),
    reviewTitle,
    achievement,
    ...reviews(...reviewArgs),
    score,
    stars,
    ...flags,
  };
}

/** Pixel layouts from settlement HTML pages + measured foot/score nudges. */
export const WritingSettlementLayout: Readonly<Record<string, SettlementLayout>> = {
  // Applied from settlement-hotspots-treasure(1).json; rankBase hidden for treasure.
  treasure: scene(
    fromHtml(-80.52, -1, 494.88, 665),
    fromHtml(525, 138.25, 262.5, 78),
    fromHtml(478, 237.75, 337.5, 335.25),
    [
      fromHtml(490.25, 258.25, 314.25, 99.75),
      fromHtml(490.25, 381.5, 314.25, 80.25),
      fromHtml(489.25, 487, 314.25, 78),
    ],
    ['599,293.5,97.5,40.5', '599,399.5,97.5,40.5', '598,504.25,97.5,40.5'],
    [
      `697,293.5,${TREASURE_RANK_SCORE_WIDTH},40.5`,
      `697,399.5,${TREASURE_RANK_SCORE_WIDTH},40.5`,
      `696,504.25,${TREASURE_RANK_SCORE_WIDTH},40.5`,
    ],
    fromHtml(966.25, 142.25, 297, 72.75),
    fromHtml(999.75, 297.75, 230.25, 32.25),
    [858.6, 247.75, 502.5, 59.25, 78.5, 18, 1304, 10.125],
    fromHtml(111, 656.25, 236.25, 54.75),
    { left: 79.5, top: 712.5, width: 48, height: 46.5, gap: 9 },
    {
      useReviewPanel: false,
      scoreAsSummary: true,
      rankTextRowOffsetY: TREASURE_RANK_TEXT_ROW_OFFSET_Y,
    },
  ),
  // Applied from settlement-hotspots-desert(1).json; rankBase not drawn (all scenes).
  desert: scene(
    fromHtml(-85.97, 4, 580.47, 653),
    fromHtml(546, 204, 285.75, 73.5),
    fromHtml(516, 297, 351.75, 354.75),
    [
      fromHtml(528, 322.5, 314.25, 99.75),
      fromHtml(527, 427, 312.75, 80.25),
      fromHtml(528, 513, 309, 78),
    ],
    ['634.99,351.44,94.27,51.87', '637.46,447.26,93.83,41.73', '636.15,529.72,92.7,40.56'],
    ['743.69,351.44,78.56,51.87', '744.67,448.26,78.19,41.73', '744.12,530.72,77.25,40.56'],
    fromHtml(954, 204, 381.75, 75),
    fromHtml(1029.75, 282, 230.25, 32.25),
    [913, 298.5, 458.25, 60, 70.5, 18, 1324.5, 10.5],
    fromHtml(264, 658.5, 78, 51),
    { left: 118.5, top: 712.5, width: 47.25, height: 45, gap: 9.75 },
    { useReviewPanel: true, scoreAsSummary: true, characterSoleLift: 34 },
  ),
  // Applied from settlement-hotspots-dinosaur.json; rankBase not drawn.
  dinosaur: scene(
    fromHtml(-55.03, 40, 461.4, 620),
    fromHtml(544.5, 213, 245.25, 70.5),
    fromHtml(493.5, 295.5, 345.75, 372),
    [
      fromHtml(505.5, 310.5, 324.75, 114),
      fromHtml(505.5, 423, 316.5, 87.75),
      fromHtml(505.5, 511.5, 317.25, 85.5),
    ],
    ['619.16,337.86,97.42,59.28', '616.27,444.06,94.95,45.63', '616.54,534.02,95.17,44.46'],
    ['726.33,337.86,81.19,59.28', '728.72,443.06,79.13,45.63', '727.23,534.02,79.31,44.46'],
    fromHtml(967.5, 211.5, 285, 72),
    fromHtml(1021.5, 286.5, 231, 32.25),
    [870.8, 304, 480.75, 64.5, 73.25, 18, 1304.75, 12.75],
    fromHtml(252, 670.5, 78, 51),
    { left: 81, top: 726, width: 66.75, height: 48, gap: -5.25 },
    {
      useReviewPanel: true,
      scoreAsSummary: true,
      rankTextOffsetY: WRITING_RANK_TEXT_OFFSET_Y.dinosaur,
    },
  ),
  // Applied from settlement-hotspots-dunhuang.json; rankBase not drawn.
  dunhuang: scene(
    fromHtml(-20.2, 10, 497.3, 620),
    fromHtml(508.5, 177, 291.75, 75),
    fromHtml(483, 253.5, 357.75, 339.75),
    [
      fromHtml(501, 294, 314.25, 99.75),
      fromHtml(502.5, 394.5, 312.75, 80.25),
      fromHtml(507, 477, 309, 78),
    ],
    ['610.99,317.94,94.27,51.87', '611.96,413.76,93.83,41.73', '615.15,495.72,92.7,40.56'],
    ['714.69,317.94,78.56,51.87', '715.17,413.76,78.19,41.73', '717.12,495.72,77.25,40.56'],
    fromHtml(948, 172.5, 314.25, 90.75),
    fromHtml(1005, 265.5, 199.5, 26.25),
    [
      856.9 + DUNHUANG_REVIEW_SHIFT_X,
      285.5,
      458.25,
      60,
      75.5,
      18,
      1268.25 + DUNHUANG_REVIEW_SHIFT_X,
      10.5,
    ],
    fromHtml(237, 655.5, 70.5, 51),
    { left: 121.5, top: 712.5, width: 46.5, height: 42, gap: 4.5 },
    {
      useReviewPanel: true,
      scoreAsSummary: true,
      characterSoleLift: 56,
      rankTextOffsetY: WRITING_RANK_TEXT_OFFSET_Y.dunhuang,
    },
  ),
  // Applied from settlement-hotspots-magic.json; rankBase not drawn.
  magic: scene(
    fromHtml(-58.78, 16, 512.37, 598),
    fromHtml(531.75, 173.25, 262.5, 78),
    fromHtml(468, 259.5, 375.75, 357),
    [
      fromHtml(482.25, 267, 314.25, 99.75),
      fromHtml(484.5, 362.25, 312.75, 80.25),
      fromHtml(487.5, 442.5, 309, 78),
    ],
    ['592.24,290.94,94.27,51.87', '593.96,381.51,93.83,41.73', '595.65,461.22,92.7,40.56'],
    ['695.94,290.94,78.56,51.87', '697.17,381.51,78.19,41.73', '697.62,461.22,77.25,40.56'],
    fromHtml(968.25, 177.75, 297, 72.75),
    fromHtml(1000.5, 253.5, 230.25, 32.25),
    [879, 293.25, 458.25, 60, 64.5, 18, 1290.25, 10.5],
    fromHtml(138.75, 613.5 + MAGIC_SCORE_SHIFT_Y, 168.75, 51),
    { left: 91.5, top: 674.25, width: 45.75, height: 44.25, gap: 5.25 },
    {
      useReviewPanel: true,
      scoreAsSummary: true,
      characterSoleLift: 48,
      rankTextOffsetY: WRITING_RANK_TEXT_OFFSET_Y.magic,
    },
  ),
};

export function settlementBoxNode(
  layout: SettlementBox,
): { width: number; height: number; position: Vec3 } {
  return {
    width: layout.size[0],
    height: layout.size[1],
    position: layout.position.clone(),
  };
}
