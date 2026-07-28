/**
 * Pixel-level settlement audit vs HTML prototypes (1440×810 design space).
 * Method from 结算页面HTML像素坐标测算与验收经验.md:
 * fixed design coords → screenshot both → MAE on qa-box regions.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const readingUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const writingUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';
const repoRoot = path.resolve(import.meta.dirname, '../../..');
const protoRoot = path.join(repoRoot, '独立HTML像素级UI原型');
const outDir = path.join(repoRoot, 'test-results/pixel-audit/settlement-pages');

const cases = [
  {
    game: 'writing',
    scene: 'treasure',
    html: 'writing/pages/06-treasure-settlement.html',
    url: `${writingUrl}?skipIntro=1&scene=treasure`,
    regions: [
      { name: 'rankTitle', box: [525, 221.25, 262.5, 78] },
      { name: 'rankBase', box: [480, 303.75, 337.5, 335.25] },
      { name: 'reviewTitle', box: [956.25, 224.25, 297, 72.75] },
      { name: 'reviewRow0', box: [852, 336.75, 502.5, 59.25] },
      { name: 'reviewRow4', box: [852, 603.75, 502.5, 59.25] },
      { name: 'score', box: [111, 656.25, 236.25, 54.75] },
      { name: 'character', box: [0, 118.59, 414, 500] },
    ],
  },
  {
    game: 'reading',
    scene: 'mario',
    html: 'reading/pages/05-mario-settlement.html',
    url: `${readingUrl}?skipIntro=1&scene=mario`,
    regions: [
      { name: 'rankTitle', box: [522.56, 289.69, 306.56, 77.06] },
      { name: 'rankRow0', box: [488.25, 398.81, 365.62, 65.81] },
      { name: 'rankRow2', box: [483.19, 550.12, 370.69, 72] },
      { name: 'reviewTitle', box: [987.19, 284.06, 306.56, 77.62] },
      { name: 'reviewText0', box: [1005.06, 421.81, 241.82, 44] },
      { name: 'reviewText4', box: [1005.06, 590.57, 241.82, 44] },
      { name: 'score', box: [215, 595, 150, 60] },
      { name: 'character', box: [144.43, 213, 265, 370] },
      { name: 'stars', box: [154.12, 672.19, 197, 42] },
    ],
  },
];

function designPoint(vp, x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
    scale,
  };
}

function maeRegion(a, b, left, top, width, height) {
  let sum = 0;
  let n = 0;
  let over = 0;
  let px = 0;
  const x1 = Math.min(1440, Math.ceil(left + width));
  const y1 = Math.min(810, Math.ceil(top + height));
  for (let y = Math.max(0, Math.floor(top)); y < y1; y += 2) {
    for (let x = Math.max(0, Math.floor(left)); x < x1; x += 2) {
      const i = (y * 1440 + x) * 4;
      let pd = 0;
      for (let c = 0; c < 3; c += 1) {
        const d = Math.abs(a.data[i + c] - b.data[i + c]);
        sum += d;
        pd += d;
        n += 1;
      }
      px += 1;
      if (pd / 3 > 40) over += 1;
    }
  }
  return { mae: n ? +(sum / n).toFixed(2) : 999, over40: px ? +(over / px).toFixed(3) : 1 };
}

function scaleToDesign(src) {
  if (src.width === 1440 && src.height === 810) return src;
  const scaled = new PNG({ width: 1440, height: 810 });
  for (let y = 0; y < 810; y += 1) {
    for (let x = 0; x < 1440; x += 1) {
      const sx = Math.min(src.width - 1, Math.floor(x * src.width / 1440));
      const sy = Math.min(src.height - 1, Math.floor(y * src.height / 810));
      const si = (sy * src.width + sx) * 4;
      const di = (y * 1440 + x) * 4;
      scaled.data[di] = src.data[si];
      scaled.data[di + 1] = src.data[si + 1];
      scaled.data[di + 2] = src.data[si + 2];
      scaled.data[di + 3] = 255;
    }
  }
  return scaled;
}

async function cropCanvasToDesign(page) {
  const buf = await page.screenshot({ type: 'png' });
  const png = PNG.sync.read(buf);
  const box = await page.evaluate(() => {
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    if (!canvas) return null;
    const scale = Math.min(canvas.width / 1440, canvas.height / 810);
    return {
      left: canvas.x + (canvas.width - 1440 * scale) / 2,
      top: canvas.y + (canvas.height - 810 * scale) / 2,
      width: 1440 * scale,
      height: 810 * scale,
    };
  });
  if (!box) return scaleToDesign(png);
  const out = new PNG({ width: 1440, height: 810 });
  for (let y = 0; y < 810; y += 1) {
    for (let x = 0; x < 1440; x += 1) {
      const sx = Math.min(png.width - 1, Math.floor(box.left + x * box.width / 1440));
      const sy = Math.min(png.height - 1, Math.floor(box.top + y * box.height / 810));
      const si = (sy * png.width + sx) * 4;
      const di = (y * 1440 + x) * 4;
      out.data[di] = png.data[si];
      out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2];
      out.data[di + 3] = 255;
    }
  }
  return out;
}

async function press(page, vp, x, y) {
  const p = designPoint(vp, x, y);
  if (vp.mobile) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

async function finishWriting(page, vp) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  }).catch(async () => press(page, vp, 720, 430));
  for (let i = 0; i < 5; i += 1) {
    await press(page, vp, 360, 600);
    await page.waitForFunction(
      () => document.body.dataset.actionReady === 'true'
        || document.body.dataset.answerCorrect !== undefined,
      null,
      { timeout: 12000 },
    ).catch(() => {});
    if (await page.evaluate(() => document.body.dataset.actionReady === 'true')) {
      for (let s = 0; s < 3; s += 1) {
        await press(page, vp, 360, 600);
        await page.waitForTimeout(500);
      }
    }
    await page.waitForTimeout(1400);
  }
  await page.waitForFunction(() => (
    document.body.dataset.gameView === 'stage-result'
    || document.body.dataset.gameView === 'result'
  ), null, { timeout: 25000 });
}

async function finishReading(page, vp) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  }).catch(async () => press(page, vp, 720, 430));
  for (let i = 0; i < 5; i += 1) {
    await press(page, vp, 337, 405);
    await page.waitForTimeout(2200);
  }
  await page.waitForFunction(() => (
    document.body.dataset.gameView === 'stage-result'
    || document.body.dataset.gameView === 'result'
  ), null, { timeout: 25000 });
}

await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const vp = { width: 1440, height: 810, mobile: false };
const page = await (await browser.newContext({ viewport: vp })).newPage();
const report = [];

for (const test of cases) {
  const htmlPath = path.join(protoRoot, test.html);
  await page.goto(`file:///${htmlPath.replace(/\\/g, '/')}`, {
    waitUntil: 'domcontentloaded', timeout: 30000,
  });
  await page.waitForFunction(() => document.body.dataset.prototypeReady === 'true', null, {
    timeout: 20000,
  });
  // hide reference overlay / grid
  await page.evaluate(() => {
    document.querySelectorAll('.reference-overlay,.coordinate-grid').forEach((el) => {
      el.style.display = 'none';
    });
  });
  const protoBuf = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: 1440, height: 810 },
  });
  const protoPng = PNG.sync.read(protoBuf);
  await fs.writeFile(path.join(outDir, `${test.scene}-proto.png`), protoBuf);

  await page.goto(test.url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  if (test.game === 'writing') await finishWriting(page, vp);
  else await finishReading(page, vp);
  await page.waitForTimeout(700);

  const runtime = await page.evaluate(() => ({
    view: document.body.dataset.gameView,
    reviewRows: document.body.dataset.reviewRows,
    reviewGap: document.body.dataset.reviewGap,
    reviewTextX: document.body.dataset.reviewTextX,
    motionBox: document.body.dataset.motionBox,
    scoreFont: document.body.dataset.scoreFont,
  }));
  const gamePng = await cropCanvasToDesign(page);
  await fs.writeFile(
    path.join(outDir, `${test.scene}-game.png`),
    PNG.sync.write(gamePng),
  );

  const regionResults = test.regions.map((region) => {
    const [left, top, width, height] = region.box;
    const metrics = maeRegion(protoPng, gamePng, left, top, width, height);
    return { name: region.name, box: region.box, ...metrics };
  });
  // Artwork regions (titles/rows) should be close; text content differs so allow higher MAE.
  const art = regionResults.filter((r) => /Title|Base|Row|character|stars|score/.test(r.name));
  const pass = art.every((r) => (
    r.name.includes('character') || r.name.includes('score') || r.name.includes('Text')
      ? r.mae < 80
      : r.mae < 45
  ));
  const entry = {
    scene: test.scene,
    game: test.game,
    pass,
    runtime,
    regions: regionResults,
  };
  report.push(entry);
  await fetch(ingest, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
    body: JSON.stringify({
      sessionId: 'ffb02e',
      runId: 'pixel-audit',
      hypothesisId: test.game === 'writing' ? 'H1' : 'H2',
      location: 'verify-pixel-settlement.mjs',
      message: `${test.scene} settlement MAE`,
      data: entry,
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  console.log(JSON.stringify(entry, null, 2));
}

const allPass = report.every((r) => r.pass);
await fs.writeFile(
  path.join(outDir, 'EVIDENCE.json'),
  `${JSON.stringify({ pass: allPass, report }, null, 2)}\n`,
);
await browser.close();
process.exit(allPass ? 0 : 1);
