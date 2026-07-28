import fs from 'node:fs';
import { chromium } from 'playwright';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const write = (e) => fs.appendFileSync(logPath, JSON.stringify({ sessionId: 'ffb02e', timestamp: Date.now(), ...e }) + '\n');
fs.writeFileSync(logPath, '');

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
  viewport: { width: 844, height: 390 },
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 MicroMessenger/8.0.49',
  permissions: ['microphone'],
});
const page = await context.newPage();
page.on('console', (m) => {
  const t = m.text();
  if (/Speech|voice|MediaRecorder|getUserMedia|NotAllowed|agentLog/i.test(t)) {
    write({ runId: 'ios-voice-probe2', hypothesisId: 'E', location: 'console', message: t.slice(0, 240) });
  }
});

try {
  await page.goto('https://game.xyouxing.com/writing-treasure/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });

  const overlayInfo = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('body *')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.position === 'fixed' || s.position === 'absolute')
        && s.pointerEvents !== 'none'
        && el.id !== 'GameCanvas'
        && el.clientWidth > 50 && el.clientHeight > 50;
    }).slice(0, 20).map((el) => ({
      id: el.id, cls: el.className?.toString?.().slice(0, 80), tag: el.tagName,
      pe: getComputedStyle(el).pointerEvents, zi: getComputedStyle(el).zIndex,
      w: el.clientWidth, h: el.clientHeight,
    }));
    return {
      hasGum: Boolean(navigator.mediaDevices?.getUserMedia),
      hasRecorder: typeof MediaRecorder !== 'undefined',
      overlays: nodes,
      speechState: document.body.dataset.speechState || null,
      gameView: document.body.dataset.gameView || null,
    };
  });
  write({ runId: 'ios-voice-probe2', hypothesisId: 'F', location: 'probe:overlays', message: 'blocking overlays at ready', data: overlayInfo });

  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  const ox = box.x + (box.width - 1440 * scale) / 2;
  const oy = box.y + (box.height - 810 * scale) / 2;
  const clickDesign = async (dx, dy) => {
    await page.mouse.click(ox + dx * scale, oy + dy * scale, { force: true });
  };

  // intro start
  for (const [dx, dy] of [[980, 550], [720, 520], [850, 540], [720, 580]]) {
    await clickDesign(dx, dy);
    await page.waitForTimeout(350);
    const v = await page.evaluate(() => document.body.dataset.gameView);
    if (v === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, { timeout: 20000 });
  await page.waitForTimeout(800);

  const afterPlay = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('body *')].filter((el) => {
      const s = getComputedStyle(el);
      return (s.position === 'fixed' || s.position === 'absolute')
        && s.pointerEvents !== 'none'
        && el.id !== 'GameCanvas'
        && el.clientWidth > 50 && el.clientHeight > 50;
    }).slice(0, 20).map((el) => ({
      id: el.id, cls: String(el.className || '').slice(0, 80), tag: el.tagName,
      pe: getComputedStyle(el).pointerEvents, zi: getComputedStyle(el).zIndex,
      w: el.clientWidth, h: el.clientHeight,
    }));
    const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight * 0.9);
    return {
      speechState: document.body.dataset.speechState || null,
      gameView: document.body.dataset.gameView || null,
      overlays: nodes,
      hitAtVoiceApprox: hit ? { id: hit.id, tag: hit.tagName, cls: String(hit.className || '').slice(0, 60) } : null,
    };
  });
  write({ runId: 'ios-voice-probe2', hypothesisId: 'F', location: 'probe:play-overlays', message: 'overlays in play', data: afterPlay });

  const vx = ox + 720 * scale;
  const vy = oy + 753 * scale;
  write({ runId: 'ios-voice-probe2', hypothesisId: 'D', location: 'probe:point', message: 'voice screen point', data: { vx, vy, scale, box } });

  const hitBefore = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return el ? { id: el.id, tag: el.tagName, cls: String(el.className || '').slice(0, 80), pe: getComputedStyle(el).pointerEvents } : null;
  }, { x: vx, y: vy });
  write({ runId: 'ios-voice-probe2', hypothesisId: 'F', location: 'probe:elementFromPoint', message: 'top element at voice', data: hitBefore });

  // short tap
  await page.touchscreen.tap(vx, vy);
  await page.waitForTimeout(1200);
  let speech = await page.evaluate(() => document.body.dataset.speechState || null);
  write({ runId: 'ios-voice-probe2', hypothesisId: 'A', location: 'probe:short-tap', message: 'speech after short tap', data: { speech } });

  await page.waitForTimeout(3500);
  // mouse click force
  await page.mouse.click(vx, vy);
  await page.waitForTimeout(1200);
  speech = await page.evaluate(() => document.body.dataset.speechState || null);
  write({ runId: 'ios-voice-probe2', hypothesisId: 'A', location: 'probe:mouse-click', message: 'speech after mouse click', data: { speech } });

  await page.waitForTimeout(3500);
  // long press
  await page.mouse.move(vx, vy);
  await page.mouse.down();
  await page.waitForTimeout(1000);
  speech = await page.evaluate(() => document.body.dataset.speechState || null);
  write({ runId: 'ios-voice-probe2', hypothesisId: 'A', location: 'probe:long-down', message: 'speech while holding', data: { speech } });
  await page.mouse.up();
  await page.waitForTimeout(800);
  speech = await page.evaluate(() => document.body.dataset.speechState || null);
  write({ runId: 'ios-voice-probe2', hypothesisId: 'A', location: 'probe:long-up', message: 'speech after release', data: { speech } });
} catch (error) {
  write({ runId: 'ios-voice-probe2', hypothesisId: 'E', location: 'probe:error', message: String(error.message || error), data: { stack: String(error.stack || '').slice(0, 600) } });
} finally {
  await browser.close();
}
console.log('probe2 done');
