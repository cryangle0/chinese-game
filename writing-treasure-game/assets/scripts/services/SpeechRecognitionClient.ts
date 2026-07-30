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

export class SpeechRequestTimeoutError extends Error {
  override readonly name = 'SpeechRequestTimeoutError';

  constructor() {
    super('ASR request timed out');
  }
}

export async function requestSpeechRecognition(
  audio: Blob,
  options: readonly string[],
  abort: AbortController,
  timeoutMs = requestTimeoutMs,
): Promise<SpeechRecognitionResult> {
  const requestAbort = new AbortController();
  let timedOut = false;
  const cancelRequest = () => requestAbort.abort();
  if (abort.signal.aborted) cancelRequest();
  else abort.signal.addEventListener('abort', cancelRequest, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    requestAbort.abort();
  }, Math.max(1, timeoutMs));
  const startedAt = Date.now();
  try {
    const response = await fetch(speechEndpoint(), {
      method: 'POST',
      headers: {
        'content-type': audio.type,
        'x-asr-hints': encodeSpeechHints(options),
      },
      body: audio,
      signal: requestAbort.signal,
    });
    if (!response.ok) throw new SpeechHttpError(response.status);
    return {
      result: await response.json() as SpeechRecognitionResponse,
      status: response.status,
      elapsedMs: Math.max(0, Date.now() - startedAt),
    };
  } catch (error) {
    if (timedOut && !abort.signal.aborted && isAbortError(error)) {
      throw new SpeechRequestTimeoutError();
    }
    throw error;
  } finally {
    clearTimeout(timer);
    abort.signal.removeEventListener('abort', cancelRequest);
  }
}

export function isTransientSpeechError(error: unknown): boolean {
  if (error instanceof SpeechHttpError) {
    return error.status === 408 || error.status === 429 || error.status >= 500;
  }
  if (error instanceof SpeechRequestTimeoutError) return true;
  if (error instanceof TypeError) return true;
  return error instanceof SyntaxError
    || (error instanceof Error && error.name === 'NetworkError');
}

function speechEndpoint(): string {
  return typeof location !== 'undefined' && location.hostname === 'game.xyouxing.com'
    ? 'https://agent.onnsa.cn/writing-treasure/api/asr'
    : '/api/asr';
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}
