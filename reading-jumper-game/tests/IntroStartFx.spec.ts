import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Intro start shatter FX', () => {
  it('holds ~700ms for button shatter before entering play', () => {
    const fx = readFileSync(
      resolve(__dirname, '../assets/scripts/ui/IntroStartTransition.ts'),
      'utf8',
    );
    expect(fx).toMatch(/INTRO_START_FX_HOLD_MS\s*=\s*700/);
    expect(fx).toContain('explodeButton');
    expect(fx).toContain('burstSparkles');
    expect(fx).toContain('playCharacterHop');
  });

  it('wires pose jump through GameIntroView.triggerStart (not immediate start)', () => {
    const controller = readFileSync(
      resolve(__dirname, '../assets/scripts/games/reading-jumper/controllers/ReadingGameController.ts'),
      'utf8',
    );
    const introCoordinator = readFileSync(
      resolve(__dirname, '../assets/scripts/games/reading-jumper/controllers/ReadingIntroCoordinator.ts'),
      'utf8',
    );
    expect(controller).toContain('mountReadingIntro');
    expect(introCoordinator).toContain('intro.triggerStart()');
    expect(introCoordinator).toContain('onBeginFx');
    expect(introCoordinator).not.toMatch(/setMode\('intro',\s*start\)/);
  });

  it('GameIntroView plays transition then calls start', () => {
    const view = readFileSync(
      resolve(__dirname, '../assets/scripts/ui/GameIntroView.ts'),
      'utf8',
    );
    expect(view).toContain('playIntroStartTransition');
    expect(view).toContain('triggerStart');
    expect(view).toContain('introStartFx');
  });
});
