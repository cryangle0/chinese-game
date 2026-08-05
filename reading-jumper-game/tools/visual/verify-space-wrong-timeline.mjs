import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'space-wrong-timeline');
const baseUrl = process.env.READING_URL?.trim() || 'http://127.0.0.1:43985';
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const expectedFrames = new Map([
  ['choice.wrong', 0],
  ['audio.wrong', 0],
  ['hazard.object.enter', 0],
  ['impact.start', 15],
  ['actor.terminal', 22],
  ['page.top.enter', 68],
  ['transition.enter', 93],
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
      correctIndex: 0,
    }));
    await route.fulfill({ response, json: bank });
  });
}

async function waitForNewTimeline(page, previousT0) {
  await page.waitForFunction(
    (previous) => Boolean(document.body.dataset.feedbackTimelineT0)
      && document.body.dataset.feedbackTimelineT0 !== previous,
    previousT0,
    { timeout: 10000, polling: 'raf' },
  );
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

async function waitForFeedbackImage(page) {
  await page.waitForFunction(() => {
    const image = document.querySelector('img[data-customer-motion="Feedback"]');
    return image instanceof HTMLImageElement
      && image.naturalWidth > 1
      && getComputedStyle(image).display !== 'none';
  }, null, { timeout: 3000, polling: 'raf' });
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
    let alphaBounds = null;
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
        alphaBounds = {
          minX, minY, maxX, maxY,
        };
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
      phase: document.body.dataset.feedbackTimelinePhase,
      events: document.body.dataset.feedbackTimelineEvents ?? '',
      audio: document.body.dataset.feedbackAudio ?? '',
      presentation: document.body.dataset.feedbackPresentation,
      underlayDataset: document.body.dataset.feedbackUnderlay,
      underlayDisplay: underlay ? getComputedStyle(underlay).display : 'missing',
      feedbackScale: Number(document.body.dataset.feedbackScale),
      feedbackX: Number(document.body.dataset.feedbackX),
      feedbackY: Number(document.body.dataset.feedbackY),
      replay: Number(image.dataset.motionReplay),
      source: image.currentSrc || image.src,
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      css: {
        width: imageRect.width / stageScale,
        height: imageRect.height / stageScale,
      },
      alphaBounds,
      visibleBounds,
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

async function screenshotDifference(leftPath, rightPath, region) {
  const left = PNG.sync.read(await fs.readFile(leftPath));
  const right = PNG.sync.read(await fs.readFile(rightPath));
  if (left.width !== right.width || left.height !== right.height) {
    throw new Error(`Screenshot size mismatch: ${leftPath} / ${rightPath}`);
  }
  const x0 = region?.x ?? 0;
  const y0 = region?.y ?? 0;
  const x1 = Math.min(left.width, x0 + (region?.width ?? left.width));
  const y1 = Math.min(left.height, y0 + (region?.height ?? left.height));
  let sum = 0;
  let changed = 0;
  let count = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const index = (y * left.width + x) * 4;
      let pixelDifference = 0;
      for (let channel = 0; channel < 4; channel += 1) {
        pixelDifference += Math.abs(left.data[index + channel] - right.data[index + channel]);
      }
      sum += pixelDifference / (4 * 255);
      if (pixelDifference > 80) changed += 1;
      count += 1;
    }
  }
  return {
    mean: sum / count,
    changedRatio: changed / count,
  };
}

function validate(viewport, row) {
  const issues = [];
  const {
    entry, impact, terminal, events, motionDifference,
  } = row;
  if (!entry || !impact || !terminal) return ['feedback diagnostics unavailable'];
  if (entry.timeline !== 'space:wrong') issues.push(`timeline=${entry.timeline}`);
  if (entry.presentation !== 'timeline') issues.push(`presentation=${entry.presentation}`);
  if (entry.underlayDataset !== '0' || entry.underlayDisplay === 'block') {
    issues.push(`underlay=${entry.underlayDataset}/${entry.underlayDisplay}`);
  }
  if (entry.natural.width !== 310 || entry.natural.height !== 720) {
    issues.push(`natural=${entry.natural.width}x${entry.natural.height}`);
  }
  const aspectError = Math.abs(
    (entry.css.width / entry.css.height)
    / (entry.natural.width / entry.natural.height) - 1,
  );
  if (aspectError > 0.01) issues.push(`aspectError=${(aspectError * 100).toFixed(3)}%`);
  if (Math.abs(entry.feedbackScale - 1.35) > 0.001) {
    issues.push(`feedbackScale=${entry.feedbackScale}`);
  }
  if (!entry.source.includes(`motionReplay=${entry.replay}`)) {
    issues.push(`source is not isolated: ${entry.source}`);
  }
  if (!motionDifference
    || motionDifference.entryImpact.changedRatio < 0.005
    || motionDifference.impactTerminal.changedRatio < 0.005) {
    issues.push(`motionDifference=${JSON.stringify(motionDifference)}`);
  }
  if (terminal.visibleBounds) {
    const bottomError = Math.abs(terminal.visibleBounds.bottom - 720);
    if (bottomError > 14) {
      issues.push(`terminal bottom=${terminal.visibleBounds.bottom.toFixed(1)}`);
    }
    if (terminal.visibleBounds.right > 1448) {
      issues.push(`terminal clipped right=${terminal.visibleBounds.right.toFixed(1)}`);
    }
  } else {
    issues.push('terminal visible bounds unavailable');
  }
  if (!terminal.audio.includes('wrong@0') || !terminal.audio.includes('danger@15')) {
    issues.push(`audio=${terminal.audio}`);
  }
  for (const event of events) {
    const expectedFrame = expectedFrames.get(event.id);
    if (expectedFrame === undefined) continue;
    const expectedMs = Math.round(expectedFrame * 1000 / 30);
    if (Math.abs(event.elapsedMs - expectedMs) > 40) {
      issues.push(
        `${event.id} timing=${event.elapsedMs.toFixed(1)}ms expected=${expectedMs}ms`,
      );
    }
  }
  for (const [id] of expectedFrames) {
    if (!events.some((event) => event.id === id)) issues.push(`missing event ${id}`);
  }
  if (viewport.name === 'wide' && terminal.visibleBounds
    && terminal.visibleBounds.left < -8) {
    issues.push(`wide feedback left=${terminal.visibleBounds.left.toFixed(1)}`);
  }
  return issues;
}

