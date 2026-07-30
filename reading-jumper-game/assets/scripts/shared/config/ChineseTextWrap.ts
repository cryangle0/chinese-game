const FORBIDDEN_LINE_START = /^[，。！？；：、）》】」』”’…⋯,.!?;:)\]}]/u;
const FORBIDDEN_LINE_END = /[（《【「『“‘([{]$/u;
/** 单独成行无意义的引号/括号等 */
const ALONE_LINE = /^[“”‘’「」『』（）()《》【】\[\]]+$/u;
/** 末行不能只剩右标点；需把上一行最后一个正文字符一起移下来。 */
const PUNCTUATION_ONLY_LINE = /^[，。！？；：、）》】」』”’…⋯,.!?;:)\]}]+$/u;

/**
 * Measured advance widths (em) in the web fallback face. CJK glyphs and fullwidth
 * punctuation take a whole em, but curly quotes come from the Latin face and are
 * far narrower. Budgeting every glyph as fullwidth wrapped lines early and pushed
 * closing quotes onto the next line even though they fit.
 */
const NARROW_GLYPH_EM: Readonly<Record<string, number>> = {
  '“': 0.5,
  '”': 0.5,
  '‘': 0.28,
  '’': 0.28,
};

/** Midline ellipsis (U+22EF×2): centered six-dot look on WeChat/Cocos system fonts. */
export const STANDARD_ELLIPSIS = '⋯⋯';

function glyphEm(char: string): number {
  return NARROW_GLYPH_EM[char] ?? 1;
}

/**
 * 题目用中文标点规范：省略号统一为「⋯⋯」（U+22EF 中线省略号×2，字身居中），
 * 不要用英文「...」或西文「…」(U+2026) 贴基线。
 */
export function normalizeChineseTypography(value: string): string {
  return value
    .replace(/\u2026+/g, STANDARD_ELLIPSIS) // … → ⋯⋯
    .replace(/\u22EF+/g, STANDARD_ELLIPSIS) // ⋯ → ⋯⋯
    .replace(/\.{2,}/g, STANDARD_ELLIPSIS)
    .replace(/。{2,}/g, STANDARD_ELLIPSIS)
    .replace(/·{2,}/g, STANDARD_ELLIPSIS)
    .replace(/(⋯⋯)+/g, STANDARD_ELLIPSIS);
}

function takeChunk(remaining: string[]): { readonly chars: string[]; readonly width: number } {
  // 「⋯⋯」不可拆开，避免后半个落行首
  if (remaining[0] === '⋯' && remaining[1] === '⋯') {
    return { chars: ['⋯', '⋯'], width: 2 };
  }
  // Legacy …… kept atomic if any slipped through before normalize
  if (remaining[0] === '…' && remaining[1] === '…') {
    return { chars: ['…', '…'], width: 2 };
  }
  const ch = remaining[0] ?? '';
  return { chars: [ch], width: glyphEm(ch) };
}

/**
 * Wrap CJK copy to a per-line budget expressed in em (box width / font size),
 * keeping closing punctuation on the preceding line and opening punctuation with
 * the following glyph. Lines never exceed the budget, so callers can clamp safely.
 */
export function wrapChineseText(value: string, emPerLine: number): string[] {
  const remaining = Array.from(
    normalizeChineseTypography(value).replace(/\s+/g, '').replace(/\n/g, ''),
  );
  const budget = Math.max(1, emPerLine);
  const lines: string[] = [];
  while (remaining.length) {
    const line: string[] = [];
    let used = 0;
    while (remaining.length) {
      const chunk = takeChunk(remaining);
      if (line.length && used + chunk.width > budget) break;
      used += chunk.width;
      for (let i = 0; i < chunk.chars.length; i += 1) remaining.shift();
      line.push(...chunk.chars);
    }
    // Closing punctuation that did not fit travels down with the glyph it follows.
    if (line.length > 1 && FORBIDDEN_LINE_START.test(remaining[0] ?? '')) {
      remaining.unshift(line.pop()!);
    }
    if (line.length > 1 && PUNCTUATION_ONLY_LINE.test(remaining.join(''))) {
      remaining.unshift(line.pop()!);
    }
    while (line.length > 1 && FORBIDDEN_LINE_END.test(line[line.length - 1] ?? '')) {
      remaining.unshift(line.pop()!);
    }
    // 引号等不得单独成行：并入上一行，或再吞一个字
    const joined = line.join('');
    if (ALONE_LINE.test(joined) && lines.length) {
      const prev = Array.from(lines.pop()!);
      prev.push(...line);
      lines.push(prev.join(''));
      continue;
    }
    if (ALONE_LINE.test(joined) && remaining.length) {
      line.push(remaining.shift()!);
    }
    lines.push(line.join(''));
  }
  return lines.length ? lines : [''];
}
