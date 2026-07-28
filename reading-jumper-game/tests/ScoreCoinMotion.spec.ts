import {
  scoreCoinBurstPoint,
  scoreCoinControlPoint,
  scoreCoinCount,
  scoreCoinPointAt,
  scoreCoinTrackPoint,
} from '../assets/scripts/shared/config/ScoreCoinMotion';

describe('score coin motion', () => {
  it('uses a visible reward trail for positive score only', () => {
    expect(scoreCoinCount(0)).toBe(0);
    expect(scoreCoinCount(20)).toBe(11);
    expect(scoreCoinCount(45)).toBe(14);
  });

  it('starts and ends on the exact supplied anchors', () => {
    const start = { x: 440, y: 60 };
    const end = { x: -668, y: 278 };
    const control = scoreCoinControlPoint(start, end, 4);
    expect(scoreCoinPointAt(start, control, end, 0)).toEqual(start);
    expect(scoreCoinPointAt(start, control, end, 1)).toEqual(end);
  });

  it('lifts the flight above the direct path', () => {
    const start = { x: 0, y: 0 };
    const end = { x: -600, y: 280 };
    const control = scoreCoinControlPoint(start, end, 0);
    const middle = scoreCoinPointAt(start, control, end, 0.5);
    expect(middle.y).toBeGreaterThan(140);
  });

  it('bursts from the supplied trigger before converging on the score icon', () => {
    const start = { x: -440, y: 59 };
    const end = { x: -668, y: 278 };
    expect(scoreCoinTrackPoint(start, end, 0, 0)).toEqual(start);
    expect(scoreCoinTrackPoint(start, end, 0, 1)).toEqual(end);
    expect(scoreCoinBurstPoint(start, 0).x).toBeLessThan(start.x);
    expect(scoreCoinBurstPoint(start, 5).x).toBeGreaterThan(start.x);
    expect(scoreCoinTrackPoint(start, end, 3, 0.2).y).toBeGreaterThan(start.y + 48);
  });
});
