import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(
  path.join('E:/angsa/angsa_data/项目/作业帮游戏/reading-jumper-game', 'package.json'),
);
const { chromium } = require('playwright');
const outDir = 'E:/angsa/angsa_data/项目/作业帮游戏/reading-jumper-game/test-results';
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, 'poetry-settlement-fix.png');

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH
    ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });

await page.route('**/question-bank.json', async (route) => {
  const res = await route.fetch();
  const pack = await res.json();
  pack.questions = (pack.questions || []).map((q) => ({ ...q, correctIndex: 0 }));
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(pack),
  });
});

await page.goto('http://127.0.0.1:43881/?skipIntro=1&scene=poetry', {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForFunction(
  () => document.body?.dataset?.gameView === 'play',
  null,
  { timeout: 60000 },
);
await page.waitForTimeout(1200);

for (let q = 0; q < 5; q++) {
  // poetry option col0 center: x=320, y≈419
  await page.mouse.click(320, 420);
  await page.waitForTimeout(1400);
  const view = await page.evaluate(() => document.body.dataset.gameView);
  console.log('after click', q, view, await page.evaluate(() => ({
    answered: document.body.dataset.answered,
    stage: document.body.dataset.gameStage,
  })));
  if (view === 'stage-result') break;
}

await page.waitForFunction(
  () => document.body.dataset.gameView === 'stage-result',
  null,
  { timeout: 30000 },
);
await page.waitForTimeout(1000);
console.log('dataset', await page.evaluate(() => ({ ...document.body.dataset })));
await page.screenshot({ path: out });
console.log('saved', out);
await browser.close();
