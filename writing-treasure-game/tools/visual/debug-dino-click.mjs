import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const outDir = path.join(root, 'test-results', 'play-fix');
await fs.mkdir(outDir, { recursive: true });

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: '43912' },
  stdio: 'ignore',
  windowsHide: true,
});

async function wait() {
  for (let i = 0; i < 50; i += 1) {
    try {
      if ((await fetch('http://127.0.0.1:43912/health')).ok) return;
    } catch { /* */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('no server');
}

try {
  await wait();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 1 }));
    await route.fulfill({ response, json: pack });
  });
  await page.goto('http://127.0.0.1:43912/?skipIntro=1&scene=dinosaur', {
    waitUntil: 'domcontentloaded', timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  console.log('ready stage', await page.evaluate(() => document.body.dataset.gameStage));
  await page.waitForSelector('body[data-game-stage="dinosaur"]', { timeout: 15000 }).catch(() => null);
  // Try several click targets on column B (option / chest / hole)
  for (const [x, y] of [[712, 520], [712, 580], [712, 610], [1084, 580]]) {
    await page.mouse.click(x, y);
    await page.waitForTimeout(300);
    const ds = await page.evaluate(() => ({ ...document.body.dataset }));
    console.log('click', x, y, 'deerW', ds.deerActionW, 'ans', ds.answerCorrect);
    if (ds.deerActionW || ds.answerCorrect) break;
  }
  for (let i = 0; i < 24; i += 1) {
    await page.waitForTimeout(500);
    const ds = await page.evaluate(() => ({ ...document.body.dataset }));
    console.log(
      i,
      'view', ds.gameView,
      'ans', ds.answerCorrect,
      'mode', ds.feedbackMode,
      'layers', ds.feedbackLayers,
      'deerW', ds.deerActionW,
    );
    if (ds.feedbackMode || ds.answerCorrect) {
      await page.screenshot({
        path: path.join(outDir, 'debug-dino-feedback.png'),
        clip: { x: 0, y: 0, width: 1440, height: 810 },
      });
      break;
    }
  }
  await page.screenshot({
    path: path.join(outDir, 'debug-dino-final.png'),
    clip: { x: 0, y: 0, width: 1440, height: 810 },
  });
  await browser.close();
} finally {
  server.kill();
}
