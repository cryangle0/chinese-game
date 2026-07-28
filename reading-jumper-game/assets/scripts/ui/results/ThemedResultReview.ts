import { Node, Vec3 } from 'cc';
import { spriteLoader } from '../../core/assets/SpriteLoader';
import { createUiNode, drawPanel } from '../../core/ui/UiFactory';
import { GameResult } from '../../shared/types/GameTypes';
import { GameTheme } from '../../shared/types/Theme';
import { mountDomResultReview, resultReviewText } from './DomResultReview';
import { ResultThemeLayout } from './ResultThemeLayoutTypes';
import { addResultHeading } from './ThemedResultSupport';

/** 白底回顾条上的正文色（主题 rank 色多为白字，不能直接用） */
const REVIEW_TEXT_COLOR = '#3A4558';

export function buildThemedResultReview(
  parent: Node,
  result: GameResult,
  theme: GameTheme,
  layout: ResultThemeLayout,
): void {
  addResultHeading(
    parent,
    'ReviewTitle',
    theme.assets.resultReviewTitle,
    '答题回顾',
    layout.review.x,
    layout.review.titleY,
    layout.text.heading,
    layout.text.headingOutline,
    layout.headingSize,
  );
  const answers = result.answers.slice(0, 5);
  const rows = answers.map((answer, index) => ({
    text: resultReviewText(answer.stem, answer.correctAnswer),
    color: REVIEW_TEXT_COLOR,
    index: index + 1,
    question: answer.stem,
    selectedAnswer: answer.selected,
    correctAnswer: answer.correctAnswer,
    correct: answer.correct,
    box: reviewTextBox(layout, index),
  }));
  answers.forEach((_, index) => addReviewPanel(parent, layout, index));
  mountDomResultReview(parent, parent, rows, 20);
  answers.forEach((answer, index) => addStateIcon(parent, answer.correct, index, theme, layout));
  markReviewDiagnostics(layout);
}

function addReviewPanel(parent: Node, layout: ResultThemeLayout, index: number): void {
  const panel = createUiNode(
    parent,
    `ReviewPanel${index}`,
    layout.review.width,
    layout.review.textHeight,
    new Vec3(layout.review.x, layout.review.rows[index]),
  );
  drawPanel(panel, '#FAFAFA', 13, 245);
}

function reviewTextBox(
  layout: ResultThemeLayout,
  index: number,
): {
  readonly width: number;
  readonly height: number;
  readonly position: { readonly x: number; readonly y: number };
} {
  const textWidth = Math.max(80, layout.review.width - 58);
  return {
    width: textWidth,
    height: layout.review.textHeight,
    position: { x: layout.review.textX, y: layout.review.rows[index] },
  };
}

function addStateIcon(
  parent: Node,
  correct: boolean,
  index: number,
  theme: GameTheme,
  layout: ResultThemeLayout,
): void {
  const size = layout.review.iconSize;
  const icon = createUiNode(
    parent,
    `ReviewState${index}`,
    size,
    size,
    new Vec3(layout.review.iconX, layout.review.rows[index]),
  );
  const path = correct ? theme.assets.resultCorrect : theme.assets.resultWrong;
  if (path) spriteLoader.apply(icon, path, 'contain');
}

function markReviewDiagnostics(layout: ResultThemeLayout): void {
  if (typeof document === 'undefined') return;
  document.body.dataset.reviewRows = layout.review.rows.join(',');
  document.body.dataset.reviewGap = String(
    Math.abs(layout.review.rows[0] - layout.review.rows[1]),
  );
  document.body.dataset.reviewTextX = String(layout.review.textX);
  document.body.dataset.motionBox = [
    layout.motion.x, layout.motion.y, layout.motion.width, layout.motion.height,
  ].join(',');
}
