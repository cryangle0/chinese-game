import { Node } from 'cc';
import { TaskScope } from '../core/lifecycle/TaskScope';
import { CampaignProgress } from '../services/CampaignProgress';
import { GameServices } from '../services/GameServices';
import { GameSession } from '../services/GameSession';
import { RoundTimer } from '../services/RoundTimer';
import { stageOutcome, stageResultActions } from '../services/StageFlow';
import { AppConfig } from '../shared/config/AppConfig';
import { FinishReason, GameId } from '../shared/types/GameTypes';
import { GameTheme } from '../shared/types/Theme';
import { ResultView } from './ResultView';
import { addSettlementHomeChip } from './results/SettlementHomeChip';

export interface StageFlowCallbacks {
  readonly nextQuestion: () => void;
  readonly nextStage: () => void;
  readonly finish: (reason: FinishReason) => void;
  readonly setPlayingVisible: (visible: boolean) => void;
  readonly share?: (title: string, imageUrl?: string) => boolean | Promise<boolean>;
  /** Remount cover / book picker. Stage settlement only. */
  readonly returnHome?: () => void;
}

export class StageResultCoordinator {
  private result: ResultView | null = null;

  constructor(
    private readonly parent: Node,
    private readonly scope: TaskScope,
    private readonly game: GameId,
    private readonly campaign: CampaignProgress<GameTheme>,
    private readonly session: GameSession,
    private readonly timer: RoundTimer,
    private readonly services: GameServices,
    private readonly callbacks: StageFlowCallbacks,
  ) {}

  completeQuestion(): void {
    const outcome = stageOutcome(this.session.answered());
    if (outcome === 'next-question') {
      this.callbacks.nextQuestion();
    } else {
      this.showResult('completed');
    }
  }

  timeoutStage(): void {
    this.showResult('timeout');
  }

  private showResult(reason: FinishReason): void {
    if (this.result) return;
    const theme = this.campaign.current();
    const result = this.session.stageResult(reason);
    this.timer.stop();
    this.services.audio.play('result');
    this.services.analytics.track({
      name: 'scene_result',
      game: this.game,
      properties: {
        scene: theme.id,
        stage: this.campaign.index() + 1,
        score: result.score,
        correct: result.correct,
      },
    });
    if (typeof document !== 'undefined') {
      document.body.dataset.gameView = 'stage-result';
      document.body.dataset.stageResult = theme.id;
      document.body.dataset.stageScore = String(result.score);
      delete document.body.dataset.answerCorrect;
    }
    this.callbacks.setPlayingVisible(false);
    const actions = stageResultActions(this.campaign.isFinal());
    const shareTitle = `${theme.name}：${result.score} 分`;
    if (typeof document !== 'undefined') document.body.dataset.shareTitle = shareTitle;
    this.result = new ResultView(
      this.parent,
      result,
      this.scope.guard(() => this.replayStage()),
      this.scope.guard(() => this.continueCampaign()),
      theme,
      (imageUrl) => {
        return this.callbacks.share?.(shareTitle, imageUrl) ?? false;
      },
      {
        title: reason === 'timeout' ? `${theme.name}时间到` : `${theme.name}场景完成`,
        primaryLabel: actions.replay,
        homeLabel: actions.proceed,
        primaryOnly: false,
      },
    );
    if (this.callbacks.returnHome) {
      addSettlementHomeChip(
        this.result.root,
        this.scope.guard(() => this.returnHome()),
      );
    }
  }

  private returnHome(): void {
    if (!this.result || !this.callbacks.returnHome) return;
    this.services.analytics.track({
      name: 'return_home',
      game: this.game,
      properties: {
        scene: this.campaign.current().id,
        stage: this.campaign.index() + 1,
        pool: 'stage-result',
      },
    });
    this.result.dispose();
    this.result = null;
    if (typeof document !== 'undefined') {
      delete document.body.dataset.stageResult;
      delete document.body.dataset.stageScore;
      delete document.body.dataset.stageHomeChip;
    }
    this.callbacks.returnHome();
  }

  private replayStage(): void {
    if (!this.result) return;
    this.result.dispose();
    this.result = null;
    this.callbacks.setPlayingVisible(true);
    this.session.restartStage();
    this.timer.start(AppConfig.roundSeconds);
    this.resetPlayDataset();
    this.callbacks.nextStage();
  }

  private continueCampaign(): void {
    if (!this.result) return;
    this.result.dispose();
    this.result = null;
    if (this.campaign.isFinal()) {
      this.callbacks.finish('completed');
      return;
    }
    if (!this.campaign.advance()) return;
    this.callbacks.setPlayingVisible(true);
    this.session.resetStage();
    this.timer.start(AppConfig.roundSeconds);
    this.resetPlayDataset();
    this.callbacks.nextStage();
  }

  private resetPlayDataset(): void {
    if (typeof document !== 'undefined') {
      document.body.dataset.gameView = 'play';
      document.body.dataset.gameScore = '0';
      delete document.body.dataset.stageResult;
      delete document.body.dataset.stageScore;
    }
  }
}
