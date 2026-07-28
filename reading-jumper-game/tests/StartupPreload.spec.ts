import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Reading startup preload', () => {
  it('waits for the initial playable theme under the startup cover', () => {
    const entry = readFileSync(
      resolve(__dirname, '../assets/scripts/boot/GameEntry.ts'),
      'utf8',
    );
    expect(entry).toContain('preloadPlayableTheme(initialTheme)');
    expect(entry).toContain('waitForRefresh(STARTUP_QUESTION_WAIT_MS)');
    expect(entry).toContain('preloadPoseRuntime()');
    expect(entry.indexOf('preloadPlayableTheme(initialTheme)'))
      .toBeLessThan(entry.indexOf('await this.prepareAndStartGame()'));
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
    expect(controller).toMatch(
      /this\.view\.setActive\(false\);\s*this\.view\.mount\(this\.campaign\.current\(\)\)/,
    );
    expect(stages).toContain('preloadPlayableThemeWhenIdle(nextTheme)');
  });

  it('preloads first-scene motion instead of relying only on link prefetch', () => {
    const preloader = readFileSync(
      resolve(__dirname, '../assets/scripts/core/assets/ThemePreloader.ts'),
      'utf8',
    );
    expect(preloader).toContain('preloadMotion(');
    expect(preloader).toContain('motion?.action');
    expect(preloader).toContain('motion?.runLeft');
    expect(preloader).toContain('motion?.runRight');
    expect(preloader).toContain('motion?.correct');
    expect(preloader).toContain('motion?.wrong');
  });
});
