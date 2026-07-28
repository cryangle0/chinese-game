type ReleaseScheduler = (release: () => void) => void;

const scheduleGestureRelease: ReleaseScheduler = (release) => {
  setTimeout(release, 600);
};

export function createResultActionGate(
  action: () => void,
  scheduleRelease: ReleaseScheduler = scheduleGestureRelease,
): () => void {
  let locked = false;
  return () => {
    if (locked) return;
    locked = true;
    action();
    scheduleRelease(() => { locked = false; });
  };
}
