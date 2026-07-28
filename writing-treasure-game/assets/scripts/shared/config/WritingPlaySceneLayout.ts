export type WritingSceneId = 'treasure' | 'desert' | 'dinosaur' | 'dunhuang' | 'magic';

export interface WritingChoiceSceneLayout {
  readonly columns: readonly [number, number, number];
  readonly choice: Readonly<{ width: number; height: number; y: number }>;
  readonly option: Readonly<{
    width: number;
    height: number;
    localY: number;
    padX: number;
    padY: number;
  }>;
  readonly chest: Readonly<{ width: number; height: number; localY: number }>;
}

const CHOICE = { width: 280, height: 280, y: -205 } as const;
const CHEST = { width: 160, height: 136, localY: 7 } as const;

function scene(
  columns: readonly [number, number, number],
  padX: number,
): WritingChoiceSceneLayout {
  return {
    columns,
    choice: CHOICE,
    option: { width: 250, height: 104, localY: 105, padX, padY: 10 },
    chest: CHEST,
  };
}

export const WritingPlaySceneLayout = {
  treasure: scene([-356, -4, 334], 20),
  desert: scene([-364, -11, 333], 20),
  dinosaur: scene([-355, -1, 342], 20),
  dunhuang: scene([-353, -6, 331], 20),
  magic: scene([-362, -14, 327], 20),
} as const satisfies Readonly<Record<WritingSceneId, WritingChoiceSceneLayout>>;

export function writingPlaySceneLayout(sceneId: string): WritingChoiceSceneLayout {
  return WritingPlaySceneLayout[sceneId as WritingSceneId] ?? WritingPlaySceneLayout.treasure;
}

export function scaledWritingChoiceColumns(
  sceneId: string,
  backgroundScaleX: number,
): readonly [number, number, number] {
  const [left, middle, right] = writingPlaySceneLayout(sceneId).columns;
  return [
    left * backgroundScaleX,
    middle * backgroundScaleX,
    right * backgroundScaleX,
  ];
}
