export interface ResultBox {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

export interface CustomerResultLayout {
  readonly rankTitle: ResultBox;
  readonly rankBase: ResultBox;
  readonly rankRows: readonly [ResultBox, ResultBox, ResultBox];
  readonly reviewTitle: ResultBox;
  readonly achievement: ResultBox;
  readonly reviewRows: readonly [ResultBox, ResultBox, ResultBox, ResultBox, ResultBox];
  readonly scoreCaption?: ResultBox;
  readonly score: ResultBox;
  readonly stars: Readonly<{ left: number; top: number; width: number; height: number; gap: number }>;
}

const repeatedRows = (
  left: number, top: number, width: number, height: number, gap: number,
): [ResultBox, ResultBox, ResultBox, ResultBox, ResultBox] => (
  [0, 1, 2, 3, 4].map((index) => ({
    left, top: top + index * gap, width, height,
  })) as [ResultBox, ResultBox, ResultBox, ResultBox, ResultBox]
);

export const customerResultLayouts: Readonly<Record<string, CustomerResultLayout>> = {
  desert: {
    rankTitle: { left: 728, top: 272, width: 381, height: 98 },
    rankBase: { left: 688, top: 396, width: 469, height: 473 },
    rankRows: [
      { left: 704, top: 430, width: 419, height: 133 },
      { left: 708, top: 564, width: 417, height: 107 },
      { left: 712, top: 676, width: 412, height: 104 },
    ],
    reviewTitle: { left: 1272, top: 272, width: 509, height: 100 },
    achievement: { left: 1373, top: 376, width: 307, height: 43 },
    reviewRows: repeatedRows(1214, 434, 611, 80, 86),
    score: { left: 352, top: 878, width: 104, height: 68 },
    stars: { left: 158, top: 950, width: 63, height: 60, gap: 13 },
  },
  dinosaur: {
    rankTitle: { left: 726, top: 284, width: 327, height: 94 },
    rankBase: { left: 658, top: 394, width: 461, height: 496 },
    rankRows: [
      { left: 674, top: 414, width: 433, height: 152 },
      { left: 686, top: 552, width: 422, height: 117 },
      { left: 686, top: 662, width: 423, height: 114 },
    ],
    reviewTitle: { left: 1290, top: 282, width: 380, height: 96 },
    achievement: { left: 1362, top: 382, width: 308, height: 43 },
    reviewRows: repeatedRows(1160, 444, 641, 86, 88),
    score: { left: 324, top: 894, width: 104, height: 68 },
    stars: { left: 108, top: 968, width: 89, height: 64, gap: -7 },
  },
  dunhuang: {
    rankTitle: { left: 678, top: 236, width: 389, height: 100 },
    rankBase: { left: 644, top: 338, width: 477, height: 453 },
    rankRows: [
      { left: 668, top: 392, width: 419, height: 133 },
      { left: 670, top: 526, width: 417, height: 107 },
      { left: 676, top: 636, width: 412, height: 104 },
    ],
    reviewTitle: { left: 1264, top: 230, width: 419, height: 121 },
    achievement: { left: 1340, top: 354, width: 266, height: 35 },
    reviewRows: repeatedRows(1138, 446, 611, 80, 90),
    score: { left: 316, top: 874, width: 94, height: 68 },
    stars: { left: 162, top: 950, width: 62, height: 56, gap: 6 },
  },
  magic: {
    rankTitle: { left: 709, top: 231, width: 350, height: 104 },
    rankBase: { left: 624, top: 346, width: 501, height: 476 },
    rankRows: [
      { left: 643, top: 356, width: 419, height: 133 },
      { left: 646, top: 483, width: 417, height: 107 },
      { left: 650, top: 590, width: 412, height: 104 },
    ],
    reviewTitle: { left: 1291, top: 237, width: 396, height: 97 },
    achievement: { left: 1334, top: 338, width: 307, height: 43 },
    reviewRows: repeatedRows(1172, 391, 611, 80, 86),
    scoreCaption: { left: 185, top: 818, width: 120, height: 68 },
    score: { left: 295, top: 818, width: 115, height: 68 },
    stars: { left: 122, top: 899, width: 61, height: 59, gap: 7 },
  },
};
