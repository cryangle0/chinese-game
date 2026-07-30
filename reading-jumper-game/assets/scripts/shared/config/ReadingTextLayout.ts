/**
 * Reading play-mode typography + box fit helpers.
 * Design canvas 1440×810.
 *
 * Safe text insets account for themed chrome (side bricks / bevels).
 * Question-board PNG bottom shadow strips are cropped from assets.
 */
export const READING_TEXT = {
  /** Under prototype 36 so long stems keep chrome padding with SHRINK. */
  questionFontSize: 32,
  /** ~1.12× font */
  questionLineHeight: 36,
  /**
   * Side brick pillars / metallic chrome on 860 board (~14% each side).
   * Space / mario frames need ≥118 or glyphs kiss the inner bevel.
   */
  questionPadX: 120,
  /** Top/bottom bevel inside board face (HTML inset ~12). */
  questionPadY: 14,
  /** Match stem size; boxes grow in ReadingLayout so glyphs stay readable. */
  optionFontSize: 32,
  optionLineHeight: 36,
  /** Horizontal breathing room for bold glyphs plus the 2px outline. */
  optionInkPadX: 10,
  /** Explicit two-line pre-fit floor; Label.Overflow.SHRINK remains the final fallback. */
  optionMinFontSize: 10,
  /** Base inset; themes may raise via ReadingLayout.option.padX (space chrome). */
  optionPadX: 44,
  optionPadY: 10,
  optionMaxLines: 2,
  /** Practical stem length for ≤3 wrapped lines at this font (schema max 80). */
  fitStemChars: 48,
  /** A. + option ≤20 schema chars. */
  maxOptionChars: 22,
} as const;

export interface TextBox {
  readonly width: number;
  readonly height: number;
}

/** Stem label frame inside question board (optional image steals left width). */
export function readingQuestionLabelBox(
  board: TextBox,
  hasImage = false,
  padX: number = READING_TEXT.questionPadX,
): TextBox {
  const insetX = Math.max(READING_TEXT.questionPadX, padX);
  const textH = Math.max(88, board.height - READING_TEXT.questionPadY * 2);
  if (hasImage) {
    return {
      width: Math.max(200, board.width - 180 - insetX * 2),
      height: textH,
    };
  }
  return {
    width: Math.max(200, board.width - insetX * 2),
    height: textH,
  };
}

/** Option label frame inside brick (optional padX for thick themed chrome). */
export function readingOptionLabelBox(brick: TextBox, padX: number = READING_TEXT.optionPadX): TextBox {
  const insetX = Math.max(READING_TEXT.optionPadX, padX);
  return {
    width: Math.max(72, brick.width - insetX * 2),
    height: Math.max(48, brick.height - READING_TEXT.optionPadY * 2),
  };
}

