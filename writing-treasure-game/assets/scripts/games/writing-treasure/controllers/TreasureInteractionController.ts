import { Node, tween } from 'cc';
import { feedbackHoldMs } from '../../../core/media/MotionPlayback';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { resolveStaticFeedback } from '../../../shared/config/WritingStaticFeedback';
import {
  feedbackPresentation, feedbackSequencePlan, feedbackUsesStageMotion,
} from '../../../shared/config/WritingFeedbackPolicy';
import { ChineseQuestion } from '../../../shared/types/Question';
import { GameTheme } from '../../../shared/types/Theme';
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
    if (typeof document !== 'undefined') {
      delete document.body.dataset.actionReady;
      delete document.body.dataset.actionAttempts;
      delete document.body.dataset.actionStrikes;
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
    this.correct = this.session.answer(question, index);
    this.services.analytics.track({
      name: 'answer',
      game: 'writing-treasure',
      properties: { questionId: question.id, correct: this.correct, scene: this.theme().id },
    });
    if (typeof document !== 'undefined') delete document.body.dataset.actionReady;
    this.services.audio.play('walk');
    tween(this.root)
      .delay(0.28)
      .call(() => this.services.audio.play('strike'))
      .start();
    this.view.deer.castAt(
      this.view.books.columnX(index),
      this.scope.guard(() => this.afterDig()),
      0.9,
    );
  }

  private afterDig(): void {
    this.services.audio.play('strike');
    this.view.deer.strike(this.scope.guard(() => {
      this.services.audio.play('strike');
      this.view.deer.strike(this.scope.guard(() => this.openChestThenFeedback()));
    }));
  }

  private openChestThenFeedback(): void {
    const theme = this.theme();
    this.view.books.reveal(
      this.selected,
      this.correct,
      theme.assets.successState,
      theme.assets.failState,
      false,
      theme.assets.choices,
      theme.id,
    );
    if (theme.id === 'magic') this.services.audio.play('reveal');
    else if (this.correct) this.services.audio.play('unlock');
    this.view.books.pulse(this.selected, 1.12);
    tween(this.root)
      .delay(0.2)
      .call(() => this.view.books.pulse(this.selected, 1.06))
      .delay(0.35)
      .call(this.scope.guard(() => this.showFeedback()))
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
    this.view.deer.hide();
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
    );
    const holdSec = feedbackHoldMs(theme.id, this.correct) / 1000;
    tween(this.root).delay(holdSec).call(this.scope.guard(this.complete)).start();
  }
}
