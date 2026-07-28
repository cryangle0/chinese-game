/**
 * Verify food stem stays inside biscuit face (not over chocolate bars).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'food-stem-pad');
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = 'http://127.0.0.1:43953';
const stem = '下列哪一项不符合《打火匣》的故事结局？';

async function waitHealth(ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server down');
}

/** Rightmost outlined white glyph X in board band; chocolate bars are dark. */
function textRightEdge(pngPath) {
  const png = PNG.sync.read(fs.readFileSync(pngPath));
  // Board roughly x 290–1150, y 90–250 in 1440×810 shot
  let maxX = -1;
  let minX = 9999;
  for (let y = 110; y < 230; y += 1) {
    for (let x = 300; x < 1140; x += 1) {
      const i = (y * png.width + x) * 4;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      if (!(r > 235 && g > 235 && b > 235)) continue;
      let outline = false;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const j = ((y + dy) * png.width + (x + dx)) * 4;
        if (png.data[j] < 100 && png.data[j + 1] < 90 && png.data[j + 2] < 80) {
          outline = true;
          break;
        }
      }
      if (outline) {
        maxX = Math.max(maxX, x);
        minX = Math.min(minX, x);
      }
    }
  }
  return { minX, maxX };
}

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: '43953',
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
    pack.version = `food-pad-${Date.now()}`;
    pack.questions = [{
      ...pack.questions[0],
      id: 'FOOD_PAD',
      packId: pack.version,
      games: ['reading-jumper'],
      scenes: ['food'],
      grade: 'ALL',
      term: 'ALL',
      knowledgePoint: '安徒生童话',
      stem,
      options: ['士兵做了国王', '三条狗成了贵宾', '巫婆拿到了打火匣'],
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
  await page.goto(`${base}/index.html?skipIntro=1&scene=food&book=${encodeURIComponent('安徒生童话')}`, {
    waitUntil: 'domcontentloaded', timeout: 90000,
  });
  await page.waitForFunction(() => document.body?.dataset?.questionStem, { timeout: 60000 });
  await page.waitForTimeout(900);
  const meta = await page.evaluate(() => ({
    padX: document.body.dataset.questionPadX,
    labelW: document.body.dataset.questionLabelW,
    stem: document.body.dataset.questionStem,
    wrapped: document.body.dataset.questionWrapped,
  }));
  const shot = path.join(outDir, 'food-stem.png');
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

  const edges = textRightEdge(shot);
  // Biscuit face ends ~ before chocolate: board center 720, half 430, face half ~(430-172)=258 → right ~978
  const faceRightSafe = 720 + (860 / 2 - Number(meta.padX)) - 8;
  const report = { meta, edges, faceRightSafe };
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));

  if (Number(meta.padX) < 168) {
    throw new Error(`food padX too small: ${meta.padX}`);
  }
  if (edges.maxX > faceRightSafe + 12) {
    throw new Error(`stem text exceeds face: maxX=${edges.maxX} safe=${faceRightSafe}`);
  }
  console.log('FOOD_STEM_PAD_OK', shot);
} finally {
  if (server?.pid) try { process.kill(server.pid); } catch { /* */ }
}
