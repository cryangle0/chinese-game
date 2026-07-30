import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'space-correct-timeline');
const baseUrl = process.env.READING_URL?.trim() || 'http://127.0.0.1:43982';
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const expectedFrames = new Map([
  ['choice.contact', 0],
  ['fx.stars.enter', 1],
  ['vehicle.rocket.enter', 36],
  ['actor.handoff', 48],
  ['vehicle.boost', 61],
  ['actor.terminal', 106],
  ['transition.enter', 118],
]);
const viewports = [
  { name: 'design', width: 1440, height: 810 },
  { name: 'miniprogram', width: 915, height: 412 },
  { name: 'wide', width: 2271, height: 960 },
];

await fs.mkdir(outDir, { recursive: true });

function designPoint(viewport, x, y) {
  const scale = Math.min(viewport.width / 1440, viewport.height / 810);
  return {
    x: (viewport.width - 1440 * scale) / 2 + x * scale,
    y: (viewport.height - 810 * scale) / 2 + y * scale,
  };
}

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

async function forceCenterCorrectAnswer(page) {
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

async function stubPoseRuntime(page) {
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
}

async function waitForEvent(page, eventId) {
  await page.waitForFunction(
    (expected) => (document.body.dataset.feedbackTimelineEvents ?? '')
      .split('|')
      .some((entry) => entry.startsWith(`${expected}@`)),
    eventId,
    { timeout: 15000, polling: 'raf' },
  );
}

async function capturePhase(page, viewport, phase) {
  await waitForEvent(page, phase);
  if (phase === 'vehicle.rocket.enter') {
    await page.waitForFunction(() => {
      const image = document.querySelector('img[data-customer-motion="Feedback"]');
      return image instanceof HTMLImageElement
        && image.naturalWidth > 1
        && getComputedStyle(image).display !== 'none';
    }, null, { timeout: 3000, polling: 'raf' });
  }
  await page.screenshot({
    path: path.join(outDir, `${viewport.name}-${phase.replaceAll('.', '-')}.png`),
  });
}

async function feedbackDiagnostics(page) {
  return page.evaluate(() => {
    const image = document.querySelector('img[data-customer-motion="Feedback"]');
    const canvasNode = document.getElementById('GameCanvas');
    const underlay = document.getElementById('CustomerFeedbackUnderlay');
    if (!(image instanceof HTMLImageElement)
      || !(canvasNode instanceof HTMLCanvasElement)) return null;
    const imageRect = image.getBoundingClientRect();
    const canvasRect = canvasNode.getBoundingClientRect();
    const stageScale = Math.min(canvasRect.width / 1440, canvasRect.height / 810);
    const stageLeft = canvasRect.left + (canvasRect.width - 1440 * stageScale) / 2;
    const stageTop = canvasRect.top + (canvasRect.height - 810 * stageScale) / 2;
    const sample = document.createElement('canvas');
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext('2d', { willReadFrequently: true });
    let visibleBounds = null;
    if (context) {
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
      let minX = sample.width;
      let minY = sample.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < sample.height; y += 1) {
        for (let x = 0; x < sample.width; x += 1) {
          if (pixels[(y * sample.width + x) * 4 + 3] <= 32) continue;
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
      if (maxX >= minX && maxY >= minY) {
        const style = getComputedStyle(image);
        const cssWidth = Number.parseFloat(style.width);
        const cssHeight = Number.parseFloat(style.height);
        const cssLeft = Number.parseFloat(style.left);
        const cssTop = Number.parseFloat(style.top);
        const [originX, originY] = style.transformOrigin.split(' ').map(Number.parseFloat);
        const matrix = new DOMMatrixReadOnly(style.transform);
        const transformPoint = (x, y) => ({
          x: cssLeft + originX
            + matrix.a * (x - originX)
            + matrix.c * (y - originY),
          y: cssTop + originY
            + matrix.b * (x - originX)
            + matrix.d * (y - originY),
        });
        const topLeft = transformPoint(
          minX / sample.width * cssWidth,
          minY / sample.height * cssHeight,
        );
        const bottomRight = transformPoint(
          (maxX + 1) / sample.width * cssWidth,
          (maxY + 1) / sample.height * cssHeight,
        );
        visibleBounds = {
          left: (topLeft.x - stageLeft) / stageScale,
          top: (topLeft.y - stageTop) / stageScale,
          right: (bottomRight.x - stageLeft) / stageScale,
          bottom: (bottomRight.y - stageTop) / stageScale,
        };
      }
    }
    return {
      timeline: document.body.dataset.feedbackTimeline,
      presentation: document.body.dataset.feedbackPresentation,
      underlayDataset: document.body.dataset.feedbackUnderlay,
      underlayDisplay: underlay ? getComputedStyle(underlay).display : 'missing',
      feedbackScale: Number(document.body.dataset.feedbackScale),
      feedbackY: Number(document.body.dataset.feedbackY),
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      css: {
        width: imageRect.width / stageScale,
        height: imageRect.height / stageScale,
      },
      visibleBounds,
      events: document.body.dataset.feedbackTimelineEvents ?? '',
    };
  });
}

function parseEvents(value) {
  return value.split('|').filter(Boolean).map((entry) => {
    const match = /^(.*?)@(\d+):([0-9.]+)$/.exec(entry);
    if (!match) return { raw: entry };
    return {
      id: match[1],
      frame: Number(match[2]),
      elapsedMs: Number(match[3]),
    };
  });
}

function validate(viewport, diagnostics, events) {
  const issues = [];
  if (!diagnostics) return ['feedback diagnostics unavailable'];
  if (diagnostics.timeline !== 'space:correct') {
    issues.push(`timeline=${diagnostics.timeline}`);
  }
  if (diagnostics.presentation !== 'timeline') {
    issues.push(`presentation=${diagnostics.presentation}`);
  }
  if (diagnostics.underlayDataset !== '0' || diagnostics.underlayDisplay === 'block') {
    issues.push(`underlay=${diagnostics.underlayDataset}/${diagnostics.underlayDisplay}`);
  }
  const aspectError = Math.abs(
    (diagnostics.css.width / diagnostics.css.height)
    / (diagnostics.natural.width / diagnostics.natural.height) - 1,
  );
  if (aspectError > 0.01) issues.push(`aspectError=${(aspectError * 100).toFixed(3)}%`);
  if (Math.abs(diagnostics.feedbackScale - 1.02) > 0.001) {
    issues.push(`feedbackScale=${diagnostics.feedbackScale}`);
  }
  if (diagnostics.visibleBounds) {
    const bottomError = Math.abs(diagnostics.visibleBounds.bottom - 720);
    if (bottomError > 14) {
      issues.push(`visibleBottom=${diagnostics.visibleBounds.bottom.toFixed(1)}`);
    }
    if (diagnostics.visibleBounds.bottom > 810) {
      issues.push(`feedback clipped below stage: ${diagnostics.visibleBounds.bottom.toFixed(1)}`);
    }
  }
  for (const event of events) {
    const expectedFrame = expectedFrames.get(event.id);
    if (expectedFrame === undefined) continue;
    const expectedMs = Math.round(expectedFrame * 1000 / 30);
    if (Math.abs(event.elapsedMs - expectedMs) > 34) {
      issues.push(
        `${event.id} timing=${event.elapsedMs.toFixed(1)}ms expected=${expectedMs}ms`,
      );
    }
  }
  for (const [id] of expectedFrames) {
    if (!events.some((event) => event.id === id)) issues.push(`missing event ${id}`);
  }
  if (viewport.name === 'wide' && diagnostics.visibleBounds
    && diagnostics.visibleBounds.left < -8) {
    issues.push(`wide feedback left=${diagnostics.visibleBounds.left.toFixed(1)}`);
  }
  return issues;
}

const server = process.env.READING_URL ? null : spawn(
  process.execPath,
  ['server/index.mjs'],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: '43982',
      PUBLIC_ROOT: path.join(root, 'build', 'web-mobile'),
      MEDIA_ROOT: path.join(root, 'customer-media'),
    },
    stdio: 'ignore',
    windowsHide: true,
  },
);

