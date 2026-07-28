import { LaunchContext } from '../platform/HostAdapter';
import { Analytics } from './Analytics';
import { AudioService } from './AudioService';
import { QuestionService } from './QuestionService';

export interface GameServices {
  readonly questions: QuestionService;
  readonly analytics: Analytics;
  readonly audio: AudioService;
  initialize(): Promise<void>;
  update(deltaSeconds: number): void;
  dispose(): void;
}

export function createGameServices(context: LaunchContext): GameServices {
  const questions = new QuestionService();
  const analytics = new Analytics(context.trackEndpoint, {
    activityId: context.activityId,
    channel: context.channel,
    host: context.host,
    sessionId: context.sessionId,
  });
  const audio = new AudioService();
  let disposed = false;
  return {
    questions,
    analytics,
    audio,
    initialize: () => questions.initialize(context.bankUrl),
    update: (deltaSeconds) => {
      if (!disposed) analytics.update(deltaSeconds);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      audio.dispose();
      void analytics.flush();
    },
  };
}
