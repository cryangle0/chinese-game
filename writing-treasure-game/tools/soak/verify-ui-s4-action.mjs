import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const out = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/test-results/ui-s4';
fs.mkdirSync(out, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), ...e,
})}\n`);

function maeRegion(protoP, gameP, left, top, width, height) {
  let sum = 0;
  let n = 0;
  let over = 0;
  let px = 0;
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
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
  return { mae: sum / n, over40: over / px };
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
  const proto = 'e:/angsa/angsa_data/项目/作业帮游戏/独立HTML像素级UI原型/writing/pages/03-treasure-action.html';
  await page.goto(`file:///${proto}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.prototypeReady === 'true', null, {
    timeout: 15000,
  });
  const protoMotion = await page.evaluate(() => {
    const el = document.querySelector('.character-motion');
    const s = el?.style;
    return {
      left: parseFloat(s?.left || '0'),
      top: parseFloat(s?.top || '0'),
      width: parseFloat(s?.width || '0'),
      height: parseFloat(s?.height || '0'),
      muted: [...document.querySelectorAll('.writing-choice')].map((n) => ({
        muted: n.classList.contains('is-muted'),
        selected: n.classList.contains('is-selected'),
      })),
    };
  });
  write({
    runId: 's4-pre', hypothesisId: 'H1', location: 'proto',
    message: 'prototype action layout', data: protoMotion,
  });
  await page.screenshot({
    path: path.join(out, 'proto-action.png'),
    clip: { x: 0, y: 0, width: 1440, height: 810 },
  });

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
  await page.waitForTimeout(600);

  // Click choice B (index 1) — chest center ~ (712, 610)
  await click(712, 610);
  await page.waitForSelector('body[data-action-ready="true"]', { timeout: 8000 });
  await page.waitForTimeout(450);

  const runtime = await page.evaluate(() => {
    const motion = document.querySelector('img[data-customer-motion="WizardDeer"]');
    const rect = motion?.getBoundingClientRect();
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const stageScale = canvas
      ? Math.min(canvas.width / 1440, canvas.height / 810)
      : 1;
    const ox = canvas ? canvas.x + (canvas.width - 1440 * stageScale) / 2 : 0;
    const oy = canvas ? canvas.y + (canvas.height - 810 * stageScale) / 2 : 0;
    return {
      actionReady: document.body.dataset.actionReady,
      motion: motion ? {
        display: motion.style.display,
        cssW: parseFloat(motion.style.width || '0'),
        cssH: parseFloat(motion.style.height || '0'),
        designW: rect && stageScale ? rect.width / stageScale : null,
        designH: rect && stageScale ? rect.height / stageScale : null,
        designLeft: rect && stageScale ? (rect.left - ox) / stageScale : null,
        designTop: rect && stageScale ? (rect.top - oy) / stageScale : null,
        src: (motion.currentSrc || motion.src || '').slice(-40),
      } : null,
    };
  });
  write({
    runId: 's4-pre', hypothesisId: 'H1', location: 'game-action',
    message: 'game action deer DOM', data: runtime,
  });

  await page.screenshot({
    path: path.join(out, 'game-action.png'),
    clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
  });

  const protoP = PNG.sync.read(fs.readFileSync(path.join(out, 'proto-action.png')));
  const gameP = scaleToDesign(PNG.sync.read(fs.readFileSync(path.join(out, 'game-action.png'))));

  // Character motion box from prototype keyframe
  const deer = maeRegion(protoP, gameP, 480, 0, 480, 620);
  // Muted left choice
  const mutedA = maeRegion(protoP, gameP, 226, 472, 270, 285);
  // Selected center choice
  const selectedB = maeRegion(protoP, gameP, 577, 472, 270, 285);

  const sizeOk = runtime.motion
    && runtime.motion.designW > 400
    && runtime.motion.designH > 580;
  const pass = runtime.actionReady === 'true'
    && sizeOk
    && deer.mae < 95;

  write({
    runId: 's4-pre', hypothesisId: 'H1-H5', location: 'verdict',
    message: pass ? 'PASS' : 'FAIL',
    data: {
      actionReady: runtime.actionReady,
      sizeOk,
      motion: runtime.motion,
      deer,
      mutedA,
      selectedB,
      protoTarget: { w: 462, h: 639.69, left: 487.4, top: -19.95 },
    },
  });
  console.log(JSON.stringify({
    pass, actionReady: runtime.actionReady, sizeOk, motion: runtime.motion, deer, mutedA, selectedB,
  }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(error);
  write({
    runId: 's4-pre', hypothesisId: 'E', location: 'error',
    message: String(error.message || error),
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
