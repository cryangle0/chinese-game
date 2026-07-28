/**
 * Verify reading-jumper: option text inset, feedback on ground, settlement background stretch-X.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'play-fix');
const baseUrl = process.env.PLAY_FIX_URL?.trim() || 'http://127.0.0.1:43921';
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function waitForServer(timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch { /* retry */ }
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

async function forceBank(page, correctIndex, options) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({
      ...q,
      correctIndex,
      options: options ?? q.options,
    }));
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
      PORT: '43921',
      // Do not inherit a sibling game's PUBLIC_ROOT (e.g. writing-treasure).
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
    // --- Fig1: space option text stays inside chrome ---
    {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();
      await forceBank(page, 1, [
        '体形小就没力量',
        '体形不代表力量',
        '只有动物能救人',
      ]);
      await page.goto(`${baseUrl}?skipIntro=1&scene=space`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      await page.waitForFunction(
        () => document.body.dataset.gameView === 'play'
          && (document.body.dataset.gameStage === 'space'
            || document.body.dataset.optionBox),
        null,
        { timeout: 30000 },
      );
      await page.waitForTimeout(800);
      const shot = path.join(outDir, 'space-options-text.png');
      await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1440, height: 810 } });
      const diag = await page.evaluate(() => ({
        stage: document.body.dataset.gameStage,
        optionBox: document.body.dataset.optionBox,
        optionPadX: document.body.dataset.optionPadX,
        labels: document.body.dataset.optionLabels,
      }));
      const issues = [];
      if (diag.optionBox !== '305x87') issues.push(`optionBox=${diag.optionBox}`);
      if (Number(diag.optionPadX) < 60) issues.push(`padX=${diag.optionPadX}`);
      report.push({ case: 'space-options', diag, issues, shot: path.basename(shot) });
      if (issues.length) failures.push(`space-options: ${issues.join('; ')}`);
      else console.log('PASS space-options', diag);
      await context.close();
    }

    // --- Fig2: mario correct feedback on ground ---
    {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();
      await forceBank(page, 1);
      await page.goto(`${baseUrl}?skipIntro=1&scene=mario`, {
        waitUntil: 'domcontentloaded', timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      await page.waitForFunction(
        () => document.body.dataset.gameView === 'play',
        null,
        { timeout: 30000 },
      );
      await page.waitForTimeout(500);
      // Column B center ≈ 720 design; option Y ≈ 405
      await press(page, vp, 720, 405);
      await page.waitForFunction(
        () => document.body.dataset.feedbackY !== undefined,
        null,
        { timeout: 20000 },
      );
      await page.waitForTimeout(500);
      const shot = path.join(outDir, 'mario-correct-feedback.png');
      await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1440, height: 810 } });
      const diag = await page.evaluate(() => {
        const img = document.querySelector('img[data-customer-motion="Feedback"]');
        const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
        const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
        const top0 = canvas ? canvas.y + (canvas.height - 810 * scale) / 2 : 0;
        const r = img?.getBoundingClientRect();
        return {
          feedbackY: document.body.dataset.feedbackY,
          feedbackH: document.body.dataset.feedbackH,
          feedbackCorrect: document.body.dataset.feedbackCorrect,
          motionBottom: r ? (r.bottom - top0) / scale : null,
          objectPosition: img ? getComputedStyle(img).objectPosition : null,
        };
      });
      const issues = [];
      const fy = Number(diag.feedbackY);
      const fh = Number(diag.feedbackH);
      // Enlarged impact box (~1.38× HTML); center rises but sole stays grounded.
      if (!(fy <= -100)) issues.push(`feedbackY=${fy}`);
      if (!(fh >= 520)) issues.push(`feedbackH=${fh}`);
      if (diag.feedbackCorrect !== '1') issues.push(`correct=${diag.feedbackCorrect}`);
      if (diag.motionBottom !== null && diag.motionBottom < 700) {
        issues.push(`motionBottom=${diag.motionBottom}`);
      }
      report.push({ case: 'mario-feedback', diag, issues, shot: path.basename(shot) });
      if (issues.length) failures.push(`mario-feedback: ${issues.join('; ')}`);
      else console.log('PASS mario-feedback', diag);
      await context.close();
    }

    // --- Fig2b: mario wrong feedback also grounded ---
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
      await page.waitForTimeout(500);
      await press(page, vp, 1100, 405); // column C wrong
      await page.waitForFunction(
        () => document.body.dataset.feedbackY !== undefined
          && document.body.dataset.feedbackCorrect === '0',
        null,
        { timeout: 20000 },
      );
      await page.waitForTimeout(500);
      const shot = path.join(outDir, 'mario-wrong-feedback.png');
      await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1440, height: 810 } });
      const diag = await page.evaluate(() => ({
        feedbackY: document.body.dataset.feedbackY,
        feedbackX: document.body.dataset.feedbackX,
        feedbackCorrect: document.body.dataset.feedbackCorrect,
      }));
      const issues = [];
      if (!(Number(diag.feedbackY) <= -100)) issues.push(`feedbackY=${diag.feedbackY}`);
      if (diag.feedbackCorrect !== '0') issues.push(`correct=${diag.feedbackCorrect}`);
      report.push({ case: 'mario-wrong-feedback', diag, issues, shot: path.basename(shot) });
      if (issues.length) failures.push(`mario-wrong-feedback: ${issues.join('; ')}`);
      else console.log('PASS mario-wrong-feedback', diag);
      await context.close();
    }

    // --- Fig3: settlement background stretch-X, foreground remains 1:1 ---
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
      // Answer all 5 quickly
      for (let i = 0; i < 5; i += 1) {
        await page.waitForTimeout(200);
        await press(page, vp, 336, 405);
        await page.waitForFunction(
          () => document.body.dataset.feedbackY !== undefined
            || document.body.dataset.gameView === 'stage-result'
            || document.body.dataset.gameView === 'result',
          null,
          { timeout: 15000 },
        ).catch(() => {});
        await page.waitForTimeout(1200);
        // Clear feedback wait by advancing hold — click again after hold if still play
      }
      await page.waitForFunction(
        () => document.body.dataset.gameView === 'stage-result'
          || document.body.dataset.gameView === 'result'
          || document.body.dataset.resultUniform === '1',
        null,
        { timeout: 45000 },
      );
      // Stage result may appear first — click through to final settlement if needed
      for (let attempt = 0; attempt < 6; attempt += 1) {
        const view = await page.evaluate(() => document.body.dataset.gameView);
        if (view === 'result' || (await page.evaluate(() => document.body.dataset.resultUniform))) {
          break;
        }
        if (view === 'stage-result') {
          await press(page, vp, 720, 685);
          await page.waitForTimeout(800);
          continue;
        }
        if (view === 'play') {
          await press(page, vp, 336, 405);
          await page.waitForTimeout(1500);
          continue;
        }
        await page.waitForTimeout(500);
      }
      await page.waitForTimeout(600);
      const shot = path.join(outDir, 'settlement-stretch-x.png');
      await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1440, height: 810 } });
      const diag = await page.evaluate(() => ({
        view: document.body.dataset.gameView,
        resultUniform: document.body.dataset.resultUniform,
        backdropScale: document.body.dataset.resultBackdropScale,
        positionScaleX: document.body.dataset.resultPositionScaleX,
        artworkScale: document.body.dataset.resultArtworkScale,
        bleedMode: document.body.dataset.resultBleedMode,
      }));
      const issues = [];
      if (diag.resultUniform !== '1') issues.push(`resultUniform=${diag.resultUniform}`);
      if (diag.backdropScale && Math.abs(Number(diag.backdropScale) - 1) > 0.01) {
        issues.push(`backdropScale=${diag.backdropScale}`);
      }
      if (diag.positionScaleX && Math.abs(Number(diag.positionScaleX) - 1) > 0.01) {
        issues.push(`positionScaleX=${diag.positionScaleX}`);
      }
      if (diag.artworkScale && Number(diag.artworkScale) !== 1) {
        issues.push(`artworkScale=${diag.artworkScale}`);
      }
      if (diag.bleedMode !== 'stretch-x') issues.push(`bleedMode=${diag.bleedMode}`);
      if (diag.view !== 'result' && diag.view !== 'stage-result') {
        issues.push(`view=${diag.view}`);
      }
      report.push({ case: 'settlement', diag, issues, shot: path.basename(shot) });
      if (issues.length) failures.push(`settlement: ${issues.join('; ')}`);
      else console.log('PASS settlement', diag);
      await context.close();
    }
  } finally {
    await browser.close();
  }
} finally {
  if (server) {
    server.kill();
  }
}

await fs.writeFile(path.join(outDir, 'report.json'), JSON.stringify({ failures, report }, null, 2));
console.log(JSON.stringify({ failures, report }, null, 2));
if (failures.length) {
  console.error('PLAY FIX FAIL', failures);
  process.exitCode = 1;
} else {
  console.log('PLAY FIX PASS');
}
