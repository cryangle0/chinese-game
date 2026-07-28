import { QuestionService } from '../assets/scripts/services/QuestionService';
import { sampleQuestions } from '../assets/scripts/shared/config/SampleQuestions';

describe('QuestionService', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('keeps startup non-blocking while exposing the remote refresh task', async () => {
    let resolveResponse: ((value: Response) => void) | undefined;
    global.fetch = jest.fn(() => new Promise<Response>((resolve) => {
      resolveResponse = resolve;
    }));
    const service = new QuestionService();
    let initialized = false;
    const task = service.initialize('/api/bank').then(() => {
      initialized = true;
    });
    await Promise.resolve();
    expect(initialized).toBe(true);
    await task;
    resolveResponse?.({
      ok: true,
      json: async () => ({
        version: 'remote_v1',
        questions: sampleQuestions,
      }),
      status: 200,
    } as Response);
    await service.whenRefreshed();
    expect(initialized).toBe(true);
    expect(service.version()).toBe('remote_v1');
  });

  it('keeps the builtin bank when the remote endpoint cannot be reached', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(async () => { throw new Error('offline'); });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = new QuestionService();
    const task = service.initialize('/api/bank');
    await jest.runAllTimersAsync();
    await task;
    expect(service.version()).toBe('builtin_v1');
    expect(warn).toHaveBeenCalled();
    jest.useRealTimers();
  });

  it('does not mix builtin samples into a matching remote question pool', async () => {
    const remote = {
      ...sampleQuestions[0],
      id: 'REMOTE_ONLY_001',
      scenes: ['treasure'],
    };
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ version: 'remote_only', questions: [remote] }),
      status: 200,
    } as Response));
    const service = new QuestionService();
    await service.initialize('/api/bank');
    await service.whenRefreshed();
    const cursor = service.createCursor({
      game: 'writing-treasure',
      scene: 'treasure',
      grade: 'L3',
      term: 'ALL',
      difficulties: ['basic'],
    }, () => 0.5);
    expect(cursor.next()?.id).toBe('REMOTE_ONLY_001');
    expect(cursor.next()?.id).toBe('REMOTE_ONLY_001');
  });

  it('falls back only when the remote bank has no matching scene', async () => {
    const remote = {
      ...sampleQuestions[0],
      id: 'REMOTE_MAGIC_001',
      scenes: ['magic'],
    };
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ version: 'remote_partial', questions: [remote] }),
      status: 200,
    } as Response));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const service = new QuestionService();
    await service.initialize('/api/bank');
    await service.whenRefreshed();
    const cursor = service.createCursor({
      game: 'writing-treasure',
      scene: 'treasure',
      grade: 'L3',
      term: 'ALL',
      difficulties: ['basic'],
    }, () => 0.5);
    expect(cursor.next()?.id).toMatch(/^WT_BUILTIN_/);
    expect(warn).toHaveBeenCalled();
  });
});
