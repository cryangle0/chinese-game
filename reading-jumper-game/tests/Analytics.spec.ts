import { Analytics } from '../assets/scripts/services/Analytics';

class MemoryStorage {
  private readonly values = new Map<string, string>();
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  get length(): number { return this.values.size; }
}

describe('Analytics', () => {
  const originalFetch = global.fetch;
  const originalStorage = global.localStorage;

  beforeEach(() => {
    global.localStorage = new MemoryStorage();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.localStorage = originalStorage;
    jest.restoreAllMocks();
  });

  it('queues contextualized events and drains them deterministically', () => {
    const analytics = new Analytics('', { sessionId: 'session-a', channel: 'test' });
    analytics.track({ name: 'answer', game: 'reading-jumper', properties: { correct: true } });
    expect(analytics.drain()).toMatchObject([{
      name: 'answer',
      sessionId: 'session-a',
      properties: { sessionId: 'session-a', channel: 'test', correct: true },
    }]);
  });

  it('removes a batch only after the endpoint accepts it', async () => {
    global.fetch = jest.fn(async () => ({ ok: true } as Response));
    const analytics = new Analytics('/api/track', { sessionId: 'session-b' });
    analytics.track({ name: 'app_enter', game: 'reading-jumper' });
    await analytics.flush();
    expect(analytics.drain()).toEqual([]);
  });

  it('restores persisted events and retains a rejected batch', async () => {
    const first = new Analytics('', { sessionId: 'restore' });
    first.track({ name: 'queued', game: 'reading-jumper' });
    expect(new Analytics().drain()).toHaveLength(1);
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 } as Response));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const analytics = new Analytics('/api/track', { sessionId: 'retry' });
    analytics.track({ name: 'retry', game: 'reading-jumper' });
    await analytics.flush();
    expect(analytics.drain()).toHaveLength(1);
    expect(warn).toHaveBeenCalled();
  });

  it('bounds the offline queue to avoid unbounded session memory', () => {
    const analytics = new Analytics('', { sessionId: 'bounded' });
    for (let index = 0; index < 70; index += 1) {
      analytics.track({ name: `event-${index}` });
    }
    const events = analytics.drain();
    expect(events).toHaveLength(64);
    expect(events[0]?.name).toBe('event-6');
  });
});
