import { director, Director } from 'cc';

type StartupCoverWindow = Window & { __dismissGameStartupCover?: () => void };

export function dismissStartupCoverAfterDraws(cancelled: () => boolean): void {
  if (typeof window === 'undefined') return;
  let framesRemaining = 3;
  const releaseAfterDraw = () => {
    if (cancelled()) return;
    framesRemaining -= 1;
    if (framesRemaining > 0) {
      director.once(Director.EVENT_AFTER_DRAW, releaseAfterDraw);
      return;
    }
    (window as StartupCoverWindow).__dismissGameStartupCover?.();
  };
  director.once(Director.EVENT_AFTER_DRAW, releaseAfterDraw);
}
