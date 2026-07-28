import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const out = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/test-results/ui-s2';
fs.mkdirSync(out, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), ...e,
})}\n`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH, headless: true,
});
const page = await (await browser.newContext({
  viewport: { width: 1440, height: 810 },
})).newPage();

try {
  const proto = 'e:/angsa/angsa_data/项目/作业帮游戏/独立HTML像素级UI原型/writing/pages/00-intro.html';
  await page.goto(`file:///${proto}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.prototypeReady === 'true', null, {
    timeout: 15000,
  });
  await page.screenshot({
    path: path.join(out, 'proto-intro.png'),
    clip: { x: 0, y: 0, width: 1440, height: 810 },
  });

  await page.goto('http://127.0.0.1:43885/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForTimeout(800);
  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  const ox = box.x + (box.width - 1440 * scale) / 2;
  const oy = box.y + (box.height - 810 * scale) / 2;
  await page.screenshot({
    path: path.join(out, 'game-intro.png'),
    clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
  });

  await page.mouse.click(ox + 937.5 * scale, oy + 466 * scale);
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 15000,
  });
  const play = await page.evaluate(() => document.body.dataset.gameView);

  const protoP = PNG.sync.read(fs.readFileSync(path.join(out, 'proto-intro.png')));
  let gameP = PNG.sync.read(fs.readFileSync(path.join(out, 'game-intro.png')));
  if (gameP.width !== 1440 || gameP.height !== 810) {
    const scaled = new PNG({ width: 1440, height: 810 });
    for (let y = 0; y < 810; y += 1) {
      for (let x = 0; x < 1440; x += 1) {
        const sx = Math.min(gameP.width - 1, Math.floor(x * gameP.width / 1440));
        const sy = Math.min(gameP.height - 1, Math.floor(y * gameP.height / 810));
        const si = (sy * gameP.width + sx) * 4;
        const di = (y * 1440 + x) * 4;
        scaled.data[di] = gameP.data[si];
        scaled.data[di + 1] = gameP.data[si + 1];
        scaled.data[di + 2] = gameP.data[si + 2];
        scaled.data[di + 3] = 255;
      }
    }
    gameP = scaled;
  }

  const regions = [
    { n: 'title', x0: 483, y0: 76, x1: 1382, y1: 200 },
    { n: 'start', x0: 720, y0: 406, x1: 1155, y1: 526 },
    { n: 'deer', x0: 104, y0: 112, x1: 442, y1: 300 },
  ];
  const stats = {};
  for (const r of regions) {
    let sum = 0;
    let n = 0;
    let over = 0;
    let px = 0;
    for (let y = r.y0; y < r.y1; y += 1) {
      for (let x = r.x0; x < r.x1; x += 1) {
        const i = (y * 1440 + x) * 4;
        let pd = 0;
        for (let c = 0; c < 3; c += 1) {
          const d = Math.abs(protoP.data[i + c] - gameP.data[i + c]);
          sum += d;
          pd += d;
          n += 1;
        }
        px += 1;
        if (pd / 3 > 40) over += 1;
      }
    }
    stats[r.n] = { mae: sum / n, over40: over / px };
  }

  const pass = play === 'play' && stats.start.mae < 80 && stats.title.mae < 80;
  write({
    runId: 'ui-s2', hypothesisId: 'intro', location: 'verdict',
    message: pass ? 'PASS' : 'FAIL', data: { play, stats },
  });
  console.log(JSON.stringify({ pass, play, stats }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await browser.close();
}
