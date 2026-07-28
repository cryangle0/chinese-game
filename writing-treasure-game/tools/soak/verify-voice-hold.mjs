import fs from 'node:fs';
import { chromium } from 'playwright';
const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const write = (e) => fs.appendFileSync(logPath, JSON.stringify({ sessionId: 'ffb02e', timestamp: Date.now(), ...e }) + '\n');
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext({
  viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 MicroMessenger/8.0.49',
  permissions: ['microphone'],
});
const page = await context.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (/agentLog|Speech|voicePress|press/i.test(t)) write({ runId: 'post-fix', hypothesisId: 'A', location: 'console', message: t.slice(0, 200) });
});
try {
  await page.goto('http://127.0.0.1:43883/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  const ox = box.x + (box.width - 1440 * scale) / 2;
  const oy = box.y + (box.height - 810 * scale) / 2;
  const click = async (dx, dy) => page.mouse.click(ox + dx * scale, oy + dy * scale);
  for (const p of [[980,550],[720,520],[850,540]]) {
    await click(p[0], p[1]);
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, { timeout: 20000 });
  await page.waitForTimeout(700);
  const vx = ox + 720 * scale, vy = oy + 753 * scale;
  // Hold press (iOS mental model)
  await page.mouse.move(vx, vy);
  await page.mouse.down();
  await page.waitForTimeout(200);
  const during = await page.evaluate(() => ({
    speech: document.body.dataset.speechState || null,
    press: document.body.dataset.voicePress || null,
  }));
  write({ runId: 'post-fix', hypothesisId: 'A', location: 'hold-down', message: 'while holding', data: during });
  await page.waitForTimeout(1000);
  await page.mouse.up();
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    speech: document.body.dataset.speechState || null,
    press: document.body.dataset.voicePress || null,
  }));
  write({ runId: 'post-fix', hypothesisId: 'A', location: 'hold-up', message: 'after release', data: after });
  // Also touchscreen tap
  await page.waitForTimeout(3500);
  await page.touchscreen.tap(vx, vy);
  await page.waitForTimeout(500);
  const tap = await page.evaluate(() => ({
    speech: document.body.dataset.speechState || null,
    press: document.body.dataset.voicePress || null,
  }));
  write({ runId: 'post-fix', hypothesisId: 'A', location: 'touch-tap', message: 'after touch tap', data: tap });
  const pass = during.speech === 'listening' || during.press === 'down'
    || tap.speech === 'listening' || tap.press === 'down';
  write({ runId: 'post-fix', hypothesisId: 'A', location: 'verdict', message: pass ? 'PASS' : 'FAIL', data: { during, after, tap, pass } });
  if (!pass) throw new Error('voice hold/tap did not enter listening');
  console.log('VERIFY_PASS');
} catch (e) {
  write({ runId: 'post-fix', hypothesisId: 'E', location: 'error', message: String(e.message || e) });
  console.error('VERIFY_FAIL', e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
