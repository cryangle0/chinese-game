import { matchSpokenTranscripts } from './SpeechOptionMatcher';
import { requestSpeechRecognition, SpeechHttpError } from './SpeechRecognitionClient';
import { transcriptsFrom } from './SpeechRecordingSupport';
import { VoiceAttemptDiagnostics } from './VoiceDiagnostics';

export async function recognizeSpeechAudio(
  audio: Blob,
  options: readonly string[],
  abort: AbortController,
  diagnostic: VoiceAttemptDiagnostics,
): Promise<number | null> {
  const response = await requestSpeechRecognition(audio, options, abort);
  const transcripts = transcriptsFrom(response.result);
  diagnostic.emit('asr_response', {
    httpStatus: response.status,
    requestId: response.result.requestId,
    transcriptPresent: transcripts.length > 0,
    transcriptLength: response.result.transcript?.length ?? 0,
    elapsedMs: response.elapsedMs,
  });
  const matchedIndex = matchSpokenTranscripts(transcripts, options);
  diagnostic.emit(
    matchedIndex === null ? 'match_failed' : 'match_success',
    matchedIndex === null ? undefined : { matchIndex: matchedIndex },
  );
  return matchedIndex;
}

export function speechHttpStatus(error: unknown): number | undefined {
  return error instanceof SpeechHttpError ? error.status : undefined;
}
