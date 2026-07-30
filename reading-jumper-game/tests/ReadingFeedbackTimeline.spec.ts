import { feedbackDurationMs } from '../assets/scripts/core/media/MotionPlayback';
import {
  readingFeedbackFrameMs,
  readingFeedbackTimeline,
  READING_FEEDBACK_TIMELINE_FPS,
} from '../assets/scripts/games/reading-jumper/config/ReadingFeedbackTimeline';

describe('Reading feedback 30fps timeline', () => {
  it('maps space correct feedback to the measured Demo frames', () => {
    const timeline = readingFeedbackTimeline('space', true);
    expect(timeline).not.toBeNull();
    expect(READING_FEEDBACK_TIMELINE_FPS).toBe(30);
    expect(timeline?.events.map(({ id, frame }) => [id, frame])).toEqual([
      ['choice.contact', 0],
      ['fx.stars.enter', 1],
      ['vehicle.rocket.enter', 36],
      ['actor.handoff', 48],
      ['vehicle.boost', 61],
      ['actor.terminal', 106],
      ['transition.enter', 118],
    ]);
  });

  it('starts the 65-frame rocket sequence so its last frame meets the transition', () => {
    const timeline = readingFeedbackTimeline('space', true);
    const rocket = timeline?.events.find((event) => event.id === 'vehicle.rocket.enter');
    const transition = timeline?.events.find((event) => event.id === 'transition.enter');
    expect(rocket).toBeDefined();
    expect(transition).toBeDefined();
    const sequenceEndMs = readingFeedbackFrameMs(rocket!.frame)
      + feedbackDurationMs('space', true);
    const transitionMs = readingFeedbackFrameMs(transition!.frame);
    expect(sequenceEndMs).toBe(3907);
    expect(transitionMs).toBe(3933);
    expect(transitionMs - sequenceEndMs).toBeLessThanOrEqual(1000 / 30);
  });

  it('uses a direct, bright, aspect-preserving presentation for the space rocket', () => {
    const presentation = readingFeedbackTimeline('space', true)?.presentation;
    expect(presentation).toMatchObject({
      animateIn: false,
      underlay: false,
      scale: 1.02,
      offsetY: 125,
      isolateTimeline: true,
    });
  });

  it('starts space wrong feedback as soon as the jump returns to ground', () => {
    const timeline = readingFeedbackTimeline('space', false);
    expect(timeline).not.toBeNull();
    expect(timeline?.events.map(({ id, frame }) => [id, frame])).toEqual([
      ['choice.wrong', 0],
      ['audio.wrong', 0],
      ['hazard.object.enter', 8],
      ['impact.start', 23],
      ['actor.terminal', 30],
      ['transition.enter', 90],
    ]);
  });

  it('aligns the 30fps source impact and terminal frames with the Demo', () => {
    const timeline = readingFeedbackTimeline('space', false);
    const enter = timeline?.events.find((event) => event.id === 'hazard.object.enter');
    const impact = timeline?.events.find((event) => event.id === 'impact.start');
    const terminal = timeline?.events.find((event) => event.id === 'actor.terminal');
    expect(enter).toBeDefined();
    expect(impact).toBeDefined();
    expect(terminal).toBeDefined();
    expect(impact!.frame - enter!.frame).toBe(15);
    expect(terminal!.frame - enter!.frame).toBe(22);
  });

  it('uses a direct, bright, feet-pinned presentation for the falling wreck', () => {
    const presentation = readingFeedbackTimeline('space', false)?.presentation;
    expect(presentation).toMatchObject({
      animateIn: false,
      underlay: false,
      scale: 1.35,
      offsetY: 121,
      isolateTimeline: true,
    });
  });

  it('keeps all other feedback on the existing controller path for now', () => {
    expect(readingFeedbackTimeline('mario', true)).toBeNull();
    expect(readingFeedbackTimeline('deep-sea', false)).toBeNull();
  });
});
