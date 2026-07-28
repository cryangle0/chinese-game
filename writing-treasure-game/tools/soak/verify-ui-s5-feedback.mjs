import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const out = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/test-results/ui-s5';
fs.mkdirSync(out, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), ...e,
})}\n`);

function maeRegion(protoP, gameP, left, top, width, height) {
  let sum = 0;
  let n = 0;
  let over = 0;
  let px = 0;
  for (let y = top; y < top + height && y < 810; y += 1) {
    for (let x = left; x < left + width && x < 1440; x += 1) {
      if (y < 0 || x < 0) continue;
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

async function captureProto(page, file, htmlPath) {
  await page.goto(`file:///${htmlPath}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.prototypeReady === 'true', null, {
    timeout: 15000,
  });
  await page.screenshot({
    path: path.join(out, file),
    clip: { x: 0, y: 0, width: 1440, height: 810 },
  });
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
const page = await context.newPage();

try {
  const protoCorrect = 'e:/angsa/angsa_data/项目/作业帮游戏/独立HTML像素级UI原型/writing/pages/04-treasure-correct.html';
  await captureProto(page, 'proto-correct.png', protoCorrect);

  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({ ...question, correctIndex: 1 }));
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
    await page.waitForTimeout(350);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 20000,
  });
  await page.waitForTimeout(500);

  // Correct answer B
  await click(712, 610);
  await page.waitForSelector('body[data-action-ready="true"]', { timeout: 8000 });
  // Strike 3 times
  for (let i = 0; i < 3; i += 1) {
    await click(712, 610);
    await page.waitForTimeout(400);
  }
  await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 5000 });
  await page.waitForTimeout(350);

  const runtime = await page.evaluate(() => {
    const layers = [...document.querySelectorAll('img[data-customer-motion^="FeedbackLayer"]')]
      .filter((img) => img.style.display !== 'none')
      .map((img) => {
        const rect = img.getBoundingClientRect();
        const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
        const stageScale = canvas
          ? Math.min(canvas.width / 1440, canvas.height / 810)
          : 1;
        const left = canvas ? canvas.x + (canvas.width - 1440 * stageScale) / 2 : 0;
        const top = canvas ? canvas.y + (canvas.height - 810 * stageScale) / 2 : 0;
        return {
          name: img.dataset.customerMotion,
          designW: rect.width / stageScale,
          designH: rect.height / stageScale,
          designLeft: (rect.left - left) / stageScale,
          designTop: (rect.top - top) / stageScale,
          src: (img.currentSrc || img.src || '').slice(-48),
        };
      });
    return {
      answerCorrect: document.body.dataset.answerCorrect,
      feedbackMode: document.body.dataset.feedbackMode,
      layers,
    };
  });
  write({
    runId: 's5-pre', hypothesisId: 'H1', location: 'game-correct',
    message: 'correct feedback runtime', data: runtime,
  });

  await page.screenshot({
    path: path.join(out, 'game-correct.png'),
    clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
  });

  const protoP = PNG.sync.read(fs.readFileSync(path.join(out, 'proto-correct.png')));
  const gameP = scaleToDesign(PNG.sync.read(fs.readFileSync(path.join(out, 'game-correct.png'))));
  const layer1 = maeRegion(protoP, gameP, 476, 112, 474, 297);
  const layer2 = maeRegion(protoP, gameP, 575, 495, 235, 188);

  const sizeOk = runtime.layers.length >= 2
    && runtime.layers[0].designW > 450
    && runtime.layers[0].designH > 280;
  const pass = runtime.answerCorrect === 'true'
    && runtime.feedbackMode === 'static'
    && sizeOk
    && layer1.mae < 90;

  write({
    runId: 's5-pre', hypothesisId: 'H1-H3', location: 'verdict',
    message: pass ? 'PASS' : 'FAIL',
    data: { pass, runtime, layer1, layer2, sizeOk },
  });
  console.log(JSON.stringify({ pass, runtime, layer1, layer2, sizeOk }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(error);
  write({
    runId: 's5-pre', hypothesisId: 'E', location: 'error',
    message: String(error.message || error),
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
