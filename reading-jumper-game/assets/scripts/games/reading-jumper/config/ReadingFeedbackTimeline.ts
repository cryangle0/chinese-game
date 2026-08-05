export const READING_FEEDBACK_TIMELINE_FPS = 30;
export const WRONG_TOP_EFFECT_HOLD_MS = 800;

export type ReadingFeedbackTimelineAction =
  | 'mark'
  | 'play-correct'
  | 'play-wrong'
  | 'show-feedback'
  | 'show-wrong-top'
  | 'play-reward'
  | 'play-danger'
  | 'complete';

export interface ReadingFeedbackTimelineEvent {
  readonly id: string;
  readonly frame: number;
  readonly action: ReadingFeedbackTimelineAction;
}

export interface ReadingFeedbackTimelineSpec {
  readonly sceneId: string;
  readonly correct: boolean;
  readonly presentation: {
    readonly animateIn: boolean;
    readonly scale: number;
    readonly offsetY: number;
    readonly isolateTimeline: boolean;
  };
  readonly events: readonly ReadingFeedbackTimelineEvent[];
}

const SPACE_CORRECT_TIMELINE: ReadingFeedbackTimelineSpec = {
  sceneId: 'space',
  correct: true,
  presentation: {
    animateIn: false,
    // Measured against the 1920x1080 Demo contact sheet. The packaged 884x600
    // canvas keeps large transparent margins, so scale the full canvas instead
    // of cropping and stretching the visible rocket.
    scale: 1.02,
    offsetY: 125,
    // Chromium/WebView may retain the completed decoder state for a prefetched
    // animated WebP. A unique request URL guarantees every answer starts at F0.
    isolateTimeline: true,
  },
  events: [
    { id: 'choice.contact', frame: 0, action: 'play-correct' },
    { id: 'fx.stars.enter', frame: 1, action: 'mark' },
    { id: 'vehicle.rocket.enter', frame: 36, action: 'show-feedback' },
    { id: 'actor.handoff', frame: 48, action: 'mark' },
    { id: 'vehicle.boost', frame: 61, action: 'play-reward' },
    { id: 'actor.terminal', frame: 106, action: 'mark' },
    { id: 'transition.enter', frame: 118, action: 'complete' },
  ],
};

const SPACE_WRONG_TIMELINE: ReadingFeedbackTimelineSpec = {
  sceneId: 'space',
  correct: false,
  presentation: {
    animateIn: false,
    // The 550x1280 source is rendered at the Demo's natural stage scale.
    // Its actor remains centered on the selected option while the wreck falls
    // into the source canvas from above.
    scale: 1.35,
    offsetY: 121,
    isolateTimeline: true,
  },
  events: [
    { id: 'choice.wrong', frame: 0, action: 'mark' },
    { id: 'audio.wrong', frame: 0, action: 'play-wrong' },
    // This timeline starts only after the penalty terminal effect and landing
    // have both completed, so the feedback source can begin at its first frame.
    { id: 'hazard.object.enter', frame: 0, action: 'show-feedback' },
    { id: 'impact.start', frame: 15, action: 'play-danger' },
    { id: 'actor.terminal', frame: 22, action: 'mark' },
    { id: 'page.top.enter', frame: 68, action: 'show-wrong-top' },
    { id: 'transition.enter', frame: 93, action: 'complete' },
  ],
};

export function readingFeedbackTimeline(
  sceneId: string,
  correct: boolean,
): ReadingFeedbackTimelineSpec | null {
  if (sceneId !== 'space') return null;
  if (correct) return SPACE_CORRECT_TIMELINE;
  return SPACE_WRONG_TIMELINE;
}

export function readingFeedbackFrameMs(frame: number): number {
  return Math.round(frame * 1000 / READING_FEEDBACK_TIMELINE_FPS);
}
