import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = process.env.CHASE_URL?.trim() || 'http://127.0.0.1:43912';
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const output = path.resolve('test-results', 'dinosaur-chase-responsive');
const baseColumns = [-355, -1, 342];
const personExitFrames = [
  { edge: 54, gone: 55 },
  { edge: 52, gone: 53 },
  { edge: 48, gone: 49 },
];
const questionBank = JSON.parse(
  await fs.readFile(path.resolve('config', 'question-bank.json'), 'utf8'),
);
const cases = [
  { name: 'desktop-a', viewport: { width: 1440, height: 810 }, selected: 0 },
  { name: 'desktop-b', viewport: { width: 1440, height: 810 }, selected: 1 },
  { name: 'desktop-c', viewport: { width: 1440, height: 810 }, selected: 2 },
  { name: 'wide-b', viewport: { width: 2271, height: 960 }, selected: 1 },
  { name: 'miniprogram-b', viewport: { width: 915, height: 412 }, selected: 1 },
];

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const report = [];

try {
  for (const testCase of cases) {
    const context = await browser.newContext({ viewport: testCase.viewport });
    const page = await context.newPage();
    await page.route('**/question-bank.json', async (route) => {
      const correctIndex = (testCase.selected + 1) % 3;
      await route.fulfill({
        json: {
          ...questionBank,
          questions: questionBank.questions.map((question) => ({
            ...question,
            correctIndex,
          })),
        },
      });
    });
    await page.goto(`${baseUrl}/?scene=dinosaur&skipIntro=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
    await page.waitForSelector('body[data-game-stage="dinosaur"]', { timeout: 15000 });

    const columns = await page.evaluate(() => (
      document.body.dataset.choiceColumns?.split(',').map(Number) ?? []
    ));
    const scale = Math.min(testCase.viewport.width / 1440, testCase.viewport.height / 810);
    const stageLeft = (testCase.viewport.width - 1440 * scale) / 2;
    const stageTop = (testCase.viewport.height - 810 * scale) / 2;
    await page.mouse.click(
      stageLeft + (720 + columns[testCase.selected]) * scale,
      stageTop + 520 * scale,
    );
    await page.waitForSelector('body[data-feedback-stage-motion]', { timeout: 25000 });
    await page.waitForFunction(() => {
      const image = document.querySelector('img[data-customer-motion="FeedbackStageMotion"]');
      return image instanceof HTMLImageElement
        && image.naturalWidth === 1440
        && getComputedStyle(image).display !== 'none';
    }, null, { timeout: 10000 });
    await page.waitForTimeout(70);

    const start = await page.evaluate(({ selected, targetX }) => {
      const image = document.querySelector('img[data-customer-motion="FeedbackStageMotion"]');
      if (!(image instanceof HTMLImageElement)) throw new Error('stage motion image missing');
      const rect = image.getBoundingClientRect();
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context2d = canvas.getContext('2d', { willReadFrequently: true });
      if (!context2d) throw new Error('2d context missing');
      context2d.drawImage(image, 0, 0);
      const pixels = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
      let minX = canvas.width;
      let maxX = -1;
      let minY = canvas.height;
      let maxY = -1;
      const fromX = Math.max(0, Math.floor(targetX - 230));
      const toX = Math.min(canvas.width, Math.ceil(targetX + 230));
      for (let y = 0; y < 500; y += 1) {
        for (let x = fromX; x < toX; x += 1) {
          if (pixels[(y * canvas.width + x) * 4 + 3] <= 16) continue;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
      return {
        selected,
        source: image.currentSrc || image.src,
        rect: { left: rect.left, right: rect.right, width: rect.width },
        fit: getComputedStyle(image).objectFit,
        objectPosition: getComputedStyle(image).objectPosition,
        top: rect.top,
        alpha: maxX >= minX
          ? { minX, maxX, minY, maxY, centerX: (minX + maxX) / 2 }
          : null,
      };
    }, { selected: testCase.selected, targetX: 720 + baseColumns[testCase.selected] });
    const encoded = await page.evaluate(async ({ source, exitFrames }) => {
      const data = await (await fetch(source, { cache: 'no-store' })).arrayBuffer();
      const decoder = new ImageDecoder({ data, type: 'image/webp' });
      await decoder.tracks.ready;
      const alphaMaxX = async (frameIndex) => {
        const { image } = await decoder.decode({ frameIndex });
        const canvas = document.createElement('canvas');
        canvas.width = image.displayWidth;
        canvas.height = image.displayHeight;
        const context2d = canvas.getContext('2d', { willReadFrequently: true });
        if (!context2d) throw new Error('2d context missing');
        context2d.drawImage(image, 0, 0);
        const pixels = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
        let maxX = -1;
        for (let y = 0; y < canvas.height; y += 1) {
          for (let x = 0; x < canvas.width; x += 1) {
            if (pixels[(y * canvas.width + x) * 4 + 3] > 16) maxX = Math.max(maxX, x);
          }
        }
        image.close();
        return maxX;
      };
      const personRightEdgePixels = async (frameIndex) => {
        const { image } = await decoder.decode({ frameIndex });
        const canvas = document.createElement('canvas');
        canvas.width = image.displayWidth;
        canvas.height = image.displayHeight;
        const context2d = canvas.getContext('2d', { willReadFrequently: true });
        if (!context2d) throw new Error('2d context missing');
        context2d.drawImage(image, 0, 0);
        const pixels = context2d.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        let maxX = -1;
        // The person leads the chase in this upper-right region. Once the
        // person exits, the following dinosaur remains left of this crop.
        for (let y = 0; y < 270; y += 1) {
          for (let x = 1200; x < canvas.width; x += 1) {
            if (pixels[(y * canvas.width + x) * 4 + 3] <= 16) continue;
            count += 1;
            maxX = Math.max(maxX, x);
          }
        }
        image.close();
        return { count, maxX };
      };
      return {
        frameCount: decoder.tracks.selectedTrack?.frameCount ?? 0,
        personEdgeFrame: exitFrames.edge,
        personEdge: await personRightEdgePixels(exitFrames.edge),
        personGoneFrame: exitFrames.gone,
        personGone: await personRightEdgePixels(exitFrames.gone),
        finalMaxX: await alphaMaxX(71),
      };
    }, {
      source: start.source,
      exitFrames: personExitFrames[testCase.selected],
    });
    await page.screenshot({
      path: path.join(output, `${testCase.name}-start.png`),
      fullPage: true,
    });
    await page.waitForTimeout(1980);
    await page.screenshot({
      path: path.join(output, `${testCase.name}-right-edge.png`),
      fullPage: true,
    });

    const issues = [];
    const expectedSuffix = `/wrong-${testCase.selected + 1}.webp`;
    if (!start.source.includes(expectedSuffix)) issues.push(`source=${start.source}`);
    if (start.rect.left > 0.5) issues.push(`left=${start.rect.left}`);
    if (start.rect.right < testCase.viewport.width - 0.5) {
      issues.push(`right=${start.rect.right}/${testCase.viewport.width}`);
    }
    if (start.fit !== 'cover') issues.push(`fit=${start.fit}`);
    if (start.objectPosition !== '50% 50%') {
      issues.push(`objectPosition=${start.objectPosition}`);
    }
    const expectedGroundY = stageTop + 418 * scale;
    const coverScale = start.rect.width / 1440;
    const actualGroundY = start.top + 418 * coverScale;
    if (Math.abs(actualGroundY - expectedGroundY) > 1.5) {
      issues.push(`ground=${actualGroundY}/${expectedGroundY}`);
    }
    const expectedCenter = 720 + baseColumns[testCase.selected];
    if (!start.alpha || Math.abs(start.alpha.centerX - expectedCenter) > 25) {
      issues.push(`startCenter=${start.alpha?.centerX ?? 'missing'} expected=${expectedCenter}`);
    }
    if (encoded.frameCount !== 72) issues.push(`frames=${encoded.frameCount}`);
    if (encoded.personEdge.maxX < 1438 || encoded.personEdge.count < 1) {
      issues.push(`personEdge=${JSON.stringify(encoded.personEdge)}`);
    }
    if (encoded.personGone.count !== 0) {
      issues.push(`personGone=${JSON.stringify(encoded.personGone)}`);
    }
    if (encoded.finalMaxX < 1438) issues.push(`finalMaxX=${encoded.finalMaxX}`);
    report.push({ ...testCase, start, encoded, issues });
    await context.close();
  }
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(output, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
if (report.some((item) => item.issues.length)) process.exitCode = 1;
