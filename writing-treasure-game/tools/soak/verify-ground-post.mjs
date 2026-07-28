/**
 * Post-fix: measure visual shoe sole vs grass top after sole-pin math.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const root = path.resolve(import.meta.dirname, '../../..');
const outDir = path.join(root, 'test-results/pixel-audit/deer-ground');
const follow = path.join(root, 'test-results/pixel-audit/followup');

async function post(message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'post-fix', hypothesisId: 'H1',
      location: 'verify-ground-post.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function analyze(png, name, box) {
  const w = png.width; const h = png.height;
  const sy = h / 810; const sx = w / 1440;
  const px = (x, y) => {
    const i = (Math.round(y * sy) * w + Math.round(x * sx)) * 4;
    return [png.data[i], png.data[i + 1], png.data[i + 2], png.data[i + 3]];
  };
  const isGreen = (r, g, b) => g > 115 && g > r + 25 && g > b + 18 && r < 140;
  // brown shoe / dark sole
  const isShoe = (r, g, b, a) => a > 180 && r > 60 && r < 170 && g > 25 && g < 110
    && b < 90 && r > g + 8 && r > b + 15;

  const y0 = name === 'reading' ? 700 : 420;
  const y1 = name === 'reading' ? 800 : 500;
  let grass = null;
  let best = 0;
  for (let y = y0; y <= y1; y += 1) {
    let g = 0;
    for (let x = 60; x < 220; x += 1) {
      const [r, gg, b] = px(x, y);
      if (isGreen(r, gg, b)) g += 1;
    }
    // Prefer first strong grass band (platform top), not distant hills.
    if (g >= 70 && g > best) {
      best = g;
      grass = y;
      if (g >= 100) break;
    }
  }
  if (grass == null) {
    for (let y = y0; y <= y1; y += 1) {
      let g = 0;
      for (let x = 60; x < 220; x += 1) {
        const [r, gg, b] = px(x, y);
        if (isGreen(r, gg, b)) g += 1;
      }
      if (g >= 40) { grass = y; break; }
    }
  }

  const cx = (box.left + box.right) / 2;
  // Search shoe near expected box bottom (last brown row)
  let shoe = null;
  const searchTop = Math.floor(box.bottom - 120);
  const searchBot = Math.ceil(box.bottom + 40);
  for (let y = searchTop; y <= searchBot; y += 1) {
    let n = 0;
    for (let dx = -45; dx <= 45; dx += 1) {
      const [r, g, b, a] = px(cx + dx, y);
      if (isShoe(r, g, b, a)) n += 1;
    }
    if (n >= 5) shoe = y;
  }

  return {
    grass,
    shoe,
    gap: grass != null && shoe != null ? +(grass - shoe).toFixed(1) : null,
    boxBottom: +box.bottom.toFixed(1),
  };
}

async function live(page, url, scene, name) {
  await page.goto(`${url}?skipIntro=1&scene=${scene}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForTimeout(1500);
  const meta = await page.evaluate(() => {
    const canvas = document.getElementById('GameCanvas');
    const crect = canvas.getBoundingClientRect();
    const scale = Math.min(crect.width / 1440, crect.height / 810);
    const contentLeft = crect.left + (crect.width - 1440 * scale) / 2;
    const contentTop = crect.top + (crect.height - 810 * scale) / 2;
    const m = [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((i) => getComputedStyle(i).display !== 'none')
      .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    if (!m) return { error: 'no-motion' };
    const r = m.getBoundingClientRect();
    const origin = getComputedStyle(m).transformOrigin; // "x y"
    const ox = parseFloat(origin);
    const oy = parseFloat(origin.split(' ')[1] || '0');
    // Pin point = top-left + transform-origin (sole)
    const pinX = (r.left - contentLeft) / scale + ox / scale;
    const pinY = (r.top - contentTop) / scale + oy / scale;
    return {
      viewBox: m.style.objectViewBox,
      transform: m.style.transform.slice(0, 80),
      styleH: m.style.height,
      styleTop: m.style.top,
      origin,
      pinX: +pinX.toFixed(1),
      pinY: +pinY.toFixed(1),
      box: {
        left: (r.left - contentLeft) / scale,
        right: (r.right - contentLeft) / scale,
        top: (r.top - contentTop) / scale,
        bottom: (r.bottom - contentTop) / scale,
        h: r.height / scale,
      },
    };
  });
  const shot = path.join(outDir, `post-${name}.png`);
  await page.screenshot({ path: shot, type: 'png' });
  const png = PNG.sync.read(fs.readFileSync(shot));
  // Analyze around pinY (expected sole), not raw img bottom (includes padding)
  const pinBox = meta.pinY != null
    ? {
      left: meta.box.left,
      right: meta.box.right,
      bottom: meta.pinY,
      top: meta.pinY - 160,
    }
    : meta.box;
  const metrics = meta.box ? analyze(png, name, pinBox) : {};
  return { shot, ...meta, ...metrics, pinGap: metrics.grass != null && meta.pinY != null
    ? +(metrics.grass - meta.pinY).toFixed(1) : null };
}

fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(follow, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const reading = await live(page, 'http://127.0.0.1:43887', 'mario', 'reading');
const writing = await live(page, 'http://127.0.0.1:43886', 'treasure', 'writing');
fs.copyFileSync(reading.shot, path.join(follow, '01-reading-mario-deer-idle.png'));
fs.copyFileSync(writing.shot, path.join(follow, '02-writing-treasure-deer-idle.png'));
const evidence = {
  reading, writing,
  // pinY should sit on grass; visual shoe near pinY
  pass: reading.pinGap != null && Math.abs(reading.pinGap) <= 20
    && writing.pinGap != null && Math.abs(writing.pinGap) <= 25
    && reading.gap != null && Math.abs(reading.gap) <= 25
    && writing.gap != null && Math.abs(writing.gap) <= 30,
};
await post('post-fix ground', evidence);
fs.writeFileSync(path.join(outDir, 'POST-FIX.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
process.exit(evidence.pass ? 0 : 1);
