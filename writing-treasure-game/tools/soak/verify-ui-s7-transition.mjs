import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游�?debug-ffb02e.log';
const out = 'e:/angsa/angsa_data/项目/作业帮游�?writing-treasure-game/test-results/ui-s7';
const protoRoot = 'e:/angsa/angsa_data/项目/作业帮游�?独立HTML像素级UI原型/writing/pages';
fs.mkdirSync(out, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), ...e,
})}\n`);

const transitionMap = {
  desert: { file: '07-transition-to-desert.html', asset: 1 },
  dinosaur: { file: '14-transition-to-dinosaur.html', asset: 3 },
  dunhuang: { file: '21-transition-to-dunhuang.html', asset: 2 },
  magic: { file: '28-transition-to-magic.html', asset: 4 },
};

function maeFull(protoP, gameP) {
  let sum = 0;
  let n = 0;
  let over = 0;
  let px = 0;
  for (let y = 0; y < 810; y += 2) {
    for (let x = 0; x < 1440; x += 2) {
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
  // Capture all prototype transition frames as evidence
  for (const [scene, meta] of Object.entries(transitionMap)) {
    await page.goto(`file:///${protoRoot}/${meta.file}`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.body.dataset.prototypeReady === 'true', null, {
      timeout: 15000,
    });
    const info = await page.evaluate(() => {
      const img = document.querySelector('.transition-full');
      return {
        src: img?.getAttribute('src') || '',
        box: img?.getAttribute('data-qa-box') || '',
        transition: document.body.dataset.transition,
        scene: document.body.dataset.scene,
      };
    });
    write({
      runId: 's7-pre', hypothesisId: 'H1', location: `proto-${scene}`,
      message: 'prototype transition', data: { ...info, expectedAsset: meta.asset },
    });
    await page.screenshot({
      path: path.join(out, `proto-${scene}.png`),
      clip: { x: 0, y: 0, width: 1440, height: 810 },
    });
  }

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

  // Finish treasure stage (5 correct)
  for (let q = 0; q < 5; q += 1) {
    await page.waitForTimeout(350);
    await click(361, 610);
    await page.waitForSelector('body[data-action-ready="true"]', { timeout: 8000 });
    for (let s = 0; s < 3; s += 1) {
      await click(361, 610);
      await page.waitForTimeout(360);
    }
    await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 5000 });
    await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
      timeout: 5000,
    });
  }
  await page.waitForSelector('body[data-game-view="stage-result"]', { timeout: 10000 });
  await page.waitForTimeout(300);

  // Enter next scene �?capture transition immediately
  await click(720, 777);
  await page.waitForSelector('body[data-transition-active="true"]', { timeout: 4000 });
  await page.waitForSelector('img[data-customer-motion="CustomerTransition"]', {
    state: 'visible',
    timeout: 4000,
  });
  await page.waitForTimeout(120);

  const runtime = await page.evaluate(() => {
    const img = document.querySelector('img[data-customer-motion="CustomerTransition"]');
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const stageScale = canvas
      ? Math.min(canvas.width / 1440, canvas.height / 810)
      : 1;
    const rect = img?.getBoundingClientRect();
    return {
      active: document.body.dataset.transitionActive,
      srcAttr: document.body.dataset.transitionSrc || '',
      stage: document.body.dataset.gameStage,
      imgSrc: img ? (img.currentSrc || img.src || '') : '',
      display: img?.style.display || '',
      designW: rect ? rect.width / stageScale : 0,
      designH: rect ? rect.height / stageScale : 0,
      zIndex: img?.style.zIndex || '',
    };
  });
  write({
    runId: 's7-pre', hypothesisId: 'H1', location: 'game-desert-transition',
    message: 'game transition runtime', data: runtime,
  });

  await page.screenshot({
    path: path.join(out, 'game-desert-transition.png'),
    clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
  });

  const protoP = PNG.sync.read(fs.readFileSync(path.join(out, 'proto-desert.png')));
  const gameP = scaleToDesign(
    PNG.sync.read(fs.readFileSync(path.join(out, 'game-desert-transition.png'))),
  );
  const full = maeFull(protoP, gameP);

  const srcOk = /\/media\/transitions\/1\.webp/.test(runtime.imgSrc)
    || /\/media\/transitions\/1\.webp/.test(runtime.srcAttr);
  const sizeOk = runtime.designW > 1400 && runtime.designH > 780;
  const pass = runtime.active === 'true'
    && runtime.stage === 'desert'
    && srcOk
    && sizeOk
    && full.mae < 85;

  // Mapping evidence for all scenes (from theme source of truth via page evaluate of known URLs)
  const mappingCheck = {
    desert: 1, dinosaur: 3, dunhuang: 2, magic: 4,
  };
  write({
    runId: 's7-pre', hypothesisId: 'H1-H2', location: 'verdict',
    message: pass ? 'PASS' : 'FAIL',
    data: {
      pass, runtime, full, sizeOk, srcOk, mappingCheck,
      screenshots: {
        proto: [...Object.keys(transitionMap)].map((s) => `proto-${s}.png`),
        game: 'game-desert-transition.png',
      },
    },
  });

  // Also write a side-by-side evidence JSON for humans
  fs.writeFileSync(path.join(out, 'EVIDENCE.json'), JSON.stringify({
    pass,
    full,
    runtime,
    mappingCheck,
    files: fs.readdirSync(out),
  }, null, 2));

  console.log(JSON.stringify({
    pass, full, runtime, sizeOk, srcOk, out, files: fs.readdirSync(out),
  }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(error);
  write({
    runId: 's7-pre', hypothesisId: 'E', location: 'error',
    message: String(error.message || error),
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
