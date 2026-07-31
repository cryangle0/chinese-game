import { Analytics } from '../../../services/Analytics';
import {
  VoiceDiagnostic,
  voiceDiagnosticProperties,
} from '../../../services/VoiceDiagnostics';

interface VoiceGuardDiagnostic {
  readonly attemptId: string;
  readonly matchIndex: number;
  readonly sameQuestion: boolean;
  readonly awaitingAnswer: boolean;
  readonly roundState: string;
}

export function trackVoiceDiagnostic(
  analytics: Analytics,
  record: VoiceDiagnostic,
): void {
  analytics.track({
    name: 'voice_diagnostic',
    game: 'writing-treasure',
    properties: voiceDiagnosticProperties(record),
  });
  if (record.phase === 'accepted' || record.phase === 'guard_rejected'
    || record.phase === 'asr_error' || record.phase === 'capture_empty'
    || record.phase === 'match_failed' || record.phase === 'released_before_ready') {
    void analytics.flush();
  }
}

export function trackVoiceGuard(
  analytics: Analytics,
  guard: VoiceGuardDiagnostic,
): boolean {
  const accepted = guard.sameQuestion && guard.awaitingAnswer;
  trackVoiceDiagnostic(analytics, {
    attemptId: guard.attemptId,
    phase: accepted ? 'accepted' : 'guard_rejected',
    matchIndex: guard.matchIndex,
    sameQuestion: guard.sameQuestion,
    awaitingAnswer: guard.awaitingAnswer,
    roundState: guard.roundState,
  });
  return accepted;
}
