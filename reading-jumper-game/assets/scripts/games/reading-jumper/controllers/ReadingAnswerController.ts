import { Node, tween } from 'cc';
import {
  feedbackDurationMs,
  feedbackHoldMs,
} from '../../../core/media/MotionPlayback';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { RoundTimer } from '../../../services/RoundTimer';
import { ChineseQuestion } from '../../../shared/types/Question';
import { createReadingFeedbackReadyHandler } from '../../../ui/DeepSeaInkEffectView';
import type { ScoreCoinSnapshot } from '../../../ui/ScoreCoinEffectView';
import type { ScoreFlightVisual } from '../../../ui/ScoreCoinDom';
import type { FeedbackPresentationOptions } from '../../../ui/FeedbackView';
import {
  readingFeedbackFrameMs,
  readingFeedbackTimeline,
  ReadingFeedbackTimelineEvent,
  ReadingFeedbackTimelineSpec,
  WRONG_TOP_EFFECT_HOLD_MS,
} from '../config/ReadingFeedbackTimeline';
import { readingLayout } from '../config/ReadingLayout';
import { readingThemes } from '../config/ReadingTheme';
import { readingScoreFeedback } from '../config/ReadingScoreFeedback';
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
    const theme = this.campaign.current();
    const feedbackTimeline = readingFeedbackTimeline(theme.id, correct);
    const scoreVisual = readingScoreFeedback(theme.id, correct);
    const deepSeaWrong = theme.id === 'deep-sea' && !correct;
    this.lastAnswerIndex = index;
    if (typeof document !== 'undefined') {
      document.body.dataset.answerCorrect = String(correct);
      document.body.dataset.scoreCoinFeedbackGate =
        feedbackTimeline && correct
          ? 'timeline-contact'
          : (
            theme.id === 'deep-sea' && !correct
              ? 'scene-effect-and-landing'
              : (correct ? 'arrival-and-landing' : 'terminal-and-landing')
          );
    }
    if (!feedbackTimeline) this.services.audio.play('strike');
    this.trackAnswer(question, correct);
    if (feedbackTimeline && correct) {
      this.view.deer.jumpTo(
        index,
        this.scope.guard(() => this.markTimelineLanding(feedbackTimeline)),
        this.scope.guard(() => {
          this.showTriggerReward(
            theme.id,
            index,
            correct,
            scoreAwarded,
            scoreRewardStart,
            scoreVisual,
          );
          this.startFeedbackTimeline(feedbackTimeline, correct, question);
        }),
      );
      return;
    }
    let landed = false;
    let scoreEffectReady = false;
    let feedbackShown = false;
    const showFeedbackWhenReady = (): void => {
      if (!landed || !scoreEffectReady || feedbackShown) return;
      feedbackShown = true;
      if (feedbackTimeline) {
        this.startFeedbackTimeline(feedbackTimeline, correct, question);
      } else if (deepSeaWrong) {
        this.showDeepSeaWrongFeedback(question);
      } else {
        this.showFeedback(correct, question);
      }
    };
    const onLanding = this.scope.guard(() => {
      landed = true;
      if (feedbackTimeline) this.markTimelineLanding(feedbackTimeline);
      showFeedbackWhenReady();
    });
    const onScoreEffectReady = this.scope.guard(() => {
      scoreEffectReady = true;
      if (!correct && typeof document !== 'undefined') {
        if (deepSeaWrong) {
          document.body.dataset.feedbackSequencePhase = 'scene-ready';
          document.body.dataset.deepSeaInkPopupCompletedAt =
            performance.now().toFixed(1);
        } else {
          document.body.dataset.feedbackSequencePhase = 'terminal-complete';
          document.body.dataset.feedbackSequenceTerminalCompletedAt =
            performance.now().toFixed(1);
        }
      }
      showFeedbackWhenReady();
    });
    this.view.deer.jumpTo(
      index,
      onLanding,
      this.scope.guard(() =>
        this.showTriggerReward(
          theme.id,
          index,
          correct,
          scoreAwarded,
          scoreRewardStart,
          scoreVisual,
          correct ? onScoreEffectReady : undefined,
          correct ? undefined : onScoreEffectReady,
        )),
    );
  }

  private showTriggerReward(
    themeId: string,
    index: number,
    correct: boolean,
    scoreAwarded: number,
    scoreRewardStart: ScoreCoinSnapshot | null,
    visual: ScoreFlightVisual | undefined,
    onFirstArrival?: () => void,
    onTerminalComplete?: () => void,
  ): void {
    this.view.bricks.showResult(index, correct);
    if (themeId === 'deep-sea' && !correct) {
      if (typeof document !== 'undefined') {
        document.body.dataset.deepSeaInkTriggerPhase = 'brick-apex';
        document.body.dataset.scoreCoinFeedbackKind = 'scene-effect';
        document.body.dataset.feedbackSequencePhase = 'terminal';
      }
      this.view.playDeepSeaInkPopup(index, () => onTerminalComplete?.());
      return;
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.scoreCoinTriggerPhase = 'brick-apex';
      document.body.dataset.scoreCoinFeedbackKind = correct ? 'reward' : 'penalty';
      if (!correct) document.body.dataset.feedbackSequencePhase = 'terminal';
    }
    if (!visual && scoreAwarded <= 0) {
      onFirstArrival?.();
      onTerminalComplete?.();
      return;
    }
    if (correct) this.services.audio.play('coin');
    this.view.playScoreReward(
      scoreRewardStart,
      this.session.score(),
      scoreAwarded,
      visual,
      onFirstArrival,
      onTerminalComplete,
    );
  }

  private showFeedback(
    correct: boolean,
    question: ChineseQuestion,
    presentation: FeedbackPresentationOptions = {},
    scheduleCompletion = true,
    playDefaultAudio = true,
    afterFeedbackReady?: () => void,
  ): void {
    const theme = this.campaign.current();
    const message = correct ? question.correctFeedback : question.wrongFeedback;
    const columnX = readingLayout(theme.id).option.columns[this.lastAnswerIndex] ?? 0;
    if (!correct && typeof document !== 'undefined') {
      document.body.dataset.feedbackSequencePhase = 'feedback';
      document.body.dataset.feedbackSequenceFeedbackStartedAt =
        performance.now().toFixed(1);
    }
    if (playDefaultAudio) {
      this.services.audio.play(correct ? 'correct' : 'wrong');
      this.services.audio.play(correct ? 'reward' : 'danger');
      if (typeof document !== 'undefined') {
        document.body.dataset.feedbackAudio = correct ? 'correct' : 'wrong';
      }
    }
    const motionPath = correct ? theme.assets.motion?.correct : theme.assets.motion?.wrong;
    const feedbackReady = this.scope.guard(
      createReadingFeedbackReadyHandler(this.view, afterFeedbackReady),
    );
    this.view.feedback.show(
      correct,
      correct ? theme.assets.feedbackCorrect : theme.assets.feedbackWrong,
      message,
      motionPath,
      columnX,
      presentation,
      {
        onReady: feedbackReady,
        onError: () => {
          if (typeof document !== 'undefined') {
            document.body.dataset.feedbackActorHandoff = 'retained-on-error';
          }
          if (afterFeedbackReady) feedbackReady();
        },
      },
    );
    if (scheduleCompletion) {
      if (correct) {
        const holdSec = feedbackHoldMs(theme.id, true) / 1000;
        tween(this.root).delay(holdSec).call(this.scope.guard(this.complete)).start();
      } else {
        tween(this.root)
          .delay(feedbackDurationMs(theme.id, false) / 1000)
          .call(this.scope.guard(() => this.showWrongTop(theme.id)))
          .delay(WRONG_TOP_EFFECT_HOLD_MS / 1000)
          .call(this.scope.guard(this.complete))
          .start();
      }
    }
  }

  private showDeepSeaWrongFeedback(question: ChineseQuestion): void {
    let sprayStarted = false;
    this.showFeedback(
      false,
      question,
      {
        animateIn: false,
        isolateTimeline: true,
      },
      true,
      true,
      () => {
        if (sprayStarted) return;
        sprayStarted = true;
        if (typeof document !== 'undefined') {
          document.body.dataset.feedbackSequencePhase = 'spray';
          document.body.dataset.deepSeaInkSprayStartedAt =
            performance.now().toFixed(1);
        }
        this.view.playDeepSeaInkSpray(this.scope.guard(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.feedbackSequencePhase = 'terminal-complete';
            document.body.dataset.feedbackSequenceTerminalCompletedAt =
              performance.now().toFixed(1);
          }
        }));
      },
    );
  }

  private startFeedbackTimeline(
    timeline: ReadingFeedbackTimelineSpec,
    correct: boolean,
    question: ChineseQuestion,
  ): void {
    const startedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackTimeline =
        `${timeline.sceneId}:${correct ? 'correct' : 'wrong'}`;
      document.body.dataset.feedbackTimelineT0 = startedAt.toFixed(3);
      document.body.dataset.feedbackTimelineEvents = '';
    }
    timeline.events.forEach((event) => {
      const run = this.scope.guard(() => {
        this.runFeedbackTimelineEvent(
          timeline,
          event,
          correct,
          question,
          startedAt,
        );
      });
      if (event.frame === 0) {
        run();
        return;
      }
      tween(this.root)
        .delay(readingFeedbackFrameMs(event.frame) / 1000)
        .call(run)
        .start();
    });
  }

  private runFeedbackTimelineEvent(
    timeline: ReadingFeedbackTimelineSpec,
    event: ReadingFeedbackTimelineEvent,
    correct: boolean,
    question: ChineseQuestion,
    startedAt: number,
  ): void {
    this.markFeedbackTimelineEvent(event, startedAt);
    switch (event.action) {
      case 'play-correct':
        this.services.audio.play('correct');
        this.markFeedbackAudio('correct', event.frame);
        return;
      case 'play-wrong':
        this.services.audio.play('wrong');
        this.markFeedbackAudio('wrong', event.frame);
        return;
      case 'show-feedback':
        this.showFeedback(
          correct,
          question,
          timeline.presentation,
          false,
          false,
        );
        return;
      case 'show-wrong-top':
        this.showWrongTop(timeline.sceneId);
        return;
      case 'play-reward':
        this.services.audio.play('reward');
        this.markFeedbackAudio('reward', event.frame);
        return;
      case 'play-danger':
        this.services.audio.play('danger');
        this.markFeedbackAudio('danger', event.frame);
        return;
      case 'complete':
        this.complete();
        return;
      case 'mark':
      default:
        return;
    }
  }

  private markFeedbackTimelineEvent(
    event: ReadingFeedbackTimelineEvent,
    startedAt: number,
  ): void {
    if (typeof document === 'undefined') return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const elapsed = now - startedAt;
    document.body.dataset.feedbackTimelinePhase = event.id;
    document.body.dataset.feedbackTimelineFrame = String(event.frame);
    document.body.dataset.feedbackTimelineElapsed = elapsed.toFixed(1);
    const previous = document.body.dataset.feedbackTimelineEvents;
    const entry = `${event.id}@${event.frame}:${elapsed.toFixed(1)}`;
    document.body.dataset.feedbackTimelineEvents = previous ? `${previous}|${entry}` : entry;
  }

  private markFeedbackAudio(name: string, frame: number): void {
    if (typeof document === 'undefined') return;
    const previous = document.body.dataset.feedbackAudio;
    const entry = `${name}@${frame}`;
    document.body.dataset.feedbackAudio = previous ? `${previous}|${entry}` : entry;
  }

  private markTimelineLanding(timeline: ReadingFeedbackTimelineSpec): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.feedbackTimelineLanding = timeline.sceneId;
  }

  private showWrongTop(sceneId: string): void {
    this.view.showWrongFeedbackTop(sceneId);
    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackSequencePhase = 'top';
      document.body.dataset.feedbackSequenceTopStartedAt =
        performance.now().toFixed(1);
    }
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
