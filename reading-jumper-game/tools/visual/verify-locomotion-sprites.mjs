import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'artifacts', 'locomotion-sprite-v9');
const baseUrl = process.env.LOCOMOTION_BASE_URL ?? 'http://127.0.0.1:44021';
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scenes = ['mario', 'deep-sea', 'space', 'food', 'poetry'];

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const results = [];

try {
  for (const scene of scenes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
    const page = await context.newPage();
    const diagnostics = [];
    page.on('pageerror', (error) => diagnostics.push(`pageerror: ${error.stack ?? error.message}`));
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) {
        diagnostics.push(`${message.type()}: ${message.text()}`);
      }
    });
    await installPoseStub(page);
    await page.goto(
      `${baseUrl}/?scene=${scene}&skipIntro=1&fix=deterministic-sprites-v9`,
      { waitUntil: 'networkidle' },
    );
    try {
      await page.waitForSelector(`body[data-game-stage="${scene}"]`, { timeout: 10000 });
    } catch (error) {
      await page.screenshot({ path: path.join(output, `${scene}-startup-failure.png`) });
      const state = await page.evaluate(() => ({
        body: { ...document.body.dataset },
        text: document.body.innerText,
        scripts: [...document.scripts].map((script) => script.src).filter(Boolean),
      }));
      console.error(JSON.stringify({ scene, state, diagnostics }, null, 2));
      throw error;
    }
    await page.waitForSelector('body[data-pose-state="ready"]', { timeout: 10000 });
    await page.waitForSelector(
      'body[data-deer-locomotion-renderer="sprite-sheet"]',
      { timeout: 5000 },
    );
    await page.waitForTimeout(900);

    const idleClip = { x: 560, y: 390, width: 320, height: 340 };
    const idleBefore = PNG.sync.read(await page.screenshot({ clip: idleClip }));
    await page.waitForTimeout(280);
    const idleAfter = PNG.sync.read(await page.screenshot({ clip: idleClip }));
    const idleChangedPixels = changedPixels(idleBefore, idleAfter);
    if (idleChangedPixels < 100) {
      throw new Error(`${scene} idle sprite did not visibly animate: ${idleChangedPixels}px`);
    }

    await page.evaluate(() => { window.__poseRawX = 132; });
    const left = await captureRun(page, scene, 'left');
    await page.waitForSelector('body[data-deer-state="idle"]', { timeout: 8000 });

    await page.evaluate(() => { window.__poseRawX = 60; });
    const right = await captureRun(page, scene, 'right');
    await page.waitForSelector('body[data-deer-state="idle"]', { timeout: 13000 });

    results.push({
      scene,
      idleChangedPixels,
      left,
      right,
    });
    await context.close();
  }
} finally {
  await browser.close();
}

const report = {
  generatedAt: new Date().toISOString(),
  baseUrl,
  results,
};
await fs.writeFile(
  path.join(output, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));

async function captureRun(page, scene, direction) {
  await page.waitForSelector('body[data-deer-state="run"]', { timeout: 5000 });
  const samples = [];
  for (let index = 0; index < 12; index += 1) {
    samples.push(await page.evaluate(() => ({
      state: document.body.dataset.deerState,
      renderer: document.body.dataset.deerLocomotionRenderer,
      path: document.body.dataset.deerSpritePath,
      frame: Number(document.body.dataset.deerSpriteFrame ?? '-1'),
      frames: Number(document.body.dataset.deerSpriteFrames ?? '0'),
      domMotionVisible: [...document.querySelectorAll(
        'img[data-customer-motion="ReadingDeer"]',
      )].some((image) => getComputedStyle(image).display !== 'none'),
    })));
    if ([0, 5, 10].includes(index)) {
      await page.screenshot({
        path: path.join(output, `${scene}-${direction}-${index}.png`),
      });
    }
    await page.waitForTimeout(85);
  }
  const running = samples.filter((sample) => sample.state === 'run');
  const uniqueFrames = [...new Set(running.map((sample) => sample.frame).filter(
    (frame) => frame >= 0,
  ))];
  const paths = [...new Set(running.map((sample) => sample.path).filter(Boolean))];
  if (running.length < 6 || uniqueFrames.length < 5) {
    throw new Error(
      `${scene}/${direction} did not advance enough frames: `
      + `${running.length} samples, ${uniqueFrames.length} frames`,
    );
  }
  if (running.some((sample) => sample.renderer !== 'sprite-sheet')) {
    throw new Error(`${scene}/${direction} fell back from sprite-sheet rendering`);
  }
  if (running.some((sample) => sample.domMotionVisible)) {
    throw new Error(`${scene}/${direction} still displayed the animated WebP layer`);
  }
  const expectedSuffix = direction === 'left'
    ? '/locomotion-run-left'
    : '/locomotion-run-right';
  if (!paths.some((value) => value.endsWith(expectedSuffix))) {
    throw new Error(`${scene}/${direction} used unexpected sprite path: ${paths.join(', ')}`);
  }
  return {
    samples: running.length,
    uniqueFrames,
    paths,
  };
}

function changedPixels(before, after) {
  let changed = 0;
  for (let offset = 0; offset < before.data.length; offset += 4) {
    const delta = Math.max(
      Math.abs(before.data[offset] - after.data[offset]),
      Math.abs(before.data[offset + 1] - after.data[offset + 1]),
      Math.abs(before.data[offset + 2] - after.data[offset + 2]),
      Math.abs(before.data[offset + 3] - after.data[offset + 3]),
    );
    if (delta > 8) changed += 1;
  }
  return changed;
}

async function installPoseStub(page) {
  await page.route('**/runtime-config.json', (route) => route.fulfill({
    contentType: 'application/json',
    json: {
      pose: {
        movementSensitivity: 1.8,
        interactionStableMs: 300,
      },
    },
  }));
  await page.route('**/vendor/*.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: '',
  }));
  await page.addInitScript(() => {
    window.__poseRawX = 96;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 192;
          canvas.height = 144;
          const graphics = canvas.getContext('2d');
          graphics.fillStyle = '#17324d';
          graphics.fillRect(0, 0, canvas.width, canvas.height);
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
        estimatePoses: async () => {
          const rawX = window.__poseRawX;
          const keypoints = Array.from({ length: 17 }, () => ({
            x: rawX, y: 72, score: 0.95,
          }));
          keypoints[5] = { x: rawX - 14, y: 30, score: 0.95 };
          keypoints[6] = { x: rawX + 14, y: 30, score: 0.95 };
          keypoints[11] = { x: rawX - 12, y: 72, score: 0.95 };
          keypoints[12] = { x: rawX + 12, y: 72, score: 0.95 };
          return [{ keypoints }];
        },
        dispose: () => undefined,
      }),
    };
  });
}
