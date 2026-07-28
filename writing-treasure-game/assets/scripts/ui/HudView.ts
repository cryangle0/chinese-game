import { Label, Node, Tween, tween, Vec3 } from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import {
  createLabel, createUiNode, drawPanel,
} from '../core/ui/UiFactory';
import { WritingPlayLayout as L } from '../shared/config/WritingPlayLayout';
import { ThemeAssets } from '../shared/types/Theme';

export interface HudState {
  seconds: number;
  score: number;
  lives: number;
  stageIndex: number;
  stageTotal: number;
  stageName: string;
  combo: number;
}

export class HudView {
  readonly root: Node;
  private readonly timerRoot: Node;
  private readonly scoreRoot: Node;
  private readonly scoreIcon: Node;
  private readonly timer: Label;
  private readonly score: Label;
  private readonly stage: Label;
  private readonly lives: Label;
  private readonly combo: Label;
  private renderedSecond = -1;
  private renderedScore = -1;
  private renderedStageIndex = -1;
  private renderedStageTotal = -1;
  private renderedStageName = '';
  private renderedLives = -1;
  private renderedCombo = -1;

  constructor(parent: Node, assets?: ThemeAssets) {
    this.root = createUiNode(parent, 'Hud', 1440, 810);
    this.timerRoot = createUiNode(
      this.root, 'Timer', L.timer.size[0], L.timer.size[1], L.timer.position,
    );
    this.scoreRoot = createUiNode(
      this.root, 'Score', L.score.size[0], L.score.size[1], L.score.position,
    );
    this.scoreIcon = createUiNode(
      this.root, 'ScoreIcon', L.scoreIcon.size[0], L.scoreIcon.size[1], L.scoreIcon.position,
    );
    this.timer = createLabel(this.timerRoot, '', {
      size: 25, width: 215, height: 64, bold: true,
    });
    this.timer.node.setPosition(22, 0);
    this.score = createLabel(this.scoreRoot, '', {
      size: 25, width: 215, height: 58, bold: true,
    });
    this.score.node.setPosition(22, 0);
    this.stage = this.createStatus('Stage', 540, new Vec3(0, 370), 22, 52);
    this.lives = this.createStatus('Lives', 285, new Vec3(570, 350), 24);
    this.combo = this.createStatus('Combo', 285, new Vec3(570, 272), 24);
    if (assets) this.setTheme(assets);
    this.stage.node.parent!.active = false;
    this.lives.node.parent!.active = false;
    this.combo.node.parent!.active = false;
  }

  setTheme(assets: ThemeAssets): void {
    spriteLoader.apply(this.timerRoot, assets.hudTimer, 'stretch');
    spriteLoader.apply(this.scoreRoot, assets.hudScore, 'stretch');
    this.scoreIcon.active = Boolean(assets.scoreIcon);
    if (assets.scoreIcon) spriteLoader.apply(this.scoreIcon, assets.scoreIcon, 'contain');
  }

  scoreRewardTarget(): Node {
    return this.scoreIcon;
  }

  showScoreReward(score: number): void {
    const increased = this.renderedScore >= 0 && score > this.renderedScore;
    this.score.string = `\u79ef\u5206\uff1a${score}`;
    this.renderedScore = score;
    if (typeof document !== 'undefined') {
      document.body.dataset.gameScore = String(score);
      document.body.dataset.scoreCoinCommittedScore = String(score);
    }
    if (increased) this.pulseScore();
  }

  render(state: HudState): void {
    const second = Math.ceil(state.seconds);
    if (second !== this.renderedSecond) {
      this.timer.string = `倒计时：${second}秒`;
      this.renderedSecond = second;
    }
    if (state.score !== this.renderedScore) {
      this.score.string = `积分：${state.score}`;
      if (this.renderedScore >= 0 && state.score > this.renderedScore) this.pulseScore();
      this.renderedScore = state.score;
    }
    if (state.stageIndex !== this.renderedStageIndex
      || state.stageTotal !== this.renderedStageTotal
      || state.stageName !== this.renderedStageName) {
      this.stage.string = `第 ${state.stageIndex + 1}/${state.stageTotal} 关 · ${state.stageName}`;
      this.renderedStageIndex = state.stageIndex;
      this.renderedStageTotal = state.stageTotal;
      this.renderedStageName = state.stageName;
    }
    if (state.lives !== this.renderedLives) {
      this.lives.string = `生命：${'♥'.repeat(state.lives)}${'♡'.repeat(Math.max(0, 3 - state.lives))}`;
      this.renderedLives = state.lives;
    }
    if (state.combo !== this.renderedCombo) {
      this.combo.string = `连对：${state.combo}`;
      this.renderedCombo = state.combo;
    }
  }

  private pulseScore(): void {
    Tween.stopAllByTarget(this.scoreIcon);
    this.scoreIcon.setScale(Vec3.ONE);
    tween(this.scoreIcon)
      .to(0.1, { scale: new Vec3(1.2, 1.2, 1) })
      .to(0.14, { scale: Vec3.ONE })
      .start();
  }

  private createStatus(
    name: string, width: number, position: Vec3, size: number, height = 70,
  ): Label {
    const root = createUiNode(this.root, name, width, height, position);
    drawPanel(root, '#102A43', 16, 205);
    return createLabel(root, '', {
      size, width: width - 28, height: height - 12, bold: true,
    });
  }
}
