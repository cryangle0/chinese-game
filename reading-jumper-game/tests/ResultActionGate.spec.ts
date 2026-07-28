import { createResultActionGate } from '../assets/scripts/ui/results/ResultActionGate';

describe('result action activation gate', () => {
  it('coalesces duplicate callbacks from one pointer gesture', () => {
    let releases: (() => void)[] = [];
    let activations = 0;
    const activate = createResultActionGate(
      () => { activations += 1; },
      (release) => { releases.push(release); },
    );

    activate();
    activate();

    expect(activations).toBe(1);
    releases.shift()?.();
    activate();
    expect(activations).toBe(2);
    releases = [];
  });
});
