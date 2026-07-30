import {
  HorizontalTextAlignment, Label, Node,
} from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import { createLabel, createUiNode, drawPanel } from '../../core/ui/UiFactory';
import {
  SettlementBox, WritingSettlementLayout, settlementBoxNode,
} from '../../shared/config/WritingSettlementLayout';
import { buildRankRows } from '../../shared/config/RankNamePool';
import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';
import { addCustomerScore } from './CustomerResultScore';
import {
  DomReviewRow, mountDomResultReview, resultReviewText,
} from './DomResultReview';

export type { CustomerResultOptions } from './CustomerResultActions';
export { addCustomerActions } from './CustomerResultActions';

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

function addRank(
  root: Node,
  result: GameResult,
  theme: GameTheme,
  rankingMaxScore = 100,
): void {
  const layout = WritingSettlementLayout[theme.id];
  if (!layout) return;
  const assets = theme.assets;
  const rankTextOffsetY = layout.rankTextOffsetY ?? 0;
  // 排行榜底板与背景木板重复，全场景不绘制
  image(root, 'CustomerRank', assets.resultRank, layout.rankTitle);
  layout.rankRows.forEach((row, index) => {
    image(root, `CustomerRankLabel${index + 1}`, assets.resultRankLabels?.[index], row);
  });
  const rows = buildRankRows(result.score, rankingMaxScore);
  rows.forEach((row, index) => {
    const text = layout.rankText[index];
    const rowOffsetY = layout.rankTextRowOffsetY?.[index] ?? rankTextOffsetY;
    const nameBox = settlementBoxNode(text.name);
    const name = createLabel(root, row.name, {
      size: 20, color: '#6D4225', width: nameBox.width, height: nameBox.height, bold: true,
    });
    name.horizontalAlign = HorizontalTextAlignment.CENTER;
    name.overflow = Label.Overflow.SHRINK;
    name.node.name = `CustomerRankName${index + 1}`;
    name.node.setPosition(
      nameBox.position.x,
      nameBox.position.y + rowOffsetY,
      nameBox.position.z,
    );
    const scoreBox = settlementBoxNode(text.score);
    const score = createLabel(root, `${row.score}分`, {
      size: 22, color: '#EF6B11', width: scoreBox.width, height: scoreBox.height, bold: true,
    });
    score.node.name = `CustomerRankScore${index + 1}`;
    score.node.setPosition(
      scoreBox.position.x,
      scoreBox.position.y + rowOffsetY,
      scoreBox.position.z,
    );
  });
  if (typeof document !== 'undefined') {
    document.body.dataset.rankMaxScore = String(rankingMaxScore);
    document.body.dataset.rankScores = rows.map((row) => `${row.score}分`).join('|');
  }
}

function addReview(
  root: Node,
  result: GameResult,
  theme: GameTheme,
  contentRoot?: Node,
): void {
  const layout = WritingSettlementLayout[theme.id];
  if (!layout) return;
  const assets = theme.assets;
  image(root, 'CustomerReview', assets.resultReview, layout.reviewTitle);
  if (typeof document !== 'undefined') {
    document.body.dataset.reviewCenterX = String(layout.reviewTitle.position.x.toFixed(1));
    delete document.body.dataset.achievementCenterX;
    delete document.body.dataset.resultBookTitle;
  }
  const domRows: DomReviewRow[] = [];
  result.answers.slice(-5).forEach((answer, index) => {
    const panelLayout = layout.reviewRows[index];
    const textLayout = layout.reviewText[index];
    const iconLayout = layout.reviewIcon[index];
    if (!panelLayout || !textLayout || !iconLayout) return;
    const panelBox = settlementBoxNode(panelLayout);
    const textBox = settlementBoxNode(textLayout);
    const panel = createUiNode(
      root, `CustomerReviewPanel${index + 1}`,
      panelBox.width, panelBox.height, panelBox.position,
    );
    drawPanel(panel, '#FAFAFA', 13, 240);
    image(
      root, `CustomerReviewIcon${index + 1}`,
      answer.correct ? assets.resultCorrect : assets.resultWrong, iconLayout,
    );
    domRows.push({
      text: resultReviewText(answer.stem, answer.correctAnswer),
      color: '#6D4225',
      index: index + 1,
      question: answer.stem,
      selectedAnswer: answer.selected,
      correctAnswer: answer.correctAnswer,
      correct: answer.correct,
      box: textBox,
    });
  });
  mountDomResultReview(root, contentRoot ?? root, domRows, 20);
}

export function buildCustomerResult(
  root: Node,
  result: GameResult,
  theme: GameTheme,
  contentRoot?: Node,
  rankingMaxScore = 100,
): Node {
  if (!WritingSettlementLayout[theme.id]) {
    throw new Error(`settlement layout unavailable: ${theme.id}`);
  }
  addRank(root, result, theme, rankingMaxScore);
  addReview(root, result, theme, contentRoot);
  return addCustomerScore(root, result, theme, contentRoot);
}
