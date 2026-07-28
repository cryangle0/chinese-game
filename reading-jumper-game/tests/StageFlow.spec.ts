import { stageOutcome } from '../assets/scripts/services/StageFlow';

describe('stage flow', () => {
  it('keeps five questions inside each scene before settlement', () => {
    expect(stageOutcome(1)).toBe('next-question');
    expect(stageOutcome(4)).toBe('next-question');
    expect(stageOutcome(5)).toBe('stage-result');
  });

  it('does not end a scene early after consecutive wrong answers', () => {
    expect(stageOutcome(2)).toBe('next-question');
    expect(stageOutcome(3)).toBe('next-question');
  });
});
