import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Reading startup preload', () => {
  it('mounts the homepage without blocking on gameplay media or pose runtime', () => {
    const entry = readFileSync(
      resolve(__dirname, '../assets/scripts/boot/GameEntry.ts'),
      'utf8',
    );
    const bootPath = entry.slice(
      entry.indexOf('private async boot()'),
      entry.indexOf('private preloadAfterHomepage()'),
    );
    expect(bootPath).toContain('await this.prepareAndStartGame()');
    expect(bootPath).not.toContain('preloadPlayableTheme(');
    expect(bootPath).not.toContain('waitForRefresh(');
    expect(bootPath).not.toContain('preloadPoseRuntime(');
    expect(bootPath).not.toContain('services.audio.preload(');
  });

  it('retains the first scene while the intro is mounted', () => {
    const intro = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/reading-jumper/controllers/ReadingIntroCoordinator.ts',
      ),
      'utf8',
    );
    expect(intro).toContain('retainIntroAndThemes(readingIntro, [campaign.current()])');
  });

  it('mounts the first scene while hidden and defers the next scene to idle time', () => {
    const controller = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/reading-jumper/controllers/ReadingGameController.ts',
      ),
      'utf8',
    );
    const stages = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/reading-jumper/controllers/ReadingStageCoordinator.ts',
      ),
      'utf8',
    );
    expect(controller).toContain('this.view.setActive(false)');
    expect(controller.indexOf('this.view.mount(this.campaign.current())'))
      .toBeGreaterThan(controller.indexOf('await this.services.questions.waitForRefresh'));
    expect(stages).toContain('preloadStartupThemeWhenIdle(nextTheme)');
    const preloader = readFileSync(
      resolve(__dirname, '../assets/scripts/core/assets/ThemePreloader.ts'),
      'utf8',
    );
    expect(preloader).toContain('preloadStartupThemeInIdleSlices');
    expect(preloader).toContain('await idleSlice()');
  });

  it('loads only startup-critical assets after homepage paint', () => {
    const preloader = readFileSync(
      resolve(__dirname, '../assets/scripts/core/assets/ThemePreloader.ts'),
      'utf8',
    );
    const intro = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/reading-jumper/controllers/ReadingIntroCoordinator.ts',
      ),
      'utf8',
    );
    expect(preloader).toContain('startupThemeAssetPaths');
    expect(preloader).toContain('playThemeAssetPaths');
    expect(preloader).toContain('feedbackThemeAssetPaths');
    expect(preloader).toContain("'characterIdleAnimation'");
    expect(preloader).toContain('preloadStartupThemeAfterFirstPaint');
    expect(preloader).toContain('window.requestAnimationFrame');
    expect(preloader).toContain('window.requestIdleCallback');
    const startup = preloader.slice(
      preloader.indexOf('export function preloadStartupTheme('),
      preloader.indexOf('export function preloadPlayTheme('),
    );
    expect(startup).not.toContain('preloadMotion(');
    expect(startup).not.toContain('motion?.idle');
    expect(startup).not.toContain('motion?.runLeft');
    expect(startup).not.toContain('motion?.runRight');
    expect(intro).toContain('preloadStartupThemeAfterFirstPaint(campaign.current())');
  });

  it('starts play preloading behind user intent without blocking the first play frame', () => {
    const controller = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/reading-jumper/controllers/ReadingGameController.ts',
      ),
      'utf8',
    );
    const stages = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/reading-jumper/controllers/ReadingStageCoordinator.ts',
      ),
      'utf8',
    );
    const deer = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/reading-jumper/views/DeerView.ts',
      ),
      'utf8',
    );
    expect(controller).toContain('void preloadPlayTheme(this.campaign.current())');
    expect(controller).toContain('setTheme(marioAudio, { preload: false })');
    expect(deer).toContain('spriteLoader.apply(this.visual, this.idleAsset');
    expect(stages).toContain('preloadFeedbackThemeWhenIdle(theme)');
    expect(stages).not.toContain('theme.assets.motion?.idle');
    expect(stages).not.toContain('theme.assets.motion?.runLeft');
    expect(stages).not.toContain('theme.assets.motion?.runRight');
  });

  it('excludes retired locomotion WebPs from web and release copies', () => {
    const build = readFileSync(
      resolve(__dirname, '../tools/build/build-web.mjs'),
      'utf8',
    );
    const release = readFileSync(
      resolve(__dirname, '../tools/deploy/create-release.mjs'),
      'utf8',
    );
    expect(build).toContain('shouldCopyCustomerMedia');
    expect(release).toContain('shouldCopyCustomerMedia');
    expect(build).toContain('fs.rmSync(mediaOutput');
    expect(build).toContain("idle.webp");
    expect(build).toContain("run-left.webp");
    expect(build).toContain("run-right.webp");
  });

  it('budgets the five lazy themes separately from startup-critical bytes', () => {
    const performance = readFileSync(
      resolve(__dirname, '../tools/performance/check-web-build.mjs'),
      'utf8',
    );
    expect(performance).toContain('retiredLocomotionFiles');
    expect(performance).toContain('perThemeBytes');
    expect(performance).toContain('45 * 1024 * 1024');
    expect(performance).not.toContain('baseBytes > 22 * 1024 * 1024');
  });
});
