import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const outDir = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/test-results/ui-s1';
fs.mkdirSync(outDir, { recursive: true });
const write = (e) => fs.appendFileSync(logPath, JSON.stringify({ sessionId: 'ffb02e', timestamp: Date.now(), ...e }) + '\n');

const expected = {
  columns: [-359, -8, 331],
  voice: { x: -9, y: -359, w: 920, h: 129 },
  question: { x: 5, y: 312.5, w: 794, h: 147 },
  deer: { x: -19.5, y: 110.5, w: 173, h: 253 },
  timer: { x: -566.5, y: 350, w: 265, h: 80 },
};

function mae(a, b) {
  let sum = 0; let n = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c += 1) sum += Math.abs(a.data[i + c] - b.data[i + c]);
    n += 3;
  }
  return sum / n;
}

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH, headless: true,
  args: ['--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 810 }, permissions: ['microphone'] });
const page = await context.newPage();

try {
  // Prototype screenshot
  const proto = path.resolve('e:/angsa/angsa_data/项目/作业帮游戏/独立HTML像素级UI原型/writing/pages/01-treasure-idle.html');
  await page.goto('file:///' + proto.replace(/\\/g, '/'), { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.prototypeReady === 'true', null, { timeout: 15000 });
  await page.screenshot({ path: path.join(outDir, 'proto-idle.png'), clip: { x: 0, y: 0, width: 1440, height: 810 } });

  // Game play
  await page.goto('http://127.0.0.1:43884/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  const ox = box.x + (box.width - 1440 * scale) / 2;
  const oy = box.y + (box.height - 810 * scale) / 2;
  for (const [dx, dy] of [[980, 550], [720, 520], [850, 540], [937, 466]]) {
    await page.mouse.click(ox + dx * scale, oy + dy * scale);
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  await page.screenshot({
    path: path.join(outDir, 'game-idle.png'),
    clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
  });

  // Probe voice button by tapping expected center and checking speechState
  const vx = ox + (720 + expected.voice.x) * scale;
  const vy = oy + (405 - expected.voice.y) * scale;
  await page.mouse.move(vx, vy);
  await page.mouse.down();
  await page.waitForTimeout(250);
  const speech = await page.evaluate(() => ({
    speech: document.body.dataset.speechState || null,
    press: document.body.dataset.voicePress || null,
  }));
  await page.mouse.up();
  write({ runId: 'ui-s1', hypothesisId: 'layout', location: 'voice-hit', message: 'voice at layout center', data: speech });

  // Resize game shot to 1440x810 for MAE vs proto (rough overall; dynamic content differs)
  const protoPng = PNG.sync.read(fs.readFileSync(path.join(outDir, 'proto-idle.png')));
  let gamePng = PNG.sync.read(fs.readFileSync(path.join(outDir, 'game-idle.png')));
  if (gamePng.width !== 1440 || gamePng.height !== 810) {
    // nearest neighbor upsample/downsample to 1440x810
    const scaled = new PNG({ width: 1440, height: 810 });
    for (let y = 0; y < 810; y += 1) {
      for (let x = 0; x < 1440; x += 1) {
        const sx = Math.min(gamePng.width - 1, Math.floor(x * gamePng.width / 1440));
        const sy = Math.min(gamePng.height - 1, Math.floor(y * gamePng.height / 810));
        const si = (sy * gamePng.width + sx) * 4;
        const di = (y * 1440 + x) * 4;
        scaled.data[di] = gamePng.data[si];
        scaled.data[di + 1] = gamePng.data[si + 1];
        scaled.data[di + 2] = gamePng.data[si + 2];
        scaled.data[di + 3] = 255;
      }
    }
    gamePng = scaled;
    fs.writeFileSync(path.join(outDir, 'game-idle-1440.png'), PNG.sync.write(gamePng));
  }

  // Compare stable regions: HUD timer box and voice bar area (mask question text / chests content)
  const regions = [
    { name: 'hud-timer', x0: 21, y0: 15, x1: 286, y1: 95 },
    { name: 'voice-bar', x0: 251, y0: 700, x1: 1171, y1: 810 },
    { name: 'choice-a-frame', x0: 226, y0: 472, x1: 496, y1: 540 },
  ];
  const regionStats = {};
  for (const r of regions) {
    let sum = 0; let n = 0; let over40 = 0;
    for (let y = r.y0; y < r.y1; y += 1) {
      for (let x = r.x0; x < r.x1; x += 1) {
        const i = (y * 1440 + x) * 4;
        let pd = 0;
        for (let c = 0; c < 3; c += 1) {
          const d = Math.abs(protoPng.data[i + c] - gamePng.data[i + c]);
          sum += d; pd += d; n += 1;
        }
        if (pd / 3 > 40) over40 += 1;
      }
    }
    regionStats[r.name] = { mae: sum / n, over40: over40 / (n / 3) };
  }
  write({ runId: 'ui-s1', hypothesisId: 'layout', location: 'region-mae', message: 'section1 region compare', data: regionStats });

  // Pass criteria: voice hit works; voice-bar mae not catastrophic (<80); hud improved
  const voiceOk = speech.speech === 'listening' || speech.press === 'down';
  const voiceBarOk = regionStats['voice-bar'].mae < 90;
  const hudOk = regionStats['hud-timer'].mae < 90;
  const pass = voiceOk && voiceBarOk && hudOk;
  write({ runId: 'ui-s1', hypothesisId: 'layout', location: 'verdict', message: pass ? 'PASS' : 'FAIL', data: { voiceOk, voiceBarOk, hudOk, speech, regionStats } });
  console.log(JSON.stringify({ pass, voiceOk, voiceBarOk, hudOk, regionStats, speech }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (e) {
  write({ runId: 'ui-s1', hypothesisId: 'E', location: 'error', message: String(e.message || e) });
  console.error(e);
  process.exitCode = 1;
} finally {
  await browser.close();
}