function optionGlyphUnits(value: string): number {
  return Array.from(value).reduce((total, glyph) => {
    if (/\s/u.test(glyph)) return total + 0.32;
    if (/[A-Za-z0-9]/u.test(glyph)) return total + 0.62;
    if (/[.,:;!?'"()[\]{}\-_/\\]/u.test(glyph)) return total + 0.34;
    return total + 1;
  }, 0);
}

/** Estimated single-line ink width for bold Microsoft YaHei plus outline. */
export function estimateReadingOptionTextWidth(text: string, fontSize: number): number {
  return optionGlyphUnits(text) * fontSize + READING_TEXT.optionInkPadX;
}

export interface ReadingOptionTextLayout {
  readonly text: string;
  readonly lines: readonly string[];
  readonly fontSize: number;
  readonly lineHeight: number;
}

const FORBIDDEN_OPTION_LINE_START =
  /^[,.;:!?\uFF0C\u3002\uFF1B\uFF1A\uFF01\uFF1F\u3001\uFF09\u300B\u3011\u300D\u300F\u201D\u2019]/u;
const FORBIDDEN_OPTION_LINE_END =
  /[(\[{<\uFF08\u300A\u3010\u300C\u300E\u201C\u2018]$/u;
// The estimator includes a 10px ink pad and slightly overstates YaHei Latin
// prefixes. This tolerance keeps borderline one-line labels inside the face.
const OPTION_SINGLE_LINE_FIT_TOLERANCE = 4;

function optionLineHeight(fontSize: number): number {
  return Math.max(fontSize + 4, Math.round(fontSize * 1.125));
}

function balancedOptionLines(
  text: string,
  fontSize: number,
  boxWidth: number,
): readonly string[] | null {
  const glyphs = Array.from(text);
  if (glyphs.length < 2) return null;
  const prefixLength = /^[A-Ca-c]\./u.test(text) ? 2 : 0;
  const firstSplit = Math.min(glyphs.length - 1, Math.max(1, prefixLength + 1));
  let best: {
    readonly lines: readonly [string, string];
    readonly maxWidth: number;
    readonly imbalance: number;
  } | null = null;
  for (let split = firstSplit; split < glyphs.length; split += 1) {
    const left = glyphs.slice(0, split).join('').trimEnd();
    const right = glyphs.slice(split).join('').trimStart();
    if (!left || !right
      || FORBIDDEN_OPTION_LINE_START.test(right)
      || FORBIDDEN_OPTION_LINE_END.test(left)) continue;
    const leftWidth = estimateReadingOptionTextWidth(left, fontSize);
    const rightWidth = estimateReadingOptionTextWidth(right, fontSize);
    if (leftWidth > boxWidth || rightWidth > boxWidth) continue;
    const maxWidth = Math.max(leftWidth, rightWidth);
    const imbalance = Math.abs(leftWidth - rightWidth);
    if (!best
      || maxWidth < best.maxWidth
      || (maxWidth === best.maxWidth && imbalance < best.imbalance)) {
      best = { lines: [left, right], maxWidth, imbalance };
    }
  }
  return best?.lines ?? null;
}

/**
 * Prefer a full-size single line, then a balanced full-size two-line layout.
 * Only reduce font size when two full-size lines still cannot fit the material face.
 */
export function readingOptionTextLayout(
  value: string,
  boxWidth: number,
  boxHeight: number,
): ReadingOptionTextLayout {
  const text = value.replace(/\s*\n\s*/gu, '').trim();
  const fullSize = READING_TEXT.optionFontSize;
  const fullLineHeight = optionLineHeight(fullSize);
  if (
    estimateReadingOptionTextWidth(text, fullSize)
    <= boxWidth + OPTION_SINGLE_LINE_FIT_TOLERANCE
  ) {
    return { text, lines: [text], fontSize: fullSize, lineHeight: fullLineHeight };
  }
  if (fullLineHeight * READING_TEXT.optionMaxLines <= boxHeight) {
    const fullSizeLines = balancedOptionLines(text, fullSize, boxWidth);
    if (fullSizeLines) {
      return {
        text: fullSizeLines.join('\n'),
        lines: fullSizeLines,
        fontSize: fullSize,
        lineHeight: fullLineHeight,
      };
    }
  }
  for (
    let fontSize = fullSize - 1;
    fontSize >= READING_TEXT.optionMinFontSize;
    fontSize -= 1
  ) {
    const lineHeight = optionLineHeight(fontSize);
    if (lineHeight * READING_TEXT.optionMaxLines > boxHeight) continue;
    const lines = balancedOptionLines(text, fontSize, boxWidth);
    if (!lines) continue;
    return { text: lines.join('\n'), lines, fontSize, lineHeight };
  }
  const fontSize = READING_TEXT.optionMinFontSize;
  const lines = balancedOptionLines(text, fontSize, Number.POSITIVE_INFINITY) ?? [text];
  return {
    text: lines.join('\n'),
    lines,
    fontSize,
    lineHeight: optionLineHeight(fontSize),
  };
}

/**
 * Pre-fit the configured font to the themed material face.
 * Cocos SHRINK stays enabled to cover platform font-metric differences.
 */
export function readingOptionFontSize(text: string, boxWidth: number): number {
  const units = optionGlyphUnits(text);
  if (units <= 0) return READING_TEXT.optionFontSize;
  const available = Math.max(1, boxWidth - READING_TEXT.optionInkPadX);
  return Math.max(
    READING_TEXT.optionMinFontSize,
    Math.min(READING_TEXT.optionFontSize, Math.floor(available / units)),
  );
}

/**
 * Approx CJK wrapped lines.
 * @param glyphScale >1 when outline/bold makes glyphs wider than fontSize (stems).
 */
export function estimateWrappedLines(
  chars: number,
  boxWidth: number,
  fontSize: number,
  glyphScale = 1,
): number {
  const perLine = Math.max(1, Math.floor(boxWidth / (fontSize * glyphScale)));
  return Math.ceil(chars / perLine);
}

export function readingStemFits(
  board: TextBox,
  hasImage = false,
  padX: number = READING_TEXT.questionPadX,
): boolean {
  const insetX = Math.max(READING_TEXT.questionPadX, padX);
  const box = readingQuestionLabelBox(board, hasImage, insetX);
  if (!labelInsideParent(board, box, insetX, READING_TEXT.questionPadY)) return false;
  const lines = estimateWrappedLines(
    READING_TEXT.fitStemChars, box.width, READING_TEXT.questionFontSize, 1.22,
  );
  return lines * READING_TEXT.questionLineHeight <= box.height + 0.5;
}

/** Geometric: label inset inside brick; height holds the configured wrapped lines. */
export function readingOptionFits(brick: TextBox, padX: number = READING_TEXT.optionPadX): boolean {
  const insetX = Math.max(READING_TEXT.optionPadX, padX);
  const box = readingOptionLabelBox(brick, insetX);
  if (!labelInsideParent(brick, box, insetX, READING_TEXT.optionPadY)) return false;
  return box.width >= 72
    && box.height + 0.5 >= READING_TEXT.optionLineHeight * READING_TEXT.optionMaxLines;
}

/** Label must stay strictly inside parent with pads. */
export function labelInsideParent(
  parent: TextBox, label: TextBox, padX: number, padY: number,
): boolean {
  return label.width + padX * 2 <= parent.width + 0.5
    && label.height + padY * 2 <= parent.height + 0.5;
}
