import { TreasureRound } from '../assets/scripts/games/writing-treasure/model/TreasureRound';

describe('game round state machines', () => {
  it('locks treasure answers during feedback', () => {
    const round = new TreasureRound();
    round.begin();
    expect(round.acceptAnswer()).toBe(true);
    expect(round.acceptAnswer()).toBe(false);
    expect(round.acceptAction()).toBe(true);
    round.completeAction();
    expect(round.acceptAction()).toBe(false);
  });
});
