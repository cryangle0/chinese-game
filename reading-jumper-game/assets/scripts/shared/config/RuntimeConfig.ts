export interface RuntimeConfig {
  readonly pose: {
    readonly movementSensitivity: number;
    readonly moveDebounceMs: number;
    readonly jumpCooldownMs: number;
    readonly enterThreshold: number;
    readonly returnThreshold: number;
    readonly smoothingAlpha: number;
    readonly jumpThreshold: number;
    readonly minimumBodyScale: number;
    readonly maximumBodyScale: number;
    readonly interactionStableMs: number;
    readonly interactionCenterTolerance: number;
    readonly interactionScaleTolerance: number;
    readonly interactionPositionTolerance: number;
  };
}

const MIN_MOVEMENT_SENSITIVITY = 0.5;
const MAX_MOVEMENT_SENSITIVITY = 2;
/** Defaults aligned with wxgame-jumper-new PoseConfig (AppConfig.ts). */
const DEFAULT_RUNTIME_CONFIG: RuntimeConfig = {
  pose: {
    movementSensitivity: 1,
    moveDebounceMs: 150,
    jumpCooldownMs: 700,
    enterThreshold: 0.1,
    returnThreshold: 0.04,
    smoothingAlpha: 0.35,
    jumpThreshold: 0.045,
    minimumBodyScale: 0.16,
    maximumBodyScale: 0.38,
    interactionStableMs: 700,
    interactionCenterTolerance: 0.22,
    interactionScaleTolerance: 0.025,
    interactionPositionTolerance: 0.055,
  },
};
let activeRuntimeConfig = DEFAULT_RUNTIME_CONFIG;
let loadTask: Promise<RuntimeConfig> | null = null;

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const finite = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, finite));
}

export function parseRuntimeConfig(value: unknown): RuntimeConfig {
  const pose = (value as { pose?: Record<string, unknown> } | null)?.pose ?? {};
  const defaults = DEFAULT_RUNTIME_CONFIG.pose;
  return {
    pose: {
      movementSensitivity: clampNumber(
        pose.movementSensitivity, defaults.movementSensitivity, MIN_MOVEMENT_SENSITIVITY, MAX_MOVEMENT_SENSITIVITY,
      ),
      moveDebounceMs: clampNumber(pose.moveDebounceMs, defaults.moveDebounceMs, 40, 400),
      jumpCooldownMs: clampNumber(pose.jumpCooldownMs, defaults.jumpCooldownMs, 200, 2000),
      enterThreshold: clampNumber(pose.enterThreshold, defaults.enterThreshold, 0.05, 0.35),
      returnThreshold: clampNumber(pose.returnThreshold, defaults.returnThreshold, 0.02, 0.2),
      smoothingAlpha: clampNumber(pose.smoothingAlpha, defaults.smoothingAlpha, 0.05, 1),
      jumpThreshold: clampNumber(pose.jumpThreshold, defaults.jumpThreshold, 0.03, 0.25),
      minimumBodyScale: clampNumber(
        pose.minimumBodyScale, defaults.minimumBodyScale, 0.08, 0.35,
      ),
      maximumBodyScale: clampNumber(
        pose.maximumBodyScale, defaults.maximumBodyScale, 0.2, 0.65,
      ),
      interactionStableMs: clampNumber(
        pose.interactionStableMs, defaults.interactionStableMs, 200, 2000,
      ),
      interactionCenterTolerance: clampNumber(
        pose.interactionCenterTolerance, defaults.interactionCenterTolerance, 0.12, 0.35,
      ),
      interactionScaleTolerance: clampNumber(
        pose.interactionScaleTolerance, defaults.interactionScaleTolerance, 0.01, 0.08,
      ),
      interactionPositionTolerance: clampNumber(
        pose.interactionPositionTolerance,
        defaults.interactionPositionTolerance,
        0.02,
        0.12,
      ),
    },
  };
}

export function runtimeConfig(): RuntimeConfig {
  return activeRuntimeConfig;
}

export function loadRuntimeConfig(
  url = './runtime-config.json',
  timeoutMs = 1500,
): Promise<RuntimeConfig> {
  if (loadTask) return loadTask;
  loadTask = load(url, timeoutMs);
  return loadTask;
}

async function load(url: string, timeoutMs: number): Promise<RuntimeConfig> {
  if (typeof fetch === 'undefined') return activeRuntimeConfig;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { cache: 'no-cache', signal: controller.signal });
    if (!response.ok) throw new Error(`runtime-config HTTP ${response.status}`);
    activeRuntimeConfig = parseRuntimeConfig(await response.json());
  } catch (error) {
    console.warn('[runtime-config] using defaults', error);
    activeRuntimeConfig = DEFAULT_RUNTIME_CONFIG;
  } finally {
    clearTimeout(timeout);
  }
  if (typeof document !== 'undefined') {
    document.body.dataset.poseMovementSensitivity = String(
      activeRuntimeConfig.pose.movementSensitivity,
    );
    document.body.dataset.poseMinimumBodyScale = String(
      activeRuntimeConfig.pose.minimumBodyScale,
    );
    document.body.dataset.poseMaximumBodyScale = String(
      activeRuntimeConfig.pose.maximumBodyScale,
    );
  }
  return activeRuntimeConfig;
}
