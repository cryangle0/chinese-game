/**
 * Verify pinFeet: shoe sole Y vs grass top from live screenshot.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

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
      sessionId: 'ffb02e', runId: 'pin-verify', hypothesisId: 'GND',
      location: 'verify-pin-feet.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function analyze(png, game) {
  const w = png.width; const h = png.height;
  const cx = Math.round(w / 2);
  function profile(y, x0, x1) {
    let green = 0; let brown = 0; let orange = 0; let fur = 0; let blue = 0;
    for (let x = x0; x < x1; x += 1) {
      const i = (y * w + x) * 4;
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      if (g > 115 && g > r + 28 && g > b + 22 && r < 115) green += 1;
      else if (r > 180 && g > 120 && g < 200 && b < 100) fur += 1;
      else if (r > 70 && r < 145 && g > 35 && g < 95 && b < 65 && r > g + 12) brown += 1;
      else if (r > 170 && g > 90 && g < 170 && b < 110 && r > g + 35) orange += 1;
      else if (b > 100 && b > r + 20 && r < 120) blue += 1;
    }
    return { green, brown, orange, fur, blue };
  }
  // grass on sides
  let grass = null;
  const side0 = game === 'reading' ? 80 : 80;
  const side1 = game === 'reading' ? 400 : 400;
  for (let y = Math.floor(h * 0.45); y < h; y += 1) {
    const p = profile(y, side0, side1);
    if (p.green >= 28) { grass = y; break; }
  }
  // shoe: last brown-dominant in center lower half
  let shoe = null;
  for (let y = Math.floor(h * 0.45); y < h; y += 1) {
    const p = profile(y, cx - 50, cx + 50);
    if (p.brown >= 12 && p.brown >= p.orange) shoe = y;
  }
  // body bottom (fur/blue)
  let body = null;
  for (let y = Math.floor(h * 0.3); y < h * 0.85; y += 1) {
    const p = profile(y, cx - 50, cx + 50);
    if (p.fur + p.blue + p.brown >= 14) body = y;
  }
  const sy = h / 810;
  return {
    shoe: shoe != null ? +(shoe / sy).toFixed(1) : null,
    grass: grass != null ? +(grass / sy).toFixed(1) : null,
    body: body != null ? +(body / sy).toFixed(1) : null,
    gap: shoe != null && grass != null ? +(grass - shoe).toFixed(1) : null,
  };
}

async function live(page, url, scene, name) {
  await page.goto(`${url}?skipIntro=1&scene=${scene}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  }).catch(() => {});
  await page.waitForTimeout(1200);
  const shot = path.join(outDir, `pin-${name}.png`);
  await page.screenshot({ path: shot, type: 'png' });
  const png = PNG.sync.read(fs.readFileSync(shot));
  return { shot, ...analyze(png, name) };
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });

const reading = await live(page, readingUrl, 'mario', 'reading');
const writing = await live(page, writingUrl, 'treasure', 'writing');

fs.copyFileSync(reading.shot, path.join(root, 'test-results/pixel-audit/followup/01-reading-mario-deer-idle.png'));
fs.copyFileSync(writing.shot, path.join(root, 'test-results/pixel-audit/followup/02-writing-treasure-deer-idle.png'));

const evidence = {
  reading,
  writing,
  // gap ≈ 0 means feet on grass; allow ±12px (scallop)
  pass: reading.gap != null && Math.abs(reading.gap) <= 12
    && writing.gap != null && Math.abs(writing.gap) <= 18,
};
await post('pinFeet verify', evidence);
fs.writeFileSync(path.join(outDir, 'PIN-EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(evidence.pass ? 0 : 1);
