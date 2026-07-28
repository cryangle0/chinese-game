import { director, Director, Node } from 'cc';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { stopTweensRecursively } from '../../../core/lifecycle/TweenCleanup';
import { preloadCriticalTheme, retainThemes } from '../../../core/assets/ThemePreloader';
import { createUiNode } from '../../../core/ui/UiFactory';
import { CampaignProgress } from '../../../services/CampaignProgress';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { QuestionCursor } from '../../../services/QuestionCursor';
import { RoundTimer } from '../../../services/RoundTimer';
import { AppConfig } from '../../../shared/config/AppConfig';
import { GameResult } from '../../../shared/types/GameTypes';
import { ChineseQuestion } from '../../../shared/types/Question';
import { GameController, GameLaunchOptions } from '../../../ui/GameController';
import { StageResultCoordinator } from '../../../ui/StageResultCoordinator';
import { hostAdapter } from '../../../platform/HostAdapter';
import { DEFAULT_BOOK, resolveBookOption } from '../../../shared/config/BookCatalog';
import { marioAudio, readingThemes } from '../config/ReadingTheme';
import { ReadingRound } from '../model/ReadingRound';
import { ReadingGameView } from '../views/ReadingGameView';
import { ReadingCompletionController } from './ReadingCompletionController';
import { ReadingAnswerController } from './ReadingAnswerController';
import { ReadingHudController } from './ReadingHudController';
import { mountReadingIntro } from './ReadingIntroCoordinator';
import { ReadingMotionController } from './ReadingMotionController';
import { ReadingStageCoordinator } from './ReadingStageCoordinator';

const PLAY_HANDOFF_FRAMES = 6;

