import {
  chineseLetterExact, editDistance, normalize, ordinalAliases,
  spokenVariants, uniqueIndex,
} from './SpeechOptionNormalize';

type MatchTier = 'exact' | 'contained' | 'ordinal' | 'keyword' | 'partial' | 'fuzzy';

const TIER_SCORE: Record<MatchTier, number> = {
  exact: 100,
  contained: 82,
  ordinal: 70,
  keyword: 66,
  partial: 58,
  fuzzy: 50,
};

function exactMatch(variants: readonly string[], candidates: readonly string[]): number | null {
  return uniqueIndex(candidates.flatMap((candidate, index) =>
    candidate && variants.includes(candidate) ? [index] : []));
}

function containedMatch(variants: readonly string[], candidates: readonly string[]): number | null {
  return uniqueIndex(candidates.flatMap((candidate, index) =>
    candidate.length >= 1 && variants.some((variant) => variant.includes(candidate))
      ? [index] : []));
}

function ordinalMatch(variants: readonly string[], optionCount: number): number | null {
  return uniqueIndex(ordinalAliases.flatMap((aliases, index) => {
    if (index >= optionCount) return [];
    const hit = variants.some((variant) => {
      if (aliases.includes(variant)) return true;
      return aliases.some((alias) => {
        if (chineseLetterExact.has(alias)) return false;
        return variant.startsWith(alias) && variant.length <= alias.length + 12;
      });
    });
    return hit ? [index] : [];
  }));
}

/** Unique ≥2-char chunk of one option appears in speech and not in other options. */
function keywordMatch(variants: readonly string[], candidates: readonly string[]): number | null {
  const hits: number[] = [];
  candidates.forEach((candidate, index) => {
    if (candidate.length < 2) return;
    const tokens: string[] = [candidate];
    if (candidate.length >= 3) {
      for (let i = 0; i <= candidate.length - 2; i += 1) tokens.push(candidate.slice(i, i + 2));
      if (candidate.length >= 4) {
        for (let i = 0; i <= candidate.length - 3; i += 1) tokens.push(candidate.slice(i, i + 3));
      }
    }
    const uniqueTokens = tokens.filter((token) =>
      token.length >= 2
      && candidates.every((other, otherIndex) =>
        otherIndex === index || !other.includes(token)));
    if (!uniqueTokens.length) return;
    const matched = variants.some((variant) =>
      uniqueTokens.some((token) => variant.includes(token)
        && (token.length >= 3 || variant.length <= token.length + 6)));
    if (matched) hits.push(index);
  });
  return uniqueIndex(hits);
}

function partialMatch(variants: readonly string[], candidates: readonly string[]): number | null {
  return uniqueIndex(candidates.flatMap((candidate, index) => {
    const minLen = candidate.length <= 3 ? 2 : 3;
    return candidate.length >= 2 && variants.some((variant) =>
      variant.length >= minLen
      && candidate.includes(variant)
      && variant.length / candidate.length >= 0.55)
      ? [index] : [];
  }));
}

function similarity(candidate: string, variant: string): number {
  if (candidate.length < 2 || variant.length < 2) return 0;
  const longest = Math.max(candidate.length, variant.length);
  const distance = editDistance(candidate, variant);
  const allowed = Math.max(1, Math.floor(longest * 0.3));
  return distance <= allowed ? 1 - distance / longest : 0;
}

function fuzzyMatch(variants: readonly string[], candidates: readonly string[]): number | null {
  const scores = candidates.map((candidate, index) => ({
    index,
    score: variants.reduce((best, variant) =>
      Math.max(best, similarity(candidate, variant)), 0),
  })).sort((left, right) => right.score - left.score);
  const [best, second] = scores;
  if (!best || best.score < 0.65 || (second && best.score - second.score < 0.08)) return null;
  return best.index;
}

function matchWithTier(
  transcript: string,
  options: readonly string[],
): { index: number; tier: MatchTier; score: number } | null {
  const variants = spokenVariants(transcript);
  if (!variants.length) return null;
  const candidates = options.map(normalize);
  const steps: Array<{ tier: MatchTier; index: number | null }> = [
    { tier: 'exact', index: exactMatch(variants, candidates) },
    { tier: 'contained', index: containedMatch(variants, candidates) },
    { tier: 'ordinal', index: ordinalMatch(variants, options.length) },
    { tier: 'keyword', index: keywordMatch(variants, candidates) },
    { tier: 'partial', index: partialMatch(variants, candidates) },
    { tier: 'fuzzy', index: fuzzyMatch(variants, candidates) },
  ];
  for (const step of steps) {
    if (step.index === null) continue;
    let score = TIER_SCORE[step.tier];
    if (step.tier === 'fuzzy') {
      const sim = variants.reduce((best, variant) =>
        Math.max(best, similarity(candidates[step.index!] ?? '', variant)), 0);
      score += Math.round(sim * 20);
    }
    return { index: step.index, tier: step.tier, score };
  }
  return null;
}

/** Match spoken transcript to an option index (A/B/C, text, or both). */
export function matchSpokenOption(transcript: string, options: readonly string[]): number | null {
  return matchWithTier(transcript, options)?.index ?? null;
}

/** Prefer strongest unique transcript; near-equal conflicts still return null. */
export function matchSpokenTranscripts(
  transcripts: readonly string[],
  options: readonly string[],
): number | null {
  const scored = transcripts
    .map((transcript) => matchWithTier(transcript, options))
    .filter((hit): hit is NonNullable<typeof hit> => hit !== null)
    .sort((left, right) => right.score - left.score);
  if (!scored.length) return null;
  const [best, second] = scored;
  if (!best) return null;
  if (scored.every((hit) => hit.index === best.index)) return best.index;
  if (second && best.index !== second.index && best.score - second.score < 12) return null;
  return best.index;
}
