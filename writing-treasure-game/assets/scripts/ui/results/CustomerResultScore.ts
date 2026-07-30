import {
  HorizontalTextAlignment, Label, Node, UIOpacity, Vec3,
} from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import { createLabel, createUiNode, drawPanel } from '../../core/ui/UiFactory';
import {
  SettlementBox, WritingSettlementLayout, settlementBoxNode,
} from '../../shared/config/WritingSettlementLayout';
import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';
import { mountDomResultScore } from './DomResultScore';

function image(
  root: Node, name: string, asset: string | undefined, layout: SettlementBox,
  mode: 'contain' | 'stretch' = 'contain',
): Node | undefined {
  if (!asset) return undefined;
  const target = settlementBoxNode(layout);
  const node = createUiNode(root, name, target.width, target.height, target.position);
  spriteLoader.apply(node, asset, mode);
  return node;
}

function boxFrom(left: number, top: number, width: number, height: number): SettlementBox {
  return {
    size: [width, height],
    position: new Vec3(left + width / 2 - 720, 405 - (top + height / 2), 0),
  };
}

function addStars(root: Node, result: GameResult, theme: GameTheme): void {
  const layout = WritingSettlementLayout[theme.id];
  if (!layout) return;
  const earned = Math.max(0, Math.min(5, result.stars));
  const { left, top, width, height, gap } = layout.stars;
  for (let index = 0; index < 5; index += 1) {
    const asset = theme.assets.resultStars?.[index] ?? theme.assets.resultStars?.[0];
    const star = image(root, `CustomerStar${index + 1}`, asset,
      boxFrom(left + index * (width + gap), top, width, height));
    if (star) star.addComponent(UIOpacity).opacity = index < earned ? 255 : 55;
  }
  if (typeof document !== 'undefined') {
    document.body.dataset.resultStarSlots = '5';
    document.body.dataset.resultStarsEarned = String(earned);
  }
}

export function addCustomerScore(
  root: Node, result: GameResult, theme: GameTheme, contentRoot?: Node,
): Node {
  const layout = WritingSettlementLayout[theme.id];
  const scoreRoot = createUiNode(root, 'CustomerScoreArtwork', 1440, 810);
  if (!layout) return scoreRoot;
  const scoreBox = settlementBoxNode(layout.score);
  if (layout.scoreAsSummary) {
    const withCaption = theme.id === 'magic' || theme.id === 'treasure';
    const label = withCaption ? `总分 ${result.score}` : String(result.score);
    const fontSize = theme.id === 'treasure' ? 30 : theme.id === 'magic' ? 26 : 30;
    const color = theme.id === 'treasure' ? '#FFE142' : '#FFFFFF';
    const summary = createLabel(scoreRoot, label, {
      size: fontSize, color, width: scoreBox.width, height: scoreBox.height, bold: true,
      outlineColor: '#3A170E', outlineWidth: 3,
    });
    summary.horizontalAlign = HorizontalTextAlignment.CENTER;
    summary.overflow = Label.Overflow.SHRINK;
    summary.node.name = 'CustomerScoreValue';
    summary.node.setPosition(scoreBox.position);
    // DOM overlay above character motion (z12) so feet cannot cover score text.
    if (contentRoot && typeof document !== 'undefined') {
      summary.node.active = false;
      mountDomResultScore(scoreRoot, contentRoot, label, scoreBox, {
        fontSize, color, outline: '#3A170E',
      });
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.scoreLabel = label;
      document.body.dataset.scoreMode = withCaption ? 'summary' : 'number';
      document.body.dataset.scoreValue = String(result.score);
      document.body.dataset.scorePanel = '0';
    }
  } else {
    const scorePanel = createUiNode(
      scoreRoot, 'CustomerScore', scoreBox.width, scoreBox.height, scoreBox.position,
    );
    drawPanel(scorePanel, '#247FD1', 15);
    createLabel(scorePanel, '总分', {
      size: 22, width: 72, height: scoreBox.height, bold: true,
    }).node.setPosition(-52, 0);
    const value = createLabel(scorePanel, String(result.score), {
      size: 30, color: '#FFE142', width: 110, height: scoreBox.height, bold: true,
    });
    value.overflow = Label.Overflow.SHRINK;
    value.node.setPosition(48, 0);
    if (typeof document !== 'undefined') {
      document.body.dataset.scoreFont = '30';
      document.body.dataset.scoreValue = String(result.score);
      document.body.dataset.scorePanel = '1';
    }
  }
  addStars(scoreRoot, result, theme);
  return scoreRoot;
}
