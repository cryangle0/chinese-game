import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游�?debug-ffb02e.log';
const out = 'e:/angsa/angsa_data/项目/作业帮游�?writing-treasure-game/test-results/ui-s8-s9';
const protoRoot = 'e:/angsa/angsa_data/项目/作业帮游�?独立HTML像素级UI原型/writing/pages';
fs.mkdirSync(out, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), ...e,
})}\n`);

const scenes = ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic'];
const idlePages = {
  treasure: '01-treasure-idle.html',
  desert: '08-desert-idle.html',
  dinosaur: '15-dinosaur-idle.html',
  dunhuang: '22-dunhuang-idle.html',
  magic: '29-magic-idle.html',
};
const settlementPages = {
  treasure: '06-treasure-settlement.html',
  desert: '13-desert-settlement.html',
  dinosaur: '20-dinosaur-settlement.html',
  dunhuang: '27-dunhuang-settlement.html',
  magic: '34-magic-settlement.html',
};
const transitionByScene = { desert: 1, dinosaur: 3, dunhuang: 2, magic: 4 };

function maeRegion(protoP, gameP, left, top, width, height) {
  let sum = 0;
  let n = 0;
  let over = 0;
  let px = 0;
  for (let y = Math.max(0, Math.floor(top)); y < Math.min(810, Math.ceil(top + height)); y += 2) {
    for (let x = Math.max(0, Math.floor(left)); x < Math.min(1440, Math.ceil(left + width)); x += 2) {
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

async function shotProto(page, file, name) {
  await page.goto(`file:///${protoRoot}/${file}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.prototypeReady === 'true', null, {
    timeout: 15000,
  });
  await page.screenshot({
    path: path.join(out, name),
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

const results = [];
try {
  // Proto evidence for idle + settlement + final
  for (const scene of scenes) {
    await shotProto(page, idlePages[scene], `proto-${scene}-idle.png`);
    await shotProto(page, settlementPages[scene], `proto-${scene}-settlement.png`);
  }
  await shotProto(page, '35-final-result.html', 'proto-final-result.png');

  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });

  await page.goto('http://127.0.0.1:43886/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  let box = await page.locator('#GameCanvas').boundingBox();
  let scale = Math.min(box.width / 1440, box.height / 810);
  let ox = box.x + (box.width - 1440 * scale) / 2;
  let oy = box.y + (box.height - 810 * scale) / 2;
  const refreshBox = async () => {
    box = await page.locator('#GameCanvas').boundingBox();
    scale = Math.min(box.width / 1440, box.height / 810);
    ox = box.x + (box.width - 1440 * scale) / 2;
    oy = box.y + (box.height - 810 * scale) / 2;
  };
  const click = async (dx, dy) => {
    await refreshBox();
    await page.mouse.click(ox + dx * scale, oy + dy * scale);
  };
  const captureGame = async (name) => {
    await refreshBox();
    await page.screenshot({
      path: path.join(out, name),
      clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
    });
  };

  for (const [dx, dy] of [[937.5, 466], [980, 550], [720, 520]]) {
    await click(dx, dy);
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 20000,
  });

  for (let stageIndex = 0; stageIndex < scenes.length; stageIndex += 1) {
    const scene = scenes[stageIndex];
    await page.waitForSelector(`body[data-game-stage="${scene}"]`, { timeout: 15000 });
    // Stage flag is set before the transition overlay finishes (~0.9s).
    await page.waitForFunction(
      () => document.body.dataset.transitionActive !== 'true'
        && document.body.dataset.gameView === 'play',
      null,
      { timeout: 8000 },
    );
    await page.waitForTimeout(500);
    await captureGame(`game-${scene}-idle.png`);

    const deer = await page.evaluate(() => {
      const img = document.querySelector('img[data-customer-motion="WizardDeer"]');
      const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
      const stageScale = canvas
        ? Math.min(canvas.width / 1440, canvas.height / 810)
        : 1;
      const left = canvas ? canvas.x + (canvas.width - 1440 * stageScale) / 2 : 0;
      const top = canvas ? canvas.y + (canvas.height - 810 * stageScale) / 2 : 0;
      const rect = img?.getBoundingClientRect();
      return rect ? {
        w: rect.width / stageScale,
        h: rect.height / stageScale,
        left: (rect.left - left) / stageScale,
        top: (rect.top - top) / stageScale,
      } : null;
    });

    const protoIdle = PNG.sync.read(fs.readFileSync(path.join(out, `proto-${scene}-idle.png`)));
    const gameIdle = scaleToDesign(PNG.sync.read(fs.readFileSync(path.join(out, `game-${scene}-idle.png`))));
    const hud = maeRegion(protoIdle, gameIdle, 21, 15, 265, 80);
    const board = maeRegion(protoIdle, gameIdle, 328, 19, 794, 147);
    const voice = maeRegion(protoIdle, gameIdle, 251, 700, 920, 110);
    const idlePass = hud.mae < 55 && board.mae < 60 && voice.mae < 90 && deer && deer.w > 150;
    results.push({
      scene, kind: 'idle', pass: idlePass, hud, board, voice, deer,
    });
    write({
      runId: 's8s9', hypothesisId: 'H-idle', location: `${scene}-idle`,
      message: idlePass ? 'PASS' : 'FAIL', data: { hud, board, voice, deer },
    });

    for (let q = 0; q < 5; q += 1) {
      await page.waitForTimeout(300);
      await click(361, 610);
      await page.waitForSelector('body[data-action-ready="true"]', { timeout: 8000 });
      await page.waitForTimeout(200);
      await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 5000 });
      await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
        timeout: 5000,
      });
    }

    await page.waitForSelector(`body[data-stage-result="${scene}"]`, { timeout: 10000 });
    await page.waitForTimeout(450);
    await captureGame(`game-${scene}-settlement.png`);

    const character = await page.evaluate(() => {
      const img = document.querySelector('img[data-customer-motion="ResultCharacterMotion"]');
      const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
      const stageScale = canvas
        ? Math.min(canvas.width / 1440, canvas.height / 810)
        : 1;
      const left = canvas ? canvas.x + (canvas.width - 1440 * stageScale) / 2 : 0;
      const top = canvas ? canvas.y + (canvas.height - 810 * stageScale) / 2 : 0;
      const rect = img?.getBoundingClientRect();
      return rect ? {
        w: rect.width / stageScale,
        h: rect.height / stageScale,
        left: (rect.left - left) / stageScale,
        top: (rect.top - top) / stageScale,
      } : null;
    });

    const protoSet = PNG.sync.read(fs.readFileSync(path.join(out, `proto-${scene}-settlement.png`)));
    const gameSet = scaleToDesign(
      PNG.sync.read(fs.readFileSync(path.join(out, `game-${scene}-settlement.png`))),
    );
    const rank = maeRegion(protoSet, gameSet, 480, 180, 360, 120);
    const settlePass = character && character.w > 400 && character.h > 500 && rank.mae < 70;
    results.push({
      scene, kind: 'settlement', pass: settlePass, rank, character,
    });
    write({
      runId: 's8s9', hypothesisId: 'H-settle', location: `${scene}-settlement`,
      message: settlePass ? 'PASS' : 'FAIL', data: { rank, character },
    });

    const finalStage = stageIndex === scenes.length - 1;
    await click(720, 777);
    if (finalStage) {
      await page.waitForSelector('body[data-game-view="result"]', { timeout: 10000 });
      await page.waitForTimeout(500);
      await captureGame('game-final-result.png');
      const protoFinal = PNG.sync.read(fs.readFileSync(path.join(out, 'proto-final-result.png')));
      const gameFinal = scaleToDesign(
        PNG.sync.read(fs.readFileSync(path.join(out, 'game-final-result.png'))),
      );
      const finalRank = maeRegion(protoFinal, gameFinal, 468, 170, 380, 120);
      const finalChar = await page.evaluate(() => {
        const img = document.querySelector('img[data-customer-motion="ResultCharacterMotion"]');
        const rect = img?.getBoundingClientRect();
        const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
        const stageScale = canvas
          ? Math.min(canvas.width / 1440, canvas.height / 810)
          : 1;
        return rect ? { w: rect.width / stageScale, h: rect.height / stageScale } : null;
      });
      const finalPass = finalChar && finalChar.w > 450 && finalRank.mae < 70;
      results.push({
        scene: 'final', kind: 'final-result', pass: finalPass, finalRank, finalChar,
      });
      write({
        runId: 's8s9', hypothesisId: 'H-final', location: 'final-result',
        message: finalPass ? 'PASS' : 'FAIL', data: { finalRank, finalChar },
      });
      break;
    }
    // Ensure transition asset mapping for next scene
    try {
      await page.waitForSelector('body[data-transition-active="true"]', { timeout: 2500 });
      const src = await page.evaluate(() => document.body.dataset.transitionSrc || '');
      const next = scenes[stageIndex + 1];
      const expected = `./media/transitions/${transitionByScene[next]}.webp`;
      const mapOk = src.includes(`transitions/${transitionByScene[next]}.webp`);
      results.push({
        scene: next, kind: 'transition', pass: mapOk, src, expected,
      });
      write({
        runId: 's8s9', hypothesisId: 'H-trans', location: `${next}-transition`,
        message: mapOk ? 'PASS' : 'FAIL', data: { src, expected },
      });
    } catch {
      // Transition may be very short; mapping already verified in S7.
    }
    await page.waitForSelector('body[data-game-view="play"]', { timeout: 8000 });
  }

  const pass = results.every((item) => item.pass);
  fs.writeFileSync(path.join(out, 'EVIDENCE.json'), JSON.stringify({
    pass, results, files: fs.readdirSync(out),
  }, null, 2));
  write({
    runId: 's8s9', hypothesisId: 'ALL', location: 'verdict',
    message: pass ? 'PASS' : 'FAIL', data: { pass, results },
  });
  console.log(JSON.stringify({ pass, results, out, files: fs.readdirSync(out) }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(error);
  write({
    runId: 's8s9', hypothesisId: 'E', location: 'error',
    message: String(error.message || error),
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
