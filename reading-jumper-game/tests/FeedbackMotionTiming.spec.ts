import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readingThemes } from '../assets/scripts/games/reading-jumper/config/ReadingTheme';
import {
  FEEDBACK_TAIL_MS,
  feedbackDurationMs,
  feedbackHoldMs,
} from '../assets/scripts/core/media/MotionPlayback';

interface WebpAnimation {
  readonly frames: number;
  readonly durationMs: number;
  readonly loopCount: number;
}

/** Walk the RIFF container so the assertion reads the shipped asset, not a fixture. */
function readWebpAnimation(file: string): WebpAnimation {
  const buffer = readFileSync(file);
  let offset = 12;
  let frames = 0;
  let durationMs = 0;
  let loopCount = -1;
  while (offset + 8 <= buffer.length) {
    const fourcc = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const body = offset + 8;
    if (fourcc === 'ANIM') loopCount = buffer.readUInt16LE(body + 4);
    if (fourcc === 'ANMF') {
      frames += 1;
      durationMs += buffer.readUIntLE(body + 12, 3);
    }
    offset = body + size + (size % 2);
  }
  return { frames, durationMs, loopCount };
}

const mediaRoot = join(__dirname, '..', 'customer-media');
const cases = readingThemes.flatMap((theme) => [true, false].map((correct) => ({
  scene: theme.id,
  correct,
  motionPath: correct ? theme.assets.motion?.correct : theme.assets.motion?.wrong,
  file: join(mediaRoot, theme.id, `${correct ? 'correct' : 'wrong'}.webp`),
})));

describe('reading feedback effect timing', () => {
  it('covers every scene for both correct and wrong answers', () => {
    expect(cases).toHaveLength(readingThemes.length * 2);
    cases.forEach(({ scene, correct, motionPath }) => {
      expect(motionPath).toBe(`./media/${scene}/${correct ? 'correct' : 'wrong'}.webp`);
    });
  });

  it.each(cases)('plays $scene correct=$correct exactly once', ({ file }) => {
    const animation = readWebpAnimation(file);
    expect(animation.frames).toBeGreaterThan(1);
    expect(animation.loopCount).toBe(1);
  });

  it.each(cases)('holds $scene correct=$correct for the full effect', (testCase) => {
    const { durationMs } = readWebpAnimation(testCase.file);
    expect(feedbackDurationMs(testCase.scene, testCase.correct)).toBe(durationMs);
    expect(feedbackHoldMs(testCase.scene, testCase.correct)).toBe(durationMs + FEEDBACK_TAIL_MS);
  });
});
