import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'test-results', 'settlement-audit');
const baseUrl = process.env.SETTLEMENT_BASE_URL?.trim() || 'http://127.0.0.1:43892';
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const scenes = ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic'];
const viewports = [
  { width: 1440, height: 810 },
  { width: 2560, height: 1080 },
  { width: 915, height: 407, mobile: true },
];
const cases = [
  ...scenes.flatMap((scene) => (
    viewports.map((viewport) => ({ scene, ...viewport }))
  )),
  { scene: 'dinosaur', width: 2271, height: 960 },
];

async function waitForServer(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('settlement audit server did not start');
}

function designPoint(testCase, x, y) {
  const scale = Math.min(testCase.width / 1440, testCase.height / 810);
  return {
    x: (testCase.width - 1440 * scale) / 2 + x * scale,
    y: (testCase.height - 810 * scale) / 2 + y * scale,
  };
}

async function press(page, testCase, x, y) {
  const point = designPoint(testCase, x, y);
  if (testCase.mobile) await page.touchscreen.tap(point.x, point.y);
  else await page.mouse.click(point.x, point.y);
}

async function useDeterministicAnswers(page) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({ ...question, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });
}

async function completeQuestion(page, testCase) {
  await press(page, testCase, 310, 595);
  // Auto dig → open/break → feedback (no manual strike taps).
  await page.waitForSelector('body[data-answer-correct]', { timeout: 12000 });
  await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
    timeout: 8000,
  });
}

function edgeMetrics(image) {
  let black = 0;
  let samples = 0;
  let luminance = 0;
  const strip = Math.max(2, Math.min(6, Math.floor(image.width / 200)));
  for (let y = 0; y < image.height; y += 1) {
    for (const startX of [0, image.width - strip]) {
      for (let x = startX; x < startX + strip; x += 1) {
        const offset = (y * image.width + x) * 4;
        const value = (
          image.data[offset] + image.data[offset + 1] + image.data[offset + 2]
        ) / 3;
        if (value < 10) black += 1;
        luminance += value;
        samples += 1;
      }
    }
  }
  return {
    blackRatio: black / samples,
    meanLuminance: luminance / samples,
  };
}

function frameMetrics(image) {
  let black = 0;
  let luminance = 0;
  let samples = 0;
  for (let y = 0; y < image.height; y += 4) {
    for (let x = 0; x < image.width; x += 4) {
      const offset = (y * image.width + x) * 4;
      const value = (
        image.data[offset] + image.data[offset + 1] + image.data[offset + 2]
      ) / 3;
      if (value < 10) black += 1;
      luminance += value;
      samples += 1;
    }
  }
  return { blackRatio: black / samples, meanLuminance: luminance / samples };
}

async function inspectResult(page, testCase, screenshot) {
  const runtime = await page.evaluate(() => {
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const images = [...document.images];
    return {
      viewport: { width: innerWidth, height: innerHeight },
      canvas: canvas?.toJSON(),
      scroll: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      resultLayout: {
        artworkScale: Number(document.body.dataset.resultArtworkScale),
        artworkOffsetY: Number(document.body.dataset.resultArtworkOffsetY),
        backdropScale: Number(document.body.dataset.resultBackdropScale),
        positionScaleX: Number(document.body.dataset.resultPositionScaleX),
        bleedMode: document.body.dataset.resultBleedMode,
      },
      missingImages: images
        .filter((image) => (
          Boolean(image.currentSrc || image.src)
          && (!image.complete || image.naturalWidth === 0)
        ))
        .map((image) => image.currentSrc || image.src),
      resultMotionReady: images.some((image) => (
        image.dataset.customerMotion === 'ResultCharacterMotion'
        && image.complete
        && getComputedStyle(image).display !== 'none'
      )),
    };
  });
  const image = PNG.sync.read(screenshot);
  const edge = edgeMetrics(image);
  const frame = frameMetrics(image);
  const canvas = runtime.canvas;
  if (!canvas
    || Math.abs(canvas.left) > 1
    || Math.abs(canvas.top) > 1
    || Math.abs(canvas.width - testCase.width) > 1
    || Math.abs(canvas.height - testCase.height) > 1) {
    throw new Error(`${testCase.scene} canvas did not cover viewport: ${JSON.stringify(canvas)}`);
  }
  if (runtime.scroll.width !== testCase.width || runtime.scroll.height !== testCase.height) {
    throw new Error(`${testCase.scene} page overflowed: ${JSON.stringify(runtime.scroll)}`);
  }
  if (runtime.missingImages.length || !runtime.resultMotionReady) {
    throw new Error(`${testCase.scene} result media incomplete: ${JSON.stringify(runtime)}`);
  }
  if (frame.blackRatio > 0.65 || frame.meanLuminance < 20) {
    throw new Error(`${testCase.scene} rendered a mostly blank frame: ${JSON.stringify(frame)}`);
  }
  if (edge.blackRatio > 0.02 || edge.meanLuminance < 15) {
    throw new Error(`${testCase.scene} has black/blank viewport edges: ${JSON.stringify(edge)}`);
  }
  const stageScale = Math.min(
    testCase.width / 1440,
    testCase.height / 810,
  );
  const expectedBackdropScale = testCase.width / (1440 * stageScale);
  if (!Number.isFinite(runtime.resultLayout.artworkScale)
    || Math.abs(runtime.resultLayout.artworkScale - 1) > 0.01
    || !Number.isFinite(runtime.resultLayout.backdropScale)
    || Math.abs(runtime.resultLayout.backdropScale - expectedBackdropScale) > 0.01
    || !Number.isFinite(runtime.resultLayout.positionScaleX)
    || Math.abs(runtime.resultLayout.positionScaleX - expectedBackdropScale) > 0.01
    || runtime.resultLayout.bleedMode !== 'stretch-x'
    || Math.abs(runtime.resultLayout.artworkOffsetY) > 0.001) {
    throw new Error(
      `${testCase.scene} result must keep 1:1 artwork with mapped stretch-X positions: `
      + JSON.stringify(runtime.resultLayout),
    );
  }
  return { ...runtime, edge, frame };
}

