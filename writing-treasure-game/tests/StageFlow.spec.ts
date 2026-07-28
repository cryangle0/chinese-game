import { stageOutcome, stageResultActions } from '../assets/scripts/services/StageFlow';

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

  it('offers replay-current-scene consistently before continuing', () => {
    expect(stageResultActions(false)).toEqual({
      replay: '再玩一次',
      proceed: '进入下一关',
    });
    expect(stageResultActions(true)).toEqual({
      replay: '再玩一次',
      proceed: '查看总成绩',
    });
  });
});
