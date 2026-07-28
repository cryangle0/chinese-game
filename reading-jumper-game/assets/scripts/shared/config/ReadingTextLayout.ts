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
  /** Explicit pre-fit floor; Label.Overflow.SHRINK remains the final fallback. */
  optionMinFontSize: 10,
  /** Base inset; themes may raise via ReadingLayout.option.padX (space chrome). */
  optionPadX: 44,
  optionPadY: 10,
  optionMaxLines: 1,
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

/** Geometric: label inset inside brick; height holds 2 lines (Overflow.SHRINK for long text). */
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
