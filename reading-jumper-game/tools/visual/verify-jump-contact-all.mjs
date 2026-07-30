import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const baseUrl = process.env.READING_URL?.trim() || 'http://127.0.0.1:43971';
const outDir = path.join(root, 'test-results', 'jump-contact-all');
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const viewport = { width: 1440, height: 810 };
const brickLift = 14;
const scenes = [
  { id: 'mario', optionY: -10, optionHeight: 122 },
  { id: 'deep-sea', optionY: -18, optionHeight: 124 },
  { id: 'space', optionY: -24, optionHeight: 126 },
  { id: 'food', optionY: -22, optionHeight: 140 },
  { id: 'poetry', optionY: -14, optionHeight: 128 },
];

await fs.mkdir(outDir, { recursive: true });

function designPoint(x, y) {
  const scale = Math.min(viewport.width / 1440, viewport.height / 810);
  return {
    x: (viewport.width - 1440 * scale) / 2 + x * scale,
    y: (viewport.height - 810 * scale) / 2 + y * scale,
  };
}

async function forceFirstAnswer(page) {
  await page.route('**/question-bank.json*', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({
      ...question,
      correctIndex: 1,
    }));
    await route.fulfill({ response, json: pack });
  });
}

async function visibleHead(page) {
  return page.evaluate(() => {
    const image = document.querySelector('img[data-customer-motion="ReadingDeer"]');
    const canvasNode = document.getElementById('GameCanvas');
    if (!(image instanceof HTMLImageElement)
      || !(canvasNode instanceof HTMLCanvasElement)
      || image.naturalWidth < 2
      || image.naturalHeight < 2
      || getComputedStyle(image).display === 'none') return null;

    const sample = document.createElement('canvas');
    sample.width = image.naturalWidth;
    sample.height = image.naturalHeight;
    const context = sample.getContext('2d', { willReadFrequently: true });
    if (!context) return null;
    context.drawImage(image, 0, 0);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let top = sample.height;
    let bottom = -1;
    for (let y = 0; y < sample.height; y += 1) {
      for (let x = 0; x < sample.width; x += 1) {
        if (pixels[(y * sample.width + x) * 4 + 3] <= 80) continue;
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
    if (bottom < top) return null;

    const style = getComputedStyle(image);
    const width = Number.parseFloat(style.width);
    const height = Number.parseFloat(style.height);
    const left = Number.parseFloat(style.left);
    const cssTop = Number.parseFloat(style.top);
    const [originX, originY] = style.transformOrigin.split(' ').map(Number.parseFloat);
    const matrix = new DOMMatrixReadOnly(style.transform);
    const rawX = width / 2;
    const rawTop = (top / sample.height) * height;
    const visibleTop = cssTop + originY
      + matrix.b * (rawX - originX)
      + matrix.d * (rawTop - originY);
    const canvas = canvasNode.getBoundingClientRect();
    const scale = Math.min(canvas.width / 1440, canvas.height / 810);
    const stageTop = canvas.y + (canvas.height - 810 * scale) / 2;
    return {
      visibleTop,
      designVisibleTop: (visibleTop - stageTop) / scale,
      frameTop: top,
      frameBottom: bottom,
      source: new URL(image.currentSrc || image.src, location.href).pathname,
      deerState: document.body.dataset.deerState,
      jumpHeight: Number(document.body.dataset.deerJumpHeight),
      left,
    };
  });
}

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
});
const results = [];

try {
  for (const scene of scenes) {
    const context = await browser.newContext({ viewport });
    await context.grantPermissions(['camera']);
    const page = await context.newPage();
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
    await forceFirstAnswer(page);
    await page.route('**/vendor/*.js', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: '',
    }));
    await page.goto(`${baseUrl}/?skipIntro=1&scene=${scene.id}&_=${Date.now()}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
    await page.waitForSelector(`body[data-game-stage="${scene.id}"]`, { timeout: 30000 });
    await page.waitForSelector('body[data-game-view="play"]', { timeout: 30000 });
    await page.waitForTimeout(500);

    const click = designPoint(720, 420);
    await page.mouse.click(click.x, click.y);
    const samples = [];
    for (let elapsed = 0; elapsed <= 620; elapsed += 20) {
      if (elapsed > 0) await page.waitForTimeout(20);
      const sample = await visibleHead(page);
      if (sample?.source.endsWith('/action.webp')) {
        samples.push({ elapsed, ...sample });
      }
      if (elapsed === 260) {
        await page.screenshot({
          path: path.join(outDir, `${scene.id}-apex.png`),
        });
      }
    }
    const highest = samples.reduce(
      (best, sample) => !best || sample.designVisibleTop < best.designVisibleTop
        ? sample
        : best,
      null,
    );
    const expectedTop = 405 - (
      scene.optionY + brickLift - scene.optionHeight / 2
    );
    const gap = highest ? highest.designVisibleTop - expectedTop : null;
    const passed = gap !== null && gap >= -25 && gap <= 8;
    const screenshot = path.join(outDir, `${scene.id}.png`);
    await page.screenshot({ path: screenshot });
    const result = {
      scene: scene.id,
      passed,
      expectedTop,
      gap: gap === null ? null : Number(gap.toFixed(2)),
      highest,
      configuredJumpHeight: Number(
        await page.getAttribute('body', 'data-deer-jump-height'),
      ),
      screenshot,
    };
    results.push(result);
    console.log(JSON.stringify(result));
    await context.close();
  }
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(outDir, 'report.json'),
  JSON.stringify(results, null, 2),
);
if (results.some((result) => !result.passed)) process.exitCode = 1;
