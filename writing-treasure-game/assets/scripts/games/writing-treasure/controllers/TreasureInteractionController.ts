import { Node, tween } from 'cc';
import { feedbackHoldMs } from '../../../core/media/MotionPlayback';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { resolveStaticFeedback } from '../../../shared/config/WritingStaticFeedback';
import {
  feedbackPresentation, feedbackSequencePlan, feedbackUsesStageMotion, writingActionTiming,
} from '../../../shared/config/WritingFeedbackPolicy';
import { ChineseQuestion } from '../../../shared/types/Question';
import { GameTheme } from '../../../shared/types/Theme';
import type { ScoreCoinSnapshot } from '../../../ui/ScoreCoinEffectView';
import { TreasureRound } from '../model/TreasureRound';
import { WritingGameView } from '../views/WritingGameView';

/**
 * Answer → run → dig → open/break chest → dug-hole feedback.
 * Same motion for all scenes; correct/wrong play the scene's packaged feedback effect.
 */
export class TreasureInteractionController {
  private selected = -1;
  private correct = false;
  private revealing = false;
  private scoreAwarded = 0;
  private scoreRewardStart: ScoreCoinSnapshot | null = null;

  constructor(
    private readonly root: Node,
    private readonly view: WritingGameView,
    private readonly round: TreasureRound,
    private readonly session: GameSession,
    private readonly services: GameServices,
    private readonly scope: TaskScope,
    private readonly question: () => ChineseQuestion | null,
    private readonly theme: () => GameTheme,
    private readonly complete: () => void,
  ) {}

  reset(): void {
    this.selected = -1;
    this.correct = false;
    this.revealing = false;
    this.scoreAwarded = 0;
    this.scoreRewardStart = null;
    if (typeof document !== 'undefined') {
      delete document.body.dataset.actionReady;
      delete document.body.dataset.actionAttempts;
      delete document.body.dataset.actionStrikes;
      delete document.body.dataset.digEffectActive;
      delete document.body.dataset.digEffectDurationMs;
      delete document.body.dataset.digEffectScene;
      delete document.body.dataset.choiceRevealAsset;
      delete document.body.dataset.choiceRevealIndex;
      delete document.body.dataset.choiceRevealScene;
      delete document.body.dataset.choiceRevealReady;
      delete document.body.dataset.choiceRevealReadyAt;
      delete document.body.dataset.scoreCoinTriggerAt;
    }
    this.view.prompt.hide();
    this.view.books.setVisible(true);
    this.view.deer.root.active = true;
    this.view.deer.idle(true);
  }

  interact(index: number): void {
    if (this.round.acceptAction() || this.revealing) return;
    const question = this.question();
    if (!question || !this.round.acceptAnswer()) return;
    this.selected = index;
    this.view.books.setEnabled(false);
    this.view.books.setVisible(true);
    this.view.prompt.hide();
    const rewardOrigin = this.view.books.scoreRewardOrigin(index);
    this.scoreRewardStart = rewardOrigin
      ? this.view.scoreCoins.capture(rewardOrigin)
      : null;
    const scoreBefore = this.session.score();
    this.correct = this.session.answer(question, index);
    this.scoreAwarded = this.session.score() - scoreBefore;
    this.services.analytics.track({
      name: 'answer',
      game: 'writing-treasure',
      properties: { questionId: question.id, correct: this.correct, scene: this.theme().id },
    });
    const actionTiming = writingActionTiming(this.theme().id);
    if (typeof document !== 'undefined') {
      delete document.body.dataset.actionReady;
      document.body.dataset.digEffectActive = 'playing';
      document.body.dataset.digEffectDurationMs = String(actionTiming.holdMs);
      document.body.dataset.digEffectScene = this.theme().id;
    }
    this.services.audio.play('walk');
    this.scheduleActionImpacts(actionTiming.impactAtMs);
    this.view.deer.castAt(
      this.view.books.columnX(index),
      this.scope.guard(() => {
        void this.openChestThenFeedback();
      }),
      actionTiming.holdMs / 1000,
    );
  }

  private scheduleActionImpacts(impactAtMs: readonly number[]): void {
    let elapsedMs = 0;
    const sequence = tween(this.root);
    impactAtMs.forEach((impactMs) => {
      sequence
        .delay(Math.max(0, impactMs - elapsedMs) / 1000)
        .call(this.scope.guard(() => this.services.audio.play('strike')));
      elapsedMs = impactMs;
    });
    sequence.start();
  }

