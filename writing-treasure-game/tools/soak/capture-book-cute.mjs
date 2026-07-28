import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = path.resolve(import.meta.dirname, '../../../test-results/pixel-audit/followup');
fs.mkdirSync(out, { recursive: true });
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function shot(url, name) {
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
  await page.waitForFunction(
    () => document.body.dataset.gameView === 'intro'
      || document.body.dataset.bookSelect != null,
    null,
    { timeout: 20000 },
  ).catch(() => {});
  await page.waitForTimeout(800);
  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  const ox = box.x + (box.width - 1440 * scale) / 2;
  const oy = box.y + (box.height - 810 * scale) / 2;
  const file = path.join(out, name);
  await page.screenshot({
    path: file,
    clip: { x: ox, y: oy, width: 1440 * scale, height: 810 * scale },
  });
  const meta = await page.evaluate(() => ({
    view: document.body.dataset.gameView,
    book: document.body.dataset.bookSelect,
  }));
  await browser.close();
  return { file, bytes: fs.statSync(file).size, meta };
}

const reading = await shot('http://127.0.0.1:43887/', '07-reading-intro-book-cute.png');
const writing = await shot('http://127.0.0.1:43886/', '08-writing-intro-book-cute.png');
console.log(JSON.stringify({ reading, writing }, null, 2));
