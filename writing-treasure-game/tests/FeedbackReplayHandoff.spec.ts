import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf8').replace(/\r\n/g, '\n');
}

describe('Writing feedback replay and actor handoff', () => {
  it('replaces the image and gives feedback WebPs a unique playback URL', () => {
    const image = source('../assets/scripts/core/media/DomMotionImage.ts');
    const feedback = source('../assets/scripts/ui/FeedbackView.ts');
    const stage = source('../assets/scripts/ui/FeedbackStageMotionView.ts');
    expect(image).toContain('previous.replaceWith(this.image)');
    expect(image).toContain('motionReplay=${replayCount}');
    expect(feedback).toContain('this.fallbackMotion.show(motionPath, true, true,');
    expect(stage).toContain('this.motion.show(path, true, true, callbacks)');
  });

  it('hides the character only after the feedback image reports ready', () => {
    const controller = source(
      '../assets/scripts/games/writing-treasure/controllers/TreasureInteractionController.ts',
    );
    const showIndex = controller.indexOf('this.view.feedback.show(');
    const hideIndex = controller.indexOf('onReady: this.scope.guard(() => {');
    expect(showIndex).toBeGreaterThanOrEqual(0);
    expect(hideIndex).toBeGreaterThan(showIndex);
    expect(controller).not.toContain(
      'this.view.books.setEnabled(false);\n    this.view.deer.hide();',
    );
    expect(controller).toContain("feedbackActorHandoff = 'retained-on-error'");
  });
});
