import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readingLayout } from '../assets/scripts/games/reading-jumper/config/ReadingLayout';

describe('Reading deer run states', () => {
  const source = readFileSync(resolve(
    __dirname,
    '../assets/scripts/games/reading-jumper/views/DeerView.ts',
  ), 'utf8');
  const tweens = readFileSync(resolve(
    __dirname,
    '../assets/scripts/games/reading-jumper/views/DeerMotionTweens.ts',
  ), 'utf8');

  it('plays idle running with deterministic sprite-sheet frames', () => {
    expect(source).toContain('if (this.idleAnimation) {');
    expect(source).toContain('this.player.play(this.idleAnimation);');
    expect(source).toContain("document.body.dataset.deerIdleMotion = 'sprite-sheet-run-in-place';");
    expect(source).toContain("document.body.dataset.deerLocomotionRenderer = 'sprite-sheet';");
  });

  it('plays directional sprite sheets for the full pose-controlled travel', () => {
    expect(source).toContain('const HORIZONTAL_RUN_PIXELS_PER_SECOND = 300;');
    expect(source).toContain('const POSE_RUN_MIN_SECONDS = 0.45;');
    expect(source).toContain('const POSE_RUN_SETTLE_SECONDS = 0.08;');
    expect(source).toContain('movingLeft ? this.runLeftAnimation : this.runRightAnimation');
    expect(source).toContain('travelDistance / HORIZONTAL_RUN_PIXELS_PER_SECOND');
    expect(source).toContain('this.player.play(animation);');
    expect(source).toContain('}, POSE_RUN_SETTLE_SECONDS, travelSeconds, true);');
    expect(source).toContain('document.body.dataset.deerRunDuration = String(travelSeconds);');
    expect(source).toContain("document.body.dataset.deerLocomotionRenderer = 'sprite-sheet';");
  });

  it('slows the pre-jump horizontal run instead of using the 0.42s default', () => {
    expect(source).toContain(
      'runDeerTo(this.root, x, this.baseY, jump, 0, travelSeconds, true);',
    );
    expect(source).toContain(
      'document.body.dataset.deerPreJumpRunDuration = String(travelSeconds);',
    );
    expect(source).not.toContain('runDeerTo(this.root, x, this.baseY, jump);');
  });

  it('does not distort the source frames with synthetic gait scaling', () => {
    expect(tweens).not.toContain('RUN_STRETCH');
    expect(tweens).not.toContain('scale:');
    expect(tweens).not.toContain('RUN_BOUNCE_HEIGHT');
  });

  it('grounds only the food idle character on its platform', () => {
    expect(readingLayout('food').deer.y).toBe(-235);
    expect(readingLayout('mario').deer.y).toBe(-226);
    expect(readingLayout('deep-sea').deer.y).toBe(-236);
    expect(readingLayout('space').deer.y).toBe(-219);
    expect(readingLayout('poetry').deer.y).toBe(-254);
  });
});
