/**
 * Writing play-mode typography + box fit helpers (design 1440×810).
 */
export const WRITING_TEXT = {
  questionFontSize: 36,
  questionLineHeight: 44,
  /**
   * Side inset inside the board PNG. 72 left only ~20px spare for an 18em bold
   * line after icon reserve — WeChat CLAMP sheared the trailing glyph. 60 gives
   * ~6% paint headroom for bold CJK while keeping the "?" badge clear.
   */
  questionPadX: 60,
  questionPadY: 28,
  optionFontSize: 26,
  optionLineHeight: 28,
  optionPadX: 18,
  optionPadY: 10,
  optionMaxLines: 1,
  fitStemChars: 48,
  maxOptionChars: 22,
} as const;

/** Board / stone outer boxes (must match WritingPlayLayout). */
export const WRITING_BOARD = { width: 860, height: 210 } as const;
export const WRITING_OPTION_STONE = { width: 250, height: 104 } as const;

/** Board art "?" badge on the right. */
export const QUESTION_ICON_RESERVE = 48;

/**
 * Small wrap bias so a full-em line does not paint flush against CLAMP.
 * Keep under ~0.5 so an 18em quoted clause still stays on one line.
 */
export const QUESTION_WRAP_SLACK_EM = 0.25;

/** Bold CJK often paints ~5–6% wider than ideal em; label box must cover that. */
export const QUESTION_BOLD_HEADROOM = 1.06;

export interface TextBox {
  readonly width: number;
  readonly height: number;
}

export function writingQuestionLabelBox(board: TextBox, hasImage = false): TextBox {
  const textH = Math.max(80, board.height - WRITING_TEXT.questionPadY * 2);
  if (hasImage) {
    return {
      width: Math.max(
        200,
        board.width - 160 - WRITING_TEXT.questionPadX * 2 - QUESTION_ICON_RESERVE,
      ),
      height: textH,
    };
  }
  return {
    width: Math.max(
      200,
      board.width - WRITING_TEXT.questionPadX * 2 - QUESTION_ICON_RESERVE,
    ),
    height: textH,
  };
}

/** Em budget for hard-wrap; slightly under the label box width. */
export function writingQuestionWrapBudget(boxWidth: number, fontSize: number): number {
  return Math.max(1, boxWidth / fontSize - QUESTION_WRAP_SLACK_EM);
}

export function writingOptionLabelBox(
  stone: TextBox,
  padX: number = WRITING_TEXT.optionPadX,
  padY: number = WRITING_TEXT.optionPadY,
): TextBox {
  const insetX = Math.max(WRITING_TEXT.optionPadX, padX);
  const insetY = Math.max(WRITING_TEXT.optionPadY, padY);
  return {
    width: Math.max(140, stone.width - insetX * 2),
    height: Math.max(48, stone.height - insetY * 2),
  };
}

export function estimateWrappedLines(
  chars: number, boxWidth: number, fontSize: number,
): number {
  const perLine = Math.max(1, Math.floor(boxWidth / fontSize));
  return Math.ceil(chars / perLine);
}

export function writingStemFits(board: TextBox = WRITING_BOARD, hasImage = false): boolean {
  const box = writingQuestionLabelBox(board, hasImage);
  const lines = estimateWrappedLines(
    WRITING_TEXT.fitStemChars, box.width, WRITING_TEXT.questionFontSize,
  );
  return lines * WRITING_TEXT.questionLineHeight <= box.height + 0.5;
}

export function writingOptionFits(
  stone: TextBox = WRITING_OPTION_STONE,
  padX: number = WRITING_TEXT.optionPadX,
  padY: number = WRITING_TEXT.optionPadY,
): boolean {
  const insetX = Math.max(WRITING_TEXT.optionPadX, padX);
  const insetY = Math.max(WRITING_TEXT.optionPadY, padY);
  const box = writingOptionLabelBox(stone, insetX, insetY);
  if (box.width + insetX * 2 > stone.width + 0.5) return false;
  if (box.height + insetY * 2 > stone.height + 0.5) return false;
  return box.height + 0.5 >= WRITING_TEXT.optionLineHeight;
}
