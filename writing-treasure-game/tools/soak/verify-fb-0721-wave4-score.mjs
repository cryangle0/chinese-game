/**
 * Wave4 follow-up: reach writing settlement and assert score font.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const outDir = path.resolve('test-results', 'fb-0721-wave4');
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const vp = { width: 915, height: 407 };

function designPoint(x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
  };
}

async function press(page, x, y) {
  const p = designPoint(x, y);
  await page.touchscreen.tap(p.x, p.y);
}

async function waitIdle(page) {
  await page.waitForFunction(() => (
    document.body.dataset.actionReady === undefined
    && document.body.dataset.answerCorrect === undefined
    && document.body.dataset.feedbackMode === undefined
  ), null, { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(350);
}

async function completeWritingQuestion(page) {
  await waitIdle(page);
  await press(page, 360, 600);
  await page.waitForFunction(
    () => document.body.dataset.actionReady === 'true'
      || document.body.dataset.answerCorrect !== undefined,
    null,
    { timeout: 12000 },
  ).catch(() => {});

  if (await page.evaluate(() => document.body.dataset.actionReady === 'true')) {
    for (let i = 0; i < 3; i += 1) {
      await press(page, 360, 600);
      await page.waitForTimeout(550);
    }
  }

  await page.waitForFunction(
    () => document.body.dataset.feedbackMode === 'motion'
      || document.body.dataset.answerCorrect !== undefined,
    null,
    { timeout: 10000 },
  ).catch(() => {});
  await page.waitForTimeout(1200);
  await waitIdle(page);
}

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await (await browser.newContext({
  viewport: vp, isMobile: true, hasTouch: true,
})).newPage();

await page.route('**/question-bank.json', async (route) => {
  const response = await route.fetch();
  const pack = await response.json();
  pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
  await route.fulfill({ response, json: pack });
});

await page.goto(`${baseUrl}?skipIntro=1&scene=treasure`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => {
  await press(page, 720, 430);
});

for (let i = 0; i < 5; i += 1) {
  console.log('Q', i, await page.evaluate(() => ({
    view: document.body.dataset.gameView,
    actionReady: document.body.dataset.actionReady,
    feedback: document.body.dataset.feedbackMode,
  })));
  await completeWritingQuestion(page);
  console.log('after Q', i, await page.evaluate(() => ({
    view: document.body.dataset.gameView,
    actionReady: document.body.dataset.actionReady,
    feedback: document.body.dataset.feedbackMode,
  })));
}

await page.waitForFunction(() => (
  document.body.dataset.gameView === 'stage-result'
  || document.body.dataset.gameView === 'result'
  || document.body.dataset.scoreFont
), null, { timeout: 25000 }).catch(() => {});
await page.waitForTimeout(600);

const settle = await page.evaluate(() => ({
  view: document.body.dataset.gameView,
  scoreFont: document.body.dataset.scoreFont,
  scoreValue: document.body.dataset.scoreValue,
}));
await page.screenshot({ path: path.join(outDir, '04-writing-settlement-score.png'), type: 'png' });
await fetch(ingest, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
  body: JSON.stringify({
    sessionId: 'ffb02e',
    runId: 'wave4-verify-score',
    hypothesisId: 'E',
    location: 'verify-fb-0721-wave4-score.mjs',
    message: 'writing score settle',
    data: settle,
    timestamp: Date.now(),
  }),
}).catch(() => {});

const evidencePath = path.join(outDir, 'EVIDENCE.json');
const prev = JSON.parse(await fs.readFile(evidencePath, 'utf8'));
prev.writingScoreFont = settle.scoreFont ? Number(settle.scoreFont) : null;
prev.writingSettle = settle;
prev.scoreShot = '04-writing-settlement-score.png';
prev.pass = Boolean(prev.writingBookSelect)
  && Boolean(prev.readingAbc)
  && Boolean(prev.readingQuestionWrap)
  && Number(prev.readingReviewGap) <= 55
  && prev.writingScoreFont === 30;
await fs.writeFile(evidencePath, `${JSON.stringify(prev, null, 2)}\n`);
await fs.writeFile(
  path.resolve('..', 'reading-jumper-game', 'test-results', 'fb-0721-wave4', 'EVIDENCE.json'),
  `${JSON.stringify(prev, null, 2)}\n`,
);
console.log(JSON.stringify({ settle, pass: prev.pass, writingScoreFont: prev.writingScoreFont }, null, 2));
await browser.close();
process.exit(settle.scoreFont === '30' ? 0 : 2);
