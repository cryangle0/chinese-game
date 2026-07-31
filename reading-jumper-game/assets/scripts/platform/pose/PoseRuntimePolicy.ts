import type { CameraOverlayState } from '../camera/CameraOverlay';
import type { MoveNetKeypoint } from './PoseRuntimeLoader';
import type { PoseInteractionStatus, PoseMotionSample } from './PoseInputTypes';

export const MODEL_START_TIMEOUT_MS = 20000;
export const MAX_CONSECUTIVE_INFERENCE_FAILURES = 5;

export interface WebPoseInputCallbacks {
  onColumn(column: 0 | 1 | 2): void;
  onJump(column: 0 | 1 | 2): void;
  onState(state: CameraOverlayState, details?: Readonly<Record<string, string | number>>): void;
}

export function poseInferenceIntervalMs(): number {
  return Math.floor(1000 / 12);
}

export function hipMotionSample(
  keypoints: readonly MoveNetKeypoint[],
  videoWidth: number,
  videoHeight: number,
): PoseMotionSample {
  const leftShoulder = keypoints[5];
  const rightShoulder = keypoints[6];
  const leftHip = keypoints[11];
  const rightHip = keypoints[12];
  const width = Math.max(1, videoWidth);
  const height = Math.max(1, videoHeight);
  const shoulderX = ((leftShoulder?.x ?? 0) + (rightShoulder?.x ?? 0)) / 2;
  const shoulderY = ((leftShoulder?.y ?? 0) + (rightShoulder?.y ?? 0)) / 2;
  const hipX = ((leftHip?.x ?? 0) + (rightHip?.x ?? 0)) / 2;
  const hipY = ((leftHip?.y ?? 0) + (rightHip?.y ?? 0)) / 2;
  const diagonal = Math.hypot(width, height);
  return {
    x: 1 - hipX / width,
    y: hipY / height,
    score: Math.min(leftHip?.score ?? 0, rightHip?.score ?? 0),
    bodyScale: Math.hypot(hipX - shoulderX, hipY - shoulderY) / diagonal,
    bodyScaleScore: Math.min(
      leftShoulder?.score ?? 0,
      rightShoulder?.score ?? 0,
      leftHip?.score ?? 0,
      rightHip?.score ?? 0,
    ),
  };
}

export function poseErrorReason(error: unknown): string {
  if (error instanceof DOMException) return error.name;
  if (error instanceof Error && /^pose-[a-z0-9-]+$/i.test(error.message)) return error.message;
  return 'pose-start-failed';
}

export function poseInteractionStatusLabel(status: PoseInteractionStatus): string {
  if (status === 'too-close') return '请后退到手机约1米处';
  if (status === 'too-far') return '请靠近到手机约1米处';
  if (status === 'off-center') return '请站到画面中央';
  if (status === 'stabilizing') return '请在约1米处站稳';
  return '请站到手机约1米处';
}

export function withTimeout<T>(
  task: Promise<T>,
  timeoutMs: number,
  reason: string,
  onLateResolve?: (value: T) => void,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeout = globalThis.setTimeout(() => {
      settled = true;
      reject(new Error(reason));
    }, timeoutMs);
    task.then((value) => {
      if (settled) {
        onLateResolve?.(value);
        return;
      }
      settled = true;
      globalThis.clearTimeout(timeout);
      resolve(value);
    }, (error) => {
      if (settled) return;
      settled = true;
      globalThis.clearTimeout(timeout);
      reject(error);
    });
  });
}
