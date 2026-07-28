import {
  normalizeChineseTypography,
  wrapChineseText,
} from '../assets/scripts/shared/config/ChineseTextWrap';
import {
  READING_TEXT,
  readingQuestionLabelBox,
} from '../assets/scripts/shared/config/ReadingTextLayout';

/** Independently measured advances (Chrome, bold Arial + CJK fallback). */
const EM = new Map([['“', 0.5], ['”', 0.5], ['‘', 0.28], ['’', 0.28]]);

function lineWidthPx(line: string, fontSize: number): number {
  return Array.from(line)
    .reduce((sum, char) => sum + (EM.get(char) ?? 1), 0) * fontSize;
}

const box = readingQuestionLabelBox({ width: 860, height: 214 });
const fontSize = READING_TEXT.questionFontSize;
/** Matches the outline allowance QuestionBoardView reserves. */
const usable = box.width - 4;
const budget = usable / fontSize;

const stems = [
  '“忽听得一声吆喝，好似千万人呐喊之声”运用了什么修辞手法？',
  '“白天鹅助跑飞奔，像一架起航的飞机”运用了什么修辞手法？',
  '“顷刻之间满街的人就都知道了？”中“顷刻”的近义词是什么？',
];

describe('reading question stem wrapping', () => {
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

  it('closes the quotation on the line that opened it', () => {
    const lines = wrapChineseText(stems[0], budget);
    expect(lines[0]).toContain('之声”');
    expect(lines.slice(1).join('')).not.toContain('”');
  });

  it.each(stems)('never starts a line with closing punctuation: %s', (stem) => {
    wrapChineseText(stem, budget).forEach((line) => {
      expect(line).not.toMatch(/^[，。！？；：、）》】」』”’…⋯]/u);
      expect(line).not.toMatch(/[（《【「『“‘]$/u);
    });
  });

  it.each(stems)('keeps every line inside the label box: %s', (stem) => {
    wrapChineseText(stem, budget).forEach((line) => {
      expect(lineWidthPx(line, fontSize)).toBeLessThanOrEqual(usable);
    });
  });
});
