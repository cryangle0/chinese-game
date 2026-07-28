/**
 * Measure REAL feet Y vs REAL ground Y from live canvas screenshot + DOM deer box.
 * Output exact dy to move deer down (design px).
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
      sessionId: 'ffb02e', runId: 'ground-exact', hypothesisId: 'GND',
      location: 'measure-exact-ground.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

/** Lowest opaque pixel Y inside the motion img (source), mapped to design canvas Y. */
async function measure(page, url, scene, game) {
  await page.goto(`${url}?skipIntro=1&scene=${scene}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  }).catch(() => {});
  await page.waitForTimeout(1000);

  const meta = await page.evaluate(async () => {
    const canvas = document.getElementById('GameCanvas');
    const crect = canvas.getBoundingClientRect();
    const scale = Math.min(crect.width / 1440, crect.height / 810);
    const contentLeft = crect.left + (crect.width - 1440 * scale) / 2;
    const contentTop = crect.top + (crect.height - 810 * scale) / 2;

    const imgs = [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((img) => getComputedStyle(img).display !== 'none');
    const motion = imgs.sort(
      (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
    )[0];
    if (!motion) return { error: 'no-motion' };

    const r = motion.getBoundingClientRect();
    // Draw the displayed image into offscreen canvas at natural size, find opaque feet
    const c = document.createElement('canvas');
    c.width = motion.naturalWidth;
    c.height = motion.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(motion, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let minY = c.height; let maxY = 0; let minX = c.width; let maxX = 0; let n = 0;
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        if (data[(y * c.width + x) * 4 + 3] > 40) {
          n += 1;
          minY = Math.min(minY, y); maxY = Math.max(maxY, y);
          minX = Math.min(minX, x); maxX = Math.max(maxX, x);
        }
      }
    }
    // How object-fit contain + object-position bottom maps opaque feet into the element box
    const fit = getComputedStyle(motion).objectFit;
    const pos = getComputedStyle(motion).objectPosition;
    const boxW = r.width / scale; // design
    const boxH = r.height / scale;
    const boxLeft = (r.left - contentLeft) / scale;
    const boxTop = (r.top - contentTop) / scale;
    const s = Math.min(boxW / c.width, boxH / c.height);
    const drawnW = c.width * s;
    const drawnH = c.height * s;
    const isBottom = /100%|bottom/i.test(pos);
    const offX = (boxW - drawnW) / 2;
    const offY = isBottom ? (boxH - drawnH) : (boxH - drawnH) / 2;
    const feetDesignY = boxTop + offY + maxY * s;
    const headDesignY = boxTop + offY + minY * s;

    return {
      fit, pos,
      natural: { w: c.width, h: c.height },
      opaque: { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1, n },
      box: {
        left: +boxLeft.toFixed(1), top: +boxTop.toFixed(1),
        w: +boxW.toFixed(1), h: +boxH.toFixed(1),
        bottom: +(boxTop + boxH).toFixed(1),
      },
      scale: +s.toFixed(4),
      feetDesignY: +feetDesignY.toFixed(1),
      headDesignY: +headDesignY.toFixed(1),
      visualH: +((maxY - minY + 1) * s).toFixed(1),
    };
  });

  // Screenshot full design viewport and find grass/platform top outside deer column
  const shotPath = path.join(outDir, `exact-${game}.png`);
  await page.screenshot({ path: shotPath, type: 'png' });
  const png = PNG.sync.read(fs.readFileSync(shotPath));

  // Map: assume screenshot is letterboxed or exact 1440x810
  const sx = png.width / 1440;
  const sy = png.height / 810;
  const deerL = Math.round((meta.box?.left ?? 600) * sx);
  const deerR = Math.round(((meta.box?.left ?? 600) + (meta.box?.w ?? 200)) * sx);

  // Ground detector: for each y from bottom, count "ground surface" pixels
  // Mario: bright green grass scallops
  // Writing: grass strip OR top of light stone option slabs near center
  let groundY = null;
  const isWriting = game === 'writing';

  for (let y = png.height - 1; y > png.height * 0.35; y -= 1) {
    let hits = 0;
    let samples = 0;
    for (let x = 40; x < png.width - 40; x += 2) {
      // skip deer column
      if (x >= deerL - 10 && x <= deerR + 10) continue;
      samples += 1;
      const i = (y * png.width + x) * 4;
      const r = png.data[i]; const g = png.data[i + 1]; const b = png.data[i + 2];
      if (isWriting) {
        // grass green OR pale stone slab top
        const grass = g > r + 15 && g > b + 10 && g > 80 && g < 200 && r < 160;
        const stone = r > 200 && g > 200 && b > 190 && Math.abs(r - g) < 25;
        if (grass || stone) hits += 1;
      } else {
        // mario grass: vivid green, not hills (hills are darker/muted)
        const grass = g > 100 && g > r + 25 && g > b + 20 && r < 140 && b < 120;
        if (grass) hits += 1;
      }
    }
    if (samples > 0 && hits / samples > 0.08) {
      groundY = y;
    } else if (groundY != null && hits / samples < 0.03) {
      // crossed above the ground band — keep last groundY as top of ground
      break;
    }
  }

  const groundDesignY = groundY == null ? null : +(groundY / sy).toFixed(1);
  const gap = groundDesignY != null && meta.feetDesignY != null
    ? +(groundDesignY - meta.feetDesignY).toFixed(1)
    : null;

  const result = {
    game, scene, ...meta,
    groundDesignY,
    gap,
    // positive gap => feet above ground => need to move deer DOWN by gap
    // cocos Y decreases when moving down visually? 
    // design top increases downward. Moving sprite down = increase design Y of center
    // = decrease cocos Y
    moveCocosY: gap != null ? +(-gap).toFixed(1) : null,
  };
  await post(`${game} exact ground`, result);
  return result;
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });

const reading = await measure(page, readingUrl, 'mario', 'reading');
const writing = await measure(page, writingUrl, 'treasure', 'writing');

const evidence = { reading, writing, pass: reading.gap != null && writing.gap != null };
fs.writeFileSync(path.join(outDir, 'EXACT-GROUND.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
