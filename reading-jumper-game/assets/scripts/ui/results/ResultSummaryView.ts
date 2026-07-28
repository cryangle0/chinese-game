import { Node, Vec3 } from 'cc';
import { createLabel, createUiNode, drawPanel } from '../../core/ui/UiFactory';
import { GameResult } from '../../shared/types/GameTypes';
import { ThemePalette } from '../../shared/types/Theme';

export class ResultSummaryView {
  readonly root: Node;

  constructor(parent: Node, result: GameResult, palette: ThemePalette) {
    this.root = createUiNode(parent, 'ResultSummary', 390, 390, new Vec3(-250, 20));
    drawPanel(this.root, '#FFF7DB', 18, 250);
    const title = createLabel(this.root, '闯关成绩', {
      size: 30, color: palette.primary, width: 330, height: 54, bold: true,
    });
    title.node.setPosition(0, 150);
    const score = createLabel(this.root, `${result.score} 分`, {
      size: 54, color: '#D96A18', width: 300, height: 76, bold: true,
    });
    score.node.setPosition(0, 78);
    const stars = createLabel(this.root, '★'.repeat(result.stars) + '☆'.repeat(5 - result.stars), {
      size: 43, color: '#F2A900', width: 280, height: 58, bold: true,
    });
    stars.node.setPosition(0, 15);
    const accuracy = result.answered ? Math.round(result.correct / result.answered * 100) : 0;
    this.addMetric('正确率', `${accuracy}%`, -55, palette.primary);
    this.addMetric('最佳连对', `${result.bestCombo}`, -105, palette.primary);
    this.addMetric('答对题数', `${result.correct}/${result.answered}`, -155, palette.primary);
  }

  private addMetric(label: string, value: string, y: number, color: string): void {
    const name = createLabel(this.root, label, {
      size: 22, color: '#5D4A35', width: 180, height: 40,
    });
    name.node.setPosition(-65, y);
    const metric = createLabel(this.root, value, {
      size: 24, color, width: 120, height: 40, bold: true,
    });
    metric.node.setPosition(105, y);
  }
}
