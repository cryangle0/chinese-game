/** Static feedback layouts from `独立HTML像素级UI原型/shared/writing-feedback.js`. */

export interface StaticFeedbackLayer {
  readonly path: string;
  /** Selection-specific art in blue, purple, orange option order. */
  readonly choicePaths?: readonly [string, string, string];
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
  /** Source composition column; this layer follows the actual selected option. */
  readonly selectedAnchor?: 0 | 1 | 2;
  /** Stretch scene-colored crop layers with the horizontally filled backdrop. */
  readonly stretchWithBackdrop?: boolean;
  /** Uniform visual enlargement while keeping the configured bottom edge fixed. */
  readonly scale?: number;
  readonly offsetX?: number;
  readonly offsetY?: number;
}

export interface StaticFeedbackVariant {
  /** Omitted when feedback must preserve the current gameplay background. */
  readonly background?: string;
  readonly layers: readonly StaticFeedbackLayer[];
}

export interface StaticFeedbackPair {
  readonly correct: StaticFeedbackVariant;
  readonly wrong: StaticFeedbackVariant;
}

function media(path: string): string {
  return `./media/${path}`;
}

function dinosaurChoicePaths(
  prefix: 'correct-layer-1' | 'wrong-layer-2',
): readonly [string, string, string] {
  const base = `static-feedback/dinosaur/${prefix}`;
  return [
    media(`${base}-blue.png`),
    media(`${base}-purple.png`),
    media(`${base}-orange.png`),
  ];
}

function variant(
  scene: string,
  kind: 'correct' | 'wrong',
  layers: ReadonlyArray<Omit<StaticFeedbackLayer, 'path'> & { file: string }>,
): StaticFeedbackVariant {
  return {
    background: media(`static-feedback/${scene}/${kind}-background.jpg`),
    layers: layers.map(({ file, ...layer }) => ({
      ...layer,
      path: media(`static-feedback/${scene}/${file}`),
    })),
  };
}

export const WritingStaticFeedback: Readonly<Record<string, StaticFeedbackPair>> = {
  treasure: {
    correct: variant('treasure', 'correct', [
      { file: 'correct-layer-1.png', left: 476.25, top: 112.5, width: 474, height: 297 },
      { file: 'correct-layer-2.png', left: 575.25, top: 495.75, width: 234.75, height: 188.25 },
    ]),
    wrong: variant('treasure', 'wrong', [
      { file: 'wrong-layer-1.png', left: 288.75, top: 216, width: 254.25, height: 218.25 },
      { file: 'wrong-layer-2.png', left: 288.75, top: 491.25, width: 219, height: 209.25 },
    ]),
  },
  desert: {
    correct: variant('desert', 'correct', [
      { file: 'correct-layer-1.png', left: 463.88, top: 108.75, width: 463.5, height: 441 },
      { file: 'correct-layer-2.png', left: 558, top: 440.25, width: 312.75, height: 246 },
    ]),
    wrong: {
      layers: [{
        path: media('static-feedback/desert/wrong-layer-1.png'),
        left: 225.75,
        top: 469.5,
        width: 258.75,
        height: 222,
        selectedAnchor: 0,
        stretchWithBackdrop: true,
        scale: 1.18,
      }],
    },
  },
  dinosaur: {
    // Preserve the live three-pit background; move only the selected feedback layer.
    correct: {
      layers: [{
        path: media('static-feedback/dinosaur/correct-layer-1-purple.png'),
        choicePaths: dinosaurChoicePaths('correct-layer-1'),
        left: 520,
        top: 420,
        width: 360,
        height: 340,
        selectedAnchor: 1,
        scale: 1.2,
      }],
    },
    wrong: {
      // The transparent full-stage chase is rendered separately.
      layers: [{
        path: media('static-feedback/dinosaur/wrong-layer-2-orange.png'),
        choicePaths: dinosaurChoicePaths('wrong-layer-2'),
        left: 200,
        top: 540,
        width: 280,
        height: 160,
        selectedAnchor: 0,
        scale: 1.05,
      }],
    },
  },
  dunhuang: {
    correct: variant('dunhuang', 'correct', [
      { file: 'correct-layer-1.png', left: 463.88, top: 39.75, width: 497.25, height: 495.75 },
      { file: 'correct-layer-2.png', left: 549, top: 423, width: 322.5, height: 350.25 },
    ]),
    wrong: variant('dunhuang', 'wrong', [
      { file: 'wrong-layer-1.png', left: 202.12, top: 41.25, width: 497.25, height: 495.75 },
      { file: 'wrong-layer-2.png', left: 261, top: 542.25, width: 195.75, height: 150 },
    ]),
  },
  magic: {
    correct: variant('magic', 'correct', [
      { file: 'correct-layer-1.png', left: 548, top: 108, width: 300, height: 350 },
      { file: 'correct-layer-2.png', left: 577.12, top: 351.75, width: 272.25, height: 354.75 },
    ]),
    wrong: variant('magic', 'wrong', [
      { file: 'wrong-layer-1.png', left: 380, top: 100, width: 680, height: 580 },
      { file: 'wrong-layer-2.png', left: 280.5, top: 533.25, width: 165, height: 161.25 },
    ]),
  },
};

export function resolveStaticFeedback(
  sceneId: string,
  correct: boolean,
): StaticFeedbackVariant | undefined {
  const pair = WritingStaticFeedback[sceneId];
  if (!pair) return undefined;
  return correct ? pair.correct : pair.wrong;
}

export function resolveFeedbackLayerPath(
  layer: Pick<StaticFeedbackLayer, 'path' | 'choicePaths'>,
  selectedIndex: number,
): string {
  const index = Math.max(0, Math.min(2, selectedIndex));
  return layer.choicePaths?.[index] ?? layer.path;
}
