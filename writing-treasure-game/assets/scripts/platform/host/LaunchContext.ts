import { DifficultyTier, Grade } from '../../shared/types/GameTypes';
import { ChineseQuestion } from '../../shared/types/Question';
import { resolveBookOption } from '../../shared/config/BookCatalog';
import { HostKind, LaunchContext } from './HostTypes';

const HOSTS: readonly HostKind[] = ['browser', 'wechat', 'wechat-mp', 'zybang'];
const PRODUCTION_H5_HOST = 'game.xyouxing.com';
const WRITING_H5_PATH = '/writing-treasure/';
const WRITING_TRACK_ENDPOINT = 'https://agent.onnsa.cn/writing-treasure/api/track';

function createSessionId(): string {
  const randomUUID = (globalThis.crypto as Crypto | undefined)?.randomUUID;
  if (randomUUID) return randomUUID.call(globalThis.crypto);
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function readLaunchQuery(): URLSearchParams {
  if (typeof location === 'undefined') return new URLSearchParams();
  return new URLSearchParams(location.search);
}

export function detectHost(
  query: URLSearchParams,
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  wxEnvironment = (globalThis as { __wxjs_environment?: string }).__wxjs_environment,
): HostKind {
  const explicit = query.get('host') as HostKind | null;
  if (explicit && HOSTS.includes(explicit)) return explicit;
  if (wxEnvironment === 'miniprogram') return 'wechat-mp';
  if (/zybang|zuoyebang/i.test(userAgent)) return 'zybang';
  return /micromessenger/i.test(userAgent) ? 'wechat' : 'browser';
}

export function parseGrade(value: string): Grade {
  const aliases: Readonly<Record<string, Grade>> = {
    '1': 'L1', '2': 'L2', '3': 'L3', '4': 'L4', '5': 'L5', '6': 'L6',
  };
  if (/^L[1-6]$/.test(value)) return value as Grade;
  return aliases[value] ?? 'L3';
}

export function parseTerm(value: string): ChineseQuestion['term'] {
  return value === 'first' || value === 'second' ? value : 'ALL';
}

export function parseDifficulties(value: string): DifficultyTier[] {
  const supported: readonly DifficultyTier[] = ['basic', 'advanced', 'challenge'];
  const requested = value.split(',').filter((item): item is DifficultyTier =>
    supported.includes(item as DifficultyTier));
  return requested.length ? Array.from(new Set(requested)) : [...supported];
}

function sameOriginRuntimeUrl(value: string | null, fallback: string): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  const origin = typeof location === 'undefined' ? '' : location.origin;
  if (!origin) return /^(?:\.{1,2}\/|\/(?!\/))/.test(candidate) ? candidate : fallback;
  try {
    const url = new URL(candidate, origin);
    return url.origin === origin && /^https?:$/.test(url.protocol) ? candidate : fallback;
  } catch {
    return fallback;
  }
}

function productionTrackEndpoint(): string {
  if (typeof location === 'undefined') return '';
  return location.hostname === PRODUCTION_H5_HOST
    && location.pathname.startsWith(WRITING_H5_PATH)
    ? WRITING_TRACK_ENDPOINT
    : '';
}

function trackRuntimeUrl(value: string | null): string {
  const productionFallback = productionTrackEndpoint();
  const candidate = value?.trim();
  if (!candidate) return productionFallback;
  if (productionFallback && candidate === productionFallback) return candidate;
  return sameOriginRuntimeUrl(candidate, productionFallback);
}

export function parseLaunchContext(
  query: URLSearchParams,
  host: HostKind,
): LaunchContext {
  return {
    activityId: query.get('activityId') ?? '',
    bankUrl: sameOriginRuntimeUrl(query.get('bankUrl'), './question-bank.json'),
    channel: query.get('channel') ?? 'organic',
    difficulties: parseDifficulties(query.get('difficulty') ?? ''),
    grade: parseGrade(query.get('grade') ?? 'L3'),
    host,
    scene: query.get('scene') ?? '',
    sessionId: query.get('sessionId') || createSessionId(),
    skipIntro: query.get('skipIntro') === '1',
    book: resolveBookOption(query.get('book')),
    term: parseTerm(query.get('term') ?? 'ALL'),
    trackEndpoint: trackRuntimeUrl(query.get('trackEndpoint')),
  };
}
