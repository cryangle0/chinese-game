import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Writing startup preload', () => {
  it('defers first-stage textures and entry motion until after homepage paint', () => {
    const preloader = readFileSync(
      resolve(__dirname, '../assets/scripts/core/assets/ThemePreloader.ts'),
      'utf8',
    );
    const intro = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/writing-treasure/controllers/WritingIntroCoordinator.ts',
      ),
      'utf8',
    );
    expect(preloader).toContain('preloadInitialThemeAfterFirstPaint');
    expect(preloader).toContain('window.requestAnimationFrame');
    expect(preloader).toContain('window.requestIdleCallback');
    expect(intro).toContain('preloadInitialThemeAfterFirstPaint(campaign.current())');
    expect(intro).toContain('scheduleRunMotionPrefetch(runMotion)');
  });

  it('keeps a stable startup cover until the real homepage has rendered', () => {
    const entry = readFileSync(
      resolve(__dirname, '../assets/scripts/boot/GameEntry.ts'),
      'utf8',
    );
    const patch = readFileSync(
      resolve(__dirname, '../tools/build/patch-web-index.mjs'),
      'utf8',
    );
    expect(entry).toContain('dismissStartupCoverAfterDraws');
    expect(patch).toContain('data-startup-cover="writing"');
    expect(patch).toContain('data-startup-background="writing"');
    expect(patch).toContain('id="GameStartupCover"');
  });
});
