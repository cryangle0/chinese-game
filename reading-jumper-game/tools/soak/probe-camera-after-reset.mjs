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
await page.goto('http://localhost:8081/index.html', { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(async () => {
  await page.goto('about:blank');
});
const result = await page.evaluate(async () => {
  const out = { devices: [], attempts: [] };
  try {
    // permission warm-up may be needed before labels appear
    try {
      const warm = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      warm.getTracks().forEach((t) => t.stop());
      out.warmup = 'ok';
    } catch (e) {
      out.warmup = { name: e?.name, message: String(e?.message || e) };
    }
    const devices = await navigator.mediaDevices.enumerateDevices();
    out.devices = devices.filter((d) => d.kind === 'videoinput').map((d) => ({
      label: d.label, deviceId: d.deviceId?.slice(0, 12), groupId: d.groupId?.slice(0, 8),
    }));
    const videoInputs = devices.filter((d) => d.kind === 'videoinput');
    const attempts = [
      { id: 'any', video: true },
      ...videoInputs.map((d, i) => ({ id: `device-${i}:${d.label || 'unnamed'}`, video: { deviceId: { exact: d.deviceId } } })),
    ];
    for (const attempt of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: attempt.video });
        const track = stream.getVideoTracks()[0];
        const settings = track?.getSettings?.() || {};
        stream.getTracks().forEach((t) => t.stop());
        out.attempts.push({ id: attempt.id, ok: true, settings });
      } catch (e) {
        out.attempts.push({ id: attempt.id, ok: false, name: e?.name, message: String(e?.message || e).slice(0, 160) });
      }
    }
  } catch (e) {
    out.error = String(e?.message || e);
  }
  return out;
});
write({ sessionId: 'ffb02e', runId: 'cam-reset-probe', hypothesisId: 'D', location: 'probe-after-pnp-reset', message: 'device enumerate and open attempts', data: result, timestamp: Date.now() });
console.log(JSON.stringify(result, null, 2));
await browser.close();
const anyOk = Array.isArray(result.attempts) && result.attempts.some((a) => a.ok);
process.exit(anyOk ? 0 : 2);
