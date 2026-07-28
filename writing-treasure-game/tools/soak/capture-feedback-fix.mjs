/**
 * Capture treasure correct + desert wrong feedback after static-prefer fix.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const out = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/followup');
fs.mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function post(message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'fb-static', hypothesisId: 'H-fb',
      location: 'capture-feedback-fix.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

async function capture(scene, optionX, expectCorrect, file) {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = (pack.questions || []).map((q) => ({ ...q, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });
  await page.goto(`http://127.0.0.1:43886/?skipIntro=1&scene=${scene}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });

  const geom = async () => {
    const box = await page.locator('#GameCanvas').boundingBox();
    const scale = Math.min(box.width / 1440, box.height / 810);
    return {
      scale,
      ox: box.x + (box.width - 1440 * scale) / 2,
      oy: box.y + (box.height - 810 * scale) / 2,
    };
  };
  const click = async (dx, dy) => {
    const g = await geom();
    await page.mouse.click(g.ox + dx * g.scale, g.oy + dy * g.scale);
  };

  for (const [dx, dy] of [[937.5, 466], [980, 550], [720, 520]]) {
    await click(dx, dy);
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  });
  await page.waitForTimeout(400);

  await click(optionX, 610);
  if (expectCorrect) {
    await page.waitForSelector('body[data-action-ready="true"]', { timeout: 8000 });
    for (let i = 0; i < 3; i += 1) {
      await click(optionX, 610);
      await page.waitForTimeout(350);
    }
  }
  await page.waitForFunction(() => document.body.dataset.feedbackMode != null, null, {
    timeout: 12000,
  });
  await page.waitForTimeout(350);

  const meta = await page.evaluate(() => {
    const layers = [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((img) => getComputedStyle(img).display !== 'none')
      .map((img) => {
        const r = img.getBoundingClientRect();
        return {
          name: img.dataset.customerMotion,
          w: Math.round(r.width),
          h: Math.round(r.height),
          src: (img.currentSrc || img.src || '').split('/').slice(-2).join('/'),
        };
      });
    return {
      answerCorrect: document.body.dataset.answerCorrect,
      feedbackMode: document.body.dataset.feedbackMode,
      feedbackColumn: document.body.dataset.feedbackColumn,
      layers,
    };
  });

  const g = await geom();
  const dest = path.join(out, file);
  await page.screenshot({
    path: dest,
    clip: { x: g.ox, y: g.oy, width: 1440 * g.scale, height: 810 * g.scale },
  });
  const shot = { file: dest, bytes: fs.statSync(dest).size, ok: fs.statSync(dest).size > 8000 };
  await post(file, { meta, shot });
  await browser.close();
  return { meta, shot };
}

const treasure = await capture('treasure', 337, true, '09-treasure-feedback-correct-static.png');
const desert = await capture('desert', 720, false, '10-desert-feedback-wrong-static.png');
console.log(JSON.stringify({ treasure, desert }, null, 2));
