import { Node, tween } from 'cc';
import { feedbackHoldMs } from '../../../core/media/MotionPlayback';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { RoundTimer } from '../../../services/RoundTimer';
import { ChineseQuestion } from '../../../shared/types/Question';
import type { ScoreCoinSnapshot } from '../../../ui/ScoreCoinEffectView';
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
    const scoreRewardStart = this.view.captureScoreRewardOrigin(index);
    const scoreBefore = this.session.score();
    const correct = this.session.answer(question, index);
    const scoreAwarded = this.session.score() - scoreBefore;
    this.lastAnswerIndex = index;
    if (typeof document !== 'undefined') {
      document.body.dataset.answerCorrect = String(correct);
      document.body.dataset.scoreCoinFeedbackGate =
        scoreAwarded > 0 ? 'arrival-and-landing' : 'landing';
    }
    this.services.audio.play('strike');
    this.trackAnswer(question, correct);
    let landed = false;
    let rewardArrived = scoreAwarded <= 0;
    let feedbackShown = false;
    const showFeedbackWhenReady = (): void => {
      if (!landed || !rewardArrived || feedbackShown) return;
      feedbackShown = true;
      this.showFeedback(correct, question);
    };
    const onLanding = this.scope.guard(() => {
      landed = true;
      showFeedbackWhenReady();
    });
    const onRewardArrival = this.scope.guard(() => {
      rewardArrived = true;
      showFeedbackWhenReady();
    });
    this.view.deer.jumpTo(
      index,
      onLanding,
      this.scope.guard(() =>
        this.showTriggerReward(
          index,
          correct,
          scoreAwarded,
          scoreRewardStart,
          onRewardArrival,
        )),
    );
  }

  private showTriggerReward(
    index: number,
    correct: boolean,
    scoreAwarded: number,
    scoreRewardStart: ScoreCoinSnapshot | null,
    onRewardArrival: () => void,
  ): void {
    this.view.bricks.showResult(index, correct);
    if (scoreAwarded <= 0) return;
    this.services.audio.play('coin');
    if (typeof document !== 'undefined') {
      document.body.dataset.scoreCoinTriggerPhase = 'brick-apex';
    }
    this.view.playScoreReward(
      scoreRewardStart,
      this.session.score(),
      scoreAwarded,
      onRewardArrival,
    );
  }

  private showFeedback(
    correct: boolean,
    question: ChineseQuestion,
  ): void {
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
