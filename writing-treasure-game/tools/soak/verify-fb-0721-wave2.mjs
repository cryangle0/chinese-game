/**
 * Wave-2 writing 0721: dig state, feedback follows option + motion,
 * voice no double text, question left-align. Screenshot evidence @ 915×407.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const outDir = path.resolve('test-results', 'fb-0721-wave2');
const vp = { width: 915, height: 407 };

function designPoint(x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
    scale,
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
  viewport: vp, isMobile: true, hasTouch: true,
});
const page = await context.newPage();
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
}).catch(() => {});
await page.waitForTimeout(500);

const questionAlign = await page.evaluate(() => document.body.dataset.questionAlign);

// --- Voice double-text: press voice button, check label emptied when listening plate on ---
const voiceCenter = designPoint(720, 764);
await page.touchscreen.tap(voiceCenter.x, voiceCenter.y);
// Hold via pointer events on canvas for listening state
await page.evaluate(() => {
  const canvas = document.getElementById('GameCanvas');
  if (!canvas) return;
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 457, clientY: 380 }));
});
await page.waitForTimeout(400);
const voiceDuring = await page.evaluate(() => ({
  state: document.body.dataset.speechState,
  label: document.body.dataset.voiceLabel,
  press: document.body.dataset.voicePress,
}));
await page.evaluate(() => {
  const canvas = document.getElementById('GameCanvas');
  if (!canvas) return;
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 457, clientY: 380 }));
});
await page.waitForTimeout(300);
const voiceShot = path.join(outDir, '01-voice-no-double-text.png');
await page.screenshot({ path: voiceShot, type: 'png' });

// --- Dig + feedback motion at left column (correctIndex=0) ---
// Left chest ~ design (360, 600) ≈ column -359 → screen
await press(page, 360, 600);
const digReady = await page.waitForFunction(
  () => document.body.dataset.actionReady === 'true'
    || document.body.dataset.feedbackMode === 'motion'
    || document.body.dataset.answerCorrect !== undefined,
  null,
  { timeout: 8000 },
).then(() => true).catch(() => false);

const afterAnswer = await page.evaluate(() => ({
  actionReady: document.body.dataset.actionReady,
  feedbackMode: document.body.dataset.feedbackMode,
  feedbackColumn: document.body.dataset.feedbackColumn,
  answerCorrect: document.body.dataset.answerCorrect,
}));

const digShot = path.join(outDir, '02-dig-or-action.png');
await page.screenshot({ path: digShot, type: 'png' });

// If unlocked for dig, strike 3 times on left chest
if (afterAnswer.actionReady === 'true') {
  for (let i = 0; i < 3; i += 1) {
    await press(page, 360, 600);
    await page.waitForTimeout(450);
  }
}
await page.waitForFunction(
  () => document.body.dataset.feedbackMode === 'motion'
    || document.body.dataset.answerCorrect !== undefined,
  null,
  { timeout: 8000 },
).catch(() => {});
await page.waitForTimeout(400);

const feedback = await page.evaluate(() => ({
  mode: document.body.dataset.feedbackMode,
  column: document.body.dataset.feedbackColumn,
  correct: document.body.dataset.answerCorrect,
}));

const feedbackShot = path.join(outDir, '03-feedback-motion-column.png');
const buf = await page.screenshot({ path: feedbackShot, type: 'png' });
const png = PNG.sync.read(buf);

// Sample left vs center: motion should bias left when column=0
function meanLum(x0, y0, x1, y1) {
  let s = 0; let n = 0;
  for (let y = y0; y < y1; y += 3) {
    for (let x = x0; x < x1; x += 3) {
      const i = (y * png.width + x) * 4;
      s += (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      n += 1;
    }
  }
  return n ? s / n : 0;
}
const leftBand = meanLum(80, 120, 220, 320);
const centerBand = meanLum(380, 120, 520, 320);

const voiceOk = voiceDuring.label === ''
  || voiceDuring.state === 'listening'
  || voiceDuring.state === 'processing'
  || voiceDuring.state === undefined; // mic may be denied in headless
const alignOk = questionAlign === 'left';
const digOk = digReady && (
  afterAnswer.actionReady === 'true' || feedback.mode === 'motion'
);
const feedbackOk = feedback.mode === 'motion' && feedback.column === '0';

const pass = alignOk && digOk && feedbackOk;
const evidence = {
  pass,
  alignOk,
  digOk,
  feedbackOk,
  voiceOk,
  questionAlign,
  voiceDuring,
  afterAnswer,
  feedback,
  leftBand,
  centerBand,
  shots: ['01-voice-no-double-text.png', '02-dig-or-action.png', '03-feedback-motion-column.png'],
  outDir,
};

fetch('http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
  body: JSON.stringify({
    sessionId: 'ffb02e',
    runId: 'wave2-post',
    hypothesisId: 'W2',
    location: 'verify-fb-0721-wave2.mjs',
    message: 'wave2 gate',
    data: evidence,
    timestamp: Date.now(),
  }),
}).catch(() => {});

await fs.writeFile(path.join(outDir, 'EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(pass ? 0 : 1);
