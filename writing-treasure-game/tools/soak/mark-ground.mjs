import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import fs from 'fs';
import path from 'path';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const out = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/deer-ground');
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });

async function mark(url, scene, name) {
  await page.goto(`${url}?skipIntro=1&scene=${scene}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const canvas = document.getElementById('GameCanvas');
    const crect = canvas.getBoundingClientRect();
    const scale = Math.min(crect.width / 1440, crect.height / 810);
    const contentTop = crect.top + (crect.height - 810 * scale) / 2;
    const m = [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((i) => getComputedStyle(i).display !== 'none')
      .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    const r = m.getBoundingClientRect();
    const o = getComputedStyle(m).transformOrigin.split(' ');
    const pinY = (r.top - contentTop) / scale + parseFloat(o[1]) / scale;
    const mk = (y, color, label) => {
      const el = document.createElement('div');
      el.style.cssText = `position:fixed;left:0;right:0;height:2px;background:${color};top:${contentTop + y * scale}px;z-index:99999;pointer-events:none;`;
      document.body.appendChild(el);
      const t = document.createElement('div');
      t.textContent = `${label} ${y.toFixed(0)}`;
      t.style.cssText = `position:fixed;left:8px;top:${contentTop + y * scale - 14}px;color:${color};font:bold 14px monospace;z-index:99999;text-shadow:0 0 3px #000`;
      document.body.appendChild(t);
    };
    mk(pinY, '#ff0', 'PIN');
    return { pinY, scale };
  });
  const shot = path.join(out, `mark-${name}.png`);
  await page.screenshot({ path: shot, type: 'png' });
  const png = PNG.sync.read(fs.readFileSync(shot));
  const w = png.width; const h = png.height;
  const sy = h / 810; const sx = w / 1440;
  const cx = 720;
  let lastBrown = null;
  let lastNonSky = null;
  for (let y = 500; y < 800; y += 1) {
    let brown = 0;
    let opaque = 0;
    for (let dx = -40; dx <= 40; dx += 1) {
      const i = (Math.round(y * sy) * w + Math.round((cx + dx) * sx)) * 4;
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      const a = png.data[i + 3];
      if (a < 200) continue;
      if (g > 115 && g > r + 25 && g > b + 18 && r < 140) continue;
      opaque += 1;
      if (r > 60 && r < 170 && g > 25 && g < 110 && b < 90 && r > g + 8) brown += 1;
    }
    if (brown >= 4) lastBrown = y;
    if (opaque >= 8) lastNonSky = y;
  }
  let grass = null;
  const y0 = name === 'reading' ? 700 : 420;
  for (let y = y0; y < 800; y += 1) {
    let g = 0;
    for (let x = 80; x < 200; x += 1) {
      const i = (Math.round(y * sy) * w + Math.round(x * sx)) * 4;
      const r = png.data[i]; const gg = png.data[i + 1]; const b = png.data[i + 2];
      if (gg > 130 && gg > r + 30 && gg > b + 20 && r < 120) g += 1;
    }
    if (g >= 60) { grass = y; break; }
  }
  return {
    name,
    pinY: +info.pinY.toFixed(1),
    lastBrown,
    lastNonSky,
    grass,
    float: grass != null && lastBrown != null ? grass - lastBrown : null,
    shot,
  };
}

fs.mkdirSync(out, { recursive: true });
const reading = await mark('http://127.0.0.1:43887', 'mario', 'reading');
const writing = await mark('http://127.0.0.1:43886', 'treasure', 'writing');
const data = { reading, writing };
console.log(JSON.stringify(data, null, 2));
await fetch(ingest, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
  body: JSON.stringify({
    sessionId: 'ffb02e', runId: 'post-fix', hypothesisId: 'H4',
    location: 'mark-ground.mjs', message: 'visual sole vs grass', data, timestamp: Date.now(),
  }),
}).catch(() => {});
await browser.close();
