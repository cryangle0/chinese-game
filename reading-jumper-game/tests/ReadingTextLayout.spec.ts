import { readingLayout, readingLayoutIds } from '../assets/scripts/games/reading-jumper/config/ReadingLayout';
import {
  READING_TEXT,
  estimateReadingOptionTextWidth,
  labelInsideParent,
  readingOptionFontSize,
  readingOptionFits,
  readingOptionLabelBox,
  readingQuestionLabelBox,
  readingStemFits,
} from '../assets/scripts/shared/config/ReadingTextLayout';
import { wrapChineseText } from '../assets/scripts/shared/config/ChineseTextWrap';
import { AppConfig } from '../assets/scripts/shared/config/AppConfig';
import { resultThemeLayout } from '../assets/scripts/ui/results/ResultThemeLayout';

describe('Reading play text size + bounds', () => {
  it('uses enlarged stem font; options stay readable inside chrome', () => {
    expect(READING_TEXT.questionFontSize).toBeGreaterThanOrEqual(30);
    expect(READING_TEXT.questionFontSize).toBeLessThanOrEqual(36);
    expect(READING_TEXT.optionFontSize).toBeGreaterThanOrEqual(28);
    expect(READING_TEXT.optionFontSize).toBeLessThanOrEqual(32);
    expect(READING_TEXT.optionMaxLines).toBe(1);
  });

  it('stem pads leave room for side bricks and bevel', () => {
    expect(READING_TEXT.questionPadX).toBeGreaterThanOrEqual(110);
    expect(READING_TEXT.questionPadY).toBeGreaterThanOrEqual(10);
    expect(READING_TEXT.questionPadY).toBeLessThanOrEqual(16);
    expect(READING_TEXT.questionLineHeight).toBeLessThanOrEqual(
      Math.round(READING_TEXT.questionFontSize * 1.2),
    );
  });

  it('food stem pad clears chocolate side bars', () => {
    expect(readingLayout('food').questionPadX ?? 0).toBeGreaterThanOrEqual(168);
  });

  it.each(readingLayoutIds())('%s: stem and options fit inside measured boxes', (id) => {
    const layout = readingLayout(id);
    const stemPadX = layout.questionPadX ?? READING_TEXT.questionPadX;
    // Board tall enough for 3× lineHeight after pads.
    const textH = layout.question.height - READING_TEXT.questionPadY * 2;
    expect(textH).toBeGreaterThanOrEqual(READING_TEXT.questionLineHeight * 3);

    expect(readingStemFits(layout.question, false, stemPadX)).toBe(true);
    expect(readingOptionFits(layout.option, layout.option.padX)).toBe(true);

    const qLabel = readingQuestionLabelBox(layout.question, false, stemPadX);
    expect(qLabel.width).toBeLessThanOrEqual(layout.question.width - stemPadX * 2 + 0.5);
    expect(labelInsideParent(
      layout.question, qLabel, stemPadX, READING_TEXT.questionPadY,
    )).toBe(true);

    const optionPadX = layout.option.padX ?? READING_TEXT.optionPadX;
    const oLabel = readingOptionLabelBox(layout.option, optionPadX);
    expect(labelInsideParent(
      layout.option, oLabel, optionPadX, READING_TEXT.optionPadY,
    )).toBe(true);
    expect(layout.option.textOffsetX ?? 0).toBe(0);

    // Per-theme deer sizes (non-mario must not share mario's 152×266 box).
    expect(layout.deer.width).toBeGreaterThan(100);
    expect(layout.deer.height).toBeGreaterThan(200);
    if (id !== 'mario') {
      expect(layout.deer.width !== 152 || layout.deer.height !== 266).toBe(true);
    }

    // Feedback feet stay near the ground even when the impact box is enlarged upward.
    expect(layout.feedback.y - layout.feedback.height / 2).toBeLessThanOrEqual(-180);
    expect(layout.feedback.height).toBeGreaterThan(300);

    // Columns must not overlap (gap ≥ 16px).
    const [l, m, r] = layout.option.columns;
    const half = layout.option.width / 2;
    expect(m - l).toBeGreaterThanOrEqual(layout.option.width + 16);
    expect(r - m).toBeGreaterThanOrEqual(layout.option.width + 16);
    expect(Math.abs(l) + half).toBeLessThanOrEqual(720);
    expect(Math.abs(r) + half).toBeLessThanOrEqual(720);
  });

  it('space option pad keeps text inside chrome bars', () => {
    expect(readingLayout('space').option.padX ?? 0).toBeGreaterThanOrEqual(108);
  });

  it('shrinks long space options while keeping short options at full size', () => {
    const layout = readingLayout('space');
    const box = readingOptionLabelBox(layout.option, layout.option.padX);
    const longText = 'A.花容月貌的女子';
    const fitted = readingOptionFontSize(longText, box.width);
    expect(fitted).toBeLessThan(READING_TEXT.optionFontSize);
    expect(estimateReadingOptionTextWidth(longText, fitted)).toBeLessThanOrEqual(box.width);
    expect(readingOptionFontSize('B.老妇人', box.width)).toBe(READING_TEXT.optionFontSize);
  });

  it('uses 180 seconds and five settlement stars in every scene', () => {
    expect(AppConfig.roundSeconds).toBe(180);
    readingLayoutIds().forEach((id) => {
      expect(resultThemeLayout(id).stars).toHaveLength(5);
    });
  });

  it.each([
    ['列夫·托尔斯泰是哪个国家的作家？', 12],
    ['“小鸭子心里想……”写的是什么？', 11],
    ['《小矮人的礼物》中，不知满足，自食恶果的是谁？', 13],
  ])('wraps Chinese text without orphan punctuation: %s', (value, perLine) => {
    const lines = wrapChineseText(value, perLine);
    expect(lines.some((line) => /^[，。！？；：、）》】」』”’…]/u.test(line))).toBe(false);
    expect(lines.some((line) => /[（《【「『“‘]$/u.test(line))).toBe(false);
  });
});
