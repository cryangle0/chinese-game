import {
  hipMotionSample, poseErrorReason, poseInferenceIntervalMs, withTimeout,
} from '../assets/scripts/platform/pose/PoseRuntimePolicy';

describe('PoseRuntimePolicy', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects stalled startup and disposes a detector that resolves late', async () => {
    jest.useFakeTimers();
    let resolveTask!: (value: { dispose(): void }) => void;
    const task = new Promise<{ dispose(): void }>((resolve) => { resolveTask = resolve; });
    const dispose = jest.fn();
    const guarded = withTimeout(task, 100, 'pose-model-timeout', (value) => value.dispose());
    jest.advanceTimersByTime(101);
    await expect(guarded).rejects.toThrow('pose-model-timeout');
    resolveTask({ dispose });
    await Promise.resolve();
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('keeps DOM permission errors distinguishable for analytics', () => {
    expect(poseErrorReason(new DOMException('denied', 'NotAllowedError'))).toBe('NotAllowedError');
    expect(poseErrorReason(new Error('pose-model-timeout'))).toBe('pose-model-timeout');
    expect(poseErrorReason(new Error('network'))).toBe('pose-start-failed');
  });

  it('uses the same 12 FPS inference cap as the reference project', () => {
    expect(poseInferenceIntervalMs()).toBe(83);
  });

  it('measures torso scale while keeping hip and body confidence separate', () => {
    const keypoints = Array.from({ length: 17 }, () => ({ x: 0, y: 0, score: 0 }));
    keypoints[5] = { x: 80, y: 30, score: 0.05 };
    keypoints[6] = { x: 112, y: 30, score: 0.05 };
    keypoints[11] = { x: 72, y: 72, score: 0.92 };
    keypoints[12] = { x: 104, y: 72, score: 0.88 };
    expect(hipMotionSample(keypoints, 192, 144)).toEqual({
      x: 1 - 88 / 192,
      y: 0.5,
      score: 0.88,
      bodyScale: Math.hypot(8, 42) / 240,
      bodyScaleScore: 0.05,
    });
  });
});
