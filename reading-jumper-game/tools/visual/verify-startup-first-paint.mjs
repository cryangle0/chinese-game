import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const { PNG } = require('pngjs');

const baseUrl = process.env.STARTUP_PAINT_URL
  ?? 'https://game.xyouxing.com/reading-jumper';
const outputRoot = path.resolve('test-results/startup-first-paint');
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

try {
  await fs.mkdir(outputRoot, { recursive: true });
  const context = await browser.newContext({
    viewport: { width: 1024, height: 472 },
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const session = await context.newCDPSession(page);
  await session.send('Network.enable');
  await session.send('Network.setCacheDisabled', { cacheDisabled: true });
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 120,
    downloadThroughput: 1024 * 1024,
    uploadThroughput: 128 * 1024,
    connectionType: 'cellular4g',
  });

  const frames = [];
  let startedAt = Date.now();
  let documentAt = Number.POSITIVE_INFINITY;
  let readyAt = Number.POSITIVE_INFINITY;
  page.on('response', (response) => {
    if (response.request().resourceType() === 'document') documentAt = Date.now();
  });
  session.on('Page.screencastFrame', async (event) => {
    const capturedAt = Date.now();
    const bytes = Buffer.from(event.data, 'base64');
    const image = PNG.sync.read(bytes);
    let black = 0;
    let white = 0;
    for (let index = 0; index < image.data.length; index += 4) {
      const red = image.data[index];
      const green = image.data[index + 1];
      const blue = image.data[index + 2];
      if (red < 24 && green < 24 && blue < 24) black += 1;
      if (red > 235 && green > 235 && blue > 235) white += 1;
    }
    const pixels = image.width * image.height;
    frames.push({
      capturedAt,
      elapsedMs: capturedAt - startedAt,
      blackRatio: black / pixels,
      whiteRatio: white / pixels,
      bytes,
    });
    await session.send('Page.screencastFrameAck', { sessionId: event.sessionId })
      .catch(() => undefined);
  });
  await session.send('Page.startScreencast', {
    format: 'png',
    maxWidth: 1024,
    maxHeight: 472,
    everyNthFrame: 1,
  });

  startedAt = Date.now();
  await page.goto(`${baseUrl}/index.html?startupProbe=${startedAt}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  let ready = true;
  try {
    await page.waitForFunction(
      () => document.body?.dataset?.gameReady === 'true',
      null,
      { timeout: 120000 },
    );
  } catch {
    ready = false;
  }
  readyAt = Date.now();
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(outputRoot, 'ready.png') });
  await session.send('Page.stopScreencast');

  const startupFrames = frames.filter((frame) =>
    frame.capturedAt >= documentAt && frame.capturedAt <= readyAt);
  const whiteFrames = startupFrames.filter((frame) => frame.whiteRatio > 0.7);
  const blackFrames = startupFrames.filter((frame) => frame.blackRatio > 0.7);
  const worstWhite = startupFrames.toSorted((a, b) => b.whiteRatio - a.whiteRatio)[0];
  const worstBlack = startupFrames.toSorted((a, b) => b.blackRatio - a.blackRatio)[0];
  if (worstWhite) await fs.writeFile(path.join(outputRoot, 'worst-white.png'), worstWhite.bytes);
  if (worstBlack) await fs.writeFile(path.join(outputRoot, 'worst-black.png'), worstBlack.bytes);
  const report = {
    url: baseUrl,
    ready,
    documentResponseMs: documentAt - startedAt,
    readyMs: readyAt - startedAt,
    frames: startupFrames.length,
    whiteFrames: whiteFrames.length,
    blackFrames: blackFrames.length,
    maxWhiteRatio: Math.max(0, ...startupFrames.map((frame) => frame.whiteRatio)),
    maxBlackRatio: Math.max(0, ...startupFrames.map((frame) => frame.blackRatio)),
  };
  await fs.writeFile(
    path.join(outputRoot, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
  if (!ready || whiteFrames.length || blackFrames.length) {
    throw new Error(
      `startup ready=${ready}; exposed ${whiteFrames.length} white `
        + `and ${blackFrames.length} black frames`,
    );
  }
} finally {
  await browser.close();
}
