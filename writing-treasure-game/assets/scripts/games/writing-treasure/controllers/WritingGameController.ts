import { Node } from 'cc';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { stopTweensRecursively } from '../../../core/lifecycle/TweenCleanup';
import { createUiNode } from '../../../core/ui/UiFactory';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { QuestionCursor } from '../../../services/QuestionCursor';
import { RoundTimer } from '../../../services/RoundTimer';
import { GameResult } from '../../../shared/types/GameTypes';
import { ChineseQuestion } from '../../../shared/types/Question';
import { GameController, GameLaunchOptions } from '../../../ui/GameController';
import { StageResultCoordinator } from '../../../ui/StageResultCoordinator';
import { hostAdapter } from '../../../platform/HostAdapter';
import { DEFAULT_BOOK, resolveBookOption } from '../../../shared/config/BookCatalog';
import { writingAudio, writingThemes } from '../config/WritingTheme';
import { TreasureRound } from '../model/TreasureRound';
import { WritingGameView } from '../views/WritingGameView';
import { TreasureInteractionController } from './TreasureInteractionController';
import { VoiceAnswerController } from './VoiceAnswerController';
import { WritingCompletionController } from './WritingCompletionController';
import { mountWritingIntro } from './WritingIntroCoordinator';
import { WritingStageCoordinator } from './WritingStageCoordinator';
import { WritingStartCoordinator } from './WritingStartCoordinator';
export class WritingGameController implements GameController {
  readonly root: Node;
  private readonly round = new TreasureRound();
  private readonly timer = new RoundTimer();
  private readonly session = new GameSession('writing-treasure');
  private readonly campaign: CampaignProgress<(typeof writingThemes)[number]>;
  private readonly scope = new TaskScope();
  private readonly view: WritingGameView;
  private readonly interaction: TreasureInteractionController;
  private readonly voice: VoiceAnswerController;
  private readonly stages: WritingStageCoordinator;
  private readonly starter: WritingStartCoordinator;
  private readonly completion: WritingCompletionController;
  private readonly stageResults: StageResultCoordinator;
  private cursor: QuestionCursor | null = null;
  private current: ChineseQuestion | null = null;
  private readonly usedQuestionIds = new Set<string>();
  private initialThemePreload: Promise<unknown | null> | null = null;
  private paused = false;
  private renderedTimerSecond = -1;
  constructor(parent: Node, private readonly services: GameServices,
    private readonly options: GameLaunchOptions,
    private readonly onFinish: (result: GameResult) => void,
    private readonly onReturnHome: () => void = () => undefined) {
    this.root = createUiNode(parent, 'WritingTreasure', 1440, 810);
    this.campaign = new CampaignProgress(writingThemes, options.initialScene);
    this.services.audio.setTheme(writingAudio(this.campaign.current().id));
    this.view = new WritingGameView(
      this.root, undefined, (i) => this.select(i),
      () => this.voice.pressStart(), () => this.voice.pressEnd(), () => this.voice.pressCancel(),
    );
    this.interaction = new TreasureInteractionController(
      this.root, this.view, this.round,
      this.session, this.services, this.scope,
      () => this.current,
      () => this.campaign.current(),
      () => this.completeStage(),
    );
    this.voice = new VoiceAnswerController(this.view, this.round, this.services,
      () => this.current, (index) => this.select(index));
    this.stages = new WritingStageCoordinator(
      this.campaign, this.view, this.services, this.options, this.usedQuestionIds,
    );
    this.starter = new WritingStartCoordinator(
      this.root, this.scope, this.campaign,
      this.view, this.voice, this.round,
      this.timer, this.services, this.stages,
      !options.skipIntro,
    );
    this.completion = new WritingCompletionController(
      this.root, this.scope, this.voice, this.round,
      this.timer, this.session, this.services,
      () => this.campaign.current().id, this.onFinish,
    );
    this.stageResults = new StageResultCoordinator(
      this.root, this.scope, 'writing-treasure', this.campaign,
      this.session, this.timer, this.services, {
        nextQuestion: () => this.continueQuestion(),
        nextStage: () => this.continueStage(),
        finish: (reason) => this.completion.finish(reason),
        setPlayingVisible: (v) => this.view.setActive(v),
        share: (title, imageUrl) => hostAdapter.share({ title, imageUrl }),
        returnHome: () => this.onReturnHome(),
      },
    );
    this.view.setActive(false);
    this.options.knowledgePoint = resolveBookOption(this.options.knowledgePoint ?? DEFAULT_BOOK);
    if (options.skipIntro) void this.start().catch((error) => this.completion.fail(error));
    else {
      this.initialThemePreload = mountWritingIntro({
        root: this.root,
        scope: this.scope,
        campaign: this.campaign,
        services: this.services,
        launch: this.options,
        start: () => { void this.start().catch((error) => this.completion.fail(error)); },
      });
    }
  }
  update(deltaSeconds: number): void {
    if (!this.scope.isActive() || this.paused) return;
    if (this.timer.tick(deltaSeconds)) { this.timeoutStage(); return; }
    this.renderHud(false);
  }
  setPaused(paused: boolean): void { this.paused = paused; }
  dispose(): void {
    if (!this.scope.isActive()) return;
    this.scope.close();
    this.voice.dispose();
    this.view.dispose();
    this.timer.stop();
    stopTweensRecursively(this.root);
    this.root.destroy();
  }
  private async start(): Promise<void> {
    const preloadError = await this.initialThemePreload;
    this.initialThemePreload = null;
    if (preloadError) throw preloadError;
    this.cursor = await this.starter.start();
    if (!this.cursor) return;
    this.renderHud();
    this.showNextQuestion();
  }
  private completeStage(): void { this.stageResults.completeQuestion(); }
  private continueQuestion(): void { this.round.prepareNext(); this.showNextQuestion(); }
  private continueStage(): void {
    try {
      this.services.audio.play('transition');
      this.round.restartStage();
      this.cursor = this.stages.mount();
      this.renderHud();
      this.showNextQuestion();
    } catch (error) { this.completion.fail(error); }
  }
  private timeoutStage(): void {
    this.voice.disable();
    this.view.books.setEnabled(false);
    this.stageResults.timeoutStage();
  }
  private showNextQuestion(): void {
    this.current = this.cursor?.next() ?? null;
    if (!this.current) { this.completion.finish('empty'); return; }
    this.usedQuestionIds.add(this.current.id);
    if (typeof document !== 'undefined') {
      delete document.body.dataset.answerCorrect;
      document.body.dataset.questionId = this.current.id;
      document.body.dataset.questionKp = this.current.knowledgePoint;
      document.body.dataset.questionStem = this.current.stem;
    }
    if (this.round.state.current() === 'transition') this.round.next();
    this.interaction.reset();
    this.voice.reset();
    this.view.feedback.hide();
    this.view.board.setQuestion(this.current.stem, this.current.stemImageUrl);
    this.view.books.setOptions(this.current.options);
    this.view.books.setEnabled(true);
    this.services.audio.play('question');
    this.timer.resume(); this.session.beginQuestion();
  }
  private select(index: number): void {
    if (this.round.state.current() === 'awaiting-answer') {
      this.voice.disable(); this.timer.pause();
    }
    this.interaction.interact(index);
  }
  private renderHud(force = true): void {
    const remaining = this.timer.remaining();
    const second = Math.ceil(remaining);
    if (!force && second === this.renderedTimerSecond) return;
    this.renderedTimerSecond = second;
    if (typeof document !== 'undefined') document.body.dataset.gameScore = String(this.session.score());
    this.view.renderHud(remaining, this.session.score(), this.session.lives(),
      this.campaign.index(), this.campaign.total(), this.campaign.current().name, this.session.combo());
  }
}
