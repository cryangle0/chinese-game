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
await page.goto('http://localhost:8081/index.html', { waitUntil: 'domcontentloaded' });
const results = await page.evaluate(async () => {
  if (!navigator.mediaDevices?.getUserMedia) return [{ id: 'none', ok: false, name: 'no-gum' }];
  const attempts = [
    { id: 'strict-max-fps', video: { width: { ideal: 192 }, height: { ideal: 144 }, frameRate: { ideal: 24, max: 30 }, facingMode: 'user' } },
    { id: 'preferred', video: { width: { ideal: 192 }, height: { ideal: 144 }, frameRate: { ideal: 24 }, facingMode: 'user' } },
    { id: 'facing-only', video: { facingMode: 'user' } },
    { id: 'any-camera', video: true },
  ];
  const out = [];
  for (const attempt of attempts) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: attempt.video });
      const settings = stream.getVideoTracks()[0]?.getSettings?.() ?? {};
      stream.getTracks().forEach((t) => t.stop());
      out.push({ id: attempt.id, ok: true, settings });
    } catch (error) {
      out.push({ id: attempt.id, ok: false, name: error?.name ?? null, message: String(error?.message ?? error).slice(0, 160) });
    }
  }
  return out;
});
write({ sessionId: 'ffb02e', runId: 'constraint-probe', hypothesisId: 'B', location: 'localhost-probe', message: 'constraint ladder on real page', data: { results }, timestamp: Date.now() });
console.log(JSON.stringify(results, null, 2));
await browser.close();
