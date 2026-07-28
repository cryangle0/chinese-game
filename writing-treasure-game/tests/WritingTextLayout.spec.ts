import {
  QUESTION_ICON_RESERVE,
  WRITING_BOARD,
  WRITING_OPTION_STONE,
  WRITING_TEXT,
  writingOptionFits,
  writingOptionLabelBox,
  writingQuestionLabelBox,
  writingStemFits,
} from '../assets/scripts/shared/config/WritingTextLayout';
import { WritingPlaySceneLayout } from '../assets/scripts/shared/config/WritingPlaySceneLayout';

describe('Writing play text size + bounds', () => {
  it('uses enlarged stem/option fonts vs previous 32/25', () => {
    expect(WRITING_TEXT.questionFontSize).toBeGreaterThanOrEqual(36);
    expect(WRITING_TEXT.optionFontSize).toBeGreaterThanOrEqual(26);
    expect(WRITING_TEXT.optionFontSize).toBeLessThanOrEqual(32);
    expect(WRITING_TEXT.optionPadX).toBeGreaterThanOrEqual(16);
    expect(WRITING_TEXT.optionMaxLines).toBe(1);
  });

  it('stem label stays inside question board', () => {
    expect(writingStemFits(WRITING_BOARD)).toBe(true);
    const label = writingQuestionLabelBox(WRITING_BOARD);
    expect(QUESTION_ICON_RESERVE).toBeGreaterThanOrEqual(48);
    expect(WRITING_TEXT.questionPadX).toBeLessThanOrEqual(60);
    expect(label.width + WRITING_TEXT.questionPadX * 2 + QUESTION_ICON_RESERVE)
      .toBeLessThanOrEqual(WRITING_BOARD.width);
    expect(label.height + WRITING_TEXT.questionPadY * 2).toBeLessThanOrEqual(WRITING_BOARD.height);
  });

  it('option label stays inside option stone for single-line shrink', () => {
    expect(writingOptionFits(WRITING_OPTION_STONE)).toBe(true);
    const label = writingOptionLabelBox(WRITING_OPTION_STONE);
    expect(label.width + WRITING_TEXT.optionPadX * 2)
      .toBeLessThanOrEqual(WRITING_OPTION_STONE.width);
    expect(label.height + WRITING_TEXT.optionPadY * 2)
      .toBeLessThanOrEqual(WRITING_OPTION_STONE.height);
  });

  it('keeps centered option text inside every themed material face', () => {
    Object.values(WritingPlaySceneLayout).forEach(({ option }) => {
      expect(writingOptionFits(option, option.padX, option.padY)).toBe(true);
      const label = writingOptionLabelBox(option, option.padX, option.padY);
      expect(label.width + option.padX * 2).toBeLessThanOrEqual(option.width);
      expect(label.height + option.padY * 2).toBeLessThanOrEqual(option.height);
    });
  });

  it('choice columns do not overlap and stay on canvas', () => {
    const { columns, choice } = WritingPlaySceneLayout.treasure;
    const choiceWidth = choice.width;
    const [l, m, r] = columns;
    const half = choiceWidth / 2;
    expect(m - l).toBeGreaterThanOrEqual(choiceWidth + 16);
    expect(r - m).toBeGreaterThanOrEqual(choiceWidth + 16);
    expect(Math.abs(l) + half).toBeLessThanOrEqual(720);
    expect(Math.abs(r) + half).toBeLessThanOrEqual(720);
    expect(WRITING_OPTION_STONE.width).toBeLessThanOrEqual(choiceWidth);
  });
});