  private async openChestThenFeedback(): Promise<void> {
    const theme = this.theme();
    const selected = this.selected;
    if (typeof document !== 'undefined') {
      document.body.dataset.digEffectActive = 'opened';
    }
    await this.view.books.reveal(
      this.selected,
      this.correct,
      theme.assets.successState,
      theme.assets.failState,
      false,
      theme.assets.choices,
      theme.id,
      theme.assets.successStates,
      theme.assets.failStates,
    );
    if (!this.scope.isActive() || selected !== this.selected) return;
    if (theme.id === 'magic') this.services.audio.play('reveal');
    else if (this.correct) this.services.audio.play('unlock');
    this.view.books.pulse(this.selected, 1.12);
    const source = this.scoreRewardStart;
    this.scoreRewardStart = null;
    let feedbackDelayComplete = false;
    let rewardArrived = this.scoreAwarded <= 0 || !source;
    let feedbackShown = false;
    const showFeedbackWhenReady = (): void => {
      if (!feedbackDelayComplete || !rewardArrived || feedbackShown) return;
      feedbackShown = true;
      this.showFeedback();
    };
    const onRewardArrival = this.scope.guard(() => {
      rewardArrived = true;
      showFeedbackWhenReady();
    });
    if (this.scoreAwarded > 0) {
      this.services.audio.play('coin');
      const score = this.session.score();
      if (typeof document !== 'undefined') {
        document.body.dataset.scoreCoinTriggerPhase = 'chest-open';
        document.body.dataset.scoreCoinFeedbackGate = 'arrival-and-chest-open';
        document.body.dataset.scoreCoinTriggerAt = (
          typeof performance !== 'undefined' ? performance.now() : Date.now()
        ).toFixed(3);
      }
      if (!source) {
        this.view.hud.showScoreReward(score);
      } else {
        this.view.scoreCoins.play({
          source,
          target: { node: this.view.hud.scoreRewardTarget() },
          awarded: this.scoreAwarded,
          onFirstArrival: () => {
            this.view.hud.showScoreReward(score);
            onRewardArrival();
          },
        });
      }
    }
    tween(this.root)
      .delay(0.2)
      .call(() => this.view.books.pulse(this.selected, 1.06))
      .delay(0.35)
      .call(this.scope.guard(() => {
        feedbackDelayComplete = true;
        showFeedbackWhenReady();
      }))
      .start();
  }

  private showFeedback(): void {
    if (this.revealing) return;
    this.revealing = true;
    const question = this.question();
    if (!question) return;
    const theme = this.theme();
    const presentation = feedbackPresentation(theme.id, this.correct);
    const staticFeedback = presentation === 'hybrid'
      ? resolveStaticFeedback(theme.id, this.correct)
      : undefined;
    const sequencePlan = feedbackSequencePlan(theme.id, this.correct);
    const useStageMotion = feedbackUsesStageMotion(theme.id, this.correct);
    this.round.completeAction();
    this.view.prompt.hide();
    this.view.books.setEnabled(false);
    this.services.audio.play(this.correct ? 'correct' : 'wrong');
    const motionPath = this.correct
      ? theme.assets.motion?.correct
      : theme.assets.motion?.wrong;
    if (typeof document !== 'undefined') {
      document.body.dataset.answerCorrect = String(this.correct);
      document.body.dataset.feedbackMode = staticFeedback && motionPath
        ? 'hybrid'
        : (motionPath ? 'motion' : 'fallback');
      document.body.dataset.feedbackColumn = String(this.selected);
      document.body.dataset.feedbackAudio = this.correct ? 'correct' : 'wrong';
      document.body.dataset.feedbackScene = theme.id;
    }
    this.view.feedback.show(
      this.correct,
      this.correct ? theme.assets.feedbackCorrect : theme.assets.feedbackWrong,
      this.correct ? question.correctFeedback : question.wrongFeedback,
      motionPath,
      staticFeedback,
      theme.assets.background,
      this.selected,
      sequencePlan,
      useStageMotion,
      theme.id,
      {
        onReady: this.scope.guard(() => {
          this.view.deer.hide();
          if (typeof document !== 'undefined') {
            document.body.dataset.feedbackActorHandoff = 'feedback-ready';
          }
        }),
        onError: () => {
          if (typeof document !== 'undefined') {
            document.body.dataset.feedbackActorHandoff = 'retained-on-error';
          }
        },
      },
    );
    const holdSec = feedbackHoldMs(theme.id, this.correct) / 1000;
    tween(this.root).delay(holdSec).call(this.scope.guard(this.complete)).start();
  }
}
