interface TfRuntime {
  setBackend(name: string): Promise<boolean>;
  ready(): Promise<void>;
  getBackend(): string;
  env(): { set(name: string, value: boolean): void };
  wasm?: { setWasmPaths(path: string | Readonly<Record<string, string>>): void };
}

interface PoseDetectionRuntime {
  SupportedModels: { MoveNet: string };
  movenet: { modelType: { SINGLEPOSE_LIGHTNING: string } };
  createDetector(model: string, config: unknown): Promise<MoveNetDetector>;
}

export interface MoveNetKeypoint {
  x: number;
  y: number;
  score?: number;
}

export interface MoveNetDetector {
  estimatePoses(
    input: HTMLVideoElement,
    options: { flipHorizontal: boolean; maxPoses: number },
  ): Promise<Array<{ keypoints: MoveNetKeypoint[] }>>;
  dispose?(): void;
}

let runtimePromise: Promise<{ tf: TfRuntime; pose: PoseDetectionRuntime }> | null = null;
let modelPrefetchTask: Promise<void> | null = null;
const MODEL_URL = './models/movenet/singlepose-lightning-v4/model.json';
const MODEL_FILES = [
  MODEL_URL,
  './models/movenet/singlepose-lightning-v4/group1-shard1of2.bin',
  './models/movenet/singlepose-lightning-v4/group1-shard2of2.bin',
] as const;

export async function preloadPoseRuntime(timeoutMs = 2500): Promise<boolean> {
  if (typeof document === 'undefined') return true;
  const runtime = loadRuntime().then(() => true, (error: unknown) => {
    console.warn('[PoseRuntimeLoader] runtime preload failed', error);
    return false;
  });
  if (timeoutMs <= 0) return false;
  return Promise.race([
    runtime,
    new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs)),
  ]);
}

export function prefetchMoveNetModel(): void {
  if (modelPrefetchTask || typeof fetch === 'undefined' || typeof location === 'undefined') return;
  modelPrefetchTask = Promise.all(MODEL_FILES.map(async (source) => {
    const response = await fetch(new URL(source, location.href), { cache: 'force-cache' });
    if (!response.ok) throw new Error(`model preload HTTP ${response.status}: ${source}`);
    await response.arrayBuffer();
  })).then(() => undefined).catch((error: unknown) => {
    modelPrefetchTask = null;
    console.warn('[PoseRuntimeLoader] model preload failed', error);
  });
}

export async function createMoveNetDetector(): Promise<{
  detector: MoveNetDetector;
  backend: string;
}> {
  const { tf, pose } = await loadRuntime();
  let backendReady = false;
  try {
    backendReady = await tf.setBackend('webgl');
    await tf.ready();
  } catch {
    backendReady = false;
  }
  if (!backendReady) {
    await loadScript('./vendor/tf-backend-wasm.js');
    tf.env().set('WASM_HAS_MULTITHREAD_SUPPORT', false);
    tf.wasm?.setWasmPaths({
      'tfjs-backend-wasm.wasm': './media/runtime/wasm/tfjs-backend-wasm.wasm',
      'tfjs-backend-wasm-simd.wasm': './wasm/tfjs-backend-wasm-simd.wasm',
      'tfjs-backend-wasm-threaded-simd.wasm': './wasm/tfjs-backend-wasm-simd.wasm',
    });
    if (!await tf.setBackend('wasm')) throw new Error('no supported TF.js backend');
    await tf.ready();
  }
  const detector = await pose.createDetector(pose.SupportedModels.MoveNet, {
    modelType: pose.movenet.modelType.SINGLEPOSE_LIGHTNING,
    enableSmoothing: true,
    minPoseScore: 0.25,
    modelUrl: MODEL_URL,
  });
  return { detector, backend: tf.getBackend() };
}

async function loadRuntime(): Promise<{ tf: TfRuntime; pose: PoseDetectionRuntime }> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      await loadScript('./vendor/tf-core.js', () => Boolean(globalRuntime().tf));
      await loadScript('./vendor/tf-converter.js');
      await loadScript('./vendor/tf-backend-webgl.js');
      await loadScript('./vendor/pose-detection.js', () => Boolean(globalRuntime().poseDetection));
      const { tf, poseDetection } = globalRuntime();
      if (!tf || !poseDetection) throw new Error('pose runtime did not initialize');
      return { tf, pose: poseDetection };
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

function loadScript(source: string, ready: () => boolean = () => false): Promise<void> {
  if (ready()) return Promise.resolve();
  const absolute = new URL(source, location.href).href;
  const existing = Array.from(document.scripts).find((script) => script.src === absolute);
  if (existing?.dataset.loaded === 'true') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = existing ?? document.createElement('script');
    let settled = false;
    const fail = (message: string) => {
      if (settled) return;
      settled = true;
      script.remove();
      reject(new Error(message));
    };
    const timeout = window.setTimeout(() => fail(`script timeout: ${source}`), 15000);
    script.addEventListener('load', () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      script.dataset.loaded = 'true';
      resolve();
    }, { once: true });
    script.addEventListener('error', () => {
      window.clearTimeout(timeout);
      fail(`script failed: ${source}`);
    }, { once: true });
    if (!existing) {
      script.src = absolute;
      script.async = false;
      document.head.appendChild(script);
    }
  });
}

function globalRuntime(): {
  tf?: TfRuntime;
  poseDetection?: PoseDetectionRuntime;
} {
  return globalThis as typeof globalThis & {
    tf?: TfRuntime;
    poseDetection?: PoseDetectionRuntime;
  };
}
