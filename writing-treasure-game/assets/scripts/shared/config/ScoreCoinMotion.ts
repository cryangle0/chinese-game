export interface ScoreCoinPoint {
  readonly x: number;
  readonly y: number;
}

const LANES = [-1, 0.45, -0.2, 0.9, -0.7, 0.2, 1] as const;
const BURST_X = [-0.9, -0.45, 0.18, 0.72, -0.12, 0.96, -0.68, 0.42, -1, 0.64, 0, 0.84, -0.36, 0.34] as const;
const BURST_PORTION = 0.28;

export function scoreCoinCount(awarded: number): number {
  if (!Number.isFinite(awarded) || awarded <= 0) return 0;
  return Math.max(11, Math.min(14, Math.round(awarded / 5) + 7));
}

export function scoreCoinBurstPoint(start: ScoreCoinPoint, index: number): ScoreCoinPoint {
  const lane = BURST_X[index % BURST_X.length] ?? 0;
  return {
    x: start.x + lane * (38 + (index % 3) * 9),
    y: start.y + 52 + (index % 4) * 14,
  };
}

export function scoreCoinControlPoint(
  start: ScoreCoinPoint,
  end: ScoreCoinPoint,
  index: number,
): ScoreCoinPoint {
  const lane = LANES[index % LANES.length] ?? 0;
  const along = 0.32 + (index % 3) * 0.035;
  return {
    x: start.x + (end.x - start.x) * along + lane * (62 + (index % 2) * 16),
    y: start.y + (end.y - start.y) * along + 92 + (index % 4) * 14,
  };
}

export function scoreCoinTrackPoint(
  start: ScoreCoinPoint,
  end: ScoreCoinPoint,
  index: number,
  progress: number,
): ScoreCoinPoint {
  const t = Math.max(0, Math.min(1, progress));
  const burst = scoreCoinBurstPoint(start, index);
  if (t <= BURST_PORTION) {
    const raw = t / BURST_PORTION;
    const eased = 1 - ((1 - raw) ** 3);
    return {
      x: start.x + (burst.x - start.x) * eased,
      y: start.y + (burst.y - start.y) * eased
        + Math.sin(Math.PI * raw) * (10 + (index % 3) * 3),
    };
  }
  const flight = (t - BURST_PORTION) / (1 - BURST_PORTION);
  return scoreCoinPointAt(
    burst,
    scoreCoinControlPoint(burst, end, index),
    end,
    flight * flight * (3 - 2 * flight),
  );
}

export function scoreCoinPointAt(
  start: ScoreCoinPoint,
  control: ScoreCoinPoint,
  end: ScoreCoinPoint,
  progress: number,
): ScoreCoinPoint {
  const t = Math.max(0, Math.min(1, progress));
  const inverse = 1 - t;
  return {
    x: inverse * inverse * start.x + 2 * inverse * t * control.x + t * t * end.x,
    y: inverse * inverse * start.y + 2 * inverse * t * control.y + t * t * end.y,
  };
}
