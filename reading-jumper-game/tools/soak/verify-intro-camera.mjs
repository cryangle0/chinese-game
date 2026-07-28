import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const logPath = path.resolve('e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log');
const url = process.env.CAM_TEST_URL ?? 'http://localhost:8081/index.html?debug=cam-e2e';

function writeLog(entry) {
  fs.appendFileSync(logPath, `${JSON.stringify(entry)}\n`);
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH
    ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  permissions: ['camera'],
});
const page = await context.newPage();
page.on('console', (msg) => {
  const text = msg.text();
  if (text.includes('[agentLog]') || text.includes('[WebPoseInput]')) {
    writeLog({
      sessionId: 'ffb02e',
      runId: 'post-fix-e2e',
      hypothesisId: 'A',
      location: 'playwright-console',
      message: text.slice(0, 500),
      data: { type: msg.type() },
      timestamp: Date.now(),
    });
  }
});

const started = Date.now();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 20000 });
await page.waitForSelector('body[data-game-view="intro"]', { timeout: 10000 });

// Must leave idle without clicking Start
await page.waitForFunction(() => {
  const state = document.body.dataset.poseState
    || document.getElementById('reading-pose-overlay')?.dataset.poseState;
  return Boolean(state && state !== 'idle');
}, null, { timeout: 12000 });

const mid = await page.evaluate(() => {
  const o = document.getElementById('reading-pose-overlay');
  const v = o?.querySelector('video');
  return {
    gameView: document.body.dataset.gameView ?? null,
    poseState: o?.dataset.poseState ?? null,
    bodyPose: document.body.dataset.poseState ?? null,
    isLive: Boolean(v?.classList.contains('is-live')),
    hasSrcObject: Boolean(v?.srcObject),
    readyState: v?.readyState ?? -1,
    videoW: v?.videoWidth ?? 0,
    videoH: v?.videoHeight ?? 0,
    opacity: v ? getComputedStyle(v).opacity : null,
  };
});
writeLog({
  sessionId: 'ffb02e', runId: 'post-fix-e2e', hypothesisId: 'A',
  location: 'playwright:after-request', message: 'intro camera state after leave-idle',
  data: mid, timestamp: Date.now(),
});

// Wait until live preview is actually showing (or fallback with clear reason)
await page.waitForFunction(() => {
  const o = document.getElementById('reading-pose-overlay');
  const v = o?.querySelector('video');
  const state = o?.dataset.poseState;
  if (state === 'fallback') return true;
  return Boolean(v?.classList.contains('is-live') && (v?.readyState ?? 0) >= 2);
}, null, { timeout: 20000 });

const finalState = await page.evaluate(() => {
  const o = document.getElementById('reading-pose-overlay');
  const v = o?.querySelector('video');
  return {
    gameView: document.body.dataset.gameView ?? null,
    poseState: o?.dataset.poseState ?? null,
    isLive: Boolean(v?.classList.contains('is-live')),
    hasSrcObject: Boolean(v?.srcObject),
    readyState: v?.readyState ?? -1,
    videoW: v?.videoWidth ?? 0,
    videoH: v?.videoHeight ?? 0,
    opacity: v ? getComputedStyle(v).opacity : null,
    clickedStart: false,
  };
});

const passed = finalState.gameView === 'intro'
  && finalState.poseState !== 'idle'
  && (
    (finalState.isLive && finalState.hasSrcObject && finalState.readyState >= 2 && Number(finalState.opacity) > 0)
    || finalState.poseState === 'fallback'
  );

// Strict pass for product ask: must show camera, not just request
const strictPass = finalState.gameView === 'intro'
  && finalState.isLive
  && finalState.hasSrcObject
  && finalState.readyState >= 2
  && Number(finalState.opacity) > 0
  && ['loading', 'ready', 'lost', 'requesting'].includes(finalState.poseState);

writeLog({
  sessionId: 'ffb02e', runId: 'post-fix-e2e', hypothesisId: 'C',
  location: 'playwright:final', message: 'intro camera verification result',
  data: {
    ...finalState, passed, strictPass, elapsedMs: Date.now() - started, url,
  },
  timestamp: Date.now(),
});

console.log(JSON.stringify({ passed, strictPass, finalState, url }, null, 2));
await browser.close();
process.exit(strictPass ? 0 : 1);