export class ReadingGameController implements GameController {
  readonly root: Node;
  private readonly round = new ReadingRound();
  private readonly timer = new RoundTimer();
  private readonly session = new GameSession('reading-jumper');
  private readonly campaign: CampaignProgress<(typeof readingThemes)[number]>;
  private readonly scope = new TaskScope();
  private readonly view: ReadingGameView;
  private readonly hud: ReadingHudController;
  private readonly motion: ReadingMotionController;
  private readonly stages: ReadingStageCoordinator;
  private readonly completion: ReadingCompletionController;
  private readonly stageResults: StageResultCoordinator;
  private readonly answers: ReadingAnswerController;
  private cursor: QuestionCursor | null = null;
  private current: ChineseQuestion | null = null;
  private readonly usedQuestionIds = new Set<string>();
  private initialThemePreload: Promise<unknown | null> | null = null;
  private paused = false;
  constructor(parent: Node, private readonly services: GameServices, private readonly options: GameLaunchOptions,
    private readonly onFinish: (result: GameResult) => void,
    private readonly onReturnHome: () => void = () => undefined) {
    this.root = createUiNode(parent, 'ReadingJumper', 1440, 810);
    this.campaign = new CampaignProgress(readingThemes, options.initialScene);
    this.services.audio.setTheme(marioAudio);
    this.view = new ReadingGameView(this.root, undefined, (i) => this.choose(i));
    this.hud = new ReadingHudController(
      this.view, this.timer, this.session, this.services, this.campaign,
    );
    this.motion = new ReadingMotionController(this.view, services, (i) => this.choose(i));
    this.stages = new ReadingStageCoordinator(
      this.campaign, this.view, this.services, this.options, this.usedQuestionIds,
    );
    this.completion = new ReadingCompletionController(this.root, this.scope, this.round, this.timer,
      this.session, this.services, () => this.campaign.current().id, this.onFinish);
    this.stageResults = new StageResultCoordinator(
      this.root, this.scope, 'reading-jumper', this.campaign,
      this.session, this.timer, this.services, {
        nextQuestion: () => this.continueQuestion(), nextStage: () => this.continueStage(),
        finish: (reason) => this.completion.finish(reason),
        setPlayingVisible: (visible) => this.view.setActive(visible),
        share: (title, imageUrl) => hostAdapter.share({ title, imageUrl }),
        returnHome: () => this.onReturnHome(),
      },
    );
    this.answers = new ReadingAnswerController(
      this.root,
      this.scope,
      this.round,
      this.timer,
      this.session,
      this.services,
      this.campaign,
      this.view,
      this.motion,
      () => this.stageResults.completeQuestion(),
    );
    this.view.setActive(false);
    this.options.knowledgePoint = resolveBookOption(this.options.knowledgePoint ?? DEFAULT_BOOK);
    if (options.skipIntro) void this.start().catch((error) => this.completion.fail(error));
    else this.initialThemePreload = mountReadingIntro({
      root: this.root,
      scope: this.scope,
      campaign: this.campaign,
      services: this.services,
      launch: this.options,
      motion: this.motion,
      start: () => { void this.start().catch((error) => this.completion.fail(error)); },
    });
  }
  update(deltaSeconds: number): void {
    if (!this.scope.isActive() || this.paused) return;
    this.view.deer.update(deltaSeconds);
    if (this.timer.tick(deltaSeconds)) { this.timeoutStage(); return; }
    this.hud.render(false);
  }
  setPaused(paused: boolean): void { this.paused = paused; this.motion.setPaused(paused); }
  dispose(): void {
    if (!this.scope.isActive()) return;
    this.scope.close(); this.timer.stop(); this.motion.dispose();
    this.view.dispose(); stopTweensRecursively(this.root); this.root.destroy();
  }
  private async start(): Promise<void> {
    this.services.audio.unlock();
    this.motion.start();
    retainThemes([this.campaign.current(), this.campaign.peek()]);
    if (this.initialThemePreload) {
      const preloadError = await this.initialThemePreload;
      this.initialThemePreload = null;
      if (preloadError) throw preloadError;
    } else {
      await preloadCriticalTheme(this.campaign.current());
    }
    await this.services.questions.whenRefreshed();
    if (!this.scope.isActive()) return;
    const intro = this.root.getChildByName('GameIntro');
    this.view.setActive(true);
    this.round.begin();
    this.timer.start(AppConfig.roundSeconds);
    this.cursor = this.stages.mount();
    this.services.audio.playMusic();
    this.services.analytics.track({ name: 'game_start', game: 'reading-jumper' });
    this.hud.render();
    this.showNextQuestion();
    if (typeof document !== 'undefined') document.body.dataset.gameView = 'play';
    // Keep the cover through several fully rendered play frames. Reading activates
    // many sprite layers at once; releasing after only one draw still exposes the
    // camera clear while those layers join the render pipeline on slower devices.
    if (intro?.isValid) {
      let framesRemaining = PLAY_HANDOFF_FRAMES;
      let releaseAfterDraw: () => void;
      releaseAfterDraw = this.scope.guard(() => {
        framesRemaining -= 1;
        if (framesRemaining > 0) {
          director.once(Director.EVENT_AFTER_DRAW, releaseAfterDraw);
        } else if (intro.isValid) {
          intro.destroy();
        }
      });
      director.once(Director.EVENT_AFTER_DRAW, releaseAfterDraw);
    }
  }
  private choose(index: number): void {
    this.answers.choose(index, this.current);
  }
  private continueQuestion(): void { this.round.prepareNext(); this.showNextQuestion(); }
  private continueStage(): void {
    try {
      this.round.restartStage();
      this.cursor = this.stages.mount();
      this.services.audio.play('transition');
      this.hud.render();
      this.showNextQuestion();
    } catch (error) { this.completion.fail(error); }
  }
  private timeoutStage(): void {
    this.motion.setAnswerEnabled(false);
    this.view.bricks.setEnabled(false);
    this.stageResults.timeoutStage();
  }
  private showNextQuestion(): void {
    this.current = this.cursor?.next() ?? null;
    if (!this.current) { this.completion.finish('empty'); return; }
    this.usedQuestionIds.add(this.current.id);
    if (typeof document !== 'undefined') {
      delete document.body.dataset.answerCorrect;
      document.body.dataset.answerReady = 'true';
      document.body.dataset.questionId = this.current.id;
      document.body.dataset.questionKp = this.current.knowledgePoint;
      document.body.dataset.questionStem = this.current.stem;
    }
    if (this.round.state.current() === 'transition') this.round.next();
    this.view.setFeedbackVisible(false);
    this.view.board.setQuestion(this.current.stem, this.current.stemImageUrl);
    this.view.bricks.setOptions(this.current.options);
    this.view.bricks.setEnabled(true);
    this.motion.setAnswerEnabled(true);
    this.hud.render();
    this.timer.resume(); this.session.beginQuestion();
  }
}
