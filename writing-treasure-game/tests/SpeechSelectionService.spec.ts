import { matchSpokenOption, matchSpokenTranscripts, SpeechSelectionService } from '../assets/scripts/services/SpeechSelectionService';
import { calculateRms } from '../assets/scripts/services/SpeechActivityWatcher';
import { SpeechStreamPool } from '../assets/scripts/services/SpeechStreamPool';
import { VoiceDiagnostic } from '../assets/scripts/services/VoiceDiagnostics';

class FakeMediaRecorder {
  static latest: FakeMediaRecorder | undefined;
  static supportedTypes = new Set(['audio/webm;codecs=opus']);
  static isTypeSupported(type: string): boolean {
    return FakeMediaRecorder.supportedTypes.has(type);
  }

  state: RecordingState = 'inactive';
  mimeType: string;
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType ?? '';
    FakeMediaRecorder.latest = this;
  }

  start(_timeslice?: number): void { this.state = 'recording'; }
  stop(): void {
    this.state = 'inactive';
    this.onstop?.();
  }

  emitData(type = this.mimeType || 'audio/webm'): void {
    this.ondataavailable?.({
      data: new Blob([new Uint8Array(256)], { type }),
    } as BlobEvent);
  }
}

const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
const originalMediaRecorder = globalThis.MediaRecorder;
const originalFetch = globalThis.fetch;

function restoreProperty(name: 'window' | 'navigator', descriptor?: PropertyDescriptor): void {
  if (descriptor) Object.defineProperty(globalThis, name, descriptor);
  else Reflect.deleteProperty(globalThis, name);
}

function installBrowser(fetchImpl: typeof fetch = jest.fn(async () =>
  new Response(JSON.stringify({ transcript: '第二个' }), { status: 200 }))) {
  const tracks: {
    stop: jest.Mock;
    enabled: boolean;
    readyState: MediaStreamTrackState;
  }[] = [];
  const getUserMedia = jest.fn(async () => {
    const track = {
      enabled: true,
      readyState: 'live' as MediaStreamTrackState,
      stop: jest.fn(),
    };
    track.stop.mockImplementation(() => {
      track.enabled = false;
      track.readyState = 'ended';
    });
    tracks.push(track);
    return { getTracks: () => [track] } as unknown as MediaStream;
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: { mediaDevices: { getUserMedia } },
  });
  globalThis.MediaRecorder = FakeMediaRecorder as unknown as typeof MediaRecorder;
  globalThis.fetch = fetchImpl;
  return { tracks, getUserMedia };
}

async function flushAsync(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
}

afterEach(() => {
  restoreProperty('window', originalWindow);
  restoreProperty('navigator', originalNavigator);
  globalThis.MediaRecorder = originalMediaRecorder;
  globalThis.fetch = originalFetch;
  FakeMediaRecorder.latest = undefined;
  FakeMediaRecorder.supportedTypes = new Set(['audio/webm;codecs=opus']);
});

describe('speech option matching', () => {
  const options = ['连接补语', '表示拥有', '表示过去'];

  it('matches full content and explicit ordinal aliases', () => {
    expect(matchSpokenOption('我选表示拥有', options)).toBe(1);
    expect(matchSpokenOption('第一个选项', options)).toBe(0);
    expect(matchSpokenOption('选C', options)).toBe(2);
    expect(matchSpokenOption('', options)).toBeNull();
  });

  it('accepts a unique minor recognition error but rejects short ambiguous fragments', () => {
    expect(matchSpokenOption('链接补语', options)).toBe(0);
    expect(matchSpokenOption('表示过', options)).toBe(2);
    expect(matchSpokenOption('表示', options)).toBeNull();
    expect(matchSpokenOption('连接', ['连接补语', '连接状语', '表示过去'])).toBeNull();
  });

  it('matches A、option labels and ASR near-miss place names', () => {
    const places = ['流沙河', '火焰山', '景阳冈'];
    expect(matchSpokenOption('A、流沙河', places)).toBe(0);
    expect(matchSpokenOption('B、火焰山', places)).toBe(1);
    expect(matchSpokenOption('C景阳冈', places)).toBe(2);
    expect(matchSpokenOption('景阳刚', places)).toBe(2);
    expect(matchSpokenOption('火焰', places)).toBe(1);
    expect(matchSpokenOption('流沙河', places)).toBe(0);
  });

  it('prefers exact option text when ASR alternatives also include an ordinal', () => {
    expect(matchSpokenTranscripts(
      ['答案是火焰山', '第二个'],
      ['流沙河', '火焰山', '景阳冈'],
    )).toBe(1);
  });

  it('does not treat an ordinal-like phrase inside a longer sentence as an answer', () => {
    expect(matchSpokenOption('第一章节讲的是过去时态', options)).toBeNull();
  });

  it('ignores malformed runtime options instead of failing a valid match', () => {
    const runtimeOptions = ['惊喜', { text: 'invalid' }, '激动'] as unknown as string[];
    expect(matchSpokenOption('焦急和伤心', runtimeOptions)).toBeNull();
    runtimeOptions[1] = '焦急和伤心';
    expect(matchSpokenOption('焦急和伤心', runtimeOptions)).toBe(1);
  });
});

