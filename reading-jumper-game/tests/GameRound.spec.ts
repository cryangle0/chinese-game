import { ReadingRound } from '../assets/scripts/games/reading-jumper/model/ReadingRound';

describe('game round state machines', () => {
  it('locks reading answers during feedback', () => {
    const round = new ReadingRound();
    round.begin();
    expect(round.acceptAnswer()).toBe(true);
    expect(round.acceptAnswer()).toBe(false);
    round.prepareNext();
    round.next();
    expect(round.acceptAnswer()).toBe(true);
  });
});
