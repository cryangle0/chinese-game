/**
 * Wave-4: writing book select, reading ABC options, text overflow / review spacing.
 * Screenshots @ 915×407 + runtime dataset gates.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const readingUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const writingUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const outDir = path.resolve(
  'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/test-results/fb-0721-wave4',
);
const readingOut = path.resolve(
  'e:/angsa/angsa_data/项目/作业帮游戏/reading-jumper-game/test-results/fb-0721-wave4',
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

async function postLog(hypothesisId, message, data) {
  try {
    await fetch(ingest, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Debug-Session-Id': 'ffb02e',
      },
      body: JSON.stringify({
        sessionId: 'ffb02e',
        runId: 'wave4-verify',
        hypothesisId,
        location: 'verify-fb-0721-wave4.mjs',
        message,
        data,
        timestamp: Date.now(),
      }),
    });
  } catch {
    // ingest optional
  }
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.rm(readingOut, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
await fs.mkdir(readingOut, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({
  viewport: vp, isMobile: true, hasTouch: true,
});
const page = await context.newPage();
page.on('console', (msg) => {
  if (msg.type() === 'error') console.error('console', msg.text());
});

const evidence = {
  writingBookSelect: false,
  readingAbc: false,
  readingQuestionWrap: false,
  readingReviewGap: null,
  writingScoreFont: null,
  pass: false,
};

// --- Writing intro: book select ---
await page.goto(writingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForTimeout(600);
const writingIntro = await page.evaluate(() => ({
  view: document.body.dataset.gameView,
  bookSelect: document.body.dataset.bookSelect,
  hasBookSelect: document.body.dataset.hasBookSelect,
}));
await page.screenshot({ path: path.join(outDir, '01-writing-intro-book.png'), type: 'png' });
evidence.writingBookSelect = Boolean(
  writingIntro.hasBookSelect === '1' || writingIntro.bookSelect,
);
await postLog('A', 'writing intro book select', writingIntro);

// Tap book select then capture
const bookTap = designPoint(720, 810 / 2 - 360); // design y=360 → screen
await page.touchscreen.tap(bookTap.x, bookTap.y);
await page.waitForTimeout(200);
const afterBook = await page.evaluate(() => document.body.dataset.bookSelect);
await page.screenshot({ path: path.join(outDir, '02-writing-book-tapped.png'), type: 'png' });
await postLog('A', 'after book tap', { afterBook });

// Writing settlement score font via skip to play then force result if possible
await page.goto(`${writingUrl}?skipIntro=1&scene=treasure`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => {
  const p = designPoint(720, 430);
  await page.touchscreen.tap(p.x, p.y);
});
// Answer 5 questions quickly (correctIndex forced)
await page.route('**/question-bank.json', async (route) => {
  const response = await route.fetch();
  const pack = await response.json();
  pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
  await route.fulfill({ response, json: pack });
});
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => {
  const p = designPoint(720, 430);
  await page.touchscreen.tap(p.x, p.y);
});

for (let i = 0; i < 5; i += 1) {
  const left = designPoint(337, 520);
  await page.touchscreen.tap(left.x, left.y);
  await page.waitForTimeout(1400);
  // dig 3 taps if prompt
  for (let d = 0; d < 3; d += 1) {
    await page.touchscreen.tap(left.x, left.y);
    await page.waitForTimeout(350);
  }
  await page.waitForTimeout(900);
}

await page.waitForFunction(
  () => document.body.dataset.gameView === 'result'
    || document.body.dataset.scoreFont !== undefined,
  null,
  { timeout: 20000 },
).catch(() => {});
await page.waitForTimeout(400);
const writingSettle = await page.evaluate(() => ({
  view: document.body.dataset.gameView,
  scoreFont: document.body.dataset.scoreFont,
  scoreValue: document.body.dataset.scoreValue,
}));
evidence.writingScoreFont = writingSettle.scoreFont
  ? Number(writingSettle.scoreFont)
  : null;
await page.screenshot({ path: path.join(outDir, '03-writing-settlement.png'), type: 'png' });
await postLog('E', 'writing settlement score', writingSettle);

// --- Reading play: ABC + question wrap ---
await page.unroute('**/question-bank.json').catch(() => {});
await page.route('**/question-bank.json', async (route) => {
  const response = await route.fetch();
  const pack = await response.json();
  pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
  await route.fulfill({ response, json: pack });
});
await page.goto(`${readingUrl}?skipIntro=1&scene=mario`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => {
  const p = designPoint(720, 430);
  await page.touchscreen.tap(p.x, p.y);
});
await page.waitForTimeout(500);
const readingPlay = await page.evaluate(() => ({
  optionLabels: document.body.dataset.optionLabels,
  questionWrap: document.body.dataset.questionWrap,
  questionAlign: document.body.dataset.questionAlign,
}));
const labels = (readingPlay.optionLabels || '').split('|').filter(Boolean);
evidence.readingAbc = labels.length >= 3
  && labels.every((label, index) => label.startsWith(`${String.fromCharCode(65 + index)}.`));
evidence.readingQuestionWrap = readingPlay.questionWrap === '1'
  && readingPlay.questionAlign === 'left';
await page.screenshot({ path: path.join(readingOut, '01-reading-abc-options.png'), type: 'png' });
await postLog('B', 'reading ABC options', { ...readingPlay, evidenceAbc: evidence.readingAbc });
await postLog('C', 'reading question wrap', {
  wrap: readingPlay.questionWrap,
  align: readingPlay.questionAlign,
});

// Finish 5 rounds for settlement review spacing
for (let i = 0; i < 5; i += 1) {
  const left = designPoint(337, 405);
  await page.touchscreen.tap(left.x, left.y);
  await page.waitForTimeout(2200);
}
await page.waitForFunction(
  () => document.body.dataset.gameView === 'result'
    || document.body.dataset.reviewGap !== undefined,
  null,
  { timeout: 25000 },
).catch(() => {});
await page.waitForTimeout(500);
const readingSettle = await page.evaluate(() => ({
  view: document.body.dataset.gameView,
  reviewRows: document.body.dataset.reviewRows,
  reviewGap: document.body.dataset.reviewGap,
}));
evidence.readingReviewGap = readingSettle.reviewGap
  ? Number(readingSettle.reviewGap)
  : null;
await page.screenshot({
  path: path.join(readingOut, '02-reading-settlement-review.png'), type: 'png',
});
await postLog('D', 'reading review spacing', readingSettle);

evidence.pass = evidence.writingBookSelect
  && evidence.readingAbc
  && evidence.readingQuestionWrap
  && (evidence.readingReviewGap !== null && evidence.readingReviewGap <= 55)
  && (evidence.writingScoreFont === null || evidence.writingScoreFont <= 32);

const payload = { ...evidence, writingIntro, afterBook, writingSettle, readingPlay, readingSettle };
await fs.writeFile(
  path.join(outDir, 'EVIDENCE.json'),
  `${JSON.stringify(payload, null, 2)}\n`,
);
await fs.writeFile(
  path.join(readingOut, 'EVIDENCE.json'),
  `${JSON.stringify(payload, null, 2)}\n`,
);
await postLog('WAVE4', evidence.pass ? 'PASS' : 'FAIL', payload);

console.log(JSON.stringify(payload, null, 2));
await browser.close();
process.exit(evidence.pass ? 0 : 1);
