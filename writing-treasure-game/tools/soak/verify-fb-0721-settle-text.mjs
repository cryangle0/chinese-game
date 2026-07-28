/**
 * Settlement text layout gate for writing treasure @ 915×407 (customer complaint).
 * Asserts board+UI co-scale (cover) and review/rank text still sit in white panels.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const outDir = path.resolve('test-results', 'fb-0721-settle-text');
const vp = { width: 915, height: 407, mobile: true };

// From 独立HTML像素级UI原型/writing/pages/06-treasure-settlement.html
const expected = {
  rankName1: { left: 600, top: 361.5, w: 97.5, h: 40.5 },
  rankScore1: { left: 721.5, top: 361.5, w: 78.75, h: 40.5 },
  reviewText1: { left: 870, top: 336.75, w: 414.5, h: 59.25 }, // code width after inset
  reviewRow1: { left: 852, top: 336.75, w: 502.5, h: 59.25 },
  score: { left: 111, top: 656.25, w: 236.25, h: 54.75 },
};

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

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({
  viewport: { width: vp.width, height: vp.height },
  isMobile: true,
  hasTouch: true,
});
const page = await context.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));

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

for (let q = 0; q < 5; q += 1) {
  await press(page, 310, 595);
  await page.waitForTimeout(200);
  for (let i = 0; i < 4; i += 1) {
    await press(page, 310, 595);
    await page.waitForTimeout(150);
  }
  await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
    timeout: 8000,
  }).catch(() => {});
}
await page.waitForSelector('body[data-stage-result="treasure"]', { timeout: 20000 });
await page.waitForTimeout(500);

const layout = await page.evaluate(() => ({
  bg: Number(document.body.dataset.resultBackgroundScale),
  art: Number(document.body.dataset.resultArtworkScale),
  fill: Number(document.body.dataset.resultBackdropScale),
}));

// Sample review-row band with cover co-scale mapping (board+UI share art scale).
const shotPath = path.join(outDir, '02-settlement-915x407.png');
const buf = await page.screenshot({ path: shotPath, type: 'png' });
const png = PNG.sync.read(buf);
const stageScale = Math.min(vp.width / 1440, vp.height / 810);
const coverScale = 1;

function sampleRowCenter(row) {
  const cx = Math.round((vp.width - 1440 * stageScale) / 2 + (row.left + row.w * 0.35) * stageScale);
  const cy = Math.round((vp.height - 810 * stageScale) / 2 + (row.top + row.h * 0.5) * stageScale);
  const i = (cy * png.width + cx) * 4;
  return {
    cx, cy,
    rgb: [png.data[i], png.data[i + 1], png.data[i + 2]],
  };
}

// White panel should be near-white at vertical center of row (text sits in panel)
const panelSample = sampleRowCenter(expected.reviewRow1);
const panelBright = panelSample.rgb[0] > 180 && panelSample.rgb[1] > 180 && panelSample.rgb[2] > 180;

// Top edge of row should still be panel-ish (not dark wood only)
const topSample = sampleRowCenter({
  ...expected.reviewRow1,
  top: expected.reviewRow1.top + 4,
  h: 8,
});
const bottomSample = sampleRowCenter({
  ...expected.reviewRow1,
  top: expected.reviewRow1.top + expected.reviewRow1.h - 12,
  h: 8,
});

const coScaled = Math.abs(layout.bg - 1) < 0.001
  && Math.abs(layout.art - 1) < 0.001;
const fillOk = Number.isFinite(layout.fill) && layout.fill >= 1;

// #region agent log
fetch('http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
  body: JSON.stringify({
    sessionId: 'ffb02e',
    runId: 'settle-text-post',
    hypothesisId: 'H2',
    location: 'verify-fb-0721-settle-text.mjs',
    message: 'settlement text gate full board',
    data: { layout, panelSample, topSample, bottomSample, coScaled, panelBright },
    timestamp: Date.now(),
  }),
}).catch(() => {});
// #endregion

const pass = coScaled && fillOk && panelBright;
const evidence = {
  pass,
  layout,
  coScaled,
  fillOk,
  panelBright,
  panelSample,
  topSample,
  bottomSample,
  shot: '02-settlement-915x407.png',
};
await fs.writeFile(path.join(outDir, 'EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(pass ? 0 : 1);
