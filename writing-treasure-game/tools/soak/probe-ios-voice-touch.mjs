/**
 * Probe: does voice button respond to mouse / short tap / long-press on iPhone viewport?
 * Writes NDJSON to workspace debug-ffb02e.log
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium, webkit } from 'playwright';

const logPath = path.resolve('e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log');
const baseUrl = process.env.E2E_BASE_URL?.trim()
  || 'https://game.xyouxing.com/writing-treasure/index.html';
const engine = process.env.PROBE_ENGINE === 'webkit' ? 'webkit' : 'chromium';

function write(entry) {
  fs.appendFileSync(logPath, `${JSON.stringify({
    sessionId: 'ffb02e',
    timestamp: Date.now(),
    ...entry,
  })}\n`);
}

async function snap(page, tag) {
  return page.evaluate((t) => {
    const canvas = document.getElementById('GameCanvas');
    return {
      tag: t,
      gameView: document.body.dataset.gameView || null,
      speechState: document.body.dataset.speechState || null,
      roundState: document.body.dataset.roundState || null,
      gameReady: document.body.dataset.gameReady || null,
      hasGum: Boolean(navigator.mediaDevices?.getUserMedia),
      hasRecorder: typeof MediaRecorder !== 'undefined',
      ua: navigator.userAgent.slice(0, 80),
      canvas: canvas ? {
        w: canvas.clientWidth, h: canvas.clientHeight,
      } : null,
    };
  }, tag);
}

async function enterPlay(page) {
  await page.goto(baseUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  // Start button ~ center-right intro
  await page.locator('canvas#GameCanvas').click({ position: { x: 980, y: 550 } });
  await page.waitForSelector('body[data-game-view="play"]', { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function voicePoint(page) {
  const box = await page.locator('canvas#GameCanvas').boundingBox();
  if (!box) throw new Error('no canvas');
  // Design: voice pill at (720, 348+405?); canvas maps design 1440x810 letterboxed
  const scale = Math.min(box.width / 1440, box.height / 810);
  const ox = box.x + (box.width - 1440 * scale) / 2;
  const oy = box.y + (box.height - 810 * scale) / 2;
  // Voice node at (0, -348) in design → screen: cx=720, cy=405-(-348)=753
  return { x: ox + 720 * scale, y: oy + 753 * scale, box, scale };
}

async function runCase(browserType, name) {
  const chromePath = process.env.CHROME_PATH
    || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const launchOpts = {
    headless: true,
    args: engine === 'chromium' ? [
      '--autoplay-policy=no-user-gesture-required',
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
    ] : undefined,
  };
  if (engine === 'chromium') launchOpts.executablePath = chromePath;
  const browser = await browserType.launch(launchOpts);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 MicroMessenger/8.0.0',
    permissions: engine === 'chromium' ? ['microphone'] : undefined,
  });
  const page = await context.newPage();
  const consoleMsgs = [];
  page.on('console', (m) => {
    const text = m.text();
    if (/Speech|voice|Voice|MediaRecorder|getUserMedia|NotAllowed|error/i.test(text)) {
      consoleMsgs.push(text.slice(0, 200));
    }
  });

  try {
    await enterPlay(page);
    const before = await snap(page, `${name}:before`);
    write({
      runId: 'ios-voice-probe', hypothesisId: 'B', location: 'probe:support',
      message: 'play entered support snapshot', data: before,
    });

    const pt = await voicePoint(page);
    write({
      runId: 'ios-voice-probe', hypothesisId: 'D', location: 'probe:point',
      message: 'voice button screen point', data: pt,
    });

    // Case 1: short tap (touch)
    await page.touchscreen.tap(pt.x, pt.y);
    await page.waitForTimeout(900);
    const afterTap = await snap(page, `${name}:after-tap`);
    write({
      runId: 'ios-voice-probe', hypothesisId: 'A', location: 'probe:short-tap',
      message: 'after short touch tap', data: { ...afterTap, consoleMsgs: [...consoleMsgs] },
    });

    // Reset speech if stuck listening by waiting or reload play — continue cases carefully
    if (afterTap.speechState === 'listening' || afterTap.speechState === 'processing') {
      await page.waitForFunction(() => {
        const s = document.body.dataset.speechState;
        return !s || s === 'idle' || s === 'no-match' || s === 'error' || s === 'unsupported';
      }, null, { timeout: 8000 }).catch(() => {});
    }

    // Case 2: long press (~800ms) — user mental model for 按住说话
    consoleMsgs.length = 0;
    await page.touchscreen.tap(pt.x, pt.y); // ensure focus
    await page.evaluate(async ({ x, y }) => {
      const target = document.elementFromPoint(x, y) || document.getElementById('GameCanvas');
      const opts = { bubbles: true, cancelable: true, clientX: x, clientY: y };
      target.dispatchEvent(new TouchEvent('touchstart', {
        bubbles: true, cancelable: true,
        touches: [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
      }));
      await new Promise((r) => setTimeout(r, 800));
      target.dispatchEvent(new TouchEvent('touchend', {
        bubbles: true, cancelable: true,
        changedTouches: [new Touch({ identifier: 1, target, clientX: x, clientY: y })],
      }));
    }, { x: pt.x, y: pt.y }).catch(async () => {
      // Touch constructor may fail; use Playwright touchscreen down/up
      await page.touchscreen.tap(pt.x, pt.y);
    });
    // Prefer Playwright native long press via mouse for engines that map it
    try {
      await page.locator('canvas#GameCanvas').dispatchEvent('pointerdown', {
        clientX: pt.x, clientY: pt.y, pointerType: 'touch', buttons: 1,
      });
      await page.waitForTimeout(850);
      await page.locator('canvas#GameCanvas').dispatchEvent('pointerup', {
        clientX: pt.x, clientY: pt.y, pointerType: 'touch', buttons: 0,
      });
    } catch { /* ignore */ }
    await page.waitForTimeout(500);
    const afterLong = await snap(page, `${name}:after-long`);
    write({
      runId: 'ios-voice-probe', hypothesisId: 'A', location: 'probe:long-press',
      message: 'after long press attempt', data: { ...afterLong, consoleMsgs: [...consoleMsgs] },
    });

    // Case 3: mouse click equivalent (desktop path)
    consoleMsgs.length = 0;
    if (afterLong.speechState === 'listening' || afterLong.speechState === 'processing') {
      await page.waitForTimeout(3500);
    }
    await page.mouse.click(pt.x, pt.y);
    await page.waitForTimeout(900);
    const afterMouse = await snap(page, `${name}:after-mouse`);
    write({
      runId: 'ios-voice-probe', hypothesisId: 'A', location: 'probe:mouse-click',
      message: 'after mouse click at voice point',
      data: { ...afterMouse, consoleMsgs: [...consoleMsgs] },
    });
  } catch (error) {
    write({
      runId: 'ios-voice-probe', hypothesisId: 'E', location: 'probe:error',
      message: String(error?.message || error), data: { name, stack: String(error?.stack || '').slice(0, 400) },
    });
  } finally {
    await browser.close();
  }
}

const launcher = engine === 'webkit' ? webkit : chromium;
await runCase(launcher, engine);
console.log(`probe done engine=${engine} log=${logPath}`);
