import { TaskScope } from '../assets/scripts/core/lifecycle/TaskScope';

describe('TaskScope', () => {
  it('invalidates callbacks after cancel or close', () => {
    const scope = new TaskScope();
    const calls: string[] = [];
    const stale = scope.guard(() => calls.push('stale'));
    scope.cancelPending();
    stale();
    const closed = scope.guard(() => calls.push('closed'));
    scope.close();
    closed();
    expect(calls).toEqual([]);
  });
});