const report = [];
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
    for (const viewport of viewports) {
      const context = await browser.newContext({ viewport });
      await context.grantPermissions(['camera']);
      const page = await context.newPage();
      await stubPoseRuntime(page);
      await forceCenterCorrectAnswer(page);
      await page.goto(`${baseUrl}/?skipIntro=1&scene=space&_=${Date.now()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
      await page.waitForSelector('body[data-game-stage="space"]', { timeout: 30000 });
      await page.waitForSelector('body[data-game-view="play"]', { timeout: 30000 });
      await page.waitForTimeout(500);

      const point = designPoint(viewport, 720, 420);
      await page.mouse.click(point.x, point.y);
      await waitForEvent(page, 'choice.contact');
      await capturePhase(page, viewport, 'fx.stars.enter');
      await capturePhase(page, viewport, 'vehicle.rocket.enter');
      const rocketDiagnostics = await feedbackDiagnostics(page);
      await capturePhase(page, viewport, 'actor.handoff');
      await capturePhase(page, viewport, 'vehicle.boost');
      await capturePhase(page, viewport, 'actor.terminal');
      await waitForEvent(page, 'transition.enter');
      const finalEvents = parseEvents(
        await page.getAttribute('body', 'data-feedback-timeline-events') ?? '',
      );
      const issues = validate(viewport, rocketDiagnostics, finalEvents);
      report.push({
        viewport,
        diagnostics: rocketDiagnostics,
        events: finalEvents,
        issues,
      });
      console.log(issues.length ? 'FAIL' : 'PASS', viewport.name, {
        events: finalEvents,
        diagnostics: rocketDiagnostics,
        issues,
      });
      await context.close();
    }
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

await fs.writeFile(
  path.join(outDir, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
const failures = report.flatMap((row) =>
  row.issues.map((issue) => `${row.viewport.name}: ${issue}`));
if (failures.length) {
  console.error(`SPACE CORRECT TIMELINE FAIL\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`SPACE CORRECT TIMELINE PASS ${outDir}`);
}
