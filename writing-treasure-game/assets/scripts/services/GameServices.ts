import { LaunchContext } from '../platform/HostAdapter';
import { Analytics } from './Analytics';
import { AudioService } from './AudioService';
import { QuestionService } from './QuestionService';
import { SpeechStreamPool } from './SpeechStreamPool';

export interface GameServices {
  readonly questions: QuestionService;
  readonly analytics: Analytics;
  readonly audio: AudioService;
  readonly speechStreams: SpeechStreamPool;
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
  const speechStreams = new SpeechStreamPool();
  let disposed = false;
  return {
    questions,
    analytics,
    audio,
    speechStreams,
    initialize: () => questions.initialize(context.bankUrl),
    update: (deltaSeconds) => {
      if (!disposed) analytics.update(deltaSeconds);
    },
    dispose: () => {
      if (disposed) return;
      disposed = true;
      audio.dispose();
      speechStreams.close();
      void analytics.flush();
    },
  };
}
