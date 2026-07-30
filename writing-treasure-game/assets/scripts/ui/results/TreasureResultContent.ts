import {
  Graphics, HorizontalTextAlignment, Label, Node, UITransform,
} from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import { createLabel, createUiNode } from '../../core/ui/UiFactory';
import { color } from '../../core/ui/colors';
import {
  SettlementBox, WritingSettlementLayout, settlementBoxNode,
} from '../../shared/config/WritingSettlementLayout';
import { buildRankRows } from '../../shared/config/RankNamePool';
import { GameResult } from '../../shared/types/GameTypes';
import { ThemeAssets } from '../../shared/types/Theme';
import {
  DomReviewRow, mountDomResultReview, resultReviewText,
} from './DomResultReview';

function addImage(
  root: Node,
  name: string,
  asset: string | undefined,
  layout: SettlementBox,
  mode: 'contain' | 'stretch' = 'contain',
): Node | undefined {
  if (!asset) return undefined;
  const mapped = settlementBoxNode(layout);
  const node = createUiNode(root, name, mapped.width, mapped.height, mapped.position);
  spriteLoader.apply(node, asset, mode);
  return node;
}

function addRank(
  root: Node,
  result: GameResult,
  assets: ThemeAssets,
  rankingMaxScore = 100,
): void {
  const layout = WritingSettlementLayout.treasure;
  addImage(root, 'TreasureRankTitle', assets.resultRank, layout.rankTitle);
  layout.rankRows.forEach((row, index) => {
    addImage(root, `TreasureRankRow${index + 1}`, assets.resultRankLabels?.[index], row);
  });

  const rows = buildRankRows(result.score, rankingMaxScore);
  rows.forEach((row, index) => {
    const text = layout.rankText[index];
    const rowOffsetY = layout.rankTextRowOffsetY?.[index]
      ?? layout.rankTextOffsetY
      ?? 0;
    const nameBox = settlementBoxNode(text.name);
    const name = createLabel(root, row.name, {
      size: 20, color: '#6D4225', width: nameBox.width, height: nameBox.height, bold: true,
    });
    name.node.name = `TreasureRankName${index + 1}`;
    name.horizontalAlign = HorizontalTextAlignment.CENTER;
    name.overflow = Label.Overflow.SHRINK;
    name.node.setPosition(
      nameBox.position.x,
      nameBox.position.y + rowOffsetY,
      nameBox.position.z,
    );
    const scoreBox = settlementBoxNode(text.score);
    const score = createLabel(root, `${row.score}分`, {
      size: 22, color: '#EF6B11', width: scoreBox.width, height: scoreBox.height, bold: true,
    });
    score.node.name = `TreasureRankScore${index + 1}`;
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

function drawReviewRow(node: Node): void {
  const transform = node.getComponent(UITransform);
  if (!transform) return;
  const graphics = node.addComponent(Graphics);
  const { width, height } = transform.contentSize;
  graphics.fillColor = color('#FAFAFA', 240);
  graphics.strokeColor = color('#E7C28C');
  graphics.lineWidth = 2;
  graphics.roundRect(-width / 2, -height / 2, width, height, 13);
  graphics.fill();
  graphics.stroke();
}

function addReview(
  root: Node,
  result: GameResult,
  assets: ThemeAssets,
  contentRoot: Node,
): void {
  const layout = WritingSettlementLayout.treasure;
  addImage(root, 'TreasureReviewTitle', assets.resultReview, layout.reviewTitle);
  const domRows: DomReviewRow[] = [];
  result.answers.slice(-5).forEach((answer, index) => {
    const panelLayout = layout.reviewRows[index];
    const textLayout = layout.reviewText[index];
    const iconLayout = layout.reviewIcon[index];
    if (!panelLayout || !textLayout || !iconLayout) return;
    const panelBox = settlementBoxNode(panelLayout);
    const textBox = settlementBoxNode(textLayout);
    const panel = createUiNode(
      root, `TreasureReviewRow${index + 1}`,
      panelBox.width, panelBox.height, panelBox.position,
    );
    drawReviewRow(panel);
    addImage(
      root,
      `TreasureReviewState${index + 1}`,
      answer.correct ? assets.resultCorrect : assets.resultWrong,
      iconLayout,
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
  mountDomResultReview(root, contentRoot, domRows, 20);
}

export function addTreasureResultContent(
  root: Node,
  result: GameResult,
  assets: ThemeAssets,
  contentRoot: Node = root,
  rankingMaxScore = 100,
): void {
  addRank(root, result, assets, rankingMaxScore);
  addReview(root, result, assets, contentRoot);
}
