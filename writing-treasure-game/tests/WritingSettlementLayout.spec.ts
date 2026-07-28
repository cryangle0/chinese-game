import {
  DUNHUANG_REVIEW_SHIFT_X,
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
});
