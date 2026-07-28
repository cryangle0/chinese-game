import { chromium } from 'playwright';
import fs from 'node:fs';
const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const browser = await chromium.launch({ executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', headless: false });
const context = await browser.newContext({ permissions: ['camera'] });
const page = await context.newPage();
await page.goto('http://localhost:8081/index.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
const result = await page.evaluate(async () => {
  let warmup = null;
  try {
    const s = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    s.getTracks().forEach((t) => t.stop());
    warmup = 'ok';
  } catch (e) { warmup = { name: e.name, message: e.message }; }
  const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  const attempts = [];
  for (const d of devices) {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { deviceId: { exact: d.deviceId } }, audio: false });
      const settings = s.getVideoTracks()[0]?.getSettings?.() || {};
      s.getTracks().forEach((t) => t.stop());
      attempts.push({ label: d.label, ok: true, settings });
    } catch (e) {
      attempts.push({ label: d.label, ok: false, name: e.name, message: e.message });
    }
  }
  return { warmup, devices: devices.map((d) => d.label), attempts };
});
fs.appendFileSync(logPath, JSON.stringify({ sessionId: 'ffb02e', runId: 'ext-cam-check', hypothesisId: 'D', location: 'probe', message: 'external camera detect+open', data: result, timestamp: Date.now() }) + '\n');
console.log(JSON.stringify(result, null, 2));
await browser.close();
