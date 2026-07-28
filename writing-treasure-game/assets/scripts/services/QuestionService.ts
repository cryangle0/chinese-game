import { sampleQuestions } from '../shared/config/SampleQuestions';
import { QuestionFilter } from '../shared/types/Question';
import { QuestionBank } from './QuestionBank';
import { QuestionCursor } from './QuestionCursor';
import { parseQuestionPack, QuestionPack } from './QuestionSchema';

const CACHE_KEY = 'zyb-writing-treasure-question-pack-v1';

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export class QuestionService {
  private readonly fallbackBank = new QuestionBank(sampleQuestions);
  private bank = this.fallbackBank;
  private versionValue = 'builtin_v1';
  private refreshTask: Promise<void> | null = null;
  private usingExternalBank = false;

  async initialize(url: string): Promise<void> {
    const cached = this.readCache();
    if (cached) this.use(cached);
    if (!url || typeof fetch === 'undefined') return;
    // Do not block intro on network/JSON parse — cover must stay interactive.
    const refresh = this.refresh(url);
    this.refreshTask = refresh;
    void refresh.finally(() => {
      if (this.refreshTask === refresh) this.refreshTask = null;
    });
  }

  whenRefreshed(): Promise<void> {
    return this.refreshTask ?? Promise.resolve();
  }

  private async refresh(url: string): Promise<void> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await this.fetchWithTimeout(url, 2500);
        if (!response.ok) throw new Error(`question bank HTTP ${response.status}`);
        const remote = parseQuestionPack(await response.json());
        if (!remote?.questions.length) throw new Error('invalid question pack');
        this.use(remote);
        storage()?.setItem(CACHE_KEY, JSON.stringify(remote));
        return;
      } catch (error) {
        lastError = error;
        if (attempt < 2) await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
    }
    console.warn('[QuestionService] using cached/builtin bank', lastError);
  }

  createCursor(
    filter: QuestionFilter,
    random?: () => number,
    excludedIds: ReadonlySet<string> = new Set(),
  ): QuestionCursor {
    try {
      return this.bank.createCursor(filter, random, excludedIds);
    } catch (error) {
      if (!this.usingExternalBank) throw error;
      console.warn('[QuestionService] no matching remote questions; using builtin bank', error);
      return this.fallbackBank.createCursor(filter, random, excludedIds);
    }
  }

  version(): string {
    return this.versionValue;
  }

  private use(pack: QuestionPack): void {
    this.bank = new QuestionBank(pack.questions);
    this.usingExternalBank = true;
    this.versionValue = pack.version;
  }

  private readCache(): QuestionPack | null {
    try {
      const raw = storage()?.getItem(CACHE_KEY);
      if (!raw) return null;
      return parseQuestionPack(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  private async fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { signal: controller.signal, cache: 'no-cache' });
    } finally {
      clearTimeout(timeout);
    }
  }
}
