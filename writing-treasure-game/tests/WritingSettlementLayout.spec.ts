import {
  DUNHUANG_REVIEW_SHIFT_X,
  MAGIC_SCORE_SHIFT_Y,
  TREASURE_RANK_SCORE_WIDTH,
  TREASURE_RANK_TEXT_ROW_OFFSET_Y,
  WRITING_RANK_TEXT_OFFSET_Y,
} from '../assets/scripts/shared/config/WritingSettlementTuning';

describe('writing settlement layout', () => {
  it.each(['magic', 'dunhuang', 'dinosaur'])(
    '%s optically centers rank names and scores in their illustrated rows',
    (sceneId) => {
      expect(
        WRITING_RANK_TEXT_OFFSET_Y[sceneId as keyof typeof WRITING_RANK_TEXT_OFFSET_Y],
      ).toBe(-5);
    },
  );

  it('moves the Dunhuang review rows and icons right by the measured amount', () => {
    expect(DUNHUANG_REVIEW_SHIFT_X).toBe(35);
  });

  it('centers classic treasure rank text in each illustrated content strip', () => {
    expect(TREASURE_RANK_TEXT_ROW_OFFSET_Y).toEqual([-8, -5, -5]);
    expect(TREASURE_RANK_SCORE_WIDTH).toBeGreaterThanOrEqual(100);
  });

  it('moves the magic total score below the illustrated plaque rim', () => {
    expect(MAGIC_SCORE_SHIFT_Y).toBe(10);
  });
});
