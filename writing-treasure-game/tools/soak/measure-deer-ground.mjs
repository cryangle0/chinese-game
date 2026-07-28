/**
 * Measure opaque pixel bounds of idle assets + live feet vs grass.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const outDir = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/deer-ground');
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const readingUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const writingUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const root = path.resolve(import.meta.dirname, '../../..');

async function post(hypothesisId, message, data) {
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e', runId: 'ground-measure', hypothesisId,
      location: 'measure-deer-ground.mjs', message, data, timestamp: Date.now(),
    }),
  }).catch(() => {});
}

async function opaqueFromBytes(page, bytes, mime) {
  const b64 = Buffer.from(bytes).toString('base64');
  return page.evaluate(async ({ b64: b, mime: m }) => {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
      img.src = `data:${m};base64,${b}`;
    });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let minX = c.width; let minY = c.height; let maxX = 0; let maxY = 0; let n = 0;
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        const a = data[(y * c.width + x) * 4 + 3];
        if (a > 24) {
          minX = Math.min(minX, x); minY = Math.min(minY, y);
          maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          n += 1;
        }
      }
    }
    return {
      natural: { w: c.width, h: c.height },
      opaque: n ? {
        minX, minY, maxX, maxY,
        w: maxX - minX + 1, h: maxY - minY + 1,
        padTop: minY,
        padBottom: c.height - 1 - maxY,
        padLeft: minX,
        padRight: c.width - 1 - maxX,
        fillH: +((maxY - minY + 1) / c.height).toFixed(3),
      } : null,
      n,
    };
  }, { b64, mime });
}

/** Visual feet Y inside a contain+bottom box. */
function visualFeetInBox(boxTop, boxW, boxH, natural, opaque) {
  if (!opaque) return null;
  const scale = Math.min(boxW / natural.w, boxH / natural.h);
  const drawnH = natural.h * scale;
  const drawnW = natural.w * scale;
  const offsetX = (boxW - drawnW) / 2;
  const offsetY = boxH - drawnH; // bottom align
  const feetY = boxTop + offsetY + opaque.maxY * scale;
  const headY = boxTop + offsetY + opaque.minY * scale;
  const visualH = opaque.h * scale;
  return {
    scale: +scale.toFixed(3),
    drawnW: +drawnW.toFixed(1),
    drawnH: +drawnH.toFixed(1),
    offsetY: +offsetY.toFixed(1),
    feetY: +feetY.toFixed(1),
    headY: +headY.toFixed(1),
    visualH: +visualH.toFixed(1),
  };
}

fs.mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
await page.goto('about:blank');

const assetFiles = [
  {
    id: 'mario-webp',
    path: path.join(root, 'reading-jumper-game/customer-media/mario/idle.webp'),
    mime: 'image/webp',
  },
  {
    id: 'mario-html-png',
    path: path.join(root, '独立HTML像素级UI原型/reading/assets/mario/deer.png'),
    mime: 'image/png',
  },
  {
    id: 'treasure-webp',
    path: path.join(root, 'writing-treasure-game/customer-media/treasure/idle.webp'),
    mime: 'image/webp',
  },
  {
    id: 'treasure-html-png',
    path: path.join(root, '独立HTML像素级UI原型/writing/assets/treasure/characterIdle.png'),
    mime: 'image/png',
  },
];

const assetReport = {};
for (const a of assetFiles) {
  const bytes = fs.readFileSync(a.path);
  assetReport[a.id] = await opaqueFromBytes(page, bytes, a.mime);
  await post('H2', `opaque ${a.id}`, assetReport[a.id]);
}

const html = {
  mario: { left: 657, top: 513, w: 136, h: 236, feetBoxBottom: 749 },
  treasure: { left: 614, top: 168, w: 173, h: 253, feetBoxBottom: 421 },
};

