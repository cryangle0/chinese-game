/**
 * Customer feedback 0720 — reading screenshot evidence pack.
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const out = 'e:/angsa/angsa_data/项目/作业帮游戏/reading-jumper-game/test-results/fb-0720-reading';
fs.mkdirSync(out, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), runId: 'fb0720-r', ...e,
})}\n`);

const results = [];
const push = (id, pass, data = {}) => {
  results.push({ id, pass, ...data });
  write({ hypothesisId: id, message: pass ? 'PASS' : 'FAIL', data });
};

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  permissions: ['camera'],
});
const page = await context.newPage();

try {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });

  await page.goto('http://127.0.0.1:43887/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });

  const refresh = async () => {
    const box = await page.locator('#GameCanvas').boundingBox();
    const scale = Math.min(box.width / 1440, box.height / 810);
    return {
      scale,
      ox: box.x + (box.width - 1440 * scale) / 2,
      oy: box.y + (box.height - 810 * scale) / 2,
    };
  };
  const click = async (dx, dy) => {
    const { ox, oy, scale } = await refresh();
    await page.mouse.click(ox + dx * scale, oy + dy * scale);
  };
  const shot = async (name) => {
    const { ox, oy, scale } = await refresh();
    const file = path.join(out, name);
    await page.screenshot({
      path: file,
      clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
    });
    const ok = fs.existsSync(file) && fs.statSync(file).size > 8000;
    return { file: name, ok, bytes: ok ? fs.statSync(file).size : 0 };
  };
  const deerMetrics = async () => page.evaluate(() => {
    const img = document.querySelector('img[data-customer-motion="ReadingDeer"]');
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
    const left0 = canvas ? canvas.x + (canvas.width - 1440 * scale) / 2 : 0;
    const top0 = canvas ? canvas.y + (canvas.height - 810 * scale) / 2 : 0;
    const r = img?.getBoundingClientRect();
    if (!r) return null;
    return {
      w: r.width / scale,
      h: r.height / scale,
      left: (r.left - left0) / scale,
      top: (r.top - top0) / scale,
      bottom: (r.bottom - top0) / scale,
      objectPosition: getComputedStyle(img).objectPosition,
    };
  });

  // Intro
  await page.waitForFunction(() => document.body.dataset.gameView === 'intro'
    || document.body.dataset.gameView === 'play', null, { timeout: 20000 });
  await page.waitForTimeout(600);
  const introShot = await shot('01-intro-book-pipe.png');
  // Visual: book select near top — sample MAE of yellow-ish region vs empty is hard;
  // assert screenshot + start game.
  push('intro-shot', introShot.ok, introShot);

  for (const [dx, dy] of [[720, 365], [720, 430], [720, 445]]) {
    await click(dx, dy);
    await page.waitForTimeout(400);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 25000,
  });
  await page.waitForTimeout(700);
  const idleShot = await shot('02-play-deer-idle.png');
  const deer = await deerMetrics();
  // Deer should be larger than old 150x240 and sit lower (bottom closer to option row ~405+)
  const deerSizeOk = deer && deer.w >= 155 && deer.h >= 245;
  const groundedStyle = Boolean(deer?.objectPosition?.includes('bottom')
    || deer?.objectPosition?.includes('100%'));
  // Feet near option band: bottom of deer box should sit in lower half of stage.
  const deerGroundOk = deer && groundedStyle && deer.bottom >= 500 && deer.bottom <= 850;
  push('deer-size', Boolean(deerSizeOk) && idleShot.ok, { deer, idleShot });
  push('deer-grounded', Boolean(deerGroundOk), { deer, groundedStyle });

  // Answer 5 questions by clicking left option
  for (let q = 0; q < 5; q += 1) {
    await page.waitForTimeout(250);
    await click(337, 405);
    await page.waitForTimeout(900);
    // wait feedback clear
    await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined
      || document.body.dataset.gameView === 'stage-result', null, { timeout: 8000 }).catch(() => {});
  }
  await page.waitForSelector('body[data-game-view="stage-result"]', { timeout: 15000 });
  await page.waitForTimeout(500);
  const stageShot = await shot('03-stage-result-cta-share.png');
  const stageMeta = await page.evaluate(() => ({
    view: document.body.dataset.gameView,
    stage: document.body.dataset.stageResult,
    score: document.body.dataset.stageScore,
  }));
  push('stage-result-shot', stageShot.ok && stageMeta.view === 'stage-result', {
    stageShot, stageMeta,
  });

  // Click 进入下一关 (primary left) then share may be center/right — click primary
  await click(460, 685);
  await page.waitForTimeout(800);
  // If still on stage-result, try center button area
  if (await page.evaluate(() => document.body.dataset.gameView) === 'stage-result') {
    await click(720, 685);
    await page.waitForTimeout(600);
  }
  if (await page.evaluate(() => document.body.dataset.gameView) === 'stage-result') {
    await click(980, 685);
    await page.waitForTimeout(600);
  }
  // Prefer advancing: primary was at -260 when share present → design x 720-260=460
  await page.waitForFunction(
    () => document.body.dataset.gameView === 'play'
      || document.body.dataset.transitionActive === 'true',
    null,
    { timeout: 10000 },
  ).catch(() => {});
  await page.waitForFunction(
    () => document.body.dataset.transitionActive !== 'true'
      && document.body.dataset.gameView === 'play',
    null,
    { timeout: 10000 },
  ).catch(() => {});
  await page.waitForTimeout(500);
  const nextShot = await shot('04-next-scene-idle.png');
  const nextView = await page.evaluate(() => ({
    view: document.body.dataset.gameView,
    stage: document.body.dataset.gameStage,
  }));
  push('next-stage', nextView.view === 'play' && nextShot.ok, { nextView, nextShot });

  const pass = results.every((r) => r.pass);
  const evidence = {
    pass,
    results,
    files: fs.readdirSync(out).filter((f) => f.endsWith('.png')),
    out,
  };
  fs.writeFileSync(path.join(out, 'EVIDENCE.json'), JSON.stringify(evidence, null, 2));
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