async function triggerWrong(page, viewport, previousT0) {
  await page.waitForFunction(
    () => document.body.dataset.answerReady === 'true'
      && document.body.dataset.answerCorrect === undefined,
    null,
    { timeout: 15000, polling: 'raf' },
  );
  const point = designPoint(viewport, 1215, 420);
  await page.mouse.click(point.x, point.y);
  await waitForNewTimeline(page, previousT0);
  return page.getAttribute('body', 'data-feedback-timeline-t0');
}

const server = process.env.READING_URL ? null : spawn(
  process.execPath,
  ['server/index.mjs'],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: '43985',
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
      await stubRuntime(page);
      await page.goto(`${baseUrl}/?skipIntro=1&scene=space&_=${Date.now()}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
      await page.waitForSelector('body[data-game-stage="space"]', { timeout: 30000 });
      await page.waitForSelector('body[data-game-view="play"]', { timeout: 30000 });

      let previousT0 = '';
      previousT0 = await triggerWrong(page, viewport, previousT0) ?? '';
      await waitForEvent(page, 'hazard.object.enter');
      await waitForFeedbackImage(page);
      await page.waitForTimeout(45);
      const entryShot = path.join(outDir, `${viewport.name}-hazard-object-enter.png`);
      await page.screenshot({
        path: entryShot,
      });
      const entry = await feedbackDiagnostics(page);
      await waitForEvent(page, 'impact.start');
      const impactShot = path.join(outDir, `${viewport.name}-impact-start.png`);
      await page.screenshot({
        path: impactShot,
      });
      const impact = await feedbackDiagnostics(page);
      await waitForEvent(page, 'actor.terminal');
      const terminalShot = path.join(outDir, `${viewport.name}-actor-terminal.png`);
      await page.screenshot({
        path: terminalShot,
      });
      const terminal = await feedbackDiagnostics(page);
      await waitForEvent(page, 'transition.enter');
      const events = parseEvents(
        await page.getAttribute('body', 'data-feedback-timeline-events') ?? '',
      );
      const motionDifference = {
        entryImpact: await screenshotDifference(entryShot, impactShot),
        impactTerminal: await screenshotDifference(impactShot, terminalShot),
      };
      const row = {
        viewport,
        entry,
        impact,
        terminal,
        events,
        motionDifference,
        issues: [],
      };
      row.issues = validate(viewport, row);

      if (viewport.name === 'design') {
        const secondT0 = await triggerWrong(page, viewport, previousT0);
        await waitForEvent(page, 'hazard.object.enter');
        await waitForFeedbackImage(page);
        await page.waitForTimeout(45);
        const replayShot = path.join(outDir, 'design-second-hazard-object-enter.png');
        await page.screenshot({
          path: replayShot,
        });
        const replay = await feedbackDiagnostics(page);
        row.replay = replay;
        row.replayDifference = {
          firstEntry: await screenshotDifference(entryShot, replayShot, {
            x: 1080,
            y: 490,
            width: 360,
            height: 280,
          }),
          terminal: await screenshotDifference(terminalShot, replayShot, {
            x: 1080,
            y: 490,
            width: 360,
            height: 280,
          }),
        };
        if (!secondT0 || replay?.replay !== 2) {
          row.issues.push(`second replay=${replay?.replay}`);
        }
        if (!replay?.source.includes('motionReplay=2')) {
          row.issues.push(`second source=${replay?.source}`);
        }
        if (row.replayDifference.firstEntry.mean > 0.035
          || row.replayDifference.terminal.mean < 0.04) {
          row.issues.push(`replayDifference=${JSON.stringify(row.replayDifference)}`);
        }
      }
      report.push(row);
      console.log(row.issues.length ? 'FAIL' : 'PASS', viewport.name, {
        entry,
        impact,
        terminal,
        replay: row.replay,
        motionDifference,
        replayDifference: row.replayDifference,
        events,
        issues: row.issues,
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
  console.error(`SPACE WRONG TIMELINE FAIL\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`SPACE WRONG TIMELINE PASS ${outDir}`);
}
