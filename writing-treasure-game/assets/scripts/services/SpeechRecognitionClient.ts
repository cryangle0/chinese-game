import {
  encodeSpeechHints,
  requestTimeoutMs,
  SpeechRecognitionResponse,
} from './SpeechRecordingSupport';

export interface SpeechRecognitionResult {
  readonly result: SpeechRecognitionResponse;
  readonly status: number;
  readonly elapsedMs: number;
}

export class SpeechHttpError extends Error {
  override readonly name = 'SpeechHttpError';

  constructor(readonly status: number) {
    super(`ASR HTTP ${status}`);
  }
}

export async function requestSpeechRecognition(
  audio: Blob,
  options: readonly string[],
  abort: AbortController,
): Promise<SpeechRecognitionResult> {
  const timer = setTimeout(() => abort.abort(), requestTimeoutMs);
  const startedAt = Date.now();
  try {
    const response = await fetch(speechEndpoint(), {
      method: 'POST',
      headers: {
        'content-type': audio.type,
        'x-asr-hints': encodeSpeechHints(options),
      },
      body: audio,
      signal: abort.signal,
    });
    if (!response.ok) throw new SpeechHttpError(response.status);
    return {
      result: await response.json() as SpeechRecognitionResponse,
      status: response.status,
      elapsedMs: Math.max(0, Date.now() - startedAt),
    };
  } finally {
    clearTimeout(timer);
  }
}

function speechEndpoint(): string {
  return typeof location !== 'undefined' && location.hostname === 'game.xyouxing.com'
    ? 'https://agent.onnsa.cn/writing-treasure/api/asr'
    : '/api/asr';
}
