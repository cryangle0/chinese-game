/**
 * Verify settlement buttons align under rank / review panels (mario).
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const outDir = path.resolve(
  import.meta.dirname, '../../../test-results/pixel-audit/settlement-pages',
);
const vp = { width: 1440, height: 810 };

function designPoint(x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
  };
}

async function press(page, x, y) {
  const p = designPoint(x, y);
  await page.mouse.click(p.x, p.y);
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await (await browser.newContext({ viewport: vp })).newPage();

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
}).catch(async () => press(page, 720, 430));

for (let i = 0; i < 5; i += 1) {
  await press(page, 337, 405);
  await page.waitForTimeout(2200);
}
await page.waitForFunction(() => document.body.dataset.gameView === 'stage-result', null, {
  timeout: 25000,
});
await page.waitForTimeout(500);

const data = await page.evaluate(() => ({
  view: document.body.dataset.gameView,
  primaryX: document.body.dataset.actionPrimaryX,
  shareX: document.body.dataset.actionShareX,
  rankX: document.body.dataset.actionRankX,
  reviewX: document.body.dataset.actionReviewX,
}));

await page.screenshot({
  path: path.join(outDir, 'mario-buttons-aligned.png'),
  type: 'png',
  clip: { x: 0, y: 0, width: 1440, height: 810 },
});

const primaryOk = Number(data.primaryX) === Number(data.rankX);
const shareOk = Number(data.shareX) === Number(data.reviewX);
const pass = primaryOk && shareOk;

await fetch(ingest, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
  body: JSON.stringify({
    sessionId: 'ffb02e',
    runId: 'btn-align',
    hypothesisId: 'BTN',
    location: 'verify-btn-align.mjs',
    message: pass ? 'PASS' : 'FAIL',
    data: { ...data, primaryOk, shareOk, pass },
    timestamp: Date.now(),
  }),
}).catch(() => {});

await fs.writeFile(
  path.join(outDir, 'BUTTON-ALIGN.json'),
  `${JSON.stringify({ pass, primaryOk, shareOk, ...data }, null, 2)}\n`,
);
console.log(JSON.stringify({ pass, primaryOk, shareOk, ...data }, null, 2));
await browser.close();
process.exit(pass ? 0 : 1);
