import {
  readingJumpHeight, readingLayout, readingLayoutIds,
} from '../assets/scripts/games/reading-jumper/config/ReadingLayout';
import {
  READING_TEXT,
  estimateReadingOptionTextWidth,
  labelInsideParent,
  readingOptionFits,
  readingOptionLabelBox,
  readingOptionTextLayout,
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
    expect(READING_TEXT.optionMaxLines).toBe(2);
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

  it.each(readingLayoutIds())('%s: jump height includes its visible-head correction', (id) => {
    const layout = readingLayout(id);
    const deerTop = layout.deer.y + layout.deer.height / 2;
    const optionBottom = layout.option.y - layout.option.height / 2;
    expect(readingJumpHeight(layout)).toBeGreaterThan(0);
    expect(readingJumpHeight(layout)).toBeCloseTo(
      optionBottom - deerTop + (layout.jumpVisibleHeadInset ?? 0),
      5,
    );
  });

  it('uses the measured mario contact height before the synchronized brick lift', () => {
    expect(readingLayout('mario').jumpVisibleHeadInset).toBe(14);
    expect(readingJumpHeight(readingLayout('mario'))).toBe(51);
  });

  it.each([
    ['deep-sea', 40, 80.5],
    ['space', 54, 73],
    ['food', 23, 44],
    ['poetry', -5, 64],
  ])(
    '%s: uses the measured action-frame correction for a visible brick contact',
    (id, inset, jumpHeight) => {
      expect(readingLayout(id).jumpVisibleHeadInset ?? 0).toBe(inset);
      expect(readingJumpHeight(readingLayout(id))).toBe(jumpHeight);
    },
  );

  it('space option pad keeps text inside chrome bars', () => {
    expect(readingLayout('space').option.padX ?? 0).toBeGreaterThanOrEqual(108);
  });

  it('uses an independent measured countdown content box for every scene', () => {
    const timerTextLayouts = readingLayoutIds().map((id) => readingLayout(id).timerText);
    expect(new Set(timerTextLayouts.map((layout) => JSON.stringify(layout))).size).toBe(5);
    timerTextLayouts.forEach((layout, index) => {
      const timer = readingLayout(readingLayoutIds()[index]).timer;
      expect(Math.abs(layout.x) + layout.width / 2).toBeLessThan(timer.width / 2);
      expect(Math.abs(layout.y) + layout.height / 2).toBeLessThan(timer.height / 2);
      expect(layout.fontSize).toBeGreaterThanOrEqual(23);
      expect(layout.lineHeight).toBeLessThan(layout.height);
    });
  });

  it('wraps long space options before reducing their font size', () => {
    const layout = readingLayout('space');
    const box = readingOptionLabelBox(layout.option, layout.option.padX);
    const wrapped = readingOptionTextLayout('B.要理性地面对生活', box.width, box.height);
    expect(wrapped.lines).toEqual(['B.要理性地', '面对生活']);
    expect(wrapped.fontSize).toBe(READING_TEXT.optionFontSize);
    expect(wrapped.lineHeight * wrapped.lines.length).toBeLessThanOrEqual(box.height);
    wrapped.lines.forEach((line) => {
      expect(estimateReadingOptionTextWidth(line, wrapped.fontSize)).toBeLessThanOrEqual(box.width);
    });

    const short = readingOptionTextLayout('A.不要轻信他人', box.width, box.height);
    expect(short.lines).toHaveLength(1);
    expect(short.fontSize).toBe(READING_TEXT.optionFontSize);

    const veryLong = readingOptionTextLayout(
      `C.${'很长的选项文字'.repeat(3)}`,
      box.width,
      box.height,
    );
    expect(veryLong.lines).toHaveLength(2);
    expect(veryLong.fontSize).toBeLessThan(READING_TEXT.optionFontSize);
    veryLong.lines.forEach((line) => {
      expect(estimateReadingOptionTextWidth(line, veryLong.fontSize))
        .toBeLessThanOrEqual(box.width);
    });
  });

  it('uses 180 seconds and five settlement stars in every scene', () => {
    expect(AppConfig.roundSeconds).toBe(180);
    readingLayoutIds().forEach((id) => {
      expect(resultThemeLayout(id).stars).toHaveLength(5);
    });
  });

  it('keeps the food settlement headings on one native-height baseline', () => {
    const layout = resultThemeLayout('food');
    expect(layout.rank.titleY).toBe(layout.review.titleY);
    expect(layout.rank.titleSize).toEqual({ width: 340, height: 48 });
    expect(layout.review.titleSize).toEqual({ width: 246, height: 48 });
  });

  it('centers the deep-sea review group on the measured crystal frame', () => {
    expect(resultThemeLayout('deep-sea').summary?.captionY).toBe(263);
    const review = resultThemeLayout('deep-sea').review;
    expect(review.x + 720).toBe(1161);
    expect(review.textX + 720).toBe(1160);
    expect(review.iconX + review.iconSize / 2)
      .toBeLessThanOrEqual(review.x + review.width / 2);
  });

  it('centers both space headings inside their measured title slots', () => {
    const layout = resultThemeLayout('space');
    expect(layout.rank.titleX + 720).toBe(763);
    expect(layout.review.x + 720).toBe(1199);
    expect(layout.rank.titleY).toBe(180);
    expect(layout.review.titleY).toBe(180);
    expect(layout.rank.titleSize).toEqual({ width: 240, height: 56 });
    expect(layout.review.titleSize).toEqual({ width: 240, height: 56 });
  });

  it('keeps poetry review rows separated with state icons inside each row', () => {
    const review = resultThemeLayout('poetry').review;
    expect(review.x).toBe(461);
    expect(review.textX).toBe(450);
    expect(review.rows[0]).toBe(18);
    const pitches = review.rows.slice(1).map((row, index) => (
      Math.abs(review.rows[index] - row)
    ));
    pitches.forEach((pitch) => {
      expect(pitch - review.textHeight).toBeGreaterThanOrEqual(10);
    });
    expect(review.iconX + review.iconSize / 2)
      .toBeLessThanOrEqual(review.x + review.width / 2);
  });

  it('centers the poetry score in the plaque gap between 总分 and 分', () => {
    expect(resultThemeLayout('poetry').score?.x).toBe(-319);
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
