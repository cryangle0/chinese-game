import { Node, Vec3 } from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import { DomMotionSprite } from '../../core/media/DomMotionSprite';
import { createUiNode } from '../../core/ui/UiFactory';
import {
  WritingSettlementLayout, settlementBoxNode,
} from '../../shared/config/WritingSettlementLayout';
import { GameTheme } from '../../shared/types/Theme';

export function createResultCharacterMotion(
  parent: Node,
  contentRoot: Node,
  theme: GameTheme,
): DomMotionSprite | null {
  if (!theme.assets.resultBackground || !theme.assets.motion?.result) return null;
  const settlement = WritingSettlementLayout[theme.id];
  const mapped = settlement
    ? settlementBoxNode(settlement.character)
    : { width: 320, height: 430, position: new Vec3(-520, -70) };
  const lift = settlement?.characterSoleLift ?? 0;
  if (lift) mapped.position.y += lift;
  const fallback = createUiNode(
    parent, 'ResultCharacterFallback', mapped.width, mapped.height, mapped.position.clone(),
  );
  spriteLoader.apply(fallback, theme.assets.characterIdle, 'contain');
  const character = createUiNode(
    parent, 'ResultCharacterMotion', mapped.width, mapped.height, mapped.position.clone(),
  );
  const motion = new DomMotionSprite(
    character, fallback, mapped.width, mapped.height,
    {
      fit: 'contain',
      objectPosition: 'center bottom',
      pinFeet: true,
      // Above rank/review artwork; keep idle fallback if result.webp is slow/missing.
      zIndex: 12,
      contentRoot,
      suppressFallback: false,
    },
  );
  motion.show(theme.assets.motion.result);
  return motion;
}
