import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const out = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/test-results/ui-s3';
fs.mkdirSync(out, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), ...e,
})}\n`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  permissions: ['microphone'],
});
const page = await context.newPage();

try {
  const proto = 'e:/angsa/angsa_data/项目/作业帮游戏/独立HTML像素级UI原型/writing/pages/02-treasure-voice-listening.html';
  await page.goto(`file:///${proto}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.prototypeReady === 'true', null, {
    timeout: 15000,
  });
  await page.screenshot({
    path: path.join(out, 'proto-voice.png'),
    clip: { x: 0, y: 0, width: 1440, height: 810 },
  });

  await page.goto('http://127.0.0.1:43886/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  const ox = box.x + (box.width - 1440 * scale) / 2;
  const oy = box.y + (box.height - 810 * scale) / 2;
  const click = async (dx, dy) => page.mouse.click(ox + dx * scale, oy + dy * scale);

  for (const [dx, dy] of [[937.5, 466], [980, 550], [720, 520]]) {
    await click(dx, dy);
    await page.waitForTimeout(350);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 20000,
  });
  await page.waitForTimeout(800);

  // Hold voice button
  const vx = ox + (720 - 9) * scale;
  const vy = oy + (405 - (-359)) * scale;
  await page.mouse.move(vx, vy);
  await page.mouse.down();
  await page.waitForSelector('body[data-speech-state="listening"]', { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(out, 'game-voice.png'),
    clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
  });
  const speech = await page.evaluate(() => document.body.dataset.speechState);
  await page.mouse.up();

  const protoP = PNG.sync.read(fs.readFileSync(path.join(out, 'proto-voice.png')));
  let gameP = PNG.sync.read(fs.readFileSync(path.join(out, 'game-voice.png')));
  if (gameP.width !== 1440 || gameP.height !== 810) {
    const scaled = new PNG({ width: 1440, height: 810 });
    for (let y = 0; y < 810; y += 1) {
      for (let x = 0; x < 1440; x += 1) {
        const sx = Math.min(gameP.width - 1, Math.floor(x * gameP.width / 1440));
        const sy = Math.min(gameP.height - 1, Math.floor(y * gameP.height / 810));
        const si = (sy * gameP.width + sx) * 4;
        const di = (y * 1440 + x) * 4;
        scaled.data[di] = gameP.data[si];
        scaled.data[di + 1] = gameP.data[si + 1];
        scaled.data[di + 2] = gameP.data[si + 2];
        scaled.data[di + 3] = 255;
      }
    }
    gameP = scaled;
  }

  // Voice bar region
  let sum = 0;
  let n = 0;
  let over = 0;
  let px = 0;
  for (let y = 700; y < 810; y += 1) {
    for (let x = 251; x < 1171; x += 1) {
      const i = (y * 1440 + x) * 4;
      let pd = 0;
      for (let c = 0; c < 3; c += 1) {
        const d = Math.abs(protoP.data[i + c] - gameP.data[i + c]);
        sum += d;
        pd += d;
        n += 1;
      }
      px += 1;
      if (pd / 3 > 40) over += 1;
    }
  }
  const voiceBar = { mae: sum / n, over40: over / px };
  const pass = speech === 'listening' && voiceBar.mae < 90;
  write({
    runId: 'ui-s3', hypothesisId: 'voice-listening', location: 'verdict',
    message: pass ? 'PASS' : 'FAIL', data: { speech, voiceBar },
  });
  console.log(JSON.stringify({ pass, speech, voiceBar }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(error);
  write({
    runId: 'ui-s3', hypothesisId: 'E', location: 'error',
    message: String(error.message || error),
  });
  process.exitCode = 1;
} finally {
  await browser.close();
}
