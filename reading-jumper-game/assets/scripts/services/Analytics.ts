import { AppConfig } from '../shared/config/AppConfig';
import { GameId } from '../shared/types/GameTypes';

export interface AnalyticsEvent {
  name: string;
  game?: GameId;
  properties?: Readonly<Record<string, string | number | boolean>>;
}

interface QueuedEvent extends AnalyticsEvent {
  id: string;
  timestamp: number;
  sessionId: string;
  attempts: number;
}

const STORAGE_KEY = 'zyb-reading-jumper-analytics-v2';
const DEAD_LETTER_KEY = 'zyb-reading-jumper-analytics-dead-v2';

export class Analytics {
  private readonly queue: QueuedEvent[] = [];
  private readonly maxQueue = 64;
  private elapsed = 0;
  private flushing = false;
  private sequence = 0;
  private retryAt = 0;

  constructor(
    private readonly endpoint = '',
    private readonly context: Readonly<Record<string, string>> = {},
  ) {
    this.restore();
  }

  track(event: AnalyticsEvent): void {
    if (this.queue.length >= this.maxQueue) this.queue.shift();
    this.queue.push({
      ...event,
      id: `${Date.now()}-${this.sequence++}`,
      timestamp: Date.now(),
      sessionId: this.context.sessionId ?? '',
      attempts: 0,
      properties: { ...this.context, ...event.properties },
    });
    this.persist();
    if (this.queue.length >= AppConfig.analyticsBatchSize) void this.flush();
  }

  update(deltaSeconds: number): void {
    this.elapsed += Math.max(0, deltaSeconds);
    if (this.elapsed >= AppConfig.analyticsFlushSeconds) {
      this.elapsed = 0;
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (!this.endpoint || this.flushing || !this.queue.length
      || typeof fetch === 'undefined' || Date.now() < this.retryAt) return;
    this.flushing = true;
    const batch = this.queue.slice(0, AppConfig.analyticsBatchSize);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`analytics HTTP ${response.status}`);
      this.queue.splice(0, batch.length);
      this.retryAt = 0;
      this.persist();
    } catch (error) {
      batch.forEach((event) => { event.attempts = (event.attempts ?? 0) + 1; });
      const exhausted = batch.filter((event) => event.attempts >= 8);
      if (exhausted.length) {
        this.deadLetter(exhausted);
        const exhaustedIds = new Set(exhausted.map((event) => event.id));
        for (let index = this.queue.length - 1; index >= 0; index -= 1) {
          if (exhaustedIds.has(this.queue[index].id)) this.queue.splice(index, 1);
        }
      }
      const attempts = batch[0]?.attempts ?? 1;
      this.retryAt = Date.now() + Math.min(60000, 1000 * 2 ** Math.min(6, attempts - 1));
      this.persist();
      console.warn('[Analytics] flush deferred', error);
    } finally {
      clearTimeout(timeout);
      this.flushing = false;
    }
  }

  drain(): AnalyticsEvent[] {
    const events = this.queue.splice(0, this.queue.length);
    this.persist();
    return events;
  }

  private restore(): void {
    try {
      const raw = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const events: unknown = JSON.parse(raw);
      if (Array.isArray(events)) {
        this.queue.push(...events.slice(-this.maxQueue).map((event) => ({
          ...event,
          attempts: Number(event.attempts) || 0,
        })));
      }
    } catch {
      // Storage can be unavailable in privacy modes.
    }
  }

  private persist(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.queue));
      }
    } catch {
      // The in-memory queue remains usable when storage quota is exhausted.
    }
  }

  private deadLetter(events: readonly QueuedEvent[]): void {
    try {
      if (typeof localStorage === 'undefined') return;
      const existing = JSON.parse(localStorage.getItem(DEAD_LETTER_KEY) ?? '[]');
      const dead = Array.isArray(existing) ? existing : [];
      localStorage.setItem(DEAD_LETTER_KEY, JSON.stringify([...dead, ...events].slice(-100)));
    } catch {
      // Dead-letter persistence must never interfere with gameplay.
    }
  }
}
