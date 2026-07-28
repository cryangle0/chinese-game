/**
 * Intro path: select book on cover → start → questionKp must match.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'test-results', 'book-select-play');
const port = process.env.BOOK_SELECT_PORT?.trim() || '43951';
const baseUrl = process.env.BOOK_SELECT_URL?.trim() || `http://127.0.0.1:${port}`;
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const book = process.env.BOOK_SELECT_BOOK?.trim() || '红楼梦';
const chipY = Number(process.env.BOOK_CHIP_Y || 348); // reading 348, writing 360

async function waitForServer(timeoutMs = 25000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server did not start');
}

function designPoint(vp, x, y) {
  const scale = Math.min(vp.width / 1440, vp.height / 810);
  return {
    x: (vp.width - 1440 * scale) / 2 + x * scale,
    y: (vp.height - 810 * scale) / 2 + y * scale,
  };
}

const server = process.env.BOOK_SELECT_URL ? null : spawn(
  process.execPath,
  ['server/index.mjs'],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: port,
      PUBLIC_ROOT: path.join(root, 'build', 'web-mobile'),
      MEDIA_ROOT: path.join(root, 'customer-media'),
    },
    stdio: 'ignore',
    windowsHide: true,
  },
);

try {
  if (server) await waitForServer();
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const vp = { width: 1440, height: 810 };
  const page = await browser.newPage({ viewport: vp });
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(
    () => document.body?.dataset?.gameReady === 'true'
      && document.body?.dataset?.gameView === 'intro'
      && document.body?.dataset?.hasBookSelect === '1',
    null,
    { timeout: 90000 },
  );

  // Open chip
  const chip = designPoint(vp, 720, 405 - chipY);
  await page.mouse.click(chip.x, chip.y);
  await page.waitForFunction(() => document.body.dataset.bookDropdownOpen === '1', null, { timeout: 5000 });

  // 红楼梦 is index 2 → third visible row
  const panelTop = (405 - chipY) + 43;
  const row = designPoint(vp, 700, panelTop + 56 * 2 + 28);
  await page.mouse.click(row.x, row.y);
  await page.waitForTimeout(400);
  const selected = await page.evaluate(() => document.body.dataset.bookSelect);
  if (selected !== book) throw new Error(`select failed: got ${selected} want ${book}`);

  // Start button (reading ≈ center; writing Intro.start center ≈ 938,466)
  const startX = Number(process.env.BOOK_START_X || 720);
  const startY = Number(process.env.BOOK_START_Y || 405);
  const start = designPoint(vp, startX, startY);
  await page.mouse.click(start.x, start.y);
  // Fallback: click slightly left if miss
  await page.waitForTimeout(400);
  const stillIntro = await page.evaluate(() => document.body.dataset.gameView === 'intro');
  if (stillIntro) {
    await page.mouse.click(start.x - 40, start.y);
  }
  // Reading has shatter FX delay
  await page.waitForFunction(
    () => document.body?.dataset?.gameView === 'play' && document.body?.dataset?.questionKp,
    null,
    { timeout: 30000 },
  );
  await page.waitForTimeout(300);

  const diag = await page.evaluate(() => ({
    bookSelect: document.body.dataset.bookSelect,
    filterBook: document.body.dataset.filterBook,
    questionKp: document.body.dataset.questionKp,
    questionStem: document.body.dataset.questionStem,
    questionId: document.body.dataset.questionId,
  }));
  await page.screenshot({ path: path.join(outDir, `play-${book}.png`) });
  await browser.close();

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(diag, null, 2));
  console.log(JSON.stringify(diag, null, 2));
  if (diag.questionKp !== book) {
    throw new Error(`MISMATCH questionKp=${diag.questionKp} book=${book} filter=${diag.filterBook}`);
  }
  if (diag.filterBook && diag.filterBook !== book) {
    throw new Error(`filterBook=${diag.filterBook} != ${book}`);
  }
  console.log(`BOOK_SELECT_PLAY_OK book=${book}`);
} finally {
  if (server?.pid) {
    try { process.kill(server.pid); } catch { /* ignore */ }
  }
}
