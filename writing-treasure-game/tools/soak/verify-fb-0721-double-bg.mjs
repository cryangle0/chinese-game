/**
 * Reading settlement @ 915×407:
 * - Background fills full width (no letterbox bars)
 * - Full art content visible (no cover crop of flag/mushroom)
 * - Single board layer (stretch X only)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const outDir = path.resolve(
  '..', 'reading-jumper-game', 'test-results', 'fb-0721-double-bg',
);
const vp = { width: 915, height: 407 };

function designPoint(x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
    scale,
    stageLeft: (vp.width - 1440 * scale) / 2,
    stageTop: (vp.height - 810 * scale) / 2,
  };
}

function meanRgb(png, x0, y0, x1, y1) {
  let r = 0; let g = 0; let b = 0; let n = 0;
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(png.width, Math.ceil(x1));
  const bottom = Math.min(png.height, Math.ceil(y1));
  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const i = (y * png.width + x) * 4;
      r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2];
      n += 1;
    }
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

function channelVariance(png, x0, y0, x1, y1) {
  const samples = [];
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(png.width, Math.ceil(x1));
  const bottom = Math.min(png.height, Math.ceil(y1));
  for (let y = top; y < bottom; y += 2) {
    for (let x = left; x < right; x += 2) {
      const i = (y * png.width + x) * 4;
      samples.push((png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3);
    }
  }
  if (!samples.length) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return samples.reduce((a, v) => a + (v - mean) ** 2, 0) / samples.length;
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({
  viewport: { width: vp.width, height: vp.height },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
await page.route('**/question-bank.json', async (route) => {
  const response = await route.fetch();
  const pack = await response.json();
  pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
  await route.fulfill({ response, json: pack });
});
await page.goto(`${baseUrl}?skipIntro=1&scene=mario`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => {
  const p = designPoint(720, 430);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 15000,
  });
});

for (let q = 0; q < 5; q += 1) {
  const p = designPoint(337, 405);
  await page.touchscreen.tap(p.x, p.y);
  await page.waitForTimeout(1000);
  await page.waitForFunction(() => (
    !document.body.dataset.answerCorrect
    || document.body.dataset.gameView === 'stage-result'
  ), null, { timeout: 8000 }).catch(() => {});
}
await page.waitForSelector('body[data-game-view="stage-result"]', { timeout: 25000 });
await page.waitForTimeout(500);

const layout = await page.evaluate(() => ({
  bg: Number(document.body.dataset.resultBackgroundScale),
  art: Number(document.body.dataset.resultArtworkScale),
  fill: Number(document.body.dataset.resultBackdropScale),
}));

const shotPath = path.join(outDir, '02-settlement-915x407.png');
const buf = await page.screenshot({ path: shotPath, type: 'png' });
const png = PNG.sync.read(buf);

const leftEdge = meanRgb(png, 1, 60, 8, 140);
const rightEdge = meanRgb(png, vp.width - 8, 60, vp.width - 1, 140);
const leftVar = channelVariance(png, 1, 60, 40, 200);
const rightVar = channelVariance(png, vp.width - 40, 200, vp.width - 1, 380);
const leftLum = (leftEdge[0] + leftEdge[1] + leftEdge[2]) / 3;

// Flat solid letterbox (black or sky panel) has near-zero variance.
const noLetterboxBars = leftVar > 80 && rightVar > 80 && leftLum > 40;
// Stretch-X: bg/art/fill share sx > 1 on ultrawide.
const stretchOk = Math.abs(layout.bg - layout.fill) < 0.01
  && Math.abs(layout.art - layout.fill) < 0.01
  && layout.fill > 1.05;

// #region agent log
fetch('http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
  body: JSON.stringify({
    sessionId: 'ffb02e',
    runId: 'stretch-x-post',
    hypothesisId: 'H4',
    location: 'verify-fb-0721-double-bg.mjs',
    message: 'stretch-X full-bleed gate',
    data: {
      layout, leftEdge, rightEdge, leftVar, rightVar, leftLum,
      noLetterboxBars, stretchOk,
    },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

const pass = stretchOk && noLetterboxBars;
const evidence = {
  pass,
  stretchOk,
  noLetterboxBars,
  leftLum,
  leftVar,
  rightVar,
  leftEdge,
  rightEdge,
  layout,
  shot: '02-settlement-915x407.png',
  outDir,
};
await fs.writeFile(path.join(outDir, 'EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
const mirror = path.resolve('test-results', 'fb-0721-wave1', 'reading');
await fs.mkdir(mirror, { recursive: true });
await fs.copyFile(shotPath, path.join(mirror, '02-settlement-915x407.png'));
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(pass ? 0 : 1);
