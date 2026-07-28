import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const baseUrl = process.env.START_NO_BLACK_URL ?? 'http://127.0.0.1:43881';
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
});

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  await page.goto(`${baseUrl}/?qa=intro-fx`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForFunction(
    () => document.body?.dataset?.gameView === 'intro'
      && typeof window.__triggerIntroStart === 'function',
    null,
    { timeout: 60000 },
  );

  const session = await page.context().newCDPSession(page);
  const frames = [];
  let startedAt = 0;
  session.on('Page.screencastFrame', async (event) => {
    const image = PNG.sync.read(Buffer.from(event.data, 'base64'));
    let blackPixels = 0;
    for (let index = 0; index < image.data.length; index += 4) {
      if (image.data[index] < 20
        && image.data[index + 1] < 20
        && image.data[index + 2] < 20
        && image.data[index + 3] > 200) {
        blackPixels += 1;
      }
    }
    frames.push({
      elapsedMs: Date.now() - startedAt,
      blackRatio: blackPixels / (image.width * image.height),
    });
    await session.send('Page.screencastFrameAck', { sessionId: event.sessionId })
      .catch(() => undefined);
  });

  await session.send('Page.startScreencast', {
    format: 'png',
    maxWidth: 720,
    maxHeight: 405,
    everyNthFrame: 1,
  });
  startedAt = Date.now();
  await page.evaluate(() => window.__triggerIntroStart());
  await new Promise((resolve) => setTimeout(resolve, 9000));
  await session.send('Page.stopScreencast');

  const blackFrames = frames.filter((frame) =>
    frame.elapsedMs >= 100 && frame.blackRatio > 0.5);
  const state = await page.evaluate(() => ({
    backend: globalThis.tf?.getBackend?.() ?? '',
    gameView: document.body.dataset.gameView ?? '',
    poseState: document.body.dataset.poseState ?? '',
  }));
  console.log(JSON.stringify({
    frames: frames.length,
    blackFrames: blackFrames.length,
    maxBlackRatio: Math.max(0, ...frames.map((frame) => frame.blackRatio)),
    state,
  }, null, 2));
  if (state.gameView !== 'play') throw new Error('start transition did not enter play');
  if (blackFrames.length > 0) {
    throw new Error(`detected ${blackFrames.length} black transition frames`);
  }
} finally {
  await browser.close();
}
