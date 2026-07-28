import { Analytics } from '../assets/scripts/services/Analytics';
import {
  trackVoiceDiagnostic,
  trackVoiceGuard,
} from '../assets/scripts/games/writing-treasure/controllers/VoiceAnswerDiagnostics';

describe('voice answer diagnostics', () => {
  it('queues privacy-safe speech records through analytics', () => {
    const analytics = new Analytics('', { sessionId: 'session-safe' });
    trackVoiceDiagnostic(analytics, {
      attemptId: 'voice-attempt',
      phase: 'asr_response',
      httpStatus: 200,
      transcriptLength: 3,
    });

    expect(analytics.drain()).toMatchObject([{
      name: 'voice_diagnostic',
      game: 'writing-treasure',
      properties: {
        sessionId: 'session-safe',
        attemptId: 'voice-attempt',
        phase: 'asr_response',
        httpStatus: 200,
        transcriptLength: 3,
      },
    }]);
  });

  it('records accepted and guard-rejected matcher results', () => {
    const analytics = new Analytics();
    expect(trackVoiceGuard(analytics, {
      attemptId: 'accepted-attempt',
      matchIndex: 1,
      sameQuestion: true,
      awaitingAnswer: true,
      roundState: 'awaiting-answer',
    })).toBe(true);
    expect(trackVoiceGuard(analytics, {
      attemptId: 'rejected-attempt',
      matchIndex: 2,
      sameQuestion: false,
      awaitingAnswer: false,
      roundState: 'feedback',
    })).toBe(false);

    expect(analytics.drain().map((event) => event.properties)).toEqual([
      expect.objectContaining({
        attemptId: 'accepted-attempt',
        phase: 'accepted',
        sameQuestion: true,
        awaitingAnswer: true,
      }),
      expect.objectContaining({
        attemptId: 'rejected-attempt',
        phase: 'guard_rejected',
        sameQuestion: false,
        awaitingAnswer: false,
        roundState: 'feedback',
      }),
    ]);
  });
});
