import { Vec3 } from 'cc';
import { box } from './WritingPlayLayout';

/**
 * Per-scene idle/action character.
 * Idle: soles on grass (pinFeet). Action boxes from HTML `*-action.html`.
 */
export const WritingSceneCharacter: Readonly<Record<string, {
  idle: ReturnType<typeof box>;
  run: ReturnType<typeof box>;
  action: ReturnType<typeof box>;
}>> = {
  treasure: {
    idle: box(614, 168, 173, 253),
    run: box(477.26, -77.56, 446.47, 498.56),
    action: box(487.4, -19.95, 462, 639.69),
  },
  desert: {
    idle: box(609, 175, 179, 256),
    run: box(480.98, -171.35, 435.03, 602.35),
    action: box(468.54, -26.06, 468, 648),
  },
  dinosaur: {
    idle: box(627, 161, 187, 259),
    run: box(515.2, -148.54, 410.61, 568.54),
    action: box(519.07, -28.5, 399, 552.46),
  },
  dunhuang: {
    idle: box(595, 172, 250, 250),
    run: box(595, 75.85, 250, 346.15),
    action: box(531.64, 32.68, 325, 450),
  },
  magic: {
    idle: box(614, 125, 200, 297),
    run: box(521.91, -109.94, 384.18, 531.94),
    // Was 360×460 → character looked tiny during cast; match HTML action frame.
    action: box(471.16, -72.82, 475.22, 658),
  },
};

export function sceneCharacter(sceneId: string) {
  return WritingSceneCharacter[sceneId] ?? WritingSceneCharacter.treasure;
}

export type SceneBox = { size: readonly [number, number]; position: Vec3 };
