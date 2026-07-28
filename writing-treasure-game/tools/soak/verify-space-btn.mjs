import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const readingUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const outDir = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/followup');
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

async function post(message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'space-btn', hypothesisId: 'SPACE',
      location: 'verify-space-btn.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true });
const page = await context.newPage();

await page.route('**/question-bank.json', async (route) => {
  const response = await route.fetch();
  const pack = await response.json();
  pack.questions = (pack.questions || []).slice(0, 3).map((q) => ({ ...q, correctIndex: 0 }));
  await route.fulfill({ response, json: pack });
});

await page.goto(`${readingUrl}?skipIntro=1&scene=space`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => press(page, 720, 430));
await post('space ready', { view: await page.evaluate(() => document.body.dataset.gameView) });

for (let i = 0; i < 8; i += 1) {
  // try multiple option X positions for space bricks
  for (const ox of [280, 320, 360, 400, 720]) {
    await press(page, ox, 390);
    await page.waitForTimeout(350);
  }
  const st = await page.evaluate(() => ({
    view: document.body.dataset.gameView,
    ans: document.body.dataset.answerCorrect,
    primaryX: document.body.dataset.actionPrimaryX,
    shareX: document.body.dataset.actionShareX,
    rankX: document.body.dataset.actionRankX,
    reviewX: document.body.dataset.actionReviewX,
  }));
  await post('space loop', { i, ...st });
  if (st.view === 'stage-result') {
    const pass = Number(st.primaryX) === Number(st.rankX)
      && Number(st.shareX) === Number(st.reviewX);
    await page.screenshot({ path: path.join(outDir, '03-btn-space.png'), type: 'png' });
    console.log(JSON.stringify({ pass, ...st }));
    await browser.close();
    process.exit(pass ? 0 : 1);
  }
  await page.waitForTimeout(400);
}

const fail = await page.evaluate(() => ({ view: document.body.dataset.gameView }));
await page.screenshot({ path: path.join(outDir, '03-btn-space-fail.png'), type: 'png' });
await post('space fail', fail);
console.log(JSON.stringify({ pass: false, ...fail }));
await browser.close();
process.exit(1);
