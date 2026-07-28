import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'test-results', 'performance');
const backendArgument = process.argv.find((argument) => argument.startsWith('--backend='));
const requestedBackend = backendArgument?.split('=')[1] ?? 'webgl';
if (!['webgl', 'wasm'].includes(requestedBackend)) {
  throw new Error('backend must be webgl or wasm');
}
const reportFile = path.join(output, `pose-runtime-${requestedBackend}.json`);
const port = Number(process.env.POSE_PERF_PORT ?? 42982);
const baseUrl = `http://127.0.0.1:${port}`;
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function waitForServer() {
  for (let attempt = 0; attempt < 75; attempt += 1) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('pose benchmark server did not start');
}

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

await fs.mkdir(output, { recursive: true });
const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
  windowsHide: true,
});

try {
  await waitForServer();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
    await page.goto(`${baseUrl}/runtime-config.json`, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });
    await page.evaluate(() => performance.clearResourceTimings());
    const scripts = [
      'tf-core.js',
      'tf-converter.js',
      'tf-backend-webgl.js',
      'tf-backend-wasm.js',
      'pose-detection.js',
    ];
    for (const file of scripts) await page.addScriptTag({ url: `${baseUrl}/vendor/${file}` });
    const runtime = await page.evaluate(async (backend) => {
      const setupStarted = performance.now();
      if (backend === 'wasm') {
        globalThis.tf.env().set('WASM_HAS_MULTITHREAD_SUPPORT', false);
        globalThis.tf.wasm.setWasmPaths({
          'tfjs-backend-wasm.wasm': './media/runtime/wasm/tfjs-backend-wasm.wasm',
          'tfjs-backend-wasm-simd.wasm': './wasm/tfjs-backend-wasm-simd.wasm',
          'tfjs-backend-wasm-threaded-simd.wasm': './wasm/tfjs-backend-wasm-simd.wasm',
        });
      }
      await globalThis.tf.setBackend(backend);
      await globalThis.tf.ready();
      const detector = await globalThis.poseDetection.createDetector(
        globalThis.poseDetection.SupportedModels.MoveNet,
        {
          modelType: globalThis.poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
          enableSmoothing: true,
          modelUrl: './models/movenet/singlepose-lightning-v4/model.json',
        },
      );
      const setupMs = performance.now() - setupStarted;
      const canvas = document.createElement('canvas');
      canvas.width = 192;
      canvas.height = 192;
      const graphics = canvas.getContext('2d');
      graphics.fillStyle = '#101820';
      graphics.fillRect(0, 0, 192, 192);
      const inferences = [];
      for (let index = 0; index < 4; index += 1) {
        const started = performance.now();
        await detector.estimatePoses(canvas, { flipHorizontal: false, maxPoses: 1 });
        inferences.push(performance.now() - started);
      }
      detector.dispose?.();
      const resources = performance.getEntriesByType('resource')
        .filter((entry) => /\/(vendor|models|wasm|media\/runtime)\//.test(entry.name));
      return {
        backend: globalThis.tf.getBackend(),
        setupMs,
        inferences,
        transferBytes: resources.reduce((sum, entry) => sum + entry.transferSize, 0),
      };
    }, requestedBackend);
    const warm = runtime.inferences.slice(1);
    const report = {
      generatedAt: new Date().toISOString(),
      environment: `local-headless-chrome-${requestedBackend}`,
      backend: runtime.backend,
      setupMs: Math.round(runtime.setupMs),
      firstInferenceMs: Math.round(runtime.inferences[0]),
      firstReadyMs: Math.round(runtime.setupMs + runtime.inferences[0]),
      warmInferenceP50Ms: Math.round(percentile(warm, 0.5)),
      warmInferenceP95Ms: Math.round(percentile(warm, 0.95)),
      transferBytes: runtime.transferBytes,
      note: 'First inference includes model fetch and backend initialization; desktop headless results do not represent a phone.',
    };
    await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    if (!['webgl', 'wasm'].includes(report.backend)) throw new Error('pose backend unavailable');
    const inferenceLimit = requestedBackend === 'wasm' ? 250 : 100;
    if (report.warmInferenceP95Ms > inferenceLimit) {
      throw new Error(
        `warm pose inference ${report.warmInferenceP95Ms}ms exceeds ${inferenceLimit}ms`,
      );
    }
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 6000))]);
}
