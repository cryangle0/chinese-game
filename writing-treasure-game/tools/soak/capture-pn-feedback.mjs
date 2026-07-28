/**
 * Capture positive/negative answer feedback screenshots for both games.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const root = path.resolve(import.meta.dirname, '../../..');
const out = path.join(root, 'test-results/pixel-audit/followup');
fs.mkdirSync(out, { recursive: true });

async function post(message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'pn-feedback', hypothesisId: 'H-fb',
      location: 'capture-pn-feedback.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function makePage(browser) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 810 },
    permissions: ['camera'],
  });
  return context.newPage();
}

async function forceCorrectIndex(page, index) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = (pack.questions || []).map((q) => ({ ...q, correctIndex: index }));
    await route.fulfill({ response, json: pack });
  });
}

async function canvasGeom(page) {
  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  return {
    scale,
    ox: box.x + (box.width - 1440 * scale) / 2,
    oy: box.y + (box.height - 810 * scale) / 2,
  };
}

async function clickDesign(page, dx, dy) {
  const { ox, oy, scale } = await canvasGeom(page);
  await page.mouse.click(ox + dx * scale, oy + dy * scale);
}

async function shot(page, name) {
  const { ox, oy, scale } = await canvasGeom(page);
  const file = path.join(out, name);
  await page.screenshot({
    path: file,
    clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
  });
  const bytes = fs.existsSync(file) ? fs.statSync(file).size : 0;
  return { file, name, bytes, ok: bytes > 8000 };
}

async function fbMeta(page) {
  return page.evaluate(() => ({
    answerCorrect: document.body.dataset.answerCorrect,
    feedbackMode: document.body.dataset.feedbackMode,
    feedbackColumn: document.body.dataset.feedbackColumn,
    gameView: document.body.dataset.gameView,
    actionReady: document.body.dataset.actionReady,
  }));
}

async function motionLayers(page) {
  return page.evaluate(() => [...document.querySelectorAll('img[data-customer-motion]')]
    .filter((img) => getComputedStyle(img).display !== 'none')
    .map((img) => {
      const r = img.getBoundingClientRect();
      return {
        name: img.dataset.customerMotion,
        w: Math.round(r.width),
        h: Math.round(r.height),
        src: (img.currentSrc || img.src || '').split('/').pop(),
      };
    }));
}

async function enterPlay(page, points) {
  await page.waitForFunction(
    () => document.body.dataset.gameView === 'intro'
      || document.body.dataset.gameView === 'play',
    null,
    { timeout: 20000 },
  ).catch(() => {});
  if (await page.evaluate(() => document.body.dataset.gameView) === 'play') {
    await page.waitForTimeout(400);
    return;
  }
  for (const [dx, dy] of points) {
    await clickDesign(page, dx, dy);
    await page.waitForTimeout(350);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  });
  await page.waitForTimeout(500);
}

async function waitFeedbackPainted(page) {
  // Feedback hold is short (~1.15�1.65s) � shoot immediately after mode flips.
  await page.waitForFunction(() => document.body.dataset.feedbackMode != null, null, {
    timeout: 15000,
  });
  await page.waitForTimeout(220);
}

async function captureReadingOne(browser, optionX, expectCorrect, file) {
  const page = await makePage(browser);
  await forceCorrectIndex(page, 0);
  await page.goto('http://127.0.0.1:43887/?skipIntro=1&scene=mario', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
  await enterPlay(page, [[720, 365], [720, 430], [720, 445]]);
  await page.waitForFunction(() => document.body.dataset.answerReady === 'true', null, {
    timeout: 10000,
  }).catch(() => {});

  await clickDesign(page, optionX, 405);
  await waitFeedbackPainted(page);
  await page.waitForSelector(
    `body[data-answer-correct="${expectCorrect ? 'true' : 'false'}"]`,
    { timeout: 3000 },
  );
  const meta = await fbMeta(page);
  const layers = await motionLayers(page);
  const result = await shot(page, file);
  await post(expectCorrect ? 'reading-correct' : 'reading-wrong', { meta, layers, shot: result });
  await page.close();
  return { shot: result, meta, layers };
}

async function captureWritingOne(browser, optionX, expectCorrect, file) {
  const page = await makePage(browser);
  await forceCorrectIndex(page, 0);
  await page.goto('http://127.0.0.1:43886/?skipIntro=1&scene=treasure', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
  await enterPlay(page, [[937.5, 466], [980, 550], [720, 520]]);
  await page.waitForTimeout(400);

  await clickDesign(page, optionX, 610);
  if (expectCorrect) {
    await page.waitForSelector('body[data-action-ready="true"]', { timeout: 8000 });
    for (let i = 0; i < 3; i += 1) {
      await clickDesign(page, optionX, 610);
      await page.waitForTimeout(400);
    }
  }
  await waitFeedbackPainted(page);
  await page.waitForSelector(
    `body[data-answer-correct="${expectCorrect ? 'true' : 'false'}"]`,
    { timeout: 3000 },
  );
  const meta = await fbMeta(page);
  const layers = await motionLayers(page);
  const result = await shot(page, file);
  await post(expectCorrect ? 'writing-correct' : 'writing-wrong', { meta, layers, shot: result });
  await page.close();
  return { shot: result, meta, layers };
}

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
  ],
});

try {
  const rPos = await captureReadingOne(browser, 337, true, '03-reading-mario-feedback-correct.png');
  const rNeg = await captureReadingOne(browser, 720, false, '04-reading-mario-feedback-wrong.png');
  const wPos = await captureWritingOne(
    browser, 337, true, '05-writing-treasure-feedback-correct.png',
  );
  const wNeg = await captureWritingOne(
    browser, 720, false, '06-writing-treasure-feedback-wrong.png',
  );
  const summary = {
    readingCorrect: rPos.shot,
    readingWrong: rNeg.shot,
    writingCorrect: wPos.shot,
    writingWrong: wNeg.shot,
    readingLayers: { pos: rPos.layers, neg: rNeg.layers },
    writingLayers: { pos: wPos.layers, neg: wNeg.layers },
    readingMeta: { pos: rPos.meta, neg: rNeg.meta },
    writingMeta: { pos: wPos.meta, neg: wNeg.meta },
  };
  await post('summary', summary);
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await browser.close();
}
