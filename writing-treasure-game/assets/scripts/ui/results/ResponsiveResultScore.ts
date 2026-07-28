import { Node, UIOpacity, Vec3 } from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import { createLabel, createUiNode, drawPanel } from '../../core/ui/UiFactory';
import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';

const scoreColors: Readonly<Record<string, readonly [string, string]>> = {
  treasure: ['#D9A73B', '#216FB3'],
  desert: ['#D4A13A', '#784126'],
  dinosaur: ['#D6A344', '#654326'],
  dunhuang: ['#D5A33A', '#514516'],
  magic: ['#D7A33B', '#30306A'],
};

export function buildResponsiveResultScore(
  parent: Node,
  result: GameResult,
  theme: GameTheme,
): Node {
  const root = createUiNode(parent, 'ResponsiveScore', 320, 108, new Vec3(-535, -334));
  const colors = scoreColors[theme.id] ?? [theme.palette.secondary, theme.palette.panel];
  drawPanel(root, colors[0], 16);
  const panel = createUiNode(root, 'ResponsiveScorePanel', 310, 98);
  drawPanel(panel, colors[1], 13);
  const caption = createLabel(panel, '总分', {
    size: 24, color: '#FFFFFF', width: 82, height: 42, bold: true,
  });
  caption.node.setPosition(-72, 24);
  const score = createLabel(panel, String(result.score), {
    size: 38, color: '#FFE142', width: 112, height: 48, bold: true,
  });
  score.node.setPosition(35, 23);
  const earned = Math.max(0, Math.min(5, result.stars));
  const count = 5;
  const starWidth = 38;
  const gap = 10;
  const totalWidth = count * starWidth + (count - 1) * gap;
  const firstX = -totalWidth / 2 + starWidth / 2;
  for (let index = 0; index < count; index += 1) {
    const star = createUiNode(
      panel,
      `ResponsiveStar${index + 1}`,
      starWidth,
      36,
      new Vec3(firstX + index * (starWidth + gap), -25),
    );
    const asset = theme.assets.resultStars?.[index] ?? theme.assets.resultStars?.[0];
    if (asset) spriteLoader.apply(star, asset, 'contain');
    star.addComponent(UIOpacity).opacity = index < earned ? 255 : 55;
  }
  return root;
}
