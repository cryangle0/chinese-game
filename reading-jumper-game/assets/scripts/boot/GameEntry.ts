import { _decorator, Component, Node, UITransform } from 'cc';
import { PageLifecycle } from '../core/lifecycle/PageLifecycle';
import { dismissStartupCoverAfterDraws } from '../core/lifecycle/StartupCover';
import { createUiNode } from '../core/ui/UiFactory';
import { preloadIntro, retainThemes } from '../core/assets/ThemePreloader';
import { ReadingGameController } from '../games/reading-jumper/controllers/ReadingGameController';
import { readingIntro, readingThemes } from '../games/reading-jumper/config/ReadingTheme';
import { hostAdapter, HostMessenger, LaunchContext } from '../platform/HostAdapter';
import { createGameServices, GameServices } from '../services/GameServices';
import { AppConfig } from '../shared/config/AppConfig';
import { resolveBookOption } from '../shared/config/BookCatalog';
import { loadRuntimeConfig } from '../shared/config/RuntimeConfig';
import { GameResult } from '../shared/types/GameTypes';
import { GameController } from '../ui/GameController';
import { LoadingView } from '../ui/LoadingView';
import { ResultView } from '../ui/ResultView';
import { StartupErrorView } from '../ui/StartupErrorView';
const { ccclass } = _decorator; const GAME_ID = 'reading-jumper' as const;
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
  private booting = false; private startingGame = false; private destroyed = false;
  private introPreloaded = false;
  onLoad(): void {
    const host = this.node.parent ?? this.node;
    const appRoot = createUiNode(host, 'ReadingJumperRoot',
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
    const delta = Math.max(0, deltaSeconds);
    this.game?.update(delta); this.services?.update(delta);
  }
  onDestroy(): void {
    this.destroyed = true;
    this.messenger?.exit('destroy');
    this.disposeGame(); this.services?.dispose(); this.result?.dispose();
    this.loading?.root.destroy(); this.errorView?.root.destroy();
    this.lifecycle?.dispose(); this.appRoot?.destroy();
    this.services = null; this.result = null; this.loading = null;
    this.errorView = null; this.lifecycle = null; this.appRoot = null;
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
      services = createGameServices(launch); this.services = services;
      const introReady = launch.skipIntro
        ? Promise.resolve()
        : preloadIntro(readingIntro);
      await Promise.all([services.initialize(), loadRuntimeConfig(), introReady]);
      this.introPreloaded = true;
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
      console.error('[reading-jumper] boot failed', error);
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
    void this.prepareAndStartGame(options).catch((error) => {
      console.error('[reading-jumper] replay preload failed', error);
    });
  }
  private async prepareAndStartGame(
    options?: { skipIntro?: boolean; initialScene?: string },
  ): Promise<void> {
    if (this.startingGame || !this.appRoot || !this.services || !this.launch) return;
    this.startingGame = true;
    const services = this.services; const launch = this.launch;
    try {
      const skipIntro = options?.skipIntro ?? launch.skipIntro;
      // Cover sprites load on-demand; keep preload best-effort in background.
      if (!skipIntro && !this.introPreloaded) {
        void preloadIntro(readingIntro).then(() => { this.introPreloaded = true; });
      }
      if (this.destroyed || this.services !== services || !this.appRoot?.isValid) return;
      this.disposeGame(); this.result?.dispose(); this.result = null;
      if (typeof document !== 'undefined') delete document.body.dataset.finishReason;
      this.game = new ReadingGameController(this.appRoot, services, {
        grade: launch.grade, initialScene: options?.initialScene ?? launch.scene, skipIntro,
        term: launch.term, difficulties: launch.difficulties,
        knowledgePoint: resolveBookOption(
          (typeof document !== 'undefined' ? document.body.dataset.bookSelect : undefined)
          || launch.book,
        ),
      }, (result) => this.showResult(result),
      () => this.startGame({ skipIntro: false }));
    } finally { this.startingGame = false; }
  }
  private showResult(result: GameResult): void {
    if (!this.appRoot || !this.services) return;
    this.disposeGame();
    const finalTheme = readingThemes.find((theme) => theme.id === result.scene)
      ?? readingThemes[readingThemes.length - 1];
    if (!finalTheme) return;
    retainThemes([finalTheme]);
    if (typeof document !== 'undefined') Object.assign(document.body.dataset, {
      gameView: 'result', finishReason: result.reason, gameAnswered: String(result.answered),
      gameScore: String(result.score), shareTitle: `阅读跳跳乐：${result.score} 分`,
    });
    this.services.analytics.track({
      name: 'result_view', game: GAME_ID,
      properties: { score: result.score, stars: result.stars },
    });
    this.messenger?.result(result);
    this.result = new ResultView(
      this.appRoot,
      result,
      () => this.startGame({ skipIntro: true, initialScene: result.scene }),
      () => this.startGame({ skipIntro: false }),
      finalTheme,
      () => {
        this.services?.analytics.track({
          name: 'share_score',
          game: GAME_ID,
          properties: { score: result.score, stars: result.stars },
        });
        return hostAdapter.share({
          title: `阅读跳跳乐：${result.score} 分`,
          url: typeof location === 'undefined' ? undefined : location.href,
        });
      },
    );
  }
  private disposeGame(): void { this.game?.dispose(); this.game = null; }
}
