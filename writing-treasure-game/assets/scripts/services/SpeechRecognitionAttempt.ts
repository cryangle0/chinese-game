import { matchSpokenTranscripts } from './SpeechOptionMatcher';
import {
  isTransientSpeechError, requestSpeechRecognition, SpeechHttpError,
} from './SpeechRecognitionClient';
import { requestTimeoutMs, transcriptsFrom } from './SpeechRecordingSupport';
import { VoiceAttemptDiagnostics } from './VoiceDiagnostics';

const maxRecognitionAttempts = 2;

export async function recognizeSpeechAudio(
  audio: Blob,
  options: readonly string[],
  abort: AbortController,
  diagnostic: VoiceAttemptDiagnostics,
): Promise<number | null> {
  const deadline = Date.now() + requestTimeoutMs;
  for (let attempt = 0; attempt < maxRecognitionAttempts; attempt += 1) {
    const remainingMs = deadline - Date.now();
    if (remainingMs <= 0) {
      diagnostic.emit('match_failed');
      return null;
    }
    try {
      const attemptsLeft = maxRecognitionAttempts - attempt;
      const attemptTimeoutMs = Math.max(1, Math.floor(remainingMs / attemptsLeft));
      const response = await requestSpeechRecognition(audio, options, abort, attemptTimeoutMs);
      const transcripts = transcriptsFrom(response.result);
      diagnostic.emit('asr_response', {
        httpStatus: response.status,
        requestId: response.result.requestId,
        transcriptPresent: transcripts.length > 0,
        transcriptLength: response.result.transcript?.length ?? 0,
        elapsedMs: response.elapsedMs,
      });
      const matchedIndex = matchSpokenTranscripts(transcripts, options);
      if (matchedIndex !== null) {
        diagnostic.emit('match_success', { matchIndex: matchedIndex });
        return matchedIndex;
      }
      if (attempt + 1 >= maxRecognitionAttempts || abort.signal.aborted) {
        diagnostic.emit('match_failed');
        return null;
      }
    } catch (error) {
      const canRetry = attempt + 1 < maxRecognitionAttempts
        && !abort.signal.aborted
        && deadline > Date.now()
        && isTransientSpeechError(error);
      if (!canRetry) throw error;
    }
  }
  diagnostic.emit('match_failed');
  return null;
}

export function speechHttpStatus(error: unknown): number | undefined {
  return error instanceof SpeechHttpError ? error.status : undefined;
}
