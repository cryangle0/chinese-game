/**
 * Smoke: stretch-X backgrounds on intro + play @ 915×407 for both games.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.resolve('test-results', 'fb-0721-stretch-x-all');
const vp = { width: 915, height: 407 };

function channelVariance(png, x0, y0, x1, y1) {
  const samples = [];
  for (let y = Math.max(0, y0 | 0); y < Math.min(png.height, y1 | 0); y += 2) {
    for (let x = Math.max(0, x0 | 0); x < Math.min(png.width, x1 | 0); x += 2) {
      const i = (y * png.width + x) * 4;
      samples.push((png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3);
    }
  }
  if (!samples.length) return 0;
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  return samples.reduce((a, v) => a + (v - mean) ** 2, 0) / samples.length;
}

function edgeOk(png) {
  const leftVar = channelVariance(png, 1, 40, 36, 200);
  const rightVar = channelVariance(png, png.width - 36, 40, png.width - 1, 200);
  const i = (80 * png.width + 4) * 4;
  const lum = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
  return { leftVar, rightVar, lum, ok: leftVar > 50 && rightVar > 50 && lum > 30 };
}

async function shotIntro(page, url, name) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForTimeout(400);
  const file = path.join(outDir, name);
  const buf = await page.screenshot({ path: file, type: 'png' });
  return { file, ...edgeOk(PNG.sync.read(buf)) };
}

async function shotPlay(page, url, name, tap) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  }).catch(async () => {
    if (tap) await page.touchscreen.tap(tap.x, tap.y);
    await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
      timeout: 15000,
    });
  });
  await page.waitForTimeout(400);
  const file = path.join(outDir, name);
  const buf = await page.screenshot({ path: file, type: 'png' });
  return { file, ...edgeOk(PNG.sync.read(buf)) };
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const results = {};

{
  const context = await browser.newContext({
    viewport: vp, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  results.readingIntro = await shotIntro(page, 'http://127.0.0.1:43887', 'reading-intro-915x407.png');
  await context.close();
}
{
  const context = await browser.newContext({
    viewport: vp, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  results.readingPlay = await shotPlay(
    page,
    'http://127.0.0.1:43887?skipIntro=1&scene=mario',
    'reading-play-915x407.png',
    { x: 457, y: 216 },
  );
  await context.close();
}
{
  const context = await browser.newContext({
    viewport: vp, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  results.writingIntro = await shotIntro(page, 'http://127.0.0.1:43886', 'writing-intro-915x407.png');
  await context.close();
}
{
  const context = await browser.newContext({
    viewport: vp, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  results.writingPlay = await shotPlay(
    page,
    'http://127.0.0.1:43886?skipIntro=1&scene=treasure',
    'writing-play-915x407.png',
  );
  await context.close();
}

const pass = Object.values(results).every((r) => r.ok);
const evidence = { pass, results, outDir };
await fs.writeFile(path.join(outDir, 'EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);

fetch('http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
  body: JSON.stringify({
    sessionId: 'ffb02e',
    runId: 'stretch-x-all',
    hypothesisId: 'H4',
    location: 'verify-stretch-x-all.mjs',
    message: 'intro+play stretch-X smoke',
    data: evidence,
    timestamp: Date.now(),
  }),
}).catch(() => {});

console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(pass ? 0 : 1);
