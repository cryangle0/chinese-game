import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf8').replace(/\r\n/g, '\n');
}

describe('Reading feedback replay and actor handoff', () => {
  it('replaces the image and isolates every feedback playback URL', () => {
    const image = source('../assets/scripts/core/media/DomMotionImage.ts');
    const feedback = source('../assets/scripts/ui/FeedbackView.ts');
    expect(image).toContain('previous.replaceWith(this.image)');
    expect(image).toContain('motionReplay=${replayCount}');
    expect(feedback).toContain('this.motion.show(');
    expect(feedback).toContain('motionPath,\n        true,\n        true,');
    expect(feedback).toContain(
      'onReady: () => {\n            this.ensureUnderlay(underlay);',
    );
    expect(feedback).toContain(
      'onError: () => {\n            this.image.active = true;',
    );
    expect(feedback).toContain(
      "spriteLoader.apply(this.image, assetPath, 'contain');\n            this.ensureUnderlay(false);",
    );
  });

  it('keeps the character until the feedback image reports ready', () => {
    const controller = source(
      '../assets/scripts/games/reading-jumper/controllers/ReadingAnswerController.ts',
    );
    const showIndex = controller.indexOf('this.view.feedback.show(');
    const hideIndex = controller.indexOf(
      'onReady: this.scope.guard(() => this.view.setFeedbackVisible(true))',
    );
    expect(showIndex).toBeGreaterThanOrEqual(0);
    expect(hideIndex).toBeGreaterThan(showIndex);
    expect(controller).toContain("feedbackActorHandoff = 'retained-on-error'");
  });
});
