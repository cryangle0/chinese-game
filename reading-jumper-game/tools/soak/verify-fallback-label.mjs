import { chromium } from 'playwright';
import fs from 'node:fs';
const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const write = (o) => fs.appendFileSync(logPath, JSON.stringify(o) + '\n');
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: false,
});
const context = await browser.newContext({ permissions: ['camera'] });
const page = await context.newPage();
await page.goto('http://localhost:8081/index.html?debug=fallback-label', { waitUntil: 'domcontentloaded' });
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 20000 });
await page.waitForFunction(() => document.body.dataset.poseState && document.body.dataset.poseState !== 'idle' && document.body.dataset.poseState !== 'requesting', null, { timeout: 15000 }).catch(() => null);
await page.waitForTimeout(1500);
const snap = await page.evaluate(() => {
  const o = document.getElementById('reading-pose-overlay');
  const retry = o?.querySelector('.pose-camera__retry');
  return {
    poseState: o?.dataset.poseState ?? null,
    fallbackReason: o?.dataset.fallbackReason ?? null,
    retryText: retry?.textContent ?? null,
    retryTitle: retry?.title ?? null,
    retryHidden: retry?.hidden ?? null,
  };
});
write({ sessionId: 'ffb02e', runId: 'post-fix-fallback-label', hypothesisId: 'B', location: 'real-chrome', message: 'fallback UI after NotReadable', data: snap, timestamp: Date.now() });
console.log(JSON.stringify(snap, null, 2));
await browser.close();
const ok = snap.poseState === 'fallback' && snap.fallbackReason === '摄像头被占用' && String(snap.retryText).includes('被占用');
process.exit(ok ? 0 : 2);
