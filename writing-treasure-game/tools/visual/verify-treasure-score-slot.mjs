/**
 * Treasure settlement: no blue score panel; number sits on BG plate.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'treasure-score-slot');
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = 'http://127.0.0.1:43954';

async function waitHealth(ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server down');
}

async function press(page, x, y) {
  await page.mouse.click(x, y);
}

/** Count bright blue panel-like pixels in score slot (drawPanel #247FD1). */
function bluePanelRatio(pngPath) {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  // Prototype score box 111,656.25,236.25,54.75
  const x0 = 111;
  const y0 = 650;
  const x1 = 350;
  const y1 = 720;
  let blue = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      n += 1;
      // Our old drawPanel #247FD1 ≈ rgb(36,127,209)
      if (b > 170 && b > r + 80 && g > 90 && g < 170 && r < 90) blue += 1;
    }
  }
  return { blue, n, ratio: blue / n };
}

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: '43954',
    PUBLIC_ROOT: path.join(root, 'build', 'web-mobile'),
    MEDIA_ROOT: path.join(root, 'customer-media'),
  },
  stdio: 'ignore',
  windowsHide: true,
});

try {
  await waitHealth();
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
  await page.route('**/question-bank.json', async (route) => {
    const pack = await (await route.fetch()).json();
    pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pack),
    });
  });
  await page.goto(`${base}/index.html?skipIntro=1&scene=treasure`, {
    waitUntil: 'domcontentloaded', timeout: 90000,
  });
  await page.waitForFunction(() => document.body?.dataset?.gameReady === 'true', { timeout: 60000 });
  for (let i = 0; i < 5; i += 1) {
    await page.waitForTimeout(400);
    await press(page, 310, 595);
    await page.waitForFunction(() => document.body.dataset.answerCorrect !== undefined, {
      timeout: 15000,
    }).catch(() => {});
    await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, {
      timeout: 12000,
    }).catch(() => {});
  }
  await page.waitForFunction(() => document.body?.dataset?.stageResult === 'treasure', {
    timeout: 20000,
  });
  await page.waitForTimeout(800);
  await page.waitForFunction(() => {
    const imgs = [...document.querySelectorAll('img[data-customer-motion]')];
    return imgs.some((img) => img.naturalWidth > 10 && getComputedStyle(img).display !== 'none');
  }, { timeout: 15000 }).catch(() => {});
  const meta = await page.evaluate(() => ({
    scoreMode: document.body.dataset.scoreMode,
    scoreLabel: document.body.dataset.scoreLabel,
    scorePanel: document.body.dataset.scorePanel,
    scoreValue: document.body.dataset.scoreValue,
  }));
  const characterOk = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img[data-customer-motion]')];
    const visible = imgs.filter((img) => {
      const style = window.getComputedStyle(img);
      return style.display !== 'none' && img.naturalWidth > 10;
    });
    return {
      shown: visible.length > 0,
      count: imgs.length,
      names: visible.map((img) => img.dataset.customerMotion),
    };
  });
  const shot = path.join(outDir, 'treasure-settlement.png');
  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  await page.screenshot({
    path: shot,
    clip: {
      x: box.x + (box.width - 1440 * scale) / 2,
      y: box.y + (box.height - 810 * scale) / 2,
      width: 1440 * scale,
      height: 810 * scale,
    },
  });
  // Score slot crop for human check
  const full = PNG.sync.read(fs.readFileSync(shot));
  const cx0 = 60;
  const cy0 = 620;
  const cx1 = 380;
  const cy1 = 780;
  const crop = new PNG({ width: cx1 - cx0, height: cy1 - cy0 });
  for (let y = cy0; y < cy1; y += 1) {
    for (let x = cx0; x < cx1; x += 1) {
      const si = (y * full.width + x) * 4;
      const di = ((y - cy0) * crop.width + (x - cx0)) * 4;
      crop.data[di] = full.data[si];
      crop.data[di + 1] = full.data[si + 1];
      crop.data[di + 2] = full.data[si + 2];
      crop.data[di + 3] = 255;
    }
  }
  fs.writeFileSync(path.join(outDir, 'score-slot-crop.png'), PNG.sync.write(crop));
  const blue = bluePanelRatio(shot);
  const report = { meta, blue, character: characterOk, shot };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();

  if (meta.scoreMode !== 'summary') throw new Error(`scoreMode=${meta.scoreMode}`);
  if (meta.scorePanel === '1') throw new Error('blue score panel still drawn');
  if (!meta.scoreLabel || !/^总分\s+\d+/.test(meta.scoreLabel)) {
    throw new Error(`scoreLabel should be "总分 N", got: ${meta.scoreLabel}`);
  }
  if (!characterOk.shown) {
    throw new Error(`result character missing: ${JSON.stringify(characterOk)}`);
  }
  console.log('TREASURE_SCORE_SLOT_OK', shot, meta.scoreLabel, characterOk);
} finally {
  if (server?.pid) try { process.kill(server.pid); } catch { /* */ }
}