const current = {
  mario: { w: 280, h: 440, yCocos: -160 }, // center; top = 405 - (y + h/2) = 405 - (-160+220) = 345
  treasure: { left: 566.5, top: 29, w: 268, h: 392 },
};
current.mario.top = 405 - (current.mario.yCocos + current.mario.h / 2);
current.mario.bottom = current.mario.top + current.mario.h;

const predicted = {
  marioHtml: visualFeetInBox(
    html.mario.top, html.mario.w, html.mario.h,
    assetReport['mario-html-png'].natural, assetReport['mario-html-png'].opaque,
  ),
  marioCurrentWebp: visualFeetInBox(
    current.mario.top, current.mario.w, current.mario.h,
    assetReport['mario-webp'].natural, assetReport['mario-webp'].opaque,
  ),
  treasureHtml: visualFeetInBox(
    html.treasure.top, html.treasure.w, html.treasure.h,
    assetReport['treasure-html-png'].natural, assetReport['treasure-html-png'].opaque,
  ),
  treasureCurrentWebpCenter: (() => {
    // writing uses object-position center (50% 50%)
    const nat = assetReport['treasure-webp'].natural;
    const op = assetReport['treasure-webp'].opaque;
    if (!op) return null;
    const box = current.treasure;
    const scale = Math.min(box.w / nat.w, box.h / nat.h);
    const drawnH = nat.h * scale;
    const offsetY = (box.h - drawnH) / 2;
    return {
      scale: +scale.toFixed(3),
      offsetY: +offsetY.toFixed(1),
      feetY: +(box.top + offsetY + op.maxY * scale).toFixed(1),
      headY: +(box.top + offsetY + op.minY * scale).toFixed(1),
      visualH: +(op.h * scale).toFixed(1),
      note: 'center position — causes float if pad asymmetric',
    };
  })(),
  treasureCurrentWebpBottom: visualFeetInBox(
    current.treasure.top, current.treasure.w, current.treasure.h,
    assetReport['treasure-webp'].natural, assetReport['treasure-webp'].opaque,
  ),
};

async function live(game, url, scene) {
  await page.setViewportSize({ width: 1440, height: 810 });
  await page.goto(`${url}?skipIntro=1&scene=${scene}`, {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  }).catch(() => {});
  await page.waitForTimeout(1000);
  const meta = await page.evaluate(() => {
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
    const imgs = [...document.querySelectorAll('img[data-customer-motion]')]
      .filter((img) => getComputedStyle(img).display !== 'none');
    const motion = imgs.sort(
      (a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height,
    )[0];
    const r = motion?.getBoundingClientRect();
    return {
      objectFit: motion ? getComputedStyle(motion).objectFit : null,
      objectPosition: motion ? getComputedStyle(motion).objectPosition : null,
      design: r && canvas ? {
        w: +(r.width / scale).toFixed(1),
        h: +(r.height / scale).toFixed(1),
        left: +((r.left - canvas.left) / scale).toFixed(1),
        top: +((r.top - canvas.top) / scale).toFixed(1),
        bottom: +((r.bottom - canvas.top) / scale).toFixed(1),
      } : null,
    };
  });
  const shot = path.join(outDir, `${game}-live.png`);
  await page.screenshot({ path: shot, type: 'png', clip: {
    x: 0, y: 0, width: 1440, height: 810,
  } }).catch(async () => page.screenshot({ path: shot, type: 'png' }));
  return meta;
}

const readingLive = await live('reading', readingUrl, 'mario');
const writingLive = await live('writing', writingUrl, 'treasure');

const evidence = {
  html,
  current,
  assetReport,
  predicted,
  readingLive,
  writingLive,
  target: {
    // Aim: visual height ~ option brick*2.5 (~220) min 520 reading; writing ~ chest height *2 (~320+) → 480
    // Feet on HTML ground lines
    marioFeetY: html.mario.feetBoxBottom, // 749
    treasureFeetY: html.treasure.feetBoxBottom, // 421
  },
};
fs.writeFileSync(path.join(outDir, 'EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
await browser.close();
