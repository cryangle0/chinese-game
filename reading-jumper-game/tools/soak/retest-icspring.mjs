import { chromium } from 'playwright';
import fs from 'node:fs';
const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const write = (o) => fs.appendFileSync(logPath, JSON.stringify(o) + '\n');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const browser = await chromium.launch({ executablePath: chrome, headless: false });
const context = await browser.newContext({ permissions: ['camera'], viewport: { width: 1440, height: 810 } });
const page = await context.newPage();
await page.goto('http://localhost:8081/index.html?debug=icspring-retest', { waitUntil: 'domcontentloaded', timeout: 20000 });

const openProbe = await page.evaluate(async () => {
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  const attempts = [];
  for (const d of devices) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: d.deviceId } } });
      const settings = s.getVideoTracks()[0]?.getSettings?.() || {};
      s.getTracks().forEach((t) => t.stop());
      attempts.push({ label: d.label, ok: true, width: settings.width, height: settings.height });
    } catch (e) {
      attempts.push({ label: d.label, ok: false, name: e.name, message: e.message });
    }
  }
  // also any
  try {
    const s = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
    const settings = s.getVideoTracks()[0]?.getSettings?.() || {};
    s.getTracks().forEach((t) => t.stop());
    attempts.push({ label: 'any', ok: true, width: settings.width, height: settings.height });
  } catch (e) {
    attempts.push({ label: 'any', ok: false, name: e.name, message: e.message });
  }
  return { devices: devices.map((d) => d.label), attempts };
});
write({ sessionId: 'ffb02e', runId: 'icspring-retest', hypothesisId: 'D', location: 'open-probe', message: 'after cable reconnect', data: openProbe, timestamp: Date.now() });
console.log('OPEN_PROBE', JSON.stringify(openProbe, null, 2));

const openOk = openProbe.attempts.some((a) => a.ok);
if (!openOk) {
  await browser.close();
  process.exit(2);
}

// Reload so game can acquire camera cleanly
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 20000 });
await page.waitForSelector('body[data-game-view="intro"]', { timeout: 10000 });
await page.waitForFunction(() => {
  const o = document.getElementById('reading-pose-overlay');
  const v = o?.querySelector('video');
  const state = o?.dataset.poseState;
  if (state === 'fallback') return true;
  return Boolean(v?.classList.contains('is-live') && (v?.readyState ?? 0) >= 2);
}, null, { timeout: 20000 });

const snap = await page.evaluate(() => {
  const o = document.getElementById('reading-pose-overlay');
  const v = o?.querySelector('video');
  return {
    gameView: document.body.dataset.gameView,
    poseState: o?.dataset.poseState,
    fallbackReason: o?.dataset.fallbackReason || null,
    isLive: Boolean(v?.classList.contains('is-live')),
    hasSrcObject: Boolean(v?.srcObject),
    readyState: v?.readyState ?? -1,
    videoW: v?.videoWidth ?? 0,
    videoH: v?.videoHeight ?? 0,
    opacity: v ? getComputedStyle(v).opacity : null,
  };
});
const strictPass = snap.gameView === 'intro' && snap.isLive && snap.hasSrcObject && snap.readyState >= 2 && Number(snap.opacity) > 0;
write({ sessionId: 'ffb02e', runId: 'icspring-retest', hypothesisId: 'C', location: 'intro-snap', message: 'intro camera after reconnect', data: { ...snap, strictPass }, timestamp: Date.now() });
console.log('INTRO_SNAP', JSON.stringify({ strictPass, snap }, null, 2));
await browser.close();
process.exit(strictPass ? 0 : 3);
