import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'space-correct-replay');
const baseUrl = process.env.READING_URL?.trim() || 'http://127.0.0.1:43984';
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const viewport = { width: 1440, height: 810 };

await fs.mkdir(outDir, { recursive: true });

async function waitForServer(timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // Retry while the local server boots.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Server did not start: ${baseUrl}`);
}

async function stubRuntime(page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 192;
          canvas.height = 144;
          return canvas.captureStream(24);
        },
      },
    });
    window.tf = {
      setBackend: async () => true,
      ready: async () => undefined,
      getBackend: () => 'webgl',
      wasm: { setWasmPaths: () => undefined },
    };
    window.poseDetection = {
      SupportedModels: { MoveNet: 'MoveNet' },
      movenet: { modelType: { SINGLEPOSE_LIGHTNING: 'lightning' } },
      createDetector: async () => ({
        estimatePoses: async () => [],
        dispose: () => undefined,
      }),
    };
  });
  await page.route('**/vendor/*.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: '',
  }));
  await page.route('**/question-bank.json*', async (route) => {
    const response = await route.fetch();
    const bank = await response.json();
    bank.questions = bank.questions.map((question) => ({
      ...question,
      correctIndex: 1,
    }));
    await route.fulfill({ response, json: bank });
  });
}

async function waitForRocketEntry(page, previousT0) {
  await page.waitForFunction(
    (previous) => Boolean(document.body.dataset.feedbackTimelineT0)
      && document.body.dataset.feedbackTimelineT0 !== previous,
    previousT0,
    { timeout: 10000, polling: 'raf' },
  );
  await page.waitForFunction(
    () => (document.body.dataset.feedbackTimelineEvents ?? '')
      .includes('vehicle.rocket.enter@36:'),
    null,
    { timeout: 10000, polling: 'raf' },
  );
  await page.waitForFunction(() => {
    const image = document.querySelector('img[data-customer-motion="Feedback"]');
    return image instanceof HTMLImageElement
      && image.naturalWidth > 1
      && getComputedStyle(image).display !== 'none';
  }, null, { timeout: 3000, polling: 'raf' });
}

async function playbackDiagnostics(page) {
  return page.evaluate(() => {
    const image = document.querySelector('img[data-customer-motion="Feedback"]');
    if (!(image instanceof HTMLImageElement)) return null;
    const sample = document.createElement('canvas');
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext('2d', { willReadFrequently: true });
    let alphaMinX = null;
    let alphaMaxX = null;
    if (context) {
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
      let minX = sample.width;
      let maxX = -1;
      for (let y = 0; y < sample.height; y += 1) {
        for (let x = 0; x < sample.width; x += 1) {
          if (pixels[(y * sample.width + x) * 4 + 3] <= 32) continue;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
        }
      }
      if (maxX >= minX) {
        alphaMinX = minX;
        alphaMaxX = maxX;
      }
    }
    return {
      replay: Number(image.dataset.motionReplay),
      source: image.currentSrc || image.src,
      alphaMinX,
      alphaMaxX,
      naturalWidth: image.naturalWidth,
      phase: document.body.dataset.feedbackTimelinePhase,
      events: document.body.dataset.feedbackTimelineEvents,
    };
  });
}

const server = process.env.READING_URL ? null : spawn(
  process.execPath,
  ['server/index.mjs'],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: '43984',
      PUBLIC_ROOT: path.join(root, 'build', 'web-mobile'),
      MEDIA_ROOT: path.join(root, 'customer-media'),
    },
    stdio: 'ignore',
    windowsHide: true,
  },
);

const attempts = [];
try {
  if (server) await waitForServer();
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  });
  try {
    const context = await browser.newContext({ viewport });
    await context.grantPermissions(['camera']);
    const page = await context.newPage();
    await stubRuntime(page);
    await page.goto(`${baseUrl}/?skipIntro=1&scene=space&_=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
    await page.waitForSelector('body[data-game-stage="space"]', { timeout: 30000 });

    let previousT0 = '';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await page.waitForFunction(
        () => document.body.dataset.answerReady === 'true'
          && document.body.dataset.answerCorrect === undefined,
        null,
        { timeout: 15000, polling: 'raf' },
      );
      await page.mouse.click(720, 420);
      await waitForRocketEntry(page, previousT0);
      previousT0 = await page.getAttribute('body', 'data-feedback-timeline-t0') ?? '';
      const diagnostics = await playbackDiagnostics(page);
      await page.screenshot({
        path: path.join(outDir, `attempt-${attempt}-rocket-entry.png`),
      });
      attempts.push({ attempt, diagnostics });
    }
    await context.close();
  } finally {
    await browser.close();
  }
} finally {
  if (server?.pid) {
    try {
      process.kill(server.pid);
    } catch {
      // The server may already be closed after a browser failure.
    }
  }
}

const issues = [];
attempts.forEach(({ attempt, diagnostics }) => {
  if (!diagnostics) {
    issues.push(`attempt ${attempt}: diagnostics unavailable`);
    return;
  }
  if (diagnostics.replay !== attempt) {
    issues.push(`attempt ${attempt}: replay=${diagnostics.replay}`);
  }
  if (!diagnostics.source.includes(`motionReplay=${attempt}`)) {
    issues.push(`attempt ${attempt}: source is not isolated`);
  }
  if (diagnostics.alphaMinX === null || diagnostics.alphaMinX > 100) {
    issues.push(`attempt ${attempt}: opened near final frame minX=${diagnostics.alphaMinX}`);
  }
});

await fs.writeFile(
  path.join(outDir, 'report.json'),
  `${JSON.stringify({ attempts, issues }, null, 2)}\n`,
);
if (issues.length) {
  console.error(`SPACE CORRECT REPLAY FAIL\n${issues.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log('SPACE CORRECT REPLAY PASS', attempts);
}
