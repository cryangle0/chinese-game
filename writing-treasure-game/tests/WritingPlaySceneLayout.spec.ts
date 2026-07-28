import {
  scaledWritingChoiceColumns,
  WritingPlaySceneLayout,
} from '../assets/scripts/shared/config/WritingPlaySceneLayout';

describe('writing play scene hotspots', () => {
  it('calibrates each scene to its own three cave centers', () => {
    expect(WritingPlaySceneLayout.treasure.columns).toEqual([-356, -4, 334]);
    expect(WritingPlaySceneLayout.desert.columns).toEqual([-364, -11, 333]);
    expect(WritingPlaySceneLayout.dinosaur.columns).toEqual([-355, -1, 342]);
    expect(WritingPlaySceneLayout.dunhuang.columns).toEqual([-353, -6, 331]);
    expect(WritingPlaySceneLayout.magic.columns).toEqual([-362, -14, 327]);
  });

  it('moves cave-bound columns with the stretched background', () => {
    expect(scaledWritingChoiceColumns('dinosaur', 1.2)).toEqual([-426, -1.2, 410.4]);
  });

  it('uses a compact undistorted option frame inside each cave', () => {
    Object.values(WritingPlaySceneLayout).forEach((layout) => {
      expect(layout.option.width).toBe(250);
      expect(layout.option.height).toBe(104);
      expect(layout.option.localY).toBe(105);
      expect(layout.option.padX).toBeGreaterThanOrEqual(20);
      expect(layout.option.padY).toBeGreaterThanOrEqual(10);
    });
  });
});
