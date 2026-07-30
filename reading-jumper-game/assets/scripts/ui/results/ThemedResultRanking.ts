import {
  HorizontalTextAlignment, Label, Node, Vec3,
} from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import {
  createLabel, createUiNode, drawPanel,
} from '../../core/ui/UiFactory';
import { buildRankRows } from '../../shared/config/RankNamePool';
import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';
import { ResultThemeLayout } from './ResultThemeLayoutTypes';
import { addResultHeading } from './ThemedResultSupport';

/** 无排行榜切图时：与答题回顾同款白条上的深色字 */
const PANEL_RANK_TEXT = '#3A4558';
const PANEL_RANK_OUTLINE = '#FFFFFF';

export function buildThemedResultRanking(
  parent: Node,
  result: GameResult,
  theme: GameTheme,
  layout: ResultThemeLayout,
  rankingMaxScore = 100,
): void {
  // 无 result-rank-title 切图时回退文字（深海/太空等）
  addResultHeading(
    parent,
    'RankTitle',
    theme.assets.resultRankTitle,
    '积分排行榜',
    layout.rank.titleX,
    layout.rank.titleY,
    layout.text.heading,
    layout.text.headingOutline,
    layout.rank.titleSize ?? layout.headingSize,
  );
  const rows = buildRankRows(result.score, rankingMaxScore).map((row) => ({
    name: row.name,
    score: `${row.score}分`,
  }));
  const usePanel = !theme.assets.resultRankRows?.length;
  rows.forEach((row, index) => {
    const root = createUiNode(
      parent,
      `RankRow${index}`,
      layout.rank.width,
      layout.rank.rowHeight,
      new Vec3(layout.rank.x, layout.rank.rows[index]),
    );
    const asset = theme.assets.resultRankRows?.[index];
    if (asset) {
      // stretch：三行切图比例不一，contain 居中会让奖牌左边错位
      spriteLoader.apply(root, asset, 'stretch');
      addRankText(root, row, layout, layout.text.rank, layout.text.rankOutline);
    } else if (layout.rank.hidePanel) {
      // 诗词等：背景已带奖牌+底条，只叠姓名/分数
      addRankText(root, row, layout, PANEL_RANK_TEXT, PANEL_RANK_OUTLINE);
    } else {
      // 与答题回顾同款白条，无奖牌/底板素材
      drawPanel(root, '#FAFAFA', 13, 245);
      addRankText(root, row, layout, PANEL_RANK_TEXT, PANEL_RANK_OUTLINE);
    }
  });
  if (typeof document !== 'undefined') {
    document.body.dataset.rankStyle = usePanel ? 'panel' : 'sprite';
    document.body.dataset.rankMaxScore = String(rankingMaxScore);
    document.body.dataset.rankScores = rows.map((row) => row.score).join('|');
  }
}

function addRankText(
  root: Node,
  row: { readonly name: string; readonly score: string },
  layout: ResultThemeLayout,
  color: string,
  outlineColor: string,
): void {
  const name = createLabel(root, row.name, {
    size: 22, color, width: 170, height: 46, bold: true,
    outlineColor, outlineWidth: 1,
  });
  name.overflow = Label.Overflow.SHRINK;
  name.horizontalAlign = HorizontalTextAlignment.CENTER;
  name.node.setPosition(layout.rank.nameX, 0);
  const value = createLabel(root, row.score, {
    size: 23, color, width: 100, height: 46, bold: true,
    outlineColor, outlineWidth: 1,
  });
  value.node.setPosition(layout.rank.scoreX, 0);
}
