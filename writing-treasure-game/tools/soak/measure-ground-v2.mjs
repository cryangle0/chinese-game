/**
 * Precise: dense opaque feet row + platform grass top (not hills / underground).
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

async function post(message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'ground-v2', hypothesisId: 'GND2',
      location: 'measure-ground-v2.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

function denseFeetY(data, w, h) {
  // per-row opaque count; feet = lowest row with count >= 25% of peak in lower half
  const counts = new Array(h).fill(0);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (data[(y * w + x) * 4 + 3] > 80) counts[y] += 1;
    }
  }
  let peak = 0;
  for (let y = Math.floor(h * 0.35); y < h; y += 1) peak = Math.max(peak, counts[y]);
  const thresh = Math.max(6, peak * 0.28);
  let feet = 0;
  for (let y = h - 1; y >= 0; y -= 1) {
    if (counts[y] >= thresh) { feet = y; break; }
  }
  let head = h;
  for (let y = 0; y < h; y += 1) {
    if (counts[y] >= thresh) { head = y; break; }
  }
  return { feet, head, peak, thresh: +thresh.toFixed(1), countsSample: counts.slice(feet - 5, feet + 1) };
}

async function measure(page, url, scene, game) {
  await page.goto(`${url}?skipIntro=1&scene=${scene}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  }).catch(() => {});
  await page.waitForTimeout(1000);

  const meta = await page.evaluate(() => {
    const canvas = document.getElementById('GameCanvas');
    const crect = canvas.getBoundingClientRect();
    const scale = Math.min(crect.width / 1440, crect.height / 810);
    const contentLeft = crect.left + (crect.width - 1440 * scale) / 2;
    const contentTop = crect.top + (crect.height - 810 * scale) / 2;
    const motion = [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((img) => getComputedStyle(img).display !== 'none')
      .sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0];
    if (!motion) return { error: 'no-motion' };
    const r = motion.getBoundingClientRect();
    return {
      pos: getComputedStyle(motion).objectPosition,
      natW: motion.naturalWidth,
      natH: motion.naturalHeight,
      src: motion.currentSrc,
      box: {
        left: +((r.left - contentLeft) / scale).toFixed(1),
        top: +((r.top - contentTop) / scale).toFixed(1),
        w: +(r.width / scale).toFixed(1),
        h: +(r.height / scale).toFixed(1),
      },
      scale,
      contentLeft, contentTop,
      screen: { left: r.left, top: r.top, w: r.width, h: r.height },
    };
  });

  // Fetch webp bytes via page and analyze dense feet in browser
  const feetInfo = await page.evaluate(async (src) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const counts = new Array(c.height).fill(0);
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        if (data[(y * c.width + x) * 4 + 3] > 80) counts[y] += 1;
      }
    }
    let peak = 0;
    for (let y = Math.floor(c.height * 0.35); y < c.height; y += 1) {
      peak = Math.max(peak, counts[y]);
    }
    const thresh = Math.max(6, peak * 0.28);
    let feet = 0;
    for (let y = c.height - 1; y >= 0; y -= 1) {
      if (counts[y] >= thresh) { feet = y; break; }
    }
    let head = c.height;
    for (let y = 0; y < c.height; y += 1) {
      if (counts[y] >= thresh) { head = y; break; }
    }
    // also raw max alpha>40
    let rawMax = 0;
    for (let y = c.height - 1; y >= 0; y -= 1) {
      for (let x = 0; x < c.width; x += 1) {
        if (data[(y * c.width + x) * 4 + 3] > 40) { rawMax = y; break; }
      }
      if (rawMax) break;
    }
    return { feet, head, peak, thresh, rawMax, natW: c.width, natH: c.height };
  }, meta.src);

  const s = Math.min(meta.box.w / feetInfo.natW, meta.box.h / feetInfo.natH);
  const drawnH = feetInfo.natH * s;
  const offY = /100%|bottom/i.test(meta.pos) ? (meta.box.h - drawnH) : (meta.box.h - drawnH) / 2;
  const denseFeetY = +(meta.box.top + offY + feetInfo.feet * s).toFixed(1);
  const rawFeetY = +(meta.box.top + offY + feetInfo.rawMax * s).toFixed(1);
  const headY = +(meta.box.top + offY + feetInfo.head * s).toFixed(1);

  const shotPath = path.join(outDir, `v2-${game}.png`);
  await page.screenshot({ path: shotPath, type: 'png' });
  const png = PNG.sync.read(fs.readFileSync(shotPath));
  const sy = png.height / 810;
  const sx = png.width / 1440;

  // Platform grass: thin band near bottom. Score each y by green density,
  // then pick the TOP of the lowest green band (platform, not hills).
  const greenRatio = [];
  for (let y = 0; y < png.height; y += 1) {
    let g = 0; let n = 0;
    for (let x = 20; x < png.width - 20; x += 3) {
      // skip deer
      const dx = x / sx;
      if (dx > meta.box.left - 20 && dx < meta.box.left + meta.box.w + 20) continue;
      n += 1;
      const i = (y * png.width + x) * 4;
      const r = png.data[i]; const gg = png.data[i + 1]; const b = png.data[i + 2];
      if (game === 'reading') {
        if (gg > 105 && gg > r + 28 && gg > b + 22 && r < 130 && b < 110) g += 1;
      } else {
        // writing grass strip (mid screen), avoid underground
        if (gg > 90 && gg > r + 18 && gg > b + 12 && r < 150 && b < 130 && y < png.height * 0.7) g += 1;
      }
    }
    greenRatio[y] = n ? g / n : 0;
  }

  // Find contiguous green bands with ratio > 0.06, take the lowest band's top
  let groundY = null;
  let inBand = false;
  let bandTop = null;
  const bands = [];
  for (let y = 0; y < png.height; y += 1) {
    if (greenRatio[y] > 0.06) {
      if (!inBand) { inBand = true; bandTop = y; }
    } else if (inBand) {
      bands.push({ top: bandTop, bottom: y - 1 });
      inBand = false;
    }
  }
  if (inBand) bands.push({ top: bandTop, bottom: png.height - 1 });

  // Prefer band whose bottom is in lower 35% of screen (platform), not hills
  const platformBands = bands.filter((b) => b.bottom > png.height * 0.65 && (b.bottom - b.top) < png.height * 0.2);
  const pick = platformBands.length
    ? platformBands[platformBands.length - 1]
    : bands.filter((b) => b.bottom > png.height * 0.5).pop();
  groundY = pick ? pick.top : null;

  // Writing: also try option-slab top (pale stone) near center columns
  let slabTop = null;
  if (game === 'writing') {
    for (let y = Math.floor(png.height * 0.35); y < png.height * 0.7; y += 1) {
      let stone = 0; let n = 0;
      for (let x = Math.floor(png.width * 0.25); x < png.width * 0.75; x += 2) {
        n += 1;
        const i = (y * png.width + x) * 4;
        const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
        if (r > 210 && g > 210 && b > 200 && Math.abs(r - g) < 20) stone += 1;
      }
      if (n && stone / n > 0.04) { slabTop = y; break; }
    }
  }

  const groundDesignY = groundY != null ? +(groundY / sy).toFixed(1) : null;
  const slabDesignY = slabTop != null ? +(slabTop / sy).toFixed(1) : null;
  // Standing surface: writing prefers slab top if found, else grass
  const standY = game === 'writing' && slabDesignY != null ? slabDesignY : groundDesignY;
  const gap = standY != null ? +(standY - denseFeetY).toFixed(1) : null;

  const result = {
    game,
    box: meta.box,
    pos: meta.pos,
    feetInfo,
    denseFeetY,
    rawFeetY,
    headY,
    groundDesignY,
    slabDesignY,
    standY,
    gap,
    // positive gap: feet above stand → move down in design = decrease cocos Y by gap
    moveCocosY: gap != null ? +(-gap).toFixed(1) : null,
    bands: bands.slice(-4).map((b) => ({
      top: +(b.top / sy).toFixed(1),
      bottom: +(b.bottom / sy).toFixed(1),
    })),
  };
  await post(`${game} ground v2`, result);
  return result;
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const reading = await measure(page, readingUrl, 'mario', 'reading');
const writing = await measure(page, writingUrl, 'treasure', 'writing');
const evidence = { reading, writing };
fs.writeFileSync(path.join(outDir, 'GROUND-V2.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
