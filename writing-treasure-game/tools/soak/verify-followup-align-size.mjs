/**
 * 1) Button align check for all reading scenes
 * 2) Character size screenshots (reading mario + writing treasure idle)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const readingUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const writingUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const outDir = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/followup');
const vp = { width: 915, height: 407 };
const scenes = [
  { id: 'mario', optionX: 337 },
  { id: 'deep-sea', optionX: 330 },
  { id: 'space', optionX: 340 },
  { id: 'food', optionX: 340 },
  { id: 'poetry', optionX: 365 },
];

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

async function post(hypothesisId, message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'followup', hypothesisId, location: 'verify-followup.mjs',
      message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const context = await browser.newContext({ viewport: vp, isMobile: true, hasTouch: true });
const page = await context.newPage();

// --- Reading idle deer size (customer #2 人物太小) ---
await page.goto(`${readingUrl}?skipIntro=1&scene=mario`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => press(page, 720, 430));
await page.waitForTimeout(500);

const deer = await page.evaluate(() => {
  const motion = [...document.querySelectorAll('img[data-customer-motion]')]
    .find((img) => /deer|idle|character|ReadingDeer/i.test(
      `${img.dataset.customerMotion || ''} ${img.className} ${img.alt || ''}`,
    ))
    || [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((img) => getComputedStyle(img).display !== 'none')
      .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
  const r = motion?.getBoundingClientRect();
  const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
  const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
  return {
    src: (motion?.currentSrc || motion?.src || '').split('/').pop(),
    name: motion?.dataset?.customerMotion,
    screen: r ? {
      w: Math.round(r.width), h: Math.round(r.height),
      left: Math.round(r.left), top: Math.round(r.top),
    } : null,
    design: r && canvas ? {
      w: +(r.width / scale).toFixed(1),
      h: +(r.height / scale).toFixed(1),
    } : null,
    scale,
  };
});
await page.screenshot({ path: path.join(outDir, '01-reading-mario-deer-idle.png'), type: 'png' });
await post('SIZE', 'reading mario deer size', deer);

// --- Writing idle deer ---
await page.goto(`${writingUrl}?skipIntro=1&scene=treasure`, {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
  timeout: 25000,
}).catch(async () => press(page, 720, 430));
await page.waitForTimeout(500);
const writingDeer = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img[data-customer-motion]')]
    .filter((img) => getComputedStyle(img).display !== 'none');
  const motion = imgs.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
  const r = motion?.getBoundingClientRect();
  const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
  const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
  return {
    src: (motion?.currentSrc || motion?.src || '').split('/').pop(),
    name: motion?.dataset?.customerMotion,
    design: r && canvas ? {
      w: +(r.width / scale).toFixed(1),
      h: +(r.height / scale).toFixed(1),
    } : null,
  };
});
await page.screenshot({ path: path.join(outDir, '02-writing-treasure-deer-idle.png'), type: 'png' });
await post('SIZE', 'writing treasure deer size', writingDeer);

// --- Button align all reading scenes ---
const buttonReport = [];
for (const scene of scenes) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = (pack.questions || []).slice(0, 3).map((q) => ({ ...q, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  }).catch(() => {});
  await page.goto(`${readingUrl}?skipIntro=1&scene=${scene.id}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  }).catch(async () => press(page, 720, 430));
  for (let i = 0; i < 6; i += 1) {
    for (const ox of [scene.optionX - 40, scene.optionX, scene.optionX + 40, 720]) {
      await press(page, ox, 390);
      await page.waitForTimeout(280);
    }
    const done = await page.evaluate(() => document.body.dataset.gameView === 'stage-result');
    if (done) break;
    await page.waitForTimeout(300);
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'stage-result', null, {
    timeout: 25000,
  }).catch(() => {});
  await page.waitForTimeout(500);
  const data = await page.evaluate(() => ({
    view: document.body.dataset.gameView,
    primaryX: document.body.dataset.actionPrimaryX,
    shareX: document.body.dataset.actionShareX,
    rankX: document.body.dataset.actionRankX,
    reviewX: document.body.dataset.actionReviewX,
  }));
  const pass = data.view === 'stage-result'
    && Number(data.primaryX) === Number(data.rankX)
    && Number(data.shareX) === Number(data.reviewX);
  await page.screenshot({
    path: path.join(outDir, `03-btn-${scene.id}.png`), type: 'png',
  });
  buttonReport.push({ scene: scene.id, pass, ...data });
  await post('BTN', `button align ${scene.id}`, { scene: scene.id, pass, ...data });
  await page.unroute('**/question-bank.json').catch(() => {});
}

const sizeOk = Boolean(deer.design && deer.design.w >= 170 && deer.design.h >= 270);
const btnOk = buttonReport.every((r) => r.pass);
const evidence = {
  pass: sizeOk && btnOk,
  sizeOk,
  btnOk,
  readingDeer: deer,
  writingDeer,
  // layout config: mario idle was enlarged to 190×300 in wave3 (was smaller)
  expectedReadingMario: { w: 190, h: 300 },
  buttonReport,
};
await fs.writeFile(path.join(outDir, 'EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(evidence.pass ? 0 : 1);
