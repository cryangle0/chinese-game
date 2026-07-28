/**
 * Settlement layout verification with screenshots (1440×810).
 * Asserts: uniform 1:1 scale, review/achievement X aligned, score label mode.
 */
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'settlement-fix');
const baseUrl = process.env.SETTLEMENT_BASE_URL?.trim() || 'http://127.0.0.1:43901';
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scenes = ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic'];

async function waitForServer(timeoutMs = 20000) {
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

async function completeQuestion(page, vp) {
  await press(page, vp, 310, 595);
  await page.waitForSelector('body[data-answer-correct]', { timeout: 15000 });
  await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
    timeout: 10000,
  });
}

const server = process.env.SETTLEMENT_BASE_URL ? null : spawn(
  process.execPath,
  ['server/index.mjs'],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: '43901',
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
    for (const scene of scenes) {
      const context = await browser.newContext({ viewport: vp });
      const page = await context.newPage();
      await page.route('**/question-bank.json', async (route) => {
        const response = await route.fetch();
        const pack = await response.json();
        pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
        await route.fulfill({ response, json: pack });
      });
      await page.goto(`${baseUrl}?skipIntro=1&scene=${scene}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
      await page.waitForSelector(`body[data-game-stage="${scene}"]`);
      for (let i = 0; i < 5; i += 1) await completeQuestion(page, vp);
      await page.waitForSelector(`body[data-stage-result="${scene}"]`, { timeout: 15000 });
      await page.waitForFunction(() => document.body.dataset.resultUniform === '1', null, {
        timeout: 5000,
      });
      await page.waitForTimeout(400);
      const shot = path.join(outDir, `${scene}-1440x810.png`);
      await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1440, height: 810 } });

      const diag = await page.evaluate(() => ({
        uniform: document.body.dataset.resultUniform,
        artworkScale: document.body.dataset.resultArtworkScale,
        artworkOffsetY: document.body.dataset.resultArtworkOffsetY,
        backdropScale: document.body.dataset.resultBackdropScale,
        positionScaleX: document.body.dataset.resultPositionScaleX,
        bleedMode: document.body.dataset.resultBleedMode,
        reviewCenterX: document.body.dataset.reviewCenterX,
        achievementCenterX: document.body.dataset.achievementCenterX,
        scoreLabel: document.body.dataset.scoreLabel,
        scoreMode: document.body.dataset.scoreMode,
        scoreValue: document.body.dataset.scoreValue,
        scorePanel: document.body.dataset.scorePanel,
        resultShare: document.body.dataset.resultShare,
        scoreDom: Boolean(document.querySelector('[data-result-score-dom="1"]')),
      }));

      const issues = [];
      if (diag.uniform !== '1') issues.push('resultUniform!=1');
      if (diag.resultShare !== '1') issues.push('missing 分享成绩 button');
      if (!diag.scoreDom) issues.push('missing DOM score overlay');
      const scoreBox = await page.evaluate(() => {
        const el = document.querySelector('[data-result-score-dom="1"]');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          text: el.textContent,
          left: +r.left.toFixed(1),
          width: +r.width.toFixed(1),
          centerX: +(r.left + r.width / 2).toFixed(1),
        };
      });
      diag.scoreBox = scoreBox;
      if (Math.abs(Number(diag.artworkScale) - 1) > 0.01) issues.push(`artworkScale=${diag.artworkScale}`);
      if (Math.abs(Number(diag.backdropScale) - 1) > 0.01) issues.push(`backdropScale=${diag.backdropScale}`);
      if (Math.abs(Number(diag.positionScaleX) - 1) > 0.01) {
        issues.push(`positionScaleX=${diag.positionScaleX}`);
      }
      if (diag.bleedMode !== 'stretch-x') issues.push(`bleedMode=${diag.bleedMode}`);
      if (Math.abs(Number(diag.artworkOffsetY)) > 0.001) issues.push(`offsetY=${diag.artworkOffsetY}`);
      if (diag.reviewCenterX && diag.achievementCenterX) {
        const dx = Number(diag.reviewCenterX) - Number(diag.achievementCenterX);
        // Subtitle is intentionally biased ~22px left under ribbon icon.
        if (Math.abs(dx - 36) > 2) {
          issues.push(`review/achievement bias ${dx.toFixed(1)} (want ~36)`);
        }
      }
      if (scene === 'desert' || scene === 'dinosaur' || scene === 'dunhuang') {
        if (diag.scoreMode !== 'number') issues.push(`scoreMode=${diag.scoreMode}`);
        if (diag.scoreLabel && /总分/.test(diag.scoreLabel)) issues.push(`scoreLabel has 总分: ${diag.scoreLabel}`);
      }
      if (scene === 'treasure' || scene === 'magic') {
        if (!diag.scoreLabel || !/^总分\s+\d+/.test(diag.scoreLabel)) {
          issues.push(`${scene} scoreLabel=${diag.scoreLabel}`);
        }
        if (diag.scorePanel === '1') issues.push(`${scene} still draws blue score panel`);
      }

      report.push({ scene, shot: path.basename(shot), diag, issues });
      if (issues.length) {
        failures.push(`${scene}: ${issues.join('; ')}`);
        console.error(`FAIL ${scene}`, issues);
      } else {
        console.log(`PASS ${scene}`, diag);
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }

  await fs.writeFile(path.join(outDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) {
    console.error('SETTLEMENT FIX FAILED\n' + failures.join('\n'));
    process.exitCode = 1;
  } else {
    console.log(`SETTLEMENT FIX OK — ${scenes.length} scenes, shots in ${outDir}`);
  }
} finally {
  if (server) {
    server.kill();
    await Promise.race([
      once(server, 'exit'),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
  }
}
