import { RoundTimer } from '../assets/scripts/services/RoundTimer';

describe('RoundTimer', () => {
  it('expires exactly once', () => {
    const timer = new RoundTimer();
    timer.start(1);
    expect(timer.tick(0.4)).toBe(false);
    expect(timer.remaining()).toBeCloseTo(0.6);
    expect(timer.tick(0.6)).toBe(true);
    expect(timer.tick(1)).toBe(false);
    expect(timer.remaining()).toBe(0);
  });

  it('does not consume time while paused during answer resolution', () => {
    const timer = new RoundTimer();
    timer.start(5);
    timer.pause();
    expect(timer.tick(2)).toBe(false);
    expect(timer.remaining()).toBe(5);
    timer.resume();
    expect(timer.tick(1)).toBe(false);
    expect(timer.remaining()).toBe(4);
  });
});

