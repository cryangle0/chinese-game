/**
 * Wave-3 reading 0721: run visible, hit at apex, feedback on column, no early brick.
 * Screenshots @ 915×407.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const outDir = path.resolve(
  '..', 'reading-jumper-game', 'test-results', 'fb-0721-wave3',
);
const vp = { width: 915, height: 407 };

function designPoint(x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
    scale,
  };
}

function meanRgb(png, x0, y0, x1, y1) {
  let r = 0; let g = 0; let b = 0; let n = 0;
  for (let y = Math.max(0, y0 | 0); y < Math.min(png.height, y1 | 0); y += 2) {
    for (let x = Math.max(0, x0 | 0); x < Math.min(png.width, x1 | 0); x += 2) {
      const i = (y * png.width + x) * 4;
      r += png.data[i]; g += png.data[i + 1]; b += png.data[i + 2];
      n += 1;
    }
  }
  return n ? [r / n, g / n, b / n] : [0, 0, 0];
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({
  viewport: vp, isMobile: true, hasTouch: true,
});
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('console', msg.text());
});

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
await page.waitForTimeout(400);

const idleShot = path.join(outDir, '01-idle-deer.png');
await page.screenshot({ path: idleShot, type: 'png' });

// Tap LEFT option (correctIndex=0). Sample brick mid-jump vs after apex.
const leftOpt = designPoint(337, 405);
const timeline = [];

// Start answer
await page.touchscreen.tap(leftOpt.x, leftOpt.y);

// ~120ms into jump: brick should NOT yet show result (was early before)
await page.waitForTimeout(120);
const early = await page.evaluate(() => ({
  answerCorrect: document.body.dataset.answerCorrect,
  feedbackMode: document.body.dataset.feedbackMode,
  feedbackColumn: document.body.dataset.feedbackColumn,
}));
const earlyBuf = await page.screenshot({
  path: path.join(outDir, '02-during-jump-before-apex.png'), type: 'png',
});
const earlyPng = PNG.sync.read(earlyBuf);
// Option brick center-ish: design (337, 405) region — green tint = already correct highlight
const earlyBrick = meanRgb(
  earlyPng,
  leftOpt.x - 40, leftOpt.y - 20,
  leftOpt.x + 40, leftOpt.y + 20,
);
timeline.push({ t: 120, early, earlyBrick });

// Wait for apex / feedback
await page.waitForFunction(
  () => document.body.dataset.feedbackMode === 'motion'
    || document.body.dataset.feedbackColumn !== undefined,
  null,
  { timeout: 5000 },
).catch(() => {});
await page.waitForTimeout(200);

const feedback = await page.evaluate(() => ({
  mode: document.body.dataset.feedbackMode,
  column: document.body.dataset.feedbackColumn,
  answerCorrect: document.body.dataset.answerCorrect,
  motionSrc: [...document.querySelectorAll('img[data-customer-motion]')]
    .filter((img) => getComputedStyle(img).display !== 'none')
    .map((img) => ({
      name: img.dataset.customerMotion,
      src: (img.currentSrc || img.src || '').split('/').pop(),
      left: Math.round(img.getBoundingClientRect().left),
      width: Math.round(img.getBoundingClientRect().width),
    })),
}));

const fbBuf = await page.screenshot({
  path: path.join(outDir, '03-feedback-on-column.png'), type: 'png',
});
const fbPng = PNG.sync.read(fbBuf);
const leftBand = meanRgb(fbPng, 40, 100, 280, 320);
const centerBand = meanRgb(fbPng, 360, 100, 560, 320);

// Run motion: move pose column by tapping? Pose may not work. Check move via second Q after feedback.
await page.waitForFunction(
  () => document.body.dataset.answerReady === 'true',
  null,
  { timeout: 5000 },
).catch(() => {});
await page.waitForTimeout(200);

// Tap RIGHT option to force run-then-jump path from left
await page.route('**/question-bank.json', async (route) => {
  const response = await route.fetch();
  const pack = await response.json();
  pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 2 }));
  await route.fulfill({ response, json: pack });
});
// Actually bank already loaded — just tap right brick (index 2), may be wrong answer
const rightOpt = designPoint(1100, 405);
await page.touchscreen.tap(rightOpt.x, rightOpt.y);
await page.waitForTimeout(150);
const runShot = path.join(outDir, '04-run-or-jump.png');
await page.screenshot({ path: runShot, type: 'png' });
const runMotion = await page.evaluate(() => [...document.querySelectorAll('img[data-customer-motion]')]
  .filter((img) => getComputedStyle(img).display !== 'none')
  .map((img) => ({
    name: img.dataset.customerMotion,
    src: (img.currentSrc || img.src || '').split('/').pop(),
  })));

const earlyNotHighlighted = earlyBrick[1] < 180; // not strongly green yet
const feedbackOk = feedback.mode === 'motion'
  && Number(feedback.column) < -100; // left column ~ -383
const feedbackImgLeft = feedback.motionSrc.find((m) => m.name === 'Feedback' || m.src?.includes('correct') || m.src?.includes('wrong'));
const columnAnchored = feedbackImgLeft
  ? feedbackImgLeft.left < vp.width * 0.45
  : Number(feedback.column) < -100;

const pass = earlyNotHighlighted && feedbackOk && columnAnchored;
const evidence = {
  pass,
  earlyNotHighlighted,
  feedbackOk,
  columnAnchored,
  early,
  earlyBrick,
  feedback,
  runMotion,
  leftBand,
  centerBand,
  shots: [
    '01-idle-deer.png',
    '02-during-jump-before-apex.png',
    '03-feedback-on-column.png',
    '04-run-or-jump.png',
  ],
  outDir,
};

fetch('http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
  body: JSON.stringify({
    sessionId: 'ffb02e',
    runId: 'wave3-post',
    hypothesisId: 'R12',
    location: 'verify-fb-0721-wave3.mjs',
    message: 'wave3 gate',
    data: evidence,
    timestamp: Date.now(),
  }),
}).catch(() => {});

await fs.writeFile(path.join(outDir, 'EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(pass ? 0 : 1);
