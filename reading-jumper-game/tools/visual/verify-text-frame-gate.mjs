/**
 * Visual gate: reading stem/options stay inside chrome; writing A/B/C frame+text present.
 * Screenshots → test-results/text-frame-gate/
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outRoot = path.resolve(import.meta.dirname, '../../test-results/text-frame-gate');

function designPoint(vp, x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
    scale,
  };
}

async function waitHealth(url, ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(`${url}/health`)).ok) return; } catch { /* */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`server down: ${url}`);
}

function startServer(cwd, port, publicRoot, mediaRoot) {
  return spawn(process.execPath, ['server/index.mjs'], {
    cwd,
    env: {
      ...process.env,
      PORT: String(port),
      PUBLIC_ROOT: publicRoot,
      MEDIA_ROOT: mediaRoot,
    },
    stdio: 'ignore',
    windowsHide: true,
  });
}

function variance(png, x0, y0, x1, y1) {
  let n = 0;
  let sum = 0;
  let sum2 = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * png.width + x) * 4;
      const v = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      sum += v;
      sum2 += v * v;
      n += 1;
    }
  }
  const mean = sum / n;
  return sum2 / n - mean * mean;
}

function darkInkRatio(png, x0, y0, x1, y1) {
  let dark = 0;
  let n = 0;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = (y * png.width + x) * 4;
      const v = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      if (v < 110) dark += 1;
      n += 1;
    }
  }
  return dark / n;
}

async function shotPlay(page, vp, file) {
  const box = await page.locator('#GameCanvas').boundingBox();
  if (!box) throw new Error('no canvas');
  const scale = Math.min(box.width / 1440, box.height / 810);
  const clip = {
    x: box.x + (box.width - 1440 * scale) / 2,
    y: box.y + (box.height - 1440 * scale) / 2,
    width: 1440 * scale,
    height: 810 * scale,
  };
  // fix height calc
  clip.y = box.y + (box.height - 810 * scale) / 2;
  clip.height = 810 * scale;
  await page.screenshot({ path: file, clip });
  return PNG.sync.read(fs.readFileSync(file));
}

const failures = [];
const report = { reading: [], writing: [] };
fs.mkdirSync(outRoot, { recursive: true });

const readingRoot = path.resolve(import.meta.dirname, '../..');
const writingRoot = path.resolve(readingRoot, '../writing-treasure-game');

const readingServer = startServer(
  readingRoot, 43941,
  path.join(readingRoot, 'build', 'web-mobile'),
  path.join(readingRoot, 'product-media'),
);
const writingServer = startServer(
  writingRoot, 43942,
  path.join(writingRoot, 'build', 'web-mobile'),
  path.join(writingRoot, 'customer-media'),
);

