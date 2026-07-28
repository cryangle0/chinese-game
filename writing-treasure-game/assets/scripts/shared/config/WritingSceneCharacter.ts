import { Vec3 } from 'cc';
import { box } from './WritingPlayLayout';

/**
 * Per-scene idle/action character.
 * Idle: soles on grass (pinFeet). Action boxes from HTML `*-action.html`.
 */
export const WritingSceneCharacter: Readonly<Record<string, {
  idle: ReturnType<typeof box>;
  action: ReturnType<typeof box>;
}>> = {
  treasure: {
    idle: box(560, -22, 320, 440),
    action: box(487.4, -19.95, 462, 639.69),
  },
  desert: {
    idle: box(560, -22, 320, 440),
    action: box(468.54, -26.06, 468, 648),
  },
  dinosaur: {
    idle: box(560, -22, 320, 440),
    action: box(519.07, -28.5, 399, 552.46),
  },
  dunhuang: {
    idle: box(555, -22, 330, 440),
    action: box(531.64, 32.68, 325, 450),
  },
  magic: {
    idle: box(560, -22, 320, 440),
    // Was 360×460 → character looked tiny during cast; match HTML action frame.
    action: box(471.16, -72.82, 475.22, 658),
  },
};

export function sceneCharacter(sceneId: string) {
  return WritingSceneCharacter[sceneId] ?? WritingSceneCharacter.treasure;
}

export type SceneBox = { size: readonly [number, number]; position: Vec3 };
