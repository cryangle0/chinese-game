import { Node, tween } from 'cc';
import { feedbackHoldMs } from '../../../core/media/MotionPlayback';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { RoundTimer } from '../../../services/RoundTimer';
import { ChineseQuestion } from '../../../shared/types/Question';
import { readingLayout } from '../config/ReadingLayout';
import { readingThemes } from '../config/ReadingTheme';
import { ReadingRound } from '../model/ReadingRound';
import { ReadingGameView } from '../views/ReadingGameView';
import { ReadingMotionController } from './ReadingMotionController';

export class ReadingAnswerController {
  private lastAnswerIndex = 0;

  constructor(
    private readonly root: Node,
    private readonly scope: TaskScope,
    private readonly round: ReadingRound,
    private readonly timer: RoundTimer,
    private readonly session: GameSession,
    private readonly services: GameServices,
    private readonly campaign: CampaignProgress<(typeof readingThemes)[number]>,
    private readonly view: ReadingGameView,
    private readonly motion: ReadingMotionController,
    private readonly complete: () => void,
  ) {}

  choose(index: number, question: ChineseQuestion | null): void {
    if (!question || !this.round.acceptAnswer()) return;
    if (typeof document !== 'undefined') delete document.body.dataset.answerReady;
    this.timer.pause();
    this.motion.setAnswerEnabled(false);
    this.view.bricks.setEnabled(false);
    const correct = this.session.answer(question, index);
    this.lastAnswerIndex = index;
    if (typeof document !== 'undefined') {
      document.body.dataset.answerCorrect = String(correct);
    }
    this.services.audio.play('strike');
    this.trackAnswer(question, correct);
    this.view.deer.jumpTo(
      index,
      this.scope.guard(() => this.showFeedback(correct, question)),
      this.scope.guard(() => this.view.bricks.showResult(index, correct)),
    );
  }

  private showFeedback(correct: boolean, question: ChineseQuestion): void {
    const theme = this.campaign.current();
    const message = correct ? question.correctFeedback : question.wrongFeedback;
    const columnX = readingLayout(theme.id).option.columns[this.lastAnswerIndex] ?? 0;
    this.services.audio.play(correct ? 'correct' : 'wrong');
    this.services.audio.play(correct ? 'reward' : 'danger');
    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackAudio = correct ? 'correct' : 'wrong';
    }
    this.view.setFeedbackVisible(true);
    this.view.feedback.show(
      correct,
      correct ? theme.assets.feedbackCorrect : theme.assets.feedbackWrong,
      message,
      correct ? theme.assets.motion?.correct : theme.assets.motion?.wrong,
      columnX,
    );
    const holdSec = feedbackHoldMs(theme.id, correct) / 1000;
    tween(this.root).delay(holdSec).call(this.scope.guard(this.complete)).start();
  }

  private trackAnswer(question: ChineseQuestion, correct: boolean): void {
    this.services.analytics.track({
      name: 'answer',
      game: 'reading-jumper',
      properties: {
        questionId: question.id,
        correct,
        scene: this.campaign.current().id,
      },
    });
  }
}