try {
  await waitHealth('http://127.0.0.1:43941');
  await waitHealth('http://127.0.0.1:43942');
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ],
  });
  const vp = { width: 1440, height: 810 };

  // --- Reading: long stem + long options on every scene ---
  const readingScenes = ['mario', 'deep-sea', 'space', 'food', 'poetry'];
  const longStem = '《张衡的天平》中，阎罗王为什么拆掉了天平？这是一道很长的阅读理解题干用来检查边距。';
  const longOpts = ['暴露自己不是好官长', '觉得天平不够实用', '天平已经彻底坏了'];

  for (const scene of readingScenes) {
    const page = await browser.newPage({ viewport: vp });
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch { /* */ }
    });
    await page.route('**/question-bank.json', async (route) => {
      const pack = await (await route.fetch()).json();
      pack.version = `gate-reading-${scene}-${Date.now()}`;
      pack.questions = [{
        ...pack.questions[0],
        id: `GATE_${scene}`,
        packId: pack.version,
        games: ['reading-jumper'],
        scenes: [scene],
        grade: 'ALL',
        term: 'ALL',
        knowledgePoint: '安徒生童话',
        stem: longStem,
        options: longOpts,
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
    await page.goto(
      `http://127.0.0.1:43941/index.html?skipIntro=1&scene=${scene}&book=${encodeURIComponent('安徒生童话')}`,
      { waitUntil: 'domcontentloaded', timeout: 90000 },
    );
    await page.waitForFunction(() => document.body?.dataset?.questionStem, { timeout: 60000 });
    await page.waitForTimeout(1200);
    const file = path.join(outRoot, `reading-${scene}.png`);
    const png = await shotPlay(page, vp, file);
    // Upscale/downscale not needed — clip is design letterbox; resize to 1440 for ROI
    const scaled = new PNG({ width: 1440, height: 810 });
    for (let y = 0; y < 810; y += 1) {
      for (let x = 0; x < 1440; x += 1) {
        const sx = Math.min(png.width - 1, Math.floor(x * png.width / 1440));
        const sy = Math.min(png.height - 1, Math.floor(y * png.height / 810));
        const si = (sy * png.width + sx) * 4;
        const di = (y * 1440 + x) * 4;
        scaled.data[di] = png.data[si];
        scaled.data[di + 1] = png.data[si + 1];
        scaled.data[di + 2] = png.data[si + 2];
        scaled.data[di + 3] = 255;
      }
    }
    fs.writeFileSync(file, PNG.sync.write(scaled));

    const padX = Number(await page.evaluate(() => document.body.dataset.optionPadX || '0'));
    const labels = await page.evaluate(() => document.body.dataset.optionLabels || '');
    // Stem ROI (center board face, avoid chrome)
    const stemInk = darkInkRatio(scaled, 420, 95, 1020, 250);
    // Option A center face (avoid side chrome)
    const optA = darkInkRatio(scaled, 280, 360, 460, 430);
    const row = {
      scene, padX, labels, stemInk, optA, file: path.basename(file),
    };
    report.reading.push(row);
    if (scene === 'space' && padX < 94) {
      failures.push(`space padX ${padX} < 94`);
    }
    if (!labels.includes('暴露') && !labels.includes('天平')) {
      failures.push(`reading ${scene} long options not applied: ${labels}`);
    }
    if (stemInk < 0.01) failures.push(`reading ${scene} stem looks empty`);
    if (optA < 0.008) failures.push(`reading ${scene} option A looks empty`);
    await page.close();
  }

  // --- Writing: force the two user-reported questions ---
  const writingCases = [
    {
      scene: 'dunhuang',
      id: 'CB0716_WT_L5_5060EE90F998',
      stem: '“那国王无地自容……”写出了比丘国国王什么样的状态？',
      options: ['内心充满羞愧', '感到沾沾自喜', '心情十分低落'],
      // choice-a stone ROI (design px)
      frameRoi: [226, 472, 496, 540],
      textRoi: [260, 480, 460, 532],
    },
    {
      scene: 'dinosaur',
      id: 'CB0716_WT_L5_3CA80A78AAE8',
      stem: '“水伯道：……常言道覆水难收。”此处引用俗语，有何表达效果？',
      options: ['增强说服力', '表现人物高兴', '让句子更长'],
      frameRoi: [226, 472, 496, 540],
      textRoi: [260, 480, 460, 532],
    },
  ];

  for (const c of writingCases) {
    const page = await browser.newPage({ viewport: vp });
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch { /* */ }
    });
    await page.route('**/question-bank.json', async (route) => {
      const pack = await (await route.fetch()).json();
      pack.version = `gate-writing-${c.scene}-${Date.now()}`;
      const hit = pack.questions.find((q) => q.id === c.id) ?? pack.questions[0];
      pack.questions = [{
        ...hit,
        id: c.id,
        packId: pack.version,
        games: ['writing-treasure'],
        scenes: [c.scene],
        grade: 'ALL',
        term: 'ALL',
        stem: c.stem,
        options: c.options,
        correctIndex: 0,
        enabled: true,
        weight: 100,
        knowledgePoint: '西游记',
      }];
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pack),
      });
    });
    await page.goto(
      `http://127.0.0.1:43942/index.html?skipIntro=1&scene=${c.scene}&book=${encodeURIComponent('西游记')}`,
      { waitUntil: 'domcontentloaded', timeout: 90000 },
    );
    await page.waitForFunction(() => document.body?.dataset?.questionStem, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const file = path.join(outRoot, `writing-${c.scene}.png`);
    const png = await shotPlay(page, vp, file);
    const scaled = new PNG({ width: 1440, height: 810 });
    for (let y = 0; y < 810; y += 1) {
      for (let x = 0; x < 1440; x += 1) {
        const sx = Math.min(png.width - 1, Math.floor(x * png.width / 1440));
        const sy = Math.min(png.height - 1, Math.floor(y * png.height / 810));
        const si = (sy * png.width + sx) * 4;
        const di = (y * 1440 + x) * 4;
        scaled.data[di] = png.data[si];
        scaled.data[di + 1] = png.data[si + 1];
        scaled.data[di + 2] = png.data[si + 2];
        scaled.data[di + 3] = 255;
      }
    }
    fs.writeFileSync(file, PNG.sync.write(scaled));

    const labels = await page.evaluate(() => document.body.dataset.optionLabels || '');
    const [fx0, fy0, fx1, fy1] = c.frameRoi;
    const [tx0, ty0, tx1, ty1] = c.textRoi;
    const frameVar = variance(scaled, fx0, fy0, fx1, fy1);
    const textDark = darkInkRatio(scaled, tx0, ty0, tx1, ty1);
    const row = {
      scene: c.scene, labels, frameVar, textDark, file: path.basename(file),
    };
    report.writing.push(row);
    if (!labels.includes('A、') || labels.split('|')[0]?.length < 4) {
      failures.push(`writing ${c.scene} option A label missing: ${labels}`);
    }
    // Stone texture / rounded panel has variance; empty dirt hole is flatter.
    if (frameVar < 80) failures.push(`writing ${c.scene} option A frame variance too low (${frameVar.toFixed(1)})`);
    if (textDark < 0.01) failures.push(`writing ${c.scene} option A text too light (${textDark.toFixed(4)})`);
    await page.close();
  }

  await browser.close();
  fs.writeFileSync(path.join(outRoot, 'report.json'), JSON.stringify({ failures, report }, null, 2));
  console.log(JSON.stringify({ failures, report }, null, 2));
  if (failures.length) {
    console.error('TEXT_FRAME_GATE_FAIL');
    process.exit(1);
  }
  console.log('TEXT_FRAME_GATE_OK');
} finally {
  for (const s of [readingServer, writingServer]) {
    if (s?.pid) try { process.kill(s.pid); } catch { /* */ }
  }
}
