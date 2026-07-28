/**
 * Wave-1 pixel gate (0721): white edge / settlement cover / transition fullscreen.
 * Evidence: screenshots + EVIDENCE.json under test-results/fb-0721-wave1/
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const writingUrl = process.env.WRITING_URL ?? 'http://127.0.0.1:43886';
const readingUrl = process.env.READING_URL ?? 'http://127.0.0.1:43887';
const outRoot = path.resolve('test-results', 'fb-0721-wave1');
const viewports = [
  { name: '1440x810', width: 1440, height: 810 },
  { name: '2560x1080', width: 2560, height: 1080 },
  { name: '915x407', width: 915, height: 407, mobile: true },
];

function designPoint(vp, x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
  };
}

function edgeStrip(png, { edge = 'bottom', thickness = 4 } = {}) {
  let white = 0;
  let black = 0;
  let samples = 0;
  let luminance = 0;
  const t = Math.max(2, thickness);
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const onEdge = edge === 'bottom' ? y >= png.height - t
        : edge === 'top' ? y < t
          : edge === 'left' ? x < t
            : x >= png.width - t;
      if (!onEdge) continue;
      const i = (y * png.width + x) * 4;
      const v = (png.data[i] + png.data[i + 1] + png.data[i + 2]) / 3;
      luminance += v;
      samples += 1;
      if (v > 240) white += 1;
      if (v < 12) black += 1;
    }
  }
  return {
    samples,
    whiteRatio: white / Math.max(1, samples),
    blackRatio: black / Math.max(1, samples),
    meanLuminance: luminance / Math.max(1, samples),
  };
}

async function shot(page, file) {
  const buf = await page.screenshot({ path: file, type: 'png' });
  return PNG.sync.read(buf);
}

async function useDeterministicAnswers(page) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });
}

async function press(page, vp, x, y) {
  const p = designPoint(vp, x, y);
  if (vp.mobile) await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

async function completeWritingQuestion(page, vp) {
  await press(page, vp, 310, 595);
  await page.waitForSelector('body[data-action-ready="true"]', { timeout: 8000 }).catch(() => {});
  // Prefer direct reveal path if available; otherwise tap option A
  const advanced = await page.evaluate(() => document.body.dataset.answerCorrect === 'true');
  if (!advanced) {
    await press(page, vp, 310, 595);
    await page.waitForFunction(() => (
      document.body.dataset.answerCorrect === 'true'
      || Number(document.body.dataset.actionStrikes ?? 0) >= 1
    ), null, { timeout: 8000 }).catch(() => {});
  }
  for (let i = 0; i < 3; i += 1) {
    const done = await page.evaluate(() => document.body.dataset.answerCorrect === 'true');
    if (done) break;
    await press(page, vp, 310, 595);
    await page.waitForTimeout(200);
  }
  await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
    timeout: 8000,
  }).catch(() => {});
}

async function completeReadingQuestion(page, vp) {
  // Left option brick (correctIndex forced to 0) — same as verify-fb-p0
  await press(page, vp, 337, 405);
  await page.waitForTimeout(1000);
  await page.waitForFunction(() => (
    !document.body.dataset.answerCorrect
    || document.body.dataset.gameView === 'stage-result'
  ), null, { timeout: 8000 }).catch(() => {});
}

async function checkCssBlack(page) {
  return page.evaluate(() => {
    const body = getComputedStyle(document.body).backgroundColor;
    const html = getComputedStyle(document.documentElement).backgroundColor;
    const game = document.getElementById('GameDiv');
    const gameBg = game ? getComputedStyle(game).backgroundColor : '';
    const parse = (c) => {
      const m = String(c).match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
      return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
    };
    const dark = (rgb) => rgb && rgb[0] < 40 && rgb[1] < 40 && rgb[2] < 40;
    return {
      body, html, gameBg,
      ok: dark(parse(body)) && dark(parse(html)),
    };
  });
}

async function checkTransitionCover(page) {
  // Capture geometry as soon as the transition image is visible.
  await page.waitForSelector('body[data-transition-active="true"]', { timeout: 8000 }).catch(() => {});
  await page.waitForSelector('img[data-customer-motion="CustomerTransition"]', {
    state: 'visible',
    timeout: 5000,
  }).catch(() => {});
  return page.evaluate(() => {
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const img = document.querySelector('img[data-customer-motion="CustomerTransition"]');
    if (!canvas || !img) return { ok: false, reason: 'missing' };
    const r = img.getBoundingClientRect();
    const visible = getComputedStyle(img).display !== 'none' && r.width > 1 && r.height > 1;
    const coverW = Math.abs(r.width - canvas.width) <= 3;
    const coverH = Math.abs(r.height - canvas.height) <= 3;
    const underlay = document.getElementById('CustomerTransitionUnderlay');
    const underlayOn = Boolean(underlay) && getComputedStyle(underlay).display !== 'none';
    return {
      ok: visible && coverW && coverH && underlayOn,
      canvas: { w: canvas.width, h: canvas.height },
      img: { w: r.width, h: r.height },
      underlay: underlayOn,
      display: getComputedStyle(img).display,
    };
  });
}

const results = [];
function push(id, pass, data = {}) {
  results.push({ id, pass, ...data });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id}`, JSON.stringify(data).slice(0, 240));
}

await fs.rm(outRoot, { recursive: true, force: true });
await fs.mkdir(path.join(outRoot, 'writing'), { recursive: true });
await fs.mkdir(path.join(outRoot, 'reading'), { recursive: true });

const browser = await chromium.launch({ executablePath: chrome, headless: true });
try {
  for (const vp of viewports) {
    // --- Writing intro white-edge ---
    {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile ?? false,
        hasTouch: vp.mobile ?? false,
      });
      const page = await context.newPage();
      await page.goto(writingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      await page.waitForTimeout(400);
      const css = await checkCssBlack(page);
      const png = await shot(page, path.join(outRoot, 'writing', `01-intro-whiteedge-${vp.name}.png`));
      const bottom = edgeStrip(png, { edge: 'bottom', thickness: 6 });
      push(`w-whiteedge-${vp.name}`, css.ok && bottom.whiteRatio < 0.08, { css, bottom });
      await context.close();
    }

    // --- Writing settlement cover ---
    {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile ?? false,
        hasTouch: vp.mobile ?? false,
      });
      const page = await context.newPage();
      await useDeterministicAnswers(page);
      await page.goto(`${writingUrl}?skipIntro=1&scene=treasure`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      for (let q = 0; q < 5; q += 1) await completeWritingQuestion(page, vp);
      await page.waitForSelector('body[data-stage-result="treasure"]', { timeout: 20000 });
      await page.waitForTimeout(500);
      const layout = await page.evaluate(() => ({
        bg: Number(document.body.dataset.resultBackgroundScale),
        art: Number(document.body.dataset.resultArtworkScale),
        backdrop: Number(document.body.dataset.resultBackdropScale),
      }));
      const png = await shot(page, path.join(outRoot, 'writing', `02-settlement-${vp.name}.png`));
      const left = edgeStrip(png, { edge: 'left', thickness: 4 });
      const right = edgeStrip(png, { edge: 'right', thickness: 4 });
      const sideOk = left.blackRatio < 0.25 && right.blackRatio < 0.25
        && left.meanLuminance > 20 && right.meanLuminance > 20;
      const scaleOk = Number.isFinite(layout.bg)
        && Number.isFinite(layout.art)
        && Number.isFinite(layout.backdrop)
        && layout.backdrop >= 0.999
        && Math.abs(layout.bg - layout.backdrop) < 0.01
        && Math.abs(layout.art - layout.backdrop) < 0.01;
      push(`w-settlement-${vp.name}`, sideOk && scaleOk, { layout, left, right });
      await context.close();
    }

    // --- Writing transition fullscreen (after 1 question into desert trigger is hard;
    //     force via dataset by calling play path: complete stage then next — use 5 Q then CTA) ---
    {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile ?? false,
        hasTouch: vp.mobile ?? false,
      });
      const page = await context.newPage();
      await useDeterministicAnswers(page);
      await page.goto(`${writingUrl}?skipIntro=1&scene=treasure`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      for (let q = 0; q < 5; q += 1) await completeWritingQuestion(page, vp);
      await page.waitForSelector('body[data-stage-result="treasure"]', { timeout: 20000 });
      // primaryOnly CTA centered: Cocos (0,-372) → design (720, 777)
      await press(page, vp, 720, 777);
      await page.waitForSelector('body[data-transition-active="true"]', { timeout: 8000 });
      await page.waitForTimeout(150);
      const cover = await checkTransitionCover(page);
      const png = await shot(page, path.join(outRoot, 'writing', `03-transition-${vp.name}.png`));
      // cover.ok already proves fullscreen geometry; active may clear if transition ends first
      push(`w-transition-${vp.name}`, cover.ok, { cover, bytes: png.width });
      await context.close();
    }

    // --- Reading intro white-edge ---
    {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile ?? false,
        hasTouch: vp.mobile ?? false,
      });
      const page = await context.newPage();
      await page.goto(readingUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      await page.waitForTimeout(400);
      const css = await checkCssBlack(page);
      const png = await shot(page, path.join(outRoot, 'reading', `01-intro-whiteedge-${vp.name}.png`));
      const bottom = edgeStrip(png, { edge: 'bottom', thickness: 6 });
      push(`r-whiteedge-${vp.name}`, css.ok && bottom.whiteRatio < 0.08, { css, bottom });
      await context.close();
    }

    // --- Reading settlement ---
    {
      const context = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        isMobile: vp.mobile ?? false,
        hasTouch: vp.mobile ?? false,
      });
      const page = await context.newPage();
      await useDeterministicAnswers(page);
      await page.goto(`${readingUrl}?skipIntro=1&scene=mario`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
        timeout: 25000,
      }).catch(async () => {
        await press(page, vp, 720, 430);
        await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
          timeout: 15000,
        });
      });
      for (let q = 0; q < 5; q += 1) await completeReadingQuestion(page, vp);
      await page.waitForSelector('body[data-game-view="stage-result"]', { timeout: 25000 });
      await page.waitForTimeout(500);
      const layout = await page.evaluate(() => ({
        bg: Number(document.body.dataset.resultBackgroundScale),
        art: Number(document.body.dataset.resultArtworkScale),
        backdrop: Number(document.body.dataset.resultBackdropScale),
      }));
      const png = await shot(page, path.join(outRoot, 'reading', `02-settlement-${vp.name}.png`));
      const left = edgeStrip(png, { edge: 'left', thickness: 4 });
      const right = edgeStrip(png, { edge: 'right', thickness: 4 });
      const sideOk = left.blackRatio < 0.25 && right.blackRatio < 0.25
        && left.meanLuminance > 20 && right.meanLuminance > 20;
      const scaleOk = Number.isFinite(layout.bg)
        && Number.isFinite(layout.art)
        && Number.isFinite(layout.backdrop)
        && layout.backdrop >= 0.999
        && Math.abs(layout.bg - layout.backdrop) < 0.01
        && Math.abs(layout.art - layout.backdrop) < 0.01;
      push(`r-settlement-${vp.name}`, sideOk && scaleOk, { layout, left, right });

      // Reading transition: click 进入下一关 then assert fullscreen cover
      await press(page, vp, 720, 777);
      await page.waitForSelector('body[data-transition-active="true"]', { timeout: 8000 }).catch(() => {});
      if (!(await page.evaluate(() => document.body.dataset.transitionActive === 'true'))) {
        await press(page, vp, 460, 685);
        await page.waitForSelector('body[data-transition-active="true"]', { timeout: 5000 }).catch(() => {});
      }
      await page.waitForTimeout(150);
      const cover = await checkTransitionCover(page);
      const tpng = await shot(page, path.join(outRoot, 'reading', `03-transition-${vp.name}.png`));
      push(`r-transition-${vp.name}`, cover.ok, { cover, bytes: tpng.width });
      await context.close();
    }
  }
} finally {
  await browser.close();
}

const pass = results.every((r) => r.pass);
const evidence = { pass, results, outRoot };
await fs.writeFile(path.join(outRoot, 'EVIDENCE.json'), `${JSON.stringify(evidence, null, 2)}\n`);
console.log(JSON.stringify(evidence, null, 2));
process.exit(pass ? 0 : 1);
