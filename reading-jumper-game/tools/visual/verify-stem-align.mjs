/**
 * Verify stem is left-aligned + vertically centered (deep-sea long stem).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'stem-align');
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = 'http://127.0.0.1:43951';
const longStem = '《张衡的天平》中，阎罗王为什么拆掉了天平？这是一道很长的阅读理解题干用来检查边距。';

async function waitHealth(ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server down');
}

function analyzeStemPixels(pngPath) {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  // Board crop ROI in full screenshot (include full blue face, not just upper half).
  const x0 = 380;
  const x1 = 1060;
  const y0 = 70;
  const y1 = 310;
  // Glyph = bright white with nearby dark outline (ignore chrome).
  const rows = [];
  for (let y = y0; y < y1; y += 1) {
    let minX = 9999;
    let maxX = -1;
    let cnt = 0;
    for (let x = x0 + 40; x < x1 - 40; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      if (!(r > 240 && g > 240 && b > 240)) continue;
      let outline = false;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-2, 0], [2, 0]]) {
        const j = ((y + dy) * png.width + (x + dx)) * 4;
        const rr = png.data[j];
        const gg = png.data[j + 1];
        const bb = png.data[j + 2];
        if (rr < 90 && gg < 130 && bb < 170) {
          outline = true;
          break;
        }
      }
      if (outline) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        cnt += 1;
      }
    }
    if (cnt > 6) rows.push({ y, minX, maxX, cnt });
  }
  const lines = [];
  let cur = null;
  for (const row of rows) {
    if (!cur || row.y - cur.y1 > 4) {
      cur = {
        y0: row.y, y1: row.y, minX: row.minX, maxX: row.maxX, cnt: 0,
      };
      lines.push(cur);
    }
    cur.y1 = row.y;
    cur.minX = Math.min(cur.minX, row.minX);
    cur.maxX = Math.max(cur.maxX, row.maxX);
    cur.cnt += row.cnt;
  }
  // Keep real text lines (ignore shell sparkles); prefer widest bands.
  const textLines = lines
    .filter((l) => (l.maxX - l.minX) > 80 || l.cnt > 40)
    .sort((a, b) => a.y0 - b.y0);
  if (textLines.length < 2) {
    return { ok: false, reason: `need >=2 text lines, got ${textLines.length}`, lines: textLines };
  }
  const first = textLines[0];
  const last = textLines[textLines.length - 1];
  const leftEdgeDelta = last.minX - first.minX;
  // Short last line left-flush (center would be +120~250).
  const leftOk = Math.abs(leftEdgeDelta) <= 40;
  // Blue face mid ≈ text block mid (crown occupies upper band of board).
  const faceTop = y0 + 78;
  const faceBot = y1 - 10;
  const faceMid = (faceTop + faceBot) / 2;
  const blockMid = (first.y0 + last.y1) / 2;
  const vOffset = blockMid - faceMid;
  const verticalOk = Math.abs(vOffset) <= 28;
  return {
    ok: leftOk && verticalOk,
    leftOk,
    verticalOk,
    leftEdgeDelta,
    vOffset,
    firstMinX: first.minX,
    lastMinX: last.minX,
    lines: textLines.map((l) => ({
      y0: l.y0, y1: l.y1, minX: l.minX, maxX: l.maxX, w: l.maxX - l.minX,
    })),
  };
}

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: '43951',
    PUBLIC_ROOT: path.join(root, 'build', 'web-mobile'),
    MEDIA_ROOT: path.join(root, 'product-media'),
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
    pack.version = `align-${Date.now()}`;
    pack.questions = [{
      ...pack.questions[0],
      id: 'ALIGN_DEEP',
      packId: pack.version,
      games: ['reading-jumper'],
      scenes: ['deep-sea'],
      grade: 'ALL',
      term: 'ALL',
      knowledgePoint: '安徒生童话',
      stem: longStem,
      options: ['暴露自己不是好官长', '觉得天平不够实用', '天平已经彻底坏了'],
      correctIndex: 2,
      enabled: true,
      weight: 100,
    }];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pack),
    });
  });
  await page.goto(`${base}/index.html?skipIntro=1&scene=deep-sea&book=${encodeURIComponent('安徒生童话')}`, {
    waitUntil: 'domcontentloaded', timeout: 90000,
  });
  await page.waitForFunction(() => document.body?.dataset?.questionStem, { timeout: 60000 });
  await page.waitForTimeout(1000);
  const meta = await page.evaluate(() => ({
    align: document.body.dataset.questionAlign,
    valign: document.body.dataset.questionVAlign,
    hAlign: document.body.dataset.questionHAlign,
    nudge: document.body.dataset.questionLabelNudge,
    faceY: document.body.dataset.questionFaceY,
    padTopExtra: document.body.dataset.questionPadTopExtra,
    labelH: document.body.dataset.questionLabelH,
    wrapped: document.body.dataset.questionWrapped,
    stem: document.body.dataset.questionStem,
  }));
  const shot = path.join(outDir, 'deep-sea-stem.png');
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
  await browser.close();
  const pixels = analyzeStemPixels(shot);
  const report = { meta, pixels };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (meta.align !== 'left' || meta.valign !== 'center') {
    throw new Error(`align meta fail: ${JSON.stringify(meta)}`);
  }
  if (meta.hAlign != null && meta.hAlign !== '0') {
    throw new Error(`runtime hAlign expected 0 (LEFT), got ${meta.hAlign}`);
  }
  if (meta.padTopExtra !== '64') {
    throw new Error(`deep-sea padTopExtra expected 64, got ${meta.padTopExtra}`);
  }
  // Short last line must be left-flush (center would start ~+180px).
  if (pixels.lines?.length >= 3) {
    const last = pixels.lines[pixels.lines.length - 1];
    const first = pixels.lines[0];
    if (last.w > first.w * 0.7) {
      throw new Error(`expected short last line, got ${JSON.stringify(last)}`);
    }
    if (Math.abs(last.minX - first.minX) > 40) {
      throw new Error(`last line not left-aligned: ${JSON.stringify({ first, last })}`);
    }
  }
  if (meta.wrapped != null && meta.wrapped !== '1') {
    throw new Error(`expected explicit wrap, got wrapped=${meta.wrapped}`);
  }
  if (!pixels.ok) {
    throw new Error(`pixel align fail: ${JSON.stringify(pixels)}`);
  }
  console.log('STEM_ALIGN_OK', shot);
} finally {
  if (server?.pid) try { process.kill(server.pid); } catch { /* */ }
}
