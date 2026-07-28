/**
 * Probe live deer DOM box vs grass pixels.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const outDir = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/deer-ground');

async function post(message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'dom-probe', hypothesisId: 'H3',
      location: 'probe-deer-dom.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function findGrass(png, game) {
  const w = png.width;
  const h = png.height;
  const sy = h / 810;
  // Mario grass is near bottom; writing grass mid-lower. Scan sides for green band.
  const y0 = game === 'reading' ? Math.floor(h * 0.72) : Math.floor(h * 0.4);
  for (let y = y0; y < h; y += 1) {
    let green = 0;
    for (let x = 40; x < 280; x += 1) {
      const i = (y * w + x) * 4;
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      if (g > 120 && g > r + 25 && g > b + 20 && r < 130) green += 1;
    }
    if (green >= 40) return +(y / sy).toFixed(1);
  }
  return null;
}

function findShoeInBox(png, boxTop, boxBottom) {
  const w = png.width;
  const h = png.height;
  const sy = h / 810;
  const cx = Math.round(w / 2);
  const y0 = Math.max(0, Math.floor(boxTop * sy));
  const y1 = Math.min(h - 1, Math.ceil(boxBottom * sy));
  let lastOpaque = null;
  for (let y = y0; y <= y1; y += 1) {
    let n = 0;
    for (let x = cx - 40; x < cx + 40; x += 1) {
      const i = (y * w + x) * 4;
      const a = png.data[i + 3];
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      // deer fur / brown shoes / blue vest (not green grass)
      if (a > 200 && !(g > 120 && g > r + 25 && g > b + 20)) {
        if (r + g + b > 80) n += 1;
      }
    }
    if (n >= 8) lastOpaque = y;
  }
  return lastOpaque != null ? +(lastOpaque / sy).toFixed(1) : null;
}

async function probe(page, url, scene, game) {
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
    const imgs = [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((i) => getComputedStyle(i).display !== 'none');
    const m = imgs.sort(
      (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
    )[0];
    if (!m) return { error: 'no-motion' };
    const r = m.getBoundingClientRect();
    const cs = getComputedStyle(m);
    return {
      fit: cs.objectFit,
      pos: cs.objectPosition,
      viewBox: m.style.objectViewBox || cs.objectViewBox,
      styleTop: m.style.top,
      styleLeft: m.style.left,
      styleW: m.style.width,
      styleH: m.style.height,
      transform: m.style.transform,
      natural: [m.naturalWidth, m.naturalHeight],
      supportsViewBox: typeof CSS !== 'undefined'
        && !!CSS.supports && CSS.supports('object-view-box', 'inset(0px)'),
      box: {
        left: +((r.left - contentLeft) / scale).toFixed(1),
        top: +((r.top - contentTop) / scale).toFixed(1),
        bottom: +((r.bottom - contentTop) / scale).toFixed(1),
        w: +(r.width / scale).toFixed(1),
        h: +(r.height / scale).toFixed(1),
      },
    };
  });
  const shot = path.join(outDir, `probe-${game}.png`);
  await page.screenshot({ path: shot, type: 'png' });
  const png = PNG.sync.read(fs.readFileSync(shot));
  const grass = findGrass(png, game);
  const shoe = meta.box ? findShoeInBox(png, meta.box.top, meta.box.bottom + 30) : null;
  return {
    ...meta,
    grass,
    shoe,
    gap: shoe != null && grass != null ? +(grass - shoe).toFixed(1) : null,
    shot,
  };
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const reading = await probe(page, 'http://127.0.0.1:43887', 'mario', 'reading');
const writing = await probe(page, 'http://127.0.0.1:43886', 'treasure', 'writing');
const evidence = { reading, writing };
await post('dom probe', evidence);
fs.writeFileSync(path.join(outDir, 'PROBE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
