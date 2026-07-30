import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const baseUrl = process.env.WRITING_BASE_URL?.trim() || 'http://127.0.0.1:43972';
const output = path.join(root, 'test-results', 'choice-success-colors');
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const columns = [337, 720, 1103];
const cases = [
  {
    scene: 'treasure',
    correct: true,
    expectedNames: ['successState-red', 'successState', 'successState-green'],
  },
  {
    scene: 'treasure',
    correct: false,
    expectedNames: ['failState', 'failState-purple', 'failState-green'],
  },
  {
    scene: 'desert',
    correct: true,
    expectedNames: ['successState-red', 'successState', 'successState-green'],
  },
  {
    scene: 'dunhuang',
    correct: true,
    expectedNames: ['successState-red', 'successState', 'successState-green'],
  },
  {
    scene: 'dunhuang',
    correct: false,
    expectedNames: ['failState', 'failState-white', 'failState-green'],
  },
];

async function designClick(page, x, y) {
  const canvas = await page.locator('#GameCanvas').boundingBox();
  if (!canvas) throw new Error('GameCanvas is unavailable');
  const scale = Math.min(canvas.width / 1440, canvas.height / 810);
  const offsetX = canvas.x + (canvas.width - 1440 * scale) / 2;
  const offsetY = canvas.y + (canvas.height - 810 * scale) / 2;
  await page.mouse.click(offsetX + x * scale, offsetY + y * scale);
}

async function openPlay(page) {
  for (const [x, y] of [[937.5, 466], [980, 550], [720, 520]]) {
    await designClick(page, x, y);
    await page.waitForTimeout(300);
    if (await page.getAttribute('body', 'data-game-view') === 'play') return;
  }
  await page.waitForSelector('body[data-game-view="play"]', { timeout: 20000 });
}

await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

try {
  for (const testCase of cases) {
    for (let index = 0; index < columns.length; index += 1) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
      const page = await context.newPage();
      await page.route('**/question-bank.json', async (route) => {
        const response = await route.fetch();
        const pack = await response.json();
        pack.questions = pack.questions.map((question) => ({
          ...question,
          correctIndex: testCase.correct ? index : (index + 1) % columns.length,
        }));
        await route.fulfill({ response, json: pack });
      });
      await page.goto(`${baseUrl}?skipIntro=1&scene=${testCase.scene}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
      await openPlay(page);
      await page.waitForSelector(
        `body[data-game-stage="${testCase.scene}"]`,
        { timeout: 10000 },
      );
      await page.waitForTimeout(450);
      await designClick(page, columns[index], 610);
      await page.waitForSelector('body[data-dig-effect-active="opened"]', { timeout: 8000 });
      await page.waitForSelector(
        `body[data-choice-reveal-index="${index}"]`
          + `[data-choice-reveal-scene="${testCase.scene}"]`
          + '[data-choice-reveal-ready="true"]',
        { timeout: 8000 },
      );

      const expected = testCase.expectedNames[index];
      const revealAsset = await page.getAttribute('body', 'data-choice-reveal-asset');
      if (!revealAsset?.endsWith(`/${expected}`)) {
        throw new Error(
          `${testCase.scene} ${testCase.correct ? 'correct' : 'wrong'} choice ${index} `
          + `revealed ${revealAsset}, expected ${expected}`,
        );
      }
      if (testCase.correct) {
        await page.waitForSelector(
          'body[data-score-coin-trigger-phase="chest-open"]',
          { timeout: 3000 },
        );
        const timing = await page.evaluate(() => ({
          reveal: Number(document.body.dataset.choiceRevealReadyAt),
          coin: Number(document.body.dataset.scoreCoinTriggerAt),
        }));
        if (!Number.isFinite(timing.reveal)
          || !Number.isFinite(timing.coin)
          || timing.coin < timing.reveal) {
          throw new Error(
            `${testCase.scene} choice ${index} coin started before the opened state rendered: `
            + JSON.stringify(timing),
          );
        }
      }
      await page.waitForTimeout(80);
      const outcome = testCase.correct ? 'correct' : 'wrong';
      const screenshot = path.join(
        output,
        `${testCase.scene}-${outcome}-${index + 1}.png`,
      );
      await page.screenshot({ path: screenshot });
      console.log(
        `PASS ${testCase.scene} ${outcome} choice ${index + 1}: ${expected}`,
      );
      await context.close();
    }
  }
} finally {
  await browser.close();
}
