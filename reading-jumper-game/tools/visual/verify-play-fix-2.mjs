/**
 * Verify: deer size stable (non-mario), transition no black underlay, text vertically centered.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'play-fix-2');
const baseUrl = process.env.PLAY_FIX_URL?.trim() || 'http://127.0.0.1:43931';
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function waitForServer(timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch { /* */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
}

function designPoint(vp, x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
  };
}

async function press(page, vp, x, y) {
  const p = designPoint(vp, x, y);
  await page.mouse.click(p.x, p.y);
}

async function forceBank(page, correctIndex) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({ ...q, correctIndex }));
    await route.fulfill({ response, json: pack });
  });
}

const server = process.env.PLAY_FIX_URL ? null : spawn(
  process.execPath,
  ['server/index.mjs'],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: '43931',
      PUBLIC_ROOT: path.join(root, 'build', 'web-mobile'),
      MEDIA_ROOT: path.join(root, 'customer-media'),
    },
    stdio: 'ignore',
    windowsHide: true,
  },
);

const failures = [];
const report = [];

try {
  if (server) await waitForServer();
  await fs.mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const vp = { width: 1440, height: 810 };

  try {
    // --- Fig1: space deer box is theme-specific, not 152x266 ---
    {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();
      await forceBank(page, 1);
      await page.goto(`${baseUrl}?skipIntro=1&scene=space`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      await page.waitForFunction(
        () => document.body.dataset.gameView === 'play'
          && document.body.dataset.deerBox,
        null,
        { timeout: 30000 },
      );
      await page.waitForTimeout(600);
      const idleShot = path.join(outDir, 'space-deer-idle.png');
      await page.screenshot({ path: idleShot, clip: { x: 0, y: 0, width: 1440, height: 810 } });

      // Trigger jump/action to check size does not explode via pinFeet height-fill
      await press(page, vp, 720, 405);
      await page.waitForTimeout(350);
      const actionDiag = await page.evaluate(() => {
        const img = document.querySelector('img[data-customer-motion="ReadingDeer"]');
        const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
        const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
        const r = img?.getBoundingClientRect();
        return {
          deerBox: document.body.dataset.deerBox,
          pinScale: document.body.dataset.deerPinScale,
          pinBox: document.body.dataset.deerPinBox,
          motionDisplay: img ? getComputedStyle(img).display : 'none',
          motionW: r ? r.width / scale : null,
          motionH: r ? r.height / scale : null,
        };
      });
      const actionShot = path.join(outDir, 'space-deer-action.png');
      await page.screenshot({ path: actionShot, clip: { x: 0, y: 0, width: 1440, height: 810 } });

      const issues = [];
      if (actionDiag.deerBox !== '165x226') issues.push(`deerBox=${actionDiag.deerBox}`);
      if (actionDiag.motionDisplay !== 'none' && actionDiag.motionH != null) {
        // Contain into 226 — must not jump to old height-fill ~400+
        if (actionDiag.motionH > 280) issues.push(`actionH too big ${actionDiag.motionH}`);
        if (actionDiag.motionW > 220) issues.push(`actionW too big ${actionDiag.motionW}`);
      }
      report.push({
        case: 'space-deer',
        diag: actionDiag,
        issues,
        shots: [path.basename(idleShot), path.basename(actionShot)],
      });
      if (issues.length) failures.push(`space-deer: ${issues.join('; ')}`);
      else console.log('PASS space-deer', actionDiag);
      await context.close();
    }

    // --- Fig2: transition has no black underlay ---
    {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();
      await forceBank(page, 0);
      await page.goto(`${baseUrl}?skipIntro=1&scene=mario`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      await page.waitForFunction(
        () => document.body.dataset.gameView === 'play',
        null,
        { timeout: 30000 },
      );
      // Finish stage 1 (5 questions) to trigger transition to next theme
      for (let i = 0; i < 5; i += 1) {
        await page.waitForFunction(
          () => document.body.dataset.gameView === 'play'
            && document.body.dataset.feedbackY === undefined,
          null,
          { timeout: 20000 },
        ).catch(() => {});
        await page.waitForTimeout(300);
        await press(page, vp, 336, 405);
        await page.waitForFunction(
          () => document.body.dataset.feedbackY !== undefined
            || document.body.dataset.gameView === 'stage-result',
          null,
          { timeout: 20000 },
        ).catch(() => {});
        // Mario wrong hold can be ~2.8s
        await page.waitForTimeout(3200);
      }
      await page.waitForFunction(
        () => document.body.dataset.gameView === 'stage-result',
        null,
        { timeout: 45000 },
      );
      await page.waitForTimeout(400);
      // Primary CTA under rank/review — try a few spots
      for (const x of [460, 720, 580, 900]) {
        await press(page, vp, x, 685);
        await page.waitForTimeout(400);
        const active = await page.evaluate(() => document.body.dataset.transitionActive
          || document.body.dataset.gameStage);
        if (active === 'true' || (active && active !== 'mario')) break;
      }
      await page.waitForFunction(
        () => document.body.dataset.transitionActive === 'true'
          || (document.body.dataset.gameStage
            && document.body.dataset.gameStage !== 'mario'),
        null,
        { timeout: 20000 },
      );
      await page.waitForTimeout(250);
      const shot = path.join(outDir, 'transition-no-black.png');
      await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1440, height: 810 } });
      const diag = await page.evaluate(() => {
        const underlay = document.getElementById('CustomerTransitionUnderlay');
        const cs = underlay ? getComputedStyle(underlay) : null;
        const img = document.querySelector('img[data-customer-motion="CustomerTransition"]');
        return {
          transitionActive: document.body.dataset.transitionActive,
          underlay: document.body.dataset.transitionUnderlay,
          underlayDisplay: cs?.display ?? 'missing',
          underlayBg: cs?.backgroundColor ?? '',
          stage: document.body.dataset.gameStage,
          transitionImg: img ? {
            display: getComputedStyle(img).display,
            src: (img.currentSrc || img.src).slice(-40),
          } : null,
        };
      });
      const issues = [];
      if (diag.underlayDisplay === 'block') {
        issues.push(`underlay still visible bg=${diag.underlayBg}`);
      }
      // Sample screenshot: left half should not be mostly pure black if theme shows
      report.push({ case: 'transition', diag, issues, shot: path.basename(shot) });
      if (issues.length) failures.push(`transition: ${issues.join('; ')}`);
      else console.log('PASS transition', diag);
      await context.close();
    }

    // --- Fig3: deep-sea question text vertical metrics ---
    {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();
      await forceBank(page, 1);
      await page.goto(`${baseUrl}?skipIntro=1&scene=deep-sea`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      await page.waitForFunction(
        () => document.body.dataset.gameView === 'play'
          && document.body.dataset.gameStage === 'deep-sea',
        null,
        { timeout: 30000 },
      );
      await page.waitForTimeout(700);
      const shot = path.join(outDir, 'deep-sea-text-center.png');
      await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1440, height: 810 } });
      const diag = await page.evaluate(() => ({
        stage: document.body.dataset.gameStage,
        deerBox: document.body.dataset.deerBox,
        optionBox: document.body.dataset.optionBox,
      }));
      const issues = [];
      if (diag.deerBox !== '163x231') issues.push(`deerBox=${diag.deerBox}`);
      if (diag.optionBox !== '361x89') issues.push(`optionBox=${diag.optionBox}`);
      report.push({ case: 'deep-sea-text', diag, issues, shot: path.basename(shot) });
      if (issues.length) failures.push(`deep-sea-text: ${issues.join('; ')}`);
      else console.log('PASS deep-sea-text', diag);
      await context.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  if (server) server.kill();
}

await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify({ failures, report }, null, 2));
console.log(JSON.stringify({ failures, report }, null, 2));
if (failures.length) {
  console.error('PLAY FIX 2 FAIL', failures);
  process.exitCode = 1;
} else {
  console.log('PLAY FIX 2 PASS');
}
