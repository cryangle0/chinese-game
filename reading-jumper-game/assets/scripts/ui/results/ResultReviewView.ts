import { Node, Vec3 } from 'cc';
import { createLabel, createUiNode, drawPanel } from '../../core/ui/UiFactory';
import { GameResult } from '../../shared/types/GameTypes';
import { ThemePalette } from '../../shared/types/Theme';

export class ResultReviewView {
  readonly root: Node;

  constructor(parent: Node, result: GameResult, palette: ThemePalette) {
    this.root = createUiNode(parent, 'ResultReview', 520, 390, new Vec3(250, 20));
    drawPanel(this.root, '#FFFDF4', 18, 250);
    const title = createLabel(this.root, '常识回顾', {
      size: 30, color: palette.primary, width: 420, height: 54, bold: true,
    });
    title.node.setPosition(0, 150);
    const answers = result.answers.slice(0, 5);
    answers.forEach((answer, index) => {
      const state = answer.correct ? '[OK]' : '[X]';
      const answerText = answer.correct ? answer.selected : answer.correctAnswer;
      const row = createLabel(this.root, `${state} ${answer.stem}  ${answerText}`, {
        size: 18,
        color: answer.correct ? '#287A50' : '#B13A4C',
        width: 460,
        height: 50,
      });
      row.node.setPosition(0, 92 - index * 58);
    });
  }
}
