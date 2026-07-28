import { Node, UIOpacity, Vec3 } from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import { createLabel, createUiNode } from '../../core/ui/UiFactory';
import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';
import { ResultThemeLayout } from './ResultThemeLayoutTypes';

export function buildThemedResultScore(
  parent: Node,
  result: GameResult,
  theme: GameTheme,
  layout: ResultThemeLayout,
): void {
  if (layout.score) {
    const suffix = layout.score.suffix ?? '分';
    const score = createLabel(parent, `${result.score}${suffix}`, {
      size: 32, color: '#FFFFFF', width: 100, height: 48, bold: true,
      outlineColor: layout.text.scoreOutline, outlineWidth: 2,
    });
    score.node.setPosition(layout.score.x, layout.score.y);
  }
  if (layout.summary) addSummary(parent, result, layout);
  const earned = Math.min(layout.stars.length, result.stars);
  const stars = theme.assets.resultStars ?? [];
  layout.stars.forEach((star, index) => {
    const node = createUiNode(
      parent, `ResultStar${index}`, star.w, star.h, new Vec3(star.x, star.y),
    );
    const path = stars[index] ?? stars[0];
    if (path) spriteLoader.apply(node, path, 'contain');
    node.addComponent(UIOpacity).opacity = index < earned ? 255 : 55;
  });
}

function addSummary(
  parent: Node,
  result: GameResult,
  layout: ResultThemeLayout,
): void {
  const summary = layout.summary;
  if (!summary) return;
  const caption = createLabel(parent, '本次总分', {
    size: 27, color: summary.captionColor, width: 240, height: 42, bold: true,
    outlineColor: layout.text.scoreOutline, outlineWidth: 2,
  });
  caption.node.setPosition(summary.x, summary.captionY);
  const score = createLabel(parent, `${result.score}分`, {
    size: 48, color: summary.scoreColor, width: 240, height: 64, bold: true,
    outlineColor: layout.text.scoreOutline, outlineWidth: 2,
  });
  score.node.setPosition(summary.x, summary.scoreY);
}
