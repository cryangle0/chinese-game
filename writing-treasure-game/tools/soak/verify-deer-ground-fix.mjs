/**
 * Post-fix: verify visual feet Y ≈ HTML ground + visualH targets.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const outDir = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/deer-ground');
const readingUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const writingUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const root = path.resolve(import.meta.dirname, '../../..');

async function post(message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'post-ground', hypothesisId: 'H2',
      location: 'verify-deer-ground-fix.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

async function opaque(page, filePath) {
  const bytes = fs.readFileSync(filePath);
  const b64 = bytes.toString('base64');
  const mime = filePath.endsWith('.png') ? 'image/png' : 'image/webp';
  return page.evaluate(async ({ b64: b, mime: m }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:${m};base64,${b}`; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let minX = c.width; let minY = c.height; let maxX = 0; let maxY = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 24) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    }
    return { nat: { w: c.width, h: c.height }, op: { minX, minY, maxX, maxY, h: maxY - minY + 1 } };
  }, { b64, mime });
}

function predict(box, nat, op, position) {
  const scale = Math.min(box.w / nat.w, box.h / nat.h);
  const drawnH = nat.h * scale;
  const offsetY = position === 'bottom' ? (box.h - drawnH) : (box.h - drawnH) / 2;
  return {
    visualH: +(op.h * scale).toFixed(1),
    feetY: +(box.top + offsetY + op.maxY * scale).toFixed(1),
    headY: +(box.top + offsetY + op.minY * scale).toFixed(1),
    objectPosition: position,
  };
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });

const marioOp = await opaque(page, path.join(root, 'reading-jumper-game/customer-media/mario/idle.webp'));
const treasureOp = await opaque(page, path.join(root, 'writing-treasure-game/customer-media/treasure/idle.webp'));

async function live(url, scene, name) {
  await page.goto(`${url}?skipIntro=1&scene=${scene}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, { timeout: 25000 }).catch(() => {});
  await page.waitForTimeout(900);
  const meta = await page.evaluate(() => {
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
    const imgs = [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((img) => getComputedStyle(img).display !== 'none');
    const motion = imgs.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    const r = motion?.getBoundingClientRect();
    return {
      objectPosition: motion ? getComputedStyle(motion).objectPosition : null,
      box: r && canvas ? {
        w: +(r.width / scale).toFixed(1),
        h: +(r.height / scale).toFixed(1),
        left: +((r.left - canvas.left) / scale).toFixed(1),
        top: +((r.top - canvas.top) / scale).toFixed(1),
        bottom: +((r.bottom - canvas.top) / scale).toFixed(1),
      } : null,
    };
  });
  await page.screenshot({ path: path.join(outDir, `${name}.png`), type: 'png' });
  return meta;
}

const reading = await live(readingUrl, 'mario', 'post-reading-mario');
const writing = await live(writingUrl, 'treasure', 'post-writing-treasure');

const readingPred = predict(reading.box, marioOp.nat, marioOp.op, 'bottom');
const writingPred = predict(writing.box, treasureOp.nat, treasureOp.op, 'bottom');

const evidence = {
  targets: { readingFeet: 804, writingFeet: 477, readingMinVisualH: 280, writingMinVisualH: 260 },
  reading: { ...reading, ...readingPred, feetErr: +(readingPred.feetY - 804).toFixed(1) },
  writing: { ...writing, ...writingPred, feetErr: +(writingPred.feetY - 477).toFixed(1) },
};
evidence.pass = Math.abs(evidence.reading.feetErr) <= 12
  && Math.abs(evidence.writing.feetErr) <= 12
  && evidence.reading.visualH >= 280
  && evidence.writing.visualH >= 260
  && /100%|bottom/i.test(String(reading.objectPosition ?? ''))
  && /100%|bottom/i.test(String(writing.objectPosition ?? ''));

await post('post-ground verify', evidence);
fs.writeFileSync(path.join(outDir, 'POST-EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
// also refresh followup shots
fs.copyFileSync(path.join(outDir, 'post-reading-mario.png'), path.join(root, 'test-results/pixel-audit/followup/01-reading-mario-deer-idle.png'));
fs.copyFileSync(path.join(outDir, 'post-writing-treasure.png'), path.join(root, 'test-results/pixel-audit/followup/02-writing-treasure-deer-idle.png'));
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(evidence.pass ? 0 : 1);
