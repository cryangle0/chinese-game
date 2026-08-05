import { Node, tween } from 'cc';
import { feedbackHoldMs } from '../../../core/media/MotionPlayback';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { CLASSIC_TREASURE_FEEDBACK } from '../../../shared/config/ClassicTreasureFeedback';
import { DESERT_TREASURE_FEEDBACK } from '../../../shared/config/DesertTreasureFeedback';
import { DINOSAUR_TREASURE_FEEDBACK } from '../../../shared/config/DinosaurTreasureFeedback';
import { DUNHUANG_TREASURE_FEEDBACK } from '../../../shared/config/DunhuangTreasureFeedback';
import { MAGIC_ACADEMY_FEEDBACK } from '../../../shared/config/MagicAcademyFeedback';
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
    this.view.hideClassicTreasureEffect();
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
      delete document.body.dataset.classicTreasureSequence;
      delete document.body.dataset.classicTreasureSelected;
      delete document.body.dataset.classicTreasureOptionIndex;
      delete document.body.dataset.classicTreasureOptionPhase;
      delete document.body.dataset.classicTreasureOptionY;
      delete document.body.dataset.classicTreasureOptionLabel;
      delete document.body.dataset.classicTreasureHolePhase;
      delete document.body.dataset.classicTreasureHoleIndex;
      delete document.body.dataset.classicTreasureHoleX;
      delete document.body.dataset.classicTreasureHoleScale;
      delete document.body.dataset.classicTreasureActorPhase;
      delete document.body.dataset.classicTreasureActorStartY;
      delete document.body.dataset.classicTreasureActorTargetY;
      delete document.body.dataset.classicTreasureActorLaunchApexY;
      delete document.body.dataset.classicTreasureActorLandingX;
      delete document.body.dataset.classicTreasureActorLandingY;
      delete document.body.dataset.desertTreasureSequence;
      delete document.body.dataset.desertTreasureSelected;
      delete document.body.dataset.desertTreasureOptionIndex;
      delete document.body.dataset.desertTreasureOptionPhase;
      delete document.body.dataset.desertTreasureOptionY;
      delete document.body.dataset.desertTreasureOptionLabel;
      delete document.body.dataset.desertTreasureChoice;
      delete document.body.dataset.desertTreasureSarcophagusAsset;
      delete document.body.dataset.desertTreasureSarcophagusIndex;
      delete document.body.dataset.desertTreasureSarcophagusPhase;
      delete document.body.dataset.desertTreasureSarcophagusY;
      delete document.body.dataset.desertTreasureHolePhase;
      delete document.body.dataset.desertTreasureHoleIndex;
      delete document.body.dataset.desertTreasureHoleX;
      delete document.body.dataset.desertTreasureHoleScale;
      delete document.body.dataset.desertTreasureActorPhase;
      delete document.body.dataset.desertTreasureActorStartY;
      delete document.body.dataset.desertTreasureActorTargetY;
      delete document.body.dataset.dinosaurTreasureSequence;
      delete document.body.dataset.dinosaurTreasureSelected;
      delete document.body.dataset.dinosaurTreasureOptionIndex;
      delete document.body.dataset.dinosaurTreasureOptionPhase;
      delete document.body.dataset.dinosaurTreasureOptionLabel;
      delete document.body.dataset.dinosaurTreasureEgg;
      delete document.body.dataset.dinosaurTreasureActorPhase;
      delete document.body.dataset.dinosaurTreasureActorStartY;
      delete document.body.dataset.dinosaurTreasureActorApexY;
      delete document.body.dataset.dinosaurTreasureActorTargetY;
      delete document.body.dataset.dinosaurTreasureActorStartX;
      delete document.body.dataset.dinosaurTreasureActorTargetX;
      delete document.body.dataset.dinosaurTreasureActorChaseDurationMs;
      delete document.body.dataset.dinosaurTreasureActorChaseColumnX;
      delete document.body.dataset.dinosaurTreasureActorReturnStartX;
      delete document.body.dataset.dinosaurTreasureActorReturnTargetX;
      delete document.body.dataset.dinosaurTreasureActorReturnDurationMs;
      delete document.body.dataset.dunhuangTreasureSequence;
      delete document.body.dataset.dunhuangTreasureBreakPhase;
      delete document.body.dataset.dunhuangTreasureBreakIndex;
      delete document.body.dataset.dunhuangTreasureBreakX;
      delete document.body.dataset.dunhuangTreasureFragmentCount;
      delete document.body.dataset.dunhuangTreasureOptionLabel;
      delete document.body.dataset.dunhuangTreasureOptionPhase;
      delete document.body.dataset.dunhuangTreasureWrongActorPhase;
      delete document.body.dataset.dunhuangTreasureWrongActorStartY;
      delete document.body.dataset.dunhuangTreasureWrongActorTargetY;
      delete document.body.dataset.dunhuangTreasureWrongActorFinalY;
      delete document.body.dataset.dunhuangTreasureWrongActorAsset;
      delete document.body.dataset.magicAcademySequence;
      delete document.body.dataset.magicAcademySelected;
      delete document.body.dataset.magicAcademyBreakPhase;
      delete document.body.dataset.magicAcademyBreakIndex;
      delete document.body.dataset.magicAcademyBreakX;
      delete document.body.dataset.magicAcademyFragmentCount;
      delete document.body.dataset.magicAcademyOptionIndex;
      delete document.body.dataset.magicAcademyOptionLabel;
      delete document.body.dataset.magicAcademyOptionPhase;
      delete document.body.dataset.magicAcademyBookState;
      delete document.body.dataset.magicAcademyBookAsset;
      delete document.body.dataset.magicAcademyBookReady;
      delete document.body.dataset.magicAcademyActorPhase;
      delete document.body.dataset.magicAcademyActorStartY;
      delete document.body.dataset.magicAcademyActorTargetY;
      delete document.body.dataset.magicAcademyActorAsset;
      delete document.body.dataset.magicAcademyActorLandingX;
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
    const theme = this.theme();
    this.services.analytics.track({
      name: 'answer',
      game: 'writing-treasure',
      properties: { questionId: question.id, correct: this.correct, scene: theme.id },
    });
    const actionTiming = writingActionTiming(theme.id);
    if (typeof document !== 'undefined') {
      delete document.body.dataset.actionReady;
      document.body.dataset.digEffectActive = 'playing';
      document.body.dataset.digEffectDurationMs = String(actionTiming.holdMs);
      document.body.dataset.digEffectScene = theme.id;
      if (theme.id === 'treasure') {
        document.body.dataset.classicTreasureSequence =
          this.correct ? 'correct-digging' : 'wrong-digging';
        document.body.dataset.classicTreasureSelected = String(index);
      } else if (theme.id === 'desert') {
        document.body.dataset.desertTreasureSequence =
          this.correct ? 'correct-digging' : 'wrong-digging';
        document.body.dataset.desertTreasureSelected = String(index);
      } else if (theme.id === 'dinosaur') {
        document.body.dataset.dinosaurTreasureSequence =
          this.correct ? 'correct-striking-ground' : 'wrong-striking-ground';
        document.body.dataset.dinosaurTreasureSelected = String(index);
      } else if (theme.id === 'magic') {
        document.body.dataset.magicAcademySequence =
          this.correct ? 'correct-casting' : 'wrong-casting';
        document.body.dataset.magicAcademySelected = String(index);
      }
    }
    this.services.audio.play('walk');
    const usesSceneDig = theme.id === 'treasure'
      || theme.id === 'desert';
    const startsActionEffects = usesSceneDig
      || theme.id === 'dunhuang'
      || theme.id === 'dinosaur'
      || theme.id === 'magic';
    const startSceneDig = this.scope.guard(() => {
      this.scheduleActionImpacts(actionTiming.impactAtMs);
      if (theme.id === 'treasure') {
        this.view.playClassicTreasureDig(
          index,
          actionTiming.holdMs,
          actionTiming.impactAtMs,
          this.correct,
        );
        return;
      }
      if (theme.id === 'desert') {
        this.view.playDesertTreasureDig(index, actionTiming.impactAtMs);
        return;
      }
      if (theme.id === 'dunhuang') {
        this.markDunhuangSequence(
          this.correct ? 'casting-at-wall' : 'wrong-casting-at-wall',
        );
        this.view.playDunhuangTreasureCast(index, actionTiming.impactAtMs);
        return;
      }
      if (theme.id === 'dinosaur') {
        this.markDinosaurSequence(
          this.correct ? 'striking-ground' : 'wrong-striking-ground',
        );
        return;
      }
      if (theme.id === 'magic') {
        this.markMagicAcademySequence(
          this.correct ? 'casting-at-top-bricks' : 'wrong-casting-at-top-bricks',
        );
        this.view.playMagicAcademyCast(index);
      }
    });
    if (!startsActionEffects) this.scheduleActionImpacts(actionTiming.impactAtMs);
    this.view.deer.castAt(
      this.view.books.columnX(index),
      this.scope.guard(() => {
        void this.openChestThenFeedback();
      }),
      actionTiming.holdMs / 1000,
      startsActionEffects ? startSceneDig : undefined,
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
    if (theme.id === 'treasure') {
      await this.openClassicTreasureFeedback(theme, selected);
      return;
    }
    if (theme.id === 'desert') {
      if (this.correct) await this.openDesertTreasureCorrect(theme, selected);
      else await this.openDesertTreasureWrong(selected);
      return;
    }
    if (theme.id === 'dunhuang') {
      if (this.correct) await this.openDunhuangTreasureCorrect(theme, selected);
      else await this.openDunhuangTreasureWrong(theme, selected);
      return;
    }
    if (theme.id === 'dinosaur') {
      if (this.correct) await this.openDinosaurTreasureCorrect(selected);
      else await this.openDinosaurTreasureWrong(selected);
      return;
    }
    if (theme.id === 'magic') {
      if (this.correct) await this.openMagicAcademyCorrect(selected);
      else await this.openMagicAcademyWrong(selected);
      return;
    }
    await this.revealSelectedChoice(theme, selected, this.correct);
    if (!this.scope.isActive() || selected !== this.selected) return;
    if (theme.id === 'magic') this.services.audio.play('reveal');
    else if (this.correct) this.services.audio.play('unlock');
    this.view.books.pulse(this.selected, 1.12);
    let feedbackDelayComplete = false;
    let rewardArrived = this.scoreAwarded <= 0 || !this.scoreRewardStart;
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
    this.playScoreReward('arrival-and-chest-open', onRewardArrival);
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

  private async openDunhuangTreasureCorrect(
    theme: GameTheme,
    selected: number,
  ): Promise<void> {
    this.markDunhuangSequence('wall-breaking');
    await Promise.all([
      this.view.breakDunhuangTreasureWall(selected),
      this.view.dropDunhuangTreasureActor(selected),
    ]);
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    this.markDunhuangSequence('rubble-at-cavity-bottom');
    await this.revealSelectedChoice(theme, selected, true);
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    this.services.audio.play('unlock');
    this.view.books.pulse(selected, 1.08);
    this.markDunhuangSequence('lotus-effect-visible');
    tween(this.root)
      .delay(DUNHUANG_TREASURE_FEEDBACK.lotusLeadMs / 1000)
      .call(this.scope.guard(() => {
        if (selected !== this.selected || !this.correct) return;
        this.markDunhuangSequence('character-rising');
        this.showFeedback();
      }))
      .start();
    tween(this.root)
      .delay(DUNHUANG_TREASURE_FEEDBACK.scoreCoinDelayMs / 1000)
      .call(this.scope.guard(() => {
        this.playScoreReward('independent-dunhuang-feedback');
      }))
      .start();
  }

  private async openDunhuangTreasureWrong(
    theme: GameTheme,
    selected: number,
  ): Promise<void> {
    this.markDunhuangSequence('wrong-cavity-opening');
    await this.view.openDunhuangTreasureWrongCavity(selected);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markDunhuangSequence('wrong-actor-descending');
    await this.view.dropDunhuangTreasureWrongActor(selected);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markDunhuangSequence('wrong-floor-impact');
    this.services.audio.play('strike');
    this.services.audio.play('wrong');
    let actorLift: Promise<void> = Promise.resolve();
    let choiceReveal: Promise<void> = Promise.resolve();
    await new Promise<void>((resolve) => {
      this.view.playDunhuangTreasureWrongEffect(selected, {
        onLiftStart: () => {
          if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
          this.markDunhuangSequence('wrong-tornado-lifting-character');
          actorLift = this.view.liftDunhuangTreasureWrongActor(selected);
        },
        onReveal: () => {
          if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
          this.markDunhuangSequence('wrong-lotus-revealing');
          choiceReveal = this.revealSelectedChoice(theme, selected, false);
        },
        onComplete: resolve,
      });
    });
    await Promise.all([actorLift, choiceReveal]);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.view.books.pulse(selected, 1.08);
    this.markDunhuangSequence('wrong-final-state');
    this.showFeedback(true, true);
  }

  private async openMagicAcademyCorrect(
    selected: number,
  ): Promise<void> {
    this.markMagicAcademySequence('top-bricks-breaking');
    await Promise.all([
      this.view.openMagicAcademyCavity(selected),
      this.view.dropMagicAcademyActor(selected),
    ]);
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    this.markMagicAcademySequence('actor-standing-on-locked-book');
    this.services.audio.play('unlock');
    let actorRise: Promise<void> = Promise.resolve();
    await this.view.unlockMagicAcademyBook(selected, () => {
      if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
      this.markMagicAcademySequence('book-open-actor-rising');
      this.services.audio.play('reveal');
      this.services.audio.play('correct');
      actorRise = this.view.riseMagicAcademyActor(selected);
      tween(this.root)
        .delay(MAGIC_ACADEMY_FEEDBACK.scoreCoinDelayMs / 1000)
        .call(this.scope.guard(() => {
          this.playScoreReward('magic-open-book');
        }))
        .start();
    });
    await actorRise;
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    this.markMagicAcademySequence('correct-hovering-over-open-book');
    this.showFeedback(
      true,
      true,
      MAGIC_ACADEMY_FEEDBACK.correctCompletionTailMs,
    );
  }

  private async openMagicAcademyWrong(
    selected: number,
  ): Promise<void> {
    this.scoreRewardStart = null;
    this.view.prepareMagicAcademyWrongActor(selected);
    this.markMagicAcademySequence('wrong-top-bricks-breaking');
    await Promise.all([
      this.view.openMagicAcademyCavity(selected),
      this.view.dropMagicAcademyActor(selected, true),
    ]);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markMagicAcademySequence('wrong-actor-seated-on-locked-book');
    let wrongBook: Promise<void> = Promise.resolve();
    let actorLaunch: Promise<void> = Promise.resolve();
    await new Promise<void>((resolve) => {
      this.view.playClassicTreasureExplosion(selected, {
        onStart: () => {
          if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
          this.markMagicAcademySequence('wrong-book-explosion-started');
          this.services.audio.play('strike');
        },
        onBurst: () => {
          if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
          this.markMagicAcademySequence('wrong-book-charred-actor-blasted-out');
          this.services.audio.play('wrong');
          wrongBook = this.view.showMagicAcademyWrongBook(selected);
          actorLaunch = this.view.launchMagicAcademyWrongActor(selected);
        },
        onComplete: resolve,
      });
    });
    await Promise.all([wrongBook, actorLaunch]);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markMagicAcademySequence('wrong-actor-landed-seated-outside-cavity');
    this.showFeedback(
      true,
      true,
      MAGIC_ACADEMY_FEEDBACK.wrongCompletionTailMs,
    );
  }

  private async openDinosaurTreasureCorrect(
    selected: number,
  ): Promise<void> {
    this.scoreRewardStart = null;
    this.markDinosaurSequence('selected-cavity-opening');
    this.view.prepareDinosaurTreasureCorrect(selected);
    this.markDinosaurSequence('actor-jumping-into-pit');
    await this.view.jumpDinosaurTreasureActor(selected);
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    this.view.deer.hide();
    this.markDinosaurSequence('hatching-sequence');
    await new Promise<void>((resolve) => {
      let hatchHandled = false;
      this.view.playDinosaurTreasureCorrect(selected, {
        onHatch: (source) => {
          if (
            hatchHandled
            || !this.scope.isActive()
            || selected !== this.selected
            || !this.correct
          ) return;
          hatchHandled = true;
          this.scoreRewardStart = source;
          this.services.audio.play('unlock');
          this.services.audio.play('correct');
          this.markDinosaurSequence('hatchling-visible-and-score-flying');
          this.playScoreReward('dinosaur-hatchling-head');
        },
        onComplete: resolve,
      });
    });
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    this.markDinosaurSequence('final-embrace-held');
    this.showFeedback(
      true,
      true,
      DINOSAUR_TREASURE_FEEDBACK.completionTailMs,
    );
  }

  private async openDinosaurTreasureWrong(
    selected: number,
  ): Promise<void> {
    this.scoreRewardStart = null;
    this.markDinosaurSequence('wrong-selected-cavity-opening');
    this.view.prepareDinosaurTreasureWrong(selected);
    this.markDinosaurSequence('wrong-actor-jumping-into-pit');
    await this.view.jumpDinosaurTreasureWrongActor(selected);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markDinosaurSequence('wrong-actor-watching-rocking-egg');
    await this.view.watchDinosaurTreasureWrongEgg(selected);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.view.hideDinosaurTreasureWrongEgg(selected);
    this.services.audio.play('strike');
    this.markDinosaurSequence('wrong-hatchling-breaking-shell');
    let actorEscape: Promise<void> = Promise.resolve();
    await new Promise<void>((resolve) => {
      let actorEscapeStarted = false;
      this.view.playDinosaurTreasureWrong(selected, {
        onActorEscape: () => {
          if (
            actorEscapeStarted
            || !this.scope.isActive()
            || selected !== this.selected
            || this.correct
          ) return;
          actorEscapeStarted = true;
          this.markDinosaurSequence('wrong-startled-actor-escaping-first');
          this.services.audio.play('walk');
          actorEscape = this.view.escapeDinosaurTreasureWrongActor(selected);
        },
        onDinosaurJump: () => {
          if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
          this.markDinosaurSequence('wrong-hatchling-jumping-out-after-actor');
        },
        onComplete: resolve,
      });
    });
    await actorEscape;
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.services.audio.play('wrong');
    this.markDinosaurSequence('wrong-same-hatchling-live-chase');
    await Promise.all([
      this.view.chaseDinosaurTreasureWrongActor(selected),
      this.view.playDinosaurTreasureWrongChase(selected),
    ]);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markDinosaurSequence('wrong-actor-and-hatchling-exited-right');
    await this.view.returnDinosaurTreasureWrongActor(selected);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markDinosaurSequence('wrong-actor-returned-to-selected-option');
    this.showFeedback(
      true,
      true,
      DINOSAUR_TREASURE_FEEDBACK.wrongCompletionTailMs,
    );
  }

  private async openDesertTreasureCorrect(
    theme: GameTheme,
    selected: number,
  ): Promise<void> {
    this.view.books.hideDesertTreasureHole();
    this.markDesertSequence('actor-and-option-dropping');
    await Promise.all([
      this.view.dropDesertTreasureOption(selected),
      this.view.dropDesertTreasureActor(selected),
    ]);
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    this.markDesertSequence('actor-on-chest');
    await new Promise<void>((resolve) => {
      tween(this.root)
        .delay(DESERT_TREASURE_FEEDBACK.actorChestHoldMs / 1000)
        .call(() => resolve())
        .start();
    });
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    await this.revealSelectedChoice(theme, selected, true);
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    this.services.audio.play('unlock');
    this.view.books.pulse(selected, 1.12);
    this.markDesertSequence('chest-open-and-reward');
    this.view.playDesertTreasureReward(selected);
    tween(this.root)
      .delay(DESERT_TREASURE_FEEDBACK.correctJumpDelayMs / 1000)
      .call(this.scope.guard(() => {
        if (selected !== this.selected || !this.correct) return;
        this.markDesertSequence('happy-jump');
        this.showFeedback();
      }))
      .start();
    tween(this.root)
      .delay(0.2)
      .call(this.scope.guard(() => this.view.books.pulse(selected, 1.06)))
      .delay(Math.max(
        0,
        DESERT_TREASURE_FEEDBACK.scoreCoinDelayMs / 1000 - 0.2,
      ))
      .call(this.scope.guard(() => {
        this.playScoreReward('independent-desert-feedback');
      }))
      .start();
  }

  private async openDesertTreasureWrong(
    selected: number,
  ): Promise<void> {
    this.view.books.showDesertTreasureCavity(selected);
    this.markDesertSequence('wrong-cavity-open');
    this.markDesertSequence('wrong-sarcophagus-rendering');
    await this.view.prepareDesertWrongSarcophagus(selected);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.services.audio.play('unlock');
    this.markDesertSequence(
      'actor-option-and-sarcophagus-dropping-to-pit-bottom',
    );
    await Promise.all([
      this.view.dropDesertTreasureOption(selected),
      this.view.dropDesertWrongSarcophagus(selected),
      this.view.dropDesertWrongActor(selected),
    ]);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markDesertSequence('actor-and-sarcophagus-at-pit-bottom');
    await new Promise<void>((resolve) => {
      tween(this.root)
        .delay(DESERT_TREASURE_FEEDBACK.wrongChestHoldMs / 1000)
        .call(() => resolve())
        .start();
    });
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markDesertSequence('sand-burial');
    let handedOff = false;
    this.view.playDesertTreasureBurial(
      selected,
      this.scope.guard(() => {
        if (handedOff || selected !== this.selected || this.correct) return;
        handedOff = true;
        this.view.books.hideDesertTreasureChoice(selected);
        this.view.deer.hide();
        this.markDesertSequence('buried-feedback');
        this.showFeedback();
      }),
    );
  }

  private async openClassicTreasureFeedback(
    theme: GameTheme,
    selected: number,
  ): Promise<void> {
    this.view.books.hideClassicTreasureHole();
    this.markClassicSequence('option-sinking');
    await this.view.sinkClassicTreasureOption(selected);
    if (!this.scope.isActive() || selected !== this.selected) return;
    if (this.correct) {
      await this.openClassicTreasureCorrect(theme, selected);
      return;
    }
    this.playScoreReward('independent-classic-feedback');
    this.markClassicSequence('actor-sinking');
    await this.view.sinkClassicTreasureActor(selected);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.markClassicSequence('explosion-playing');
    let actorLaunch: Promise<void> | null = null;
    this.view.playClassicTreasureExplosion(selected, {
      onStart: this.scope.guard(() => {
        if (selected !== this.selected || this.correct) return;
        this.markClassicSequence('actor-launch');
        actorLaunch = this.view.launchClassicTreasureActor(selected);
      }),
      onBurst: this.scope.guard(() => {
        if (selected !== this.selected || this.correct) return;
        const launch = actorLaunch
          ?? this.view.launchClassicTreasureActor(selected);
        void this.revealClassicTreasureWrong(theme, selected, launch);
      }),
    });
  }

  private async openClassicTreasureCorrect(
    theme: GameTheme,
    selected: number,
  ): Promise<void> {
    this.markClassicSequence('chest-opening');
    await this.revealSelectedChoice(theme, selected, true, false);
    if (!this.scope.isActive() || selected !== this.selected || !this.correct) return;
    this.services.audio.play('unlock');
    this.view.books.pulse(selected, 1.12);
    this.markClassicSequence('reward-and-jump');
    this.showFeedback();
    tween(this.root)
      .delay(CLASSIC_TREASURE_FEEDBACK.correctRewardDelayMs / 1000)
      .call(this.scope.guard(() => {
        this.view.playClassicTreasureReward(selected);
      }))
      .start();
    tween(this.root)
      .delay(0.2)
      .call(this.scope.guard(() => this.view.books.pulse(selected, 1.06)))
      .delay(Math.max(
        0,
        CLASSIC_TREASURE_FEEDBACK.scoreCoinDelayMs / 1000 - 0.2,
      ))
      .call(this.scope.guard(() => {
        this.playScoreReward('independent-classic-feedback');
      }))
      .start();
  }

  private async revealClassicTreasureWrong(
    theme: GameTheme,
    selected: number,
    launch: Promise<void>,
  ): Promise<void> {
    this.markClassicSequence('explosion-burst');
    const reveal = this.revealSelectedChoice(theme, selected, false);
    await Promise.all([reveal, launch]);
    if (!this.scope.isActive() || selected !== this.selected || this.correct) return;
    this.view.books.pulse(selected, 1.12);
    this.markClassicSequence('actor-landed');
    this.showFeedback(true);
    tween(this.root)
      .delay(0.2)
      .call(this.scope.guard(() => this.view.books.pulse(selected, 1.06)))
      .start();
  }

  private revealSelectedChoice(
    theme: GameTheme,
    selected: number,
    correct: boolean,
    perChoiceState = true,
  ): Promise<void> {
    return this.view.books.reveal(
      selected,
      correct,
      theme.assets.successState,
      theme.assets.failState,
      false,
      theme.assets.choices,
      theme.id,
      perChoiceState ? theme.assets.successStates : undefined,
      perChoiceState ? theme.assets.failStates : undefined,
    );
  }

  private playScoreReward(
    feedbackGate: string,
    onFirstArrival: () => void = () => undefined,
  ): boolean {
    const source = this.scoreRewardStart;
    this.scoreRewardStart = null;
    if (this.scoreAwarded <= 0) return false;
    this.services.audio.play('coin');
    const score = this.session.score();
    if (typeof document !== 'undefined') {
      document.body.dataset.scoreCoinTriggerPhase = 'chest-open';
      document.body.dataset.scoreCoinFeedbackGate = feedbackGate;
      document.body.dataset.scoreCoinTriggerAt = (
        typeof performance !== 'undefined' ? performance.now() : Date.now()
      ).toFixed(3);
    }
    if (!source) {
      this.view.hud.showScoreReward(score);
      onFirstArrival();
      return false;
    }
    this.view.scoreCoins.play({
      source,
      target: { node: this.view.hud.scoreRewardTarget() },
      awarded: this.scoreAwarded,
      onFirstArrival: () => {
        this.view.hud.showScoreReward(score);
        onFirstArrival();
      },
    });
    return true;
  }

  private markClassicSequence(phase: string): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.classicTreasureSequence = phase;
  }

  private markDesertSequence(phase: string): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.desertTreasureSequence = phase;
  }

  private markDinosaurSequence(phase: string): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.dinosaurTreasureSequence = phase;
  }

  private markDunhuangSequence(phase: string): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.dunhuangTreasureSequence = phase;
  }

  private markMagicAcademySequence(phase: string): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.magicAcademySequence = phase;
  }

  private showFeedback(
    liveSceneOnly = false,
    audioAlreadyPlayed = false,
    liveSceneHoldMs: number = CLASSIC_TREASURE_FEEDBACK.actorLandingHoldMs,
  ): void {
    if (this.revealing) return;
    this.revealing = true;
    const question = this.question();
    if (!question) return;
    const theme = this.theme();
    const presentation = liveSceneOnly
      ? 'motion'
      : feedbackPresentation(theme.id, this.correct);
    const staticFeedback = !liveSceneOnly && presentation === 'hybrid'
      ? resolveStaticFeedback(theme.id, this.correct)
      : undefined;
    const sequencePlan = liveSceneOnly
      ? undefined
      : feedbackSequencePlan(theme.id, this.correct);
    const useStageMotion = !liveSceneOnly
      && feedbackUsesStageMotion(theme.id, this.correct);
    this.round.completeAction();
    this.view.prompt.hide();
    this.view.books.setEnabled(false);
    if (!audioAlreadyPlayed) {
      this.services.audio.play(this.correct ? 'correct' : 'wrong');
    }
    const motionPath = liveSceneOnly
      ? undefined
      : this.correct
      ? theme.assets.motion?.correct
      : theme.assets.motion?.wrong;
    if (typeof document !== 'undefined') {
      document.body.dataset.answerCorrect = String(this.correct);
      document.body.dataset.feedbackMode = liveSceneOnly
        ? 'live-scene'
        : staticFeedback && motionPath
        ? 'hybrid'
        : (motionPath ? 'motion' : 'fallback');
      document.body.dataset.feedbackColumn = String(this.selected);
      document.body.dataset.feedbackAudio = this.correct ? 'correct' : 'wrong';
      document.body.dataset.feedbackScene = theme.id;
    }
    if (liveSceneOnly) {
      tween(this.root)
        .delay(liveSceneHoldMs / 1000)
        .call(this.scope.guard(this.complete))
        .start();
      return;
    }
    const fallbackAsset = theme.id === 'desert' && !this.correct
      ? theme.assets.failState ?? theme.assets.feedbackWrong
      : this.correct ? theme.assets.feedbackCorrect : theme.assets.feedbackWrong;
    this.view.feedback.show(
      this.correct,
      fallbackAsset,
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
    const feedbackHold = feedbackHoldMs(theme.id, this.correct);
    const classicRewardHold = theme.id === 'treasure' && this.correct
      ? CLASSIC_TREASURE_FEEDBACK.correctRewardDelayMs
        + CLASSIC_TREASURE_FEEDBACK.rewardDurationMs
        + CLASSIC_TREASURE_FEEDBACK.rewardCompletionTailMs
      : 0;
    const holdSec = Math.max(feedbackHold, classicRewardHold) / 1000;
    tween(this.root).delay(holdSec).call(this.scope.guard(this.complete)).start();
  }
}
