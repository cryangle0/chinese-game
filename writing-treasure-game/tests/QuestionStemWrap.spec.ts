import {
  normalizeChineseTypography,
  wrapChineseText,
} from '../assets/scripts/shared/config/ChineseTextWrap';
import {
  QUESTION_BOLD_HEADROOM,
  QUESTION_WRAP_SLACK_EM,
  WRITING_BOARD,
  WRITING_TEXT,
  writingQuestionLabelBox,
  writingQuestionWrapBudget,
} from '../assets/scripts/shared/config/WritingTextLayout';

/** Independently measured advances (Chrome, bold Arial + CJK fallback). */
const EM = new Map([['“', 0.5], ['”', 0.5], ['‘', 0.28], ['’', 0.28]]);

function lineWidthPx(line: string, fontSize: number): number {
  return Array.from(line)
    .reduce((sum, char) => sum + (EM.get(char) ?? 1), 0) * fontSize;
}

const box = writingQuestionLabelBox(WRITING_BOARD);
const fontSize = WRITING_TEXT.questionFontSize;
const budget = writingQuestionWrapBudget(box.width, fontSize);

const stems = [
  '“忽听得一声吆喝，好似千万人呐喊之声”运用了什么修辞手法？',
  '“白天鹅助跑飞奔，像一架起航的飞机”运用了什么修辞手法？',
  '“顷刻之间满街的人就都知道了？”中“顷刻”的近义词是什么？',
  '“我是苍蝇眼睛体积的千分之一”用了什么手法来说明细菌体积小？',
  '“他一只手揪着八戒，一只手扯住妇人”这句话运用了什么描写？',
];

describe('writing question stem wrapping', () => {
  it('normalizes ASCII/Western ellipsis to centered midline ⋯⋯', () => {
    expect(normalizeChineseTypography('他走了...')).toBe('他走了⋯⋯');
    expect(normalizeChineseTypography('他走了…')).toBe('他走了⋯⋯');
    expect(normalizeChineseTypography('他走了……')).toBe('他走了⋯⋯');
    expect(normalizeChineseTypography('他走了。。。')).toBe('他走了⋯⋯');
  });

  it('keeps ⋯⋯ as one unit (never starts a line with ⋯)', () => {
    const lines = wrapChineseText(`${'字'.repeat(Math.floor(budget) - 1)}……后面`, budget);
    lines.forEach((line) => {
      expect(line).not.toMatch(/^[⋯…]/);
    });
    expect(lines.join('')).toContain('⋯⋯');
  });

  it('keeps the closing quote on the line that opened the quotation', () => {
    expect(wrapChineseText(stems[0], budget)).toEqual([
      '“忽听得一声吆喝，好似千万人呐喊之声”',
      '运用了什么修辞手法？',
    ]);
  });

  it.each(stems)('never starts a line with closing punctuation: %s', (stem) => {
    wrapChineseText(stem, budget).forEach((line) => {
      expect(line).not.toMatch(/^[，。！？；：、）》】」』”’…⋯]/u);
      expect(line).not.toMatch(/[（《【「『“‘]$/u);
    });
  });

  it.each(stems)('keeps every line inside the label box: %s', (stem) => {
    wrapChineseText(stem, budget).forEach((line) => {
      expect(lineWidthPx(line, fontSize)).toBeLessThanOrEqual(box.width);
    });
  });

  it('keeps a small wrap slack without breaking 18em quoted clauses', () => {
    expect(QUESTION_WRAP_SLACK_EM).toBeGreaterThan(0);
    expect(QUESTION_WRAP_SLACK_EM).toBeLessThanOrEqual(0.5);
    expect(budget).toBeLessThan(box.width / fontSize);
    expect(budget).toBeGreaterThanOrEqual(18);
  });

  it('gives bold 18em lines enough label width to avoid CLAMP shear', () => {
    // Phone bug: “…妇人”这  is 18em; old 668px box left ~20px and bold sheared 这.
    expect(box.width).toBeGreaterThanOrEqual(18 * fontSize * QUESTION_BOLD_HEADROOM);
    const stem = '“他一只手揪着八戒，一只手扯住妇人”这句话运用了什么描写？';
    const [first] = wrapChineseText(stem, budget);
    expect(first).toContain('这');
    expect(lineWidthPx(first, fontSize) * QUESTION_BOLD_HEADROOM)
      .toBeLessThanOrEqual(box.width);
  });
});