async function alphaReport() {
  const bundleRoot = path.join(root, 'assets', 'theme-bundles');
  const themes = await fs.readdir(bundleRoot, { withFileTypes: true });
  const report = [];
  for (const theme of themes.filter((entry) => entry.isDirectory())) {
    const directory = path.join(bundleRoot, theme.name);
    const files = (await fs.readdir(directory))
      .filter((name) => /^result.*\.png$/i.test(name));
    for (const name of files) {
      const image = PNG.sync.read(await fs.readFile(path.join(directory, name)));
      let left = image.width;
      let top = image.height;
      let right = 0;
      let bottom = 0;
      let visiblePixels = 0;
      let alphaTotal = 0;
      let weightedX = 0;
      let weightedY = 0;
      for (let y = 0; y < image.height; y += 1) {
        for (let x = 0; x < image.width; x += 1) {
          const alpha = image.data[(y * image.width + x) * 4 + 3];
          if (alpha < 8) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x + 1);
          bottom = Math.max(bottom, y + 1);
          visiblePixels += 1;
          alphaTotal += alpha;
          weightedX += x * alpha;
          weightedY += y * alpha;
        }
      }
      if (!visiblePixels) throw new Error(`empty result asset: ${theme.name}/${name}`);
      report.push({
        asset: `${theme.name}/${name}`,
        size: [image.width, image.height],
        alpha_bbox: [left, top, right, bottom],
        visual_centroid: [
          Number((weightedX / alphaTotal).toFixed(2)),
          Number((weightedY / alphaTotal).toFixed(2)),
        ],
        visible_ratio: Number((visiblePixels / (image.width * image.height)).toFixed(4)),
      });
    }
  }
  await fs.writeFile(
    path.join(output, 'asset-alpha-bounds.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  return report.length;
}

await fs.mkdir(output, { recursive: true });
const server = process.env.SETTLEMENT_BASE_URL ? null : spawn(
  process.execPath,
  ['server/index.mjs'],
  {
    cwd: root,
    env: { ...process.env, PORT: '43892' },
    stdio: 'ignore',
    windowsHide: true,
  },
);

try {
  if (server) await waitForServer();
  const assetCount = await alphaReport();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const results = [];
  try {
    for (const testCase of cases) {
      const context = await browser.newContext({
        viewport: { width: testCase.width, height: testCase.height },
        isMobile: testCase.mobile ?? false,
        hasTouch: testCase.mobile ?? false,
      });
      const page = await context.newPage();
      const failures = [];
      page.on('pageerror', (error) => failures.push(error.stack ?? error.message));
      page.on('console', (message) => {
        if (message.type() === 'error') failures.push(message.text());
      });
      await useDeterministicAnswers(page);
      await page.goto(`${baseUrl}?skipIntro=1&scene=${testCase.scene}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 30000 });
      await page.waitForSelector(`body[data-game-stage="${testCase.scene}"]`);
      for (let question = 0; question < 5; question += 1) {
        await completeQuestion(page, testCase);
      }
      await page.waitForSelector(`body[data-stage-result="${testCase.scene}"]`);
      await page.waitForFunction(() => [...document.images].some((image) => (
        image.dataset.customerMotion === 'ResultCharacterMotion'
        && image.complete
        && getComputedStyle(image).display !== 'none'
      )));
      await page.waitForTimeout(350);
      const name = `writing-${testCase.width}x${testCase.height}-${testCase.scene}.png`;
      const screenshot = await page.screenshot({ path: path.join(output, name) });
      const audit = await inspectResult(page, testCase, screenshot);
      if (failures.length) {
        throw new Error(`${testCase.scene} runtime errors:\n${failures.join('\n')}`);
      }
      results.push({ ...testCase, screenshot: name, ...audit });
      await context.close();
      console.log(`PASS ${testCase.scene} ${testCase.width}x${testCase.height}`);
    }
  } finally {
    await browser.close();
  }
  await fs.writeFile(
    path.join(output, 'report.json'),
    `${JSON.stringify({ assetCount, results }, null, 2)}\n`,
  );
  console.log(`Writing settlement audit passed: ${results.length} viewports, ${assetCount} assets`);
} finally {
  if (server) {
    server.kill();
    await Promise.race([
      once(server, 'exit'),
      new Promise((resolve) => setTimeout(resolve, 6000)),
    ]);
  }
}
