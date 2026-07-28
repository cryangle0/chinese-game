import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const baseUrl = process.env.PLAY_HOTSPOT_URL ?? 'http://127.0.0.1:44200';
const outputRoot = path.resolve('test-results/play-hotspots');
const scenes = ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic'];
const viewports = [
  { name: 'design', width: 1440, height: 810 },
  { name: 'ultrawide', width: 1024, height: 472 },
];
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const browser = await chromium.launch({
  headless: true,
  executablePath: chrome,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
});

try {
  await fs.mkdir(outputRoot, { recursive: true });
  const report = [];
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport });
    for (const scene of scenes) {
      const page = await context.newPage();
      await page.goto(`${baseUrl}/index.html?skipIntro=1&scene=${scene}`, {
        waitUntil: 'networkidle',
        timeout: 60000,
      });
      await page.waitForFunction(
        (expected) => document.body?.dataset?.gameView === 'play'
          && document.body?.dataset?.gameStage === expected
          && document.body?.dataset?.choiceScene === expected,
        scene,
        { timeout: 30000 },
      );
      await page.waitForTimeout(500);
      const metrics = await page.evaluate(() => ({
        backgroundScaleX: Number(document.body.dataset.playBackdropScale),
        columns: (document.body.dataset.choiceColumns ?? '').split(',').map(Number),
        optionFrame: document.body.dataset.choiceOptionFrame ?? '',
        fallbackCleared: document.body.dataset.choiceOptionFallbackCleared === '1',
      }));
      if (metrics.columns.length !== 3
        || metrics.columns.some((value) => !Number.isFinite(value))
        || metrics.optionFrame !== '250x104@105'
        || !metrics.fallbackCleared) {
        throw new Error(`${scene}/${viewport.name} exposed invalid choice layout`);
      }
      const screenshot = path.join(outputRoot, `${viewport.name}-${scene}.png`);
      await page.screenshot({ path: screenshot });
      const stageScale = Math.min(viewport.width / 1440, viewport.height / 810);
      await page.mouse.click(
        viewport.width / 2 + metrics.columns[1] * stageScale,
        viewport.height / 2 + 100 * stageScale,
      );
      await page.waitForFunction(
        () => ['true', 'false'].includes(document.body?.dataset?.answerCorrect ?? ''),
        null,
        { timeout: 5000 },
      );
      report.push({ scene, viewport: viewport.name, interaction: 'answered', ...metrics });
      await page.close();
    }
    await context.close();
  }
  await fs.writeFile(
    path.join(outputRoot, 'report.json'),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
