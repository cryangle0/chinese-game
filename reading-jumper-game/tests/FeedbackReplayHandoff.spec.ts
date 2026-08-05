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
    expect(image).toContain("previous.removeAttribute('src')");
    expect(image).toContain('motionReplay=${replayCount}');
    expect(image).toContain('motionSession=${PLAYBACK_SESSION}');
    expect(image).toContain('motionNonce=${generation}-${isolatedPlaybackSerial}');
    expect(image).toContain('this.sourceAssignmentFrame = requestAnimationFrame(assign)');
    expect(image).toContain('image.dataset.motionGeneration = String(this.playbackGeneration)');
    expect(image).toContain('this.matchesGeneration(image)');
    expect(feedback).toContain('this.motion.show(');
    expect(feedback).toContain('motionPath,\n        true,\n        true,');
    expect(feedback).toContain(
      'onError: () => {\n            this.image.active = true;',
    );
    expect(feedback).toContain('this.removeLegacyFeedbackShade();');
    expect(feedback).not.toContain('this.ensureUnderlay(');
    expect(feedback).not.toContain('rgba(5, 8, 11, 0.8)');
  });

  it('keeps the character until the feedback image reports ready', () => {
    const controller = source(
      '../assets/scripts/games/reading-jumper/controllers/ReadingAnswerController.ts',
    );
    expect(controller).toContain('this.view.feedback.show(');
    expect(controller).toContain(
      'createReadingFeedbackReadyHandler(this.view, afterFeedbackReady)',
    );
    expect(controller).toContain('onReady: feedbackReady');
    expect(controller).toContain("feedbackActorHandoff = 'retained-on-error'");
  });
});
