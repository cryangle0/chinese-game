import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'test-results', 'deer-motion-size');
const baseUrl = process.env.DEER_SIZE_URL?.trim() || 'http://127.0.0.1:43881';
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scenes = [
  { id: 'mario', option: [280, 415] },
  { id: 'deep-sea', option: [270, 423] },
  { id: 'space', option: [225, 429] },
  { id: 'food', option: [225, 427] },
  { id: 'poetry', option: [320, 419] },
];

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const results = [];

try {
  for (const scene of scenes) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
    const page = await context.newPage();
    await page.route('**/question-bank.json', async (route) => {
      const response = await route.fetch();
      const pack = await response.json();
      pack.questions = pack.questions.map((question) => ({ ...question, correctIndex: 0 }));
      await route.fulfill({ response, json: pack });
    });
    await page.goto(`${baseUrl}/?skipIntro=1&scene=${scene.id}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30000,
    });
    await page.waitForSelector('body[data-game-ready="true"]', { timeout: 20000 });
    await page.waitForSelector('body[data-game-view="play"]', { timeout: 10000 });
    await page.screenshot({ path: path.join(output, `${scene.id}-idle.png`) });

    await page.mouse.click(scene.option[0], scene.option[1]);
    await page.waitForFunction(() => document.body.dataset.deerState === 'run', null, {
      timeout: 1500,
    });
    await page.waitForFunction(() => {
      const image = document.querySelector('img[data-customer-motion="ReadingDeer"]');
      const source = image instanceof HTMLImageElement ? image.currentSrc || image.src : '';
      return /\/run-(?:left|right)\.webp$/.test(new URL(source, location.href).pathname)
        && Number.isFinite(Number(document.body.dataset.deerPinScale))
        && Number.isFinite(Number(document.body.dataset.deerOpaqueH));
    }, null, { timeout: 1200 });
    const metrics = await page.evaluate(() => {
      const image = document.querySelector('img[data-customer-motion="ReadingDeer"]');
      const box = (document.body.dataset.deerBox ?? '').split('x').map(Number);
      if (!(image instanceof HTMLImageElement) || box.length !== 2) return null;
      const scale = Number(document.body.dataset.deerPinScale);
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context?.drawImage(image, 0, 0);
      const pixels = context?.getImageData(0, 0, canvas.width, canvas.height).data;
      let top = canvas.height;
      let bottom = -1;
      if (pixels) {
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            if (pixels[(y * canvas.width + x) * 4 + 3] <= 80) continue;
            top = Math.min(top, y);
            bottom = Math.max(bottom, y);
          }
        }
      }
      const opaqueHeight = Math.max(0, bottom - top + 1);
      return {
        source: new URL(image.currentSrc || image.src, location.href).pathname,
        boxWidth: box[0],
        boxHeight: box[1],
        pinScale: scale,
        opaqueHeight,
        visibleHeight: opaqueHeight * scale,
      };
    });
    await page.screenshot({ path: path.join(output, `${scene.id}-run.png`) });
    await context.close();

    const ratio = metrics ? metrics.visibleHeight / metrics.boxHeight : 0;
    const passed = Boolean(metrics)
      && /\/run-(?:left|right)\.webp$/.test(metrics.source)
      && ratio >= 0.97
      && ratio <= 1.08;
    const result = { scene: scene.id, passed, visibleHeightRatio: ratio, ...metrics };
    results.push(result);
    console.log(`${passed ? 'PASS' : 'FAIL'} ${scene.id}`, JSON.stringify(result));
  }
} finally {
  await browser.close();
}

const passed = results.every((result) => result.passed);
await fs.writeFile(
  path.join(output, 'result.json'),
  JSON.stringify({ passed, results }, null, 2),
);
if (!passed) process.exitCode = 1;
