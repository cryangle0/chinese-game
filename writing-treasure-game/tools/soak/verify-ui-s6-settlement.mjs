import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游�?debug-ffb02e.log';
const out = 'e:/angsa/angsa_data/项目/作业帮游�?writing-treasure-game/test-results/ui-s6';
fs.mkdirSync(out, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), ...e,
})}\n`);

function maeRegion(protoP, gameP, left, top, width, height) {
  let sum = 0;
  let n = 0;
  let over = 0;
  let px = 0;
  for (let y = Math.max(0, top); y < Math.min(810, top + height); y += 1) {
    for (let x = Math.max(0, left); x < Math.min(1440, left + width); x += 1) {
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
  return { mae: n ? sum / n : 999, over40: px ? over / px : 1 };
}

function scaleToDesign(gameP) {
  if (gameP.width === 1440 && gameP.height === 810) return gameP;
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
  return scaled;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
const page = await context.newPage();

try {
  const proto = 'e:/angsa/angsa_data/项目/作业帮游�?独立HTML像素级UI原型/writing/pages/06-treasure-settlement.html';
  await page.goto(`file:///${proto}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.prototypeReady === 'true', null, {
    timeout: 15000,
  });
  await page.screenshot({
    path: path.join(out, 'proto-settlement.png'),
    clip: { x: 0, y: 0, width: 1440, height: 810 },
  });

  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({ ...question, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });

  await page.goto('http://127.0.0.1:43886/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  const ox = box.x + (box.width - 1440 * scale) / 2;
  const oy = box.y + (box.height - 810 * scale) / 2;
  const click = async (dx, dy) => page.mouse.click(ox + dx * scale, oy + dy * scale);

  for (const [dx, dy] of [[937.5, 466], [980, 550], [720, 520]]) {
    await click(dx, dy);
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 20000,
  });

  for (let q = 0; q < 5; q += 1) {
    await page.waitForTimeout(400);
    await click(361, 610); // choice A
    await page.waitForSelector('body[data-action-ready="true"]', { timeout: 8000 });
    for (let s = 0; s < 3; s += 1) {
      await click(361, 610);
      await page.waitForTimeout(380);
    }
    await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 5000 });
    await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
      timeout: 5000,
    });
  }

  await page.waitForSelector('body[data-game-view="stage-result"]', { timeout: 10000 });
  await page.waitForTimeout(500);

  const runtime = await page.evaluate(() => {
    const motion = document.querySelector('img[data-customer-motion="ResultCharacterMotion"]');
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const stageScale = canvas
      ? Math.min(canvas.width / 1440, canvas.height / 810)
      : 1;
    const left = canvas ? canvas.x + (canvas.width - 1440 * stageScale) / 2 : 0;
    const top = canvas ? canvas.y + (canvas.height - 810 * stageScale) / 2 : 0;
    const rect = motion?.getBoundingClientRect();
    return {
      view: document.body.dataset.gameView,
      stage: document.body.dataset.stageResult,
      score: document.body.dataset.stageScore,
      character: motion && rect ? {
        designW: rect.width / stageScale,
        designH: rect.height / stageScale,
        designLeft: (rect.left - left) / stageScale,
        designTop: (rect.top - top) / stageScale,
      } : null,
    };
  });
  write({
    runId: 's6-pre', hypothesisId: 'H1', location: 'game-settlement',
    message: 'settlement runtime', data: runtime,
  });

  await page.screenshot({
    path: path.join(out, 'game-settlement.png'),
    clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
  });

  const protoP = PNG.sync.read(fs.readFileSync(path.join(out, 'proto-settlement.png')));
  const gameP = scaleToDesign(PNG.sync.read(fs.readFileSync(path.join(out, 'game-settlement.png'))));
  const rankTitle = maeRegion(protoP, gameP, 525, 221, 263, 78);
  const rankBase = maeRegion(protoP, gameP, 480, 304, 338, 335);
  const scorePanel = maeRegion(protoP, gameP, 111, 656, 236, 55);
  const character = maeRegion(protoP, gameP, 0, 120, 420, 600);

  const sizeOk = runtime.character
    && runtime.character.designW > 470
    && runtime.character.designH > 630;
  const pass = runtime.view === 'stage-result'
    && runtime.stage === 'treasure'
    && sizeOk
    && rankTitle.mae < 80
    && rankBase.mae < 70;

  write({
    runId: 's6-pre', hypothesisId: 'H1-H3', location: 'verdict',
    message: pass ? 'PASS' : 'FAIL',
    data: { pass, runtime, rankTitle, rankBase, scorePanel, character, sizeOk },
  });
  console.log(JSON.stringify({
    pass, runtime, rankTitle, rankBase, scorePanel, character, sizeOk,
  }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(error);
  write({
    runId: 's6-pre', hypothesisId: 'E', location: 'error',
    message: String(error.message || error),
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
