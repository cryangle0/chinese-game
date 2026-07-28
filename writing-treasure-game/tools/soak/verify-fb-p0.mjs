/**
 * P0 delivery verify: writing multi-scene feedback + voice tip; reading book + settlement.
 * Requires screenshot files + runtime asserts.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const outW = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/test-results/fb-p0-writing';
const outR = 'e:/angsa/angsa_data/项目/作业帮游戏/reading-jumper-game/test-results/fb-p0-reading';
fs.mkdirSync(outW, { recursive: true });
fs.mkdirSync(outR, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), runId: 'fb-p0', ...e,
})}\n`);

const results = [];
const push = (id, pass, data = {}) => {
  results.push({ id, pass, ...data });
  write({ hypothesisId: id, message: pass ? 'PASS' : 'FAIL', data });
};

async function makeClick(page) {
  const refresh = async () => {
    const box = await page.locator('#GameCanvas').boundingBox();
    const scale = Math.min(box.width / 1440, box.height / 810);
    return {
      scale,
      ox: box.x + (box.width - 1440 * scale) / 2,
      oy: box.y + (box.height - 810 * scale) / 2,
    };
  };
  return {
    refresh,
    click: async (dx, dy) => {
      const { ox, oy, scale } = await refresh();
      await page.mouse.click(ox + dx * scale, oy + dy * scale);
    },
    shot: async (dir, name) => {
      const { ox, oy, scale } = await refresh();
      const file = path.join(dir, name);
      await page.screenshot({
        path: file,
        clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
      });
      const ok = fs.existsSync(file) && fs.statSync(file).size > 8000;
      return { file: name, ok, bytes: ok ? fs.statSync(file).size : 0 };
    },
  };
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream'],
});

try {
  // ========== WRITING ==========
  {
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    const { click, shot } = await makeClick(page);
    await page.route('**/question-bank.json', async (route) => {
      const response = await route.fetch();
      const pack = await response.json();
      pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
      await route.fulfill({ response, json: pack });
    });
    await page.goto('http://127.0.0.1:43886/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
    for (const [dx, dy] of [[937.5, 466], [980, 550], [720, 520]]) {
      await click(dx, dy);
      await page.waitForTimeout(300);
      if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
    }
    await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
      timeout: 20000,
    });
    await page.waitForTimeout(400);

    // Short press tip
    await click(720, 745);
    await page.waitForTimeout(300);
    const short = await page.evaluate(() => ({
      state: document.body.dataset.speechState,
      short: document.body.dataset.voiceShortPress,
    }));
    const shortShot = await shot(outW, '01-voice-short-press.png');
    push('w-voice-short', short.short === 'true' && short.state === 'no-match' && shortShot.ok, {
      short, shortShot,
    });

    // Treasure correct A — colored chest stays, deer hidden, character layer on
    await click(361, 610);
    await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 6000 });
    await page.waitForTimeout(400);
    const treasureFb = await page.evaluate(() => {
      const deer = document.querySelector('img[data-customer-motion="WizardDeer"]');
      const layers = [...document.querySelectorAll('img[data-customer-motion^="FeedbackLayer"]')]
        .filter((el) => getComputedStyle(el).display !== 'none');
      return {
        deerHidden: !deer || getComputedStyle(deer).display === 'none',
        layerCount: layers.length,
        mode: document.body.dataset.feedbackMode,
      };
    });
    const tShot = await shot(outW, '02-treasure-correct-A-color.png');
    push('w-treasure-correct', treasureFb.deerHidden && treasureFb.layerCount >= 1 && tShot.ok, {
      treasureFb, tShot,
    });
    await page.waitForFunction(() => !document.body.dataset.answerCorrect, null, { timeout: 6000 });

    // Finish treasure stage (4 more)
    for (let i = 0; i < 4; i += 1) {
      await click(361, 610);
      await page.waitForSelector('body[data-answer-correct]', { timeout: 6000 });
      await page.waitForFunction(() => !document.body.dataset.answerCorrect, null, { timeout: 6000 });
    }
    await page.waitForSelector('body[data-stage-result="treasure"]', { timeout: 10000 });
    await page.waitForTimeout(400);
    await click(720, 777);
    try {
      await page.waitForSelector('body[data-transition-active="true"]', { timeout: 4000 });
    } catch { /* ok */ }
    await page.waitForFunction(
      () => document.body.dataset.transitionActive !== 'true'
        && document.body.dataset.gameStage === 'desert'
        && document.body.dataset.gameView === 'play',
      null,
      { timeout: 15000 },
    );
    await page.waitForTimeout(500);

    // Desert correct A
    await click(361, 610);
    await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 6000 });
    await page.waitForTimeout(450);
    const desertFb = await page.evaluate(() => ({
      stage: document.body.dataset.gameStage,
      mode: document.body.dataset.feedbackMode,
      deerHidden: (() => {
        const deer = document.querySelector('img[data-customer-motion="WizardDeer"]');
        return !deer || getComputedStyle(deer).display === 'none';
      })(),
      layers: [...document.querySelectorAll('img[data-customer-motion^="FeedbackLayer"]')]
        .filter((el) => getComputedStyle(el).display !== 'none').length,
    }));
    const dShot = await shot(outW, '03-desert-correct-A.png');
    push('w-desert-correct', desertFb.deerHidden && desertFb.mode === 'static' && dShot.ok, {
      desertFb, dShot,
    });
    await page.waitForFunction(() => !document.body.dataset.answerCorrect, null, { timeout: 6000 });

    // Finish desert
    for (let i = 0; i < 4; i += 1) {
      await click(361, 610);
      await page.waitForSelector('body[data-answer-correct]', { timeout: 6000 });
      await page.waitForFunction(() => !document.body.dataset.answerCorrect, null, { timeout: 6000 });
    }
    await page.waitForSelector('body[data-stage-result="desert"]', { timeout: 10000 });
    await page.waitForTimeout(400);
    await click(720, 777);
    await page.waitForFunction(
      () => document.body.dataset.transitionActive !== 'true'
        && document.body.dataset.gameStage === 'dinosaur',
      null,
      { timeout: 10000 },
    );
    await page.waitForTimeout(500);

    // Dinosaur WRONG on C (correct is A)
    await click(1080, 610);
    await page.waitForSelector('body[data-answer-correct="false"]', { timeout: 6000 });
    await page.waitForTimeout(450);
    const dinoFb = await page.evaluate(() => {
      const layers = [...document.querySelectorAll('img[data-customer-motion^="FeedbackLayer"]')]
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => {
          const r = el.getBoundingClientRect();
          return { name: el.dataset.customerMotion, w: r.width, h: r.height, src: el.currentSrc };
        });
      return {
        stage: document.body.dataset.gameStage,
        correct: document.body.dataset.answerCorrect,
        layers,
        // chase layer should be large (wrong-layer-1)
        hasChase: layers.some((l) => l.w > 300 && l.h > 150),
      };
    });
    const diShot = await shot(outW, '04-dinosaur-wrong-chase.png');
    push('w-dinosaur-wrong-chase', dinoFb.hasChase && diShot.ok, { dinoFb, diShot });
    await page.waitForFunction(() => !document.body.dataset.answerCorrect, null, { timeout: 6000 });

    // Finish dinosaur (4 more correct)
    for (let i = 0; i < 4; i += 1) {
      await click(361, 610);
      await page.waitForSelector('body[data-answer-correct]', { timeout: 6000 });
      await page.waitForFunction(() => !document.body.dataset.answerCorrect, null, { timeout: 6000 });
    }
    await page.waitForSelector('body[data-stage-result="dinosaur"]', { timeout: 10000 });
    await page.waitForTimeout(400);
    await click(720, 777);
    // skip dunhuang quickly? need to go desert->dino->dunhuang->magic. After dino is dunhuang.
    await page.waitForFunction(
      () => document.body.dataset.transitionActive !== 'true'
        && document.body.dataset.gameStage === 'dunhuang',
      null,
      { timeout: 10000 },
    );
    await page.waitForTimeout(400);
    for (let i = 0; i < 5; i += 1) {
      await click(361, 610);
      await page.waitForSelector('body[data-answer-correct]', { timeout: 6000 });
      await page.waitForFunction(() => !document.body.dataset.answerCorrect, null, { timeout: 6000 });
    }
    await page.waitForSelector('body[data-stage-result="dunhuang"]', { timeout: 10000 });
    await page.waitForTimeout(400);
    await click(720, 777);
    await page.waitForFunction(
      () => document.body.dataset.transitionActive !== 'true'
        && document.body.dataset.gameStage === 'magic',
      null,
      { timeout: 10000 },
    );
    await page.waitForTimeout(500);

    // Magic correct
    await click(361, 610);
    await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 6000 });
    await page.waitForTimeout(450);
    const magicFb = await page.evaluate(() => {
      const layers = [...document.querySelectorAll('img[data-customer-motion^="FeedbackLayer"]')]
        .filter((el) => getComputedStyle(el).display !== 'none')
        .map((el) => {
          const r = el.getBoundingClientRect();
          const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
          const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
          return { w: r.width / scale, h: r.height / scale };
        });
      return {
        layers,
        bigChar: layers.some((l) => l.w >= 250 && l.h >= 280),
        deerHidden: (() => {
          const deer = document.querySelector('img[data-customer-motion="WizardDeer"]');
          return !deer || getComputedStyle(deer).display === 'none';
        })(),
      };
    });
    const mShot = await shot(outW, '05-magic-correct-size.png');
    push('w-magic-correct', magicFb.bigChar && magicFb.deerHidden && mShot.ok, {
      magicFb, mShot,
    });

    await page.close();
  }

  // ========== READING ==========
  {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 810 },
      permissions: ['camera'],
    });
    const page = await context.newPage();
    const { click, shot } = await makeClick(page);
    await page.route('**/question-bank.json', async (route) => {
      const response = await route.fetch();
      const pack = await response.json();
      pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
      await route.fulfill({ response, json: pack });
    });
    await page.goto('http://127.0.0.1:43887/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
    await page.waitForTimeout(500);
    const book0 = await page.evaluate(() => document.body.dataset.bookSelect);
    // BookSelect at design (0, 348) → screen y ≈ 405-348 = 57
    await click(720, 57);
    await page.waitForTimeout(250);
    const book1 = await page.evaluate(() => document.body.dataset.bookSelect);
    if (book1 === book0) {
      await click(720, 70);
      await page.waitForTimeout(250);
    }
    const bookFinal = await page.evaluate(() => document.body.dataset.bookSelect);
    const introShot = await shot(outR, '01-book-dropdown.png');
    push('r-book-dropdown', book0 === '西游记' && bookFinal && bookFinal !== book0 && introShot.ok, {
      book0, book1, bookFinal, introShot,
    });

    for (const [dx, dy] of [[720, 365], [720, 430]]) {
      await click(dx, dy);
      await page.waitForTimeout(400);
      if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
    }
    await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
      timeout: 25000,
    });
    for (let q = 0; q < 5; q += 1) {
      await page.waitForTimeout(250);
      await click(337, 405);
      await page.waitForTimeout(1000);
      await page.waitForFunction(() => !document.body.dataset.answerCorrect
        || document.body.dataset.gameView === 'stage-result', null, { timeout: 8000 }).catch(() => {});
    }
    await page.waitForSelector('body[data-game-view="stage-result"]', { timeout: 15000 });
    await page.waitForTimeout(500);
    const settleChar = await page.evaluate(() => {
      const img = document.querySelector('img[data-customer-motion="ResultCharacterMotion"]');
      const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
      const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
      const top0 = canvas ? canvas.y + (canvas.height - 810 * scale) / 2 : 0;
      const r = img?.getBoundingClientRect();
      return r ? {
        w: r.width / scale,
        h: r.height / scale,
        top: (r.top - top0) / scale,
        bottom: (r.bottom - top0) / scale,
        objectPosition: getComputedStyle(img).objectPosition,
      } : null;
    });
    const settleShot = await shot(outR, '02-settlement-deer.png');
    const grounded = settleChar
      && (settleChar.objectPosition.includes('100%') || settleChar.objectPosition.includes('bottom'))
      && settleChar.bottom >= 520
      && settleChar.h >= 350;
    push('r-settlement-deer', Boolean(grounded) && settleShot.ok, { settleChar, settleShot });
    await context.close();
  }

  const pass = results.every((r) => r.pass);
  const evidence = {
    pass,
    results,
    writingFiles: fs.readdirSync(outW),
    readingFiles: fs.readdirSync(outR),
    outW,
    outR,
  };
  fs.writeFileSync(path.join(outW, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  fs.writeFileSync(path.join(outR, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
  write({ hypothesisId: 'ALL', message: pass ? 'PASS' : 'FAIL', data: evidence });
  console.log(JSON.stringify(evidence, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(error);
  write({ hypothesisId: 'E', message: String(error.message || error) });
  process.exitCode = 1;
} finally {
  await browser.close();
}
