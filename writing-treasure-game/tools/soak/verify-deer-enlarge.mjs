/**
 * Measure idle deer DOM size + natural aspect; screenshot before enlarge.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const readingUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const writingUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const outDir = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/deer-enlarge');
const vp = { width: 1440, height: 810 };
const runId = process.env.RUN_ID ?? 'pre-enlarge';

function designPoint(x, y) {
  return { x, y };
}

async function press(page, x, y) {
  await page.touchscreen.tap(x, y);
}

async function post(hypothesisId, message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId, hypothesisId,
      location: 'verify-deer-enlarge.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

async function measureDeer(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const scale = canvas
      ? Math.min(canvas.width / 1440, canvas.height / 810)
      : 1;
    const imgs = [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((img) => getComputedStyle(img).display !== 'none');
    const motion = imgs.sort(
      (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
    )[0];
    if (!motion || !canvas) return null;
    const r = motion.getBoundingClientRect();
    const design = {
      w: +(r.width / scale).toFixed(1),
      h: +(r.height / scale).toFixed(1),
      left: +((r.left - canvas.left) / scale).toFixed(1),
      top: +((r.top - canvas.top) / scale).toFixed(1),
      bottom: +((r.bottom - canvas.top) / scale).toFixed(1),
    };
    return {
      name: motion.dataset.customerMotion,
      src: (motion.currentSrc || motion.src || '').split('/').pop(),
      natural: { w: motion.naturalWidth, h: motion.naturalHeight },
      screen: {
        w: Math.round(r.width), h: Math.round(r.height),
        left: Math.round(r.left), top: Math.round(r.top),
      },
      design,
      canvasH: canvas.height,
      heightRatio: +(design.h / 810).toFixed(3),
      objectFit: getComputedStyle(motion).objectFit,
      objectPosition: getComputedStyle(motion).objectPosition,
    };
  });
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true });
const page = await context.newPage();

// Reading mario idle
await page.goto(`${readingUrl}?skipIntro=1&scene=mario`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => press(page, 720, 430));
await page.waitForTimeout(800);
const reading = await measureDeer(page);
await page.screenshot({ path: path.join(outDir, `${runId}-01-reading-mario.png`), type: 'png' });
await post('H1', 'reading mario idle measure', reading);

// Writing treasure idle
await page.goto(`${writingUrl}?skipIntro=1&scene=treasure`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => press(page, 720, 430));
await page.waitForTimeout(800);
const writing = await measureDeer(page);
await page.screenshot({ path: path.join(outDir, `${runId}-02-writing-treasure.png`), type: 'png' });
await post('H3', 'writing treasure idle measure', writing);

const evidence = {
  runId,
  pass: Boolean(reading?.design && writing?.design),
  reading,
  writing,
  targets: {
    // customer: visibly small — aim ~45%+ of canvas height for reading, ~42% writing
    readingMinH: 360,
    writingMinH: 360,
  },
};
await fs.writeFile(path.join(outDir, `${runId}-EVIDENCE.json`), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(evidence.pass ? 0 : 1);
