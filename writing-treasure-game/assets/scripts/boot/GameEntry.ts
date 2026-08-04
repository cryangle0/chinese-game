import { _decorator, Component, Node, UITransform } from 'cc';
import { PageLifecycle } from '../core/lifecycle/PageLifecycle';
import { dismissStartupCoverAfterDraws } from '../core/lifecycle/StartupCover';
import { createUiNode } from '../core/ui/UiFactory';
import { preloadIntro } from '../core/assets/ThemePreloader';
import { WritingGameController } from '../games/writing-treasure/controllers/WritingGameController';
import { writingIntro } from '../games/writing-treasure/config/WritingTheme';
import { hostAdapter, HostMessenger, LaunchContext } from '../platform/HostAdapter';
import { createGameServices, GameServices } from '../services/GameServices';
import { AppConfig } from '../shared/config/AppConfig';
import { resolveBookOption } from '../shared/config/BookCatalog';
import { GameResult } from '../shared/types/GameTypes';
import { GameController } from '../ui/GameController';
import { LoadingView } from '../ui/LoadingView';
import { ResultView } from '../ui/ResultView';
import { StartupErrorView } from '../ui/StartupErrorView';
import { createWritingResultView } from './WritingResultFactory';

const { ccclass } = _decorator;
const GAME_ID = 'writing-treasure' as const;

@ccclass('GameEntry')
export class GameEntry extends Component {
  private appRoot: Node | null = null;
  private game: GameController | null = null;
  private result: ResultView | null = null;
  private loading: LoadingView | null = null;
  private errorView: StartupErrorView | null = null;
  private services: GameServices | null = null;
  private launch: LaunchContext | null = null;
  private messenger: HostMessenger | null = null;
  private lifecycle: PageLifecycle | null = null;
  private booting = false;
  private startingGame = false;
  private destroyed = false;
  private introPreloaded = false;

  onLoad(): void {
    const host = this.node.parent ?? this.node;
    const appRoot = createUiNode(host, 'WritingTreasureRoot',
      AppConfig.designWidth, AppConfig.designHeight);
    this.appRoot = appRoot;
    appRoot.getComponent(UITransform)?.setContentSize(AppConfig.designWidth, AppConfig.designHeight);
    this.lifecycle = new PageLifecycle(appRoot, {
      onExit: (persisted) => {
        if (!persisted) this.messenger?.exit('pagehide');
        this.services?.analytics.track({ name: 'exit', game: GAME_ID });
        void this.services?.analytics.flush();
        this.game?.setPaused(true); this.services?.audio.setPaused(true);
      },
      onVisibilityChange: (paused) => {
        this.game?.setPaused(paused); this.services?.audio.setPaused(paused);
      },
    });
    this.loading = new LoadingView(appRoot);
    void this.boot();
  }

  update(deltaSeconds: number): void {
    this.game?.update(Math.max(0, deltaSeconds));
    this.services?.update(Math.max(0, deltaSeconds));
  }

  onDestroy(): void {
    this.destroyed = true;
    this.messenger?.exit('destroy');
    this.disposeGame();
    this.services?.dispose();
    this.result?.dispose();
    this.loading?.root.destroy();
    this.errorView?.root.destroy();
    this.lifecycle?.dispose();
    this.appRoot?.destroy();
    this.services = this.result = this.loading = this.errorView = null;
    this.lifecycle = this.appRoot = null;
  }

  private async boot(): Promise<void> {
    if (this.booting || this.destroyed) return;
    this.booting = true;
    const launch = hostAdapter.launchContext();
    const messenger = new HostMessenger(GAME_ID, launch, hostAdapter);
    this.launch = launch; this.messenger = messenger;
    let services: GameServices | null = null;
    try {
      this.services?.dispose();
      services = createGameServices(launch);
      this.services = services;
      await services.initialize();
      // Kick intro preload in parallel — do not await before mounting cover UI.
      if (!launch.skipIntro) {
        void preloadIntro(writingIntro).then(() => { this.introPreloaded = true; });
      } else {
        this.introPreloaded = true;
      }
      void hostAdapter.lockLandscape();
      if (this.destroyed || this.services !== services || !this.appRoot?.isValid) {
        services.dispose(); return;
      }
      services.analytics.track({ name: 'app_enter', game: GAME_ID });
      // Mount real homepage under the loading shell, then dismiss the badge overlay.
      await this.prepareAndStartGame();
      this.loading?.root.destroy(); this.loading = null;
      messenger.ready();
      if (typeof document !== 'undefined') document.body.dataset.gameReady = 'true';
      dismissStartupCoverAfterDraws(() => this.destroyed);
    } catch (error) {
      if (this.destroyed || (services && this.services !== services)) return;
      messenger.error(error);
      if (typeof document !== 'undefined') document.body.dataset.gameError = 'boot';
      console.error('[writing-treasure] boot failed', error);
      this.showBootError();
      dismissStartupCoverAfterDraws(() => this.destroyed);
    } finally { this.booting = false; }
  }

  private showBootError(): void {
    if (!this.appRoot) return;
    this.loading?.root.destroy(); this.loading = null;
    this.errorView?.root.destroy();
    this.errorView = new StartupErrorView(this.appRoot, () => {
      this.errorView?.root.destroy(); this.errorView = null;
      if (!this.appRoot) return;
      this.loading = new LoadingView(this.appRoot);
      if (typeof document !== 'undefined') delete document.body.dataset.gameError;
      void this.boot();
    });
  }

  private startGame(options?: { skipIntro?: boolean; initialScene?: string }): void {
    void this.prepareAndStartGame(options)
      .catch((error) => console.error('[writing-treasure] replay preload failed', error));
  }

  private async prepareAndStartGame(
    options?: { skipIntro?: boolean; initialScene?: string },
  ): Promise<void> {
    if (this.startingGame || !this.appRoot || !this.services || !this.launch) return;
    this.startingGame = true;
    const { services, launch, appRoot } = this;
    try {
      const skipIntro = options?.skipIntro ?? launch.skipIntro;
      // Boot already preloaded intro art — avoid a second blocking wait on first paint.
      if (!skipIntro && !this.introPreloaded) {
        void preloadIntro(writingIntro).then(() => { this.introPreloaded = true; });
      }
      if (this.destroyed || this.services !== services || !appRoot?.isValid) return;
      this.disposeGame();
      this.result?.dispose(); this.result = null;
      if (typeof document !== 'undefined') delete document.body.dataset.finishReason;
      this.game = new WritingGameController(appRoot, services!, {
        grade: launch!.grade, initialScene: options?.initialScene ?? launch!.scene, skipIntro,
        term: launch!.term, difficulties: launch!.difficulties,
        knowledgePoint: resolveBookOption(
          (typeof document !== 'undefined' ? document.body.dataset.bookSelect : undefined)
          || launch!.book,
        ),
      }, (result) => this.showResult(result),
      () => this.startGame({ skipIntro: false }));
    } finally { this.startingGame = false; }
  }

  private showResult(result: GameResult): void {
    if (!this.appRoot || !this.services) return;
    this.disposeGame();
    this.result = createWritingResultView({
      appRoot: this.appRoot,
      services: this.services,
      messenger: this.messenger,
      result,
      replay: () => this.startGame({ skipIntro: true, initialScene: result.scene }),
      home: () => this.startGame({ skipIntro: false }),
    });
  }

  private disposeGame(): void { this.game?.dispose(); this.game = null; }
}