describe('speech activity energy', () => {
  it('distinguishes silence from a voice-like waveform', () => {
    expect(calculateRms(new Uint8Array(64).fill(128))).toBe(0);
    const waveform = Uint8Array.from({ length: 64 }, (_, index) =>
      index % 2 ? 154 : 102);
    expect(calculateRms(waveform)).toBeGreaterThan(0.18);
  });
});

describe('SpeechSelectionService', () => {
  const options = ['连接补语', '表示拥有', '表示过去'];

  it('records optimized audio, posts hints, parks the microphone, and matches', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({
        transcript: '第二个',
        requestId: 'request-success',
      }), { status: 200 }));
    const { tracks, getUserMedia } = installBrowser(fetchMock);
    const diagnostics: VoiceDiagnostic[] = [];
    const service = new SpeechSelectionService((record) => diagnostics.push(record));
    const states: string[] = [];
    const matches: number[] = [];

    service.listen(options, (index) => matches.push(index), (state) => states.push(state));
    await flushAsync();
    FakeMediaRecorder.latest?.emitData();
    FakeMediaRecorder.latest?.stop();
    await flushAsync();

    expect(getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({
        autoGainControl: false,
        echoCancellation: true,
        noiseSuppression: true,
      }),
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/asr', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        'content-type': 'audio/webm;codecs=opus',
        'x-asr-hints': expect.any(String),
      }),
    }));
    expect(matches).toEqual([1]);
    expect(states).toEqual(['listening', 'processing', 'idle']);
    expect(tracks[0].enabled).toBe(false);
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(diagnostics.map((record) => record.phase)).toEqual([
      'started',
      'microphone_ready',
      'capture_ready',
      'asr_response',
      'match_success',
    ]);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'capture_ready',
        audioBytes: 256,
        mimeType: 'audio/webm;codecs=opus',
      }),
      expect.objectContaining({
        phase: 'asr_response',
        httpStatus: 200,
        requestId: 'request-success',
        transcriptPresent: true,
        transcriptLength: 3,
      }),
      expect.objectContaining({ phase: 'match_success', matchIndex: 1 }),
    ]));
    service.dispose();
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
  });

  it('delivers a valid match even when the game callback immediately stops listening', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ transcript: '第二个' }), { status: 200 }));
    installBrowser(fetchMock);
    const service = new SpeechSelectionService();
    const matches: number[] = [];
    const states: string[] = [];

    service.listen(options, (index) => {
      matches.push(index);
      service.stop();
    }, (state) => states.push(state));
    await flushAsync();
    FakeMediaRecorder.latest?.emitData();
    FakeMediaRecorder.latest?.stop();
    await flushAsync();

    expect(matches).toEqual([1]);
    expect(states).toEqual(['listening', 'processing', 'idle']);
  });

  it('falls back to a supported recorder format for Safari-style browsers', async () => {
    FakeMediaRecorder.supportedTypes = new Set(['audio/mp4']);
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ transcript: '' }), { status: 200 }));
    installBrowser(fetchMock);
    const service = new SpeechSelectionService();

    service.listen(options, jest.fn(), jest.fn());
    await flushAsync();
    FakeMediaRecorder.latest?.emitData('audio/mp4');
    FakeMediaRecorder.latest?.stop();
    await flushAsync();

    expect(FakeMediaRecorder.latest?.mimeType).toBe('audio/mp4');
    expect(fetchMock).toHaveBeenCalledWith('/api/asr', expect.objectContaining({
      headers: expect.objectContaining({ 'content-type': 'audio/mp4' }),
    }));
  });

  it('stops and parks the microphone before recognition completes without stale callbacks', async () => {
    let requestSignal: AbortSignal | undefined;
    const fetchMock = jest.fn((_url: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal ?? undefined;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener('abort', () =>
          reject(new DOMException('aborted', 'AbortError')));
      });
    }) as jest.MockedFunction<typeof fetch>;
    const { tracks } = installBrowser(fetchMock);
    const service = new SpeechSelectionService();
    const states: string[] = [];
    const onMatch = jest.fn();

    service.listen(options, onMatch, (state) => states.push(state));
    await flushAsync();
    FakeMediaRecorder.latest?.emitData();
    FakeMediaRecorder.latest?.stop();
    await flushAsync();
    service.stop();
    await flushAsync();

    expect(requestSignal?.aborted).toBe(true);
    expect(tracks[0].enabled).toBe(false);
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
    expect(onMatch).not.toHaveBeenCalled();
    expect(states).toEqual(['listening', 'processing']);
    service.dispose();
    expect(tracks[0].stop).toHaveBeenCalledTimes(1);
  });

  it('releases and reacquires the microphone across questions and scenes', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ transcript: '第二个' }), { status: 200 }));
    const { tracks, getUserMedia } = installBrowser(fetchMock);
    const service = new SpeechSelectionService();

    for (let attempt = 0; attempt < 2; attempt += 1) {
      service.listen(options, jest.fn(), jest.fn());
      await flushAsync();
      FakeMediaRecorder.latest?.emitData();
      FakeMediaRecorder.latest?.stop();
      await flushAsync();
    }

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(tracks).toHaveLength(2);
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    service.dispose();
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
  });

  it('releases the microphone across game controller lifecycles', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ transcript: '第二个' }), { status: 200 }));
    const { tracks, getUserMedia } = installBrowser(fetchMock);
    const streams = new SpeechStreamPool();

    for (let controller = 0; controller < 2; controller += 1) {
      const service = new SpeechSelectionService(undefined, streams);
      service.listen(options, jest.fn(), jest.fn());
      await flushAsync();
      FakeMediaRecorder.latest?.emitData();
      FakeMediaRecorder.latest?.stop();
      await flushAsync();
      service.dispose();
    }

    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(tracks).toHaveLength(2);
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
    streams.close();
    tracks.forEach((track) => expect(track.stop).toHaveBeenCalledTimes(1));
  });

  it('does not repeatedly request permission after an explicit denial', async () => {
    const { getUserMedia } = installBrowser();
    getUserMedia.mockRejectedValue(new DOMException('denied', 'NotAllowedError'));
    const service = new SpeechSelectionService();
    const states: string[] = [];

    for (let attempt = 0; attempt < 2; attempt += 1) {
      service.listen(options, jest.fn(), (state) => states.push(state));
      await flushAsync();
    }

    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(states).toEqual(['listening', 'error', 'listening', 'error']);
  });

  it('does not upload an empty recording', async () => {
    const fetchMock = jest.fn();
    installBrowser(fetchMock as unknown as typeof fetch);
    const diagnostics: VoiceDiagnostic[] = [];
    const service = new SpeechSelectionService((record) => diagnostics.push(record));
    const states: string[] = [];

    service.listen(options, jest.fn(), (state) => states.push(state));
    await flushAsync();
    FakeMediaRecorder.latest?.stop();
    await flushAsync();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(states).toEqual(['listening', 'no-match']);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({ phase: 'capture_empty', audioBytes: 0 }),
    ]));
  });

  it('diagnoses ASR HTTP failures without logging response content', async () => {
    const fetchMock = jest.fn(async () =>
      new Response(JSON.stringify({ error: 'provider secret' }), { status: 503 }));
    installBrowser(fetchMock);
    const diagnostics: VoiceDiagnostic[] = [];
    const service = new SpeechSelectionService((record) => diagnostics.push(record));
    const states: string[] = [];

    service.listen(options, jest.fn(), (state) => states.push(state));
    await flushAsync();
    FakeMediaRecorder.latest?.emitData();
    FakeMediaRecorder.latest?.stop();
    await flushAsync();

    expect(states).toEqual(['listening', 'processing', 'error']);
    expect(diagnostics).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'asr_error',
        httpStatus: 503,
        errorName: 'SpeechHttpError',
      }),
    ]));
    expect(JSON.stringify(diagnostics)).not.toContain('provider secret');
  });

  it('refuses conflicting recognition alternatives instead of guessing', async () => {
    const fetchMock = jest.fn(async () => new Response(JSON.stringify({
      transcript: '第一个',
      alternatives: ['第二个'],
    }), { status: 200 }));
    installBrowser(fetchMock);
    const service = new SpeechSelectionService();
    const states: string[] = [];
    const onMatch = jest.fn();

    service.listen(options, onMatch, (state) => states.push(state));
    await flushAsync();
    FakeMediaRecorder.latest?.emitData();
    FakeMediaRecorder.latest?.stop();
    await flushAsync();

    expect(onMatch).not.toHaveBeenCalled();
    expect(states).toEqual(['listening', 'processing', 'no-match']);
  });
});
