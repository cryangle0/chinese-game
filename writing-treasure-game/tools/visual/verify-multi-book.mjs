/**
 * Multi-book verify:
 * 1) skipIntro+book=… filter path (all books)
 * 2) intro UI select → play (first 6 books, correct row)
 *
 * Usage:
 *   node tools/visual/verify-multi-book.mjs
 *   BOOKS=西游记,红楼梦,山海经 node tools/visual/verify-multi-book.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'test-results', 'multi-book');
const port = process.env.MULTI_BOOK_PORT?.trim() || '43971';
const baseUrl = process.env.MULTI_BOOK_URL?.trim() || `http://127.0.0.1:${port}`;
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chipY = Number(process.env.BOOK_CHIP_Y || 348);
const startX = Number(process.env.BOOK_START_X || 720);
const startY = Number(process.env.BOOK_START_Y || 365);

const ALL_BOOKS = [
  '西游记', '三国演义', '红楼梦', '水浒传', '安徒生童话', '格林童话',
  '伊索寓言', '中国古代寓言', '中国民间故事', '山海经',
  '骆驼祥子', '秘密花园', '克雷洛夫寓言', '和大人一起读1', '读读童话故事1',
];
const books = (process.env.BOOKS?.trim()
  ? process.env.BOOKS.split(/[,，]/).map((s) => s.trim()).filter(Boolean)
  : ALL_BOOKS);

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

async function waitKp(page, book, timeoutMs = 30000) {
  await page.waitForFunction(
    (b) => document.body?.dataset?.gameView === 'play'
      && document.body?.dataset?.questionKp === b,
    book,
    { timeout: timeoutMs },
  );
}

async function checkFilterPath(page, book) {
  await page.goto(
    `${baseUrl}/index.html?skipIntro=1&book=${encodeURIComponent(book)}&_=${Date.now()}`,
    { waitUntil: 'domcontentloaded', timeout: 90000 },
  );
  await waitKp(page, book, 60000);
  const diag = await page.evaluate(() => ({
    kp: document.body.dataset.questionKp,
    filter: document.body.dataset.filterBook,
    stem: document.body.dataset.questionStem,
    id: document.body.dataset.questionId,
  }));
  if (diag.kp !== book) throw new Error(`filter path kp=${diag.kp}`);
  return diag;
}

async function checkIntroPath(page, book, bookIndex, vp) {
  await page.goto(`${baseUrl}/index.html?_=${Date.now()}`, {
    waitUntil: 'domcontentloaded', timeout: 90000,
  });
  await page.waitForFunction(
    () => document.body?.dataset?.gameReady === 'true'
      && document.body?.dataset?.gameView === 'intro'
      && document.body?.dataset?.hasBookSelect === '1',
    null,
    { timeout: 90000 },
  );

  const chip = designPoint(vp, 720, 405 - chipY);
  await page.mouse.click(chip.x, chip.y);
  await page.waitForFunction(() => document.body.dataset.bookDropdownOpen === '1', null, { timeout: 5000 });

  // Jump via scrollbar thumb (more reliable than list drag for large idx).
  const panelTop = (405 - chipY) + 43;
  const panelH = 6 * 56 + 24;
  const maxStart = Math.max(0, 50 - 6);
  const targetStart = Math.max(0, Math.min(maxStart, bookIndex - 2));
  const thumbX = designPoint(vp, 720 + 198, panelTop + panelH * 0.2);
  // Drag thumb from near-top to fraction of track.
  const trackTop = designPoint(vp, 720 + 198, panelTop + 20);
  const trackBot = designPoint(vp, 720 + 198, panelTop + panelH - 20);
  const t = maxStart === 0 ? 0 : targetStart / maxStart;
  const thumbY = trackTop.y + (trackBot.y - trackTop.y) * t;
  await page.mouse.move(trackTop.x, trackTop.y);
  await page.mouse.down();
  await page.mouse.move(trackTop.x, thumbY, { steps: 16 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  let windowStart = Number(await page.evaluate(() => document.body.dataset.bookWindow || '0'));
  // Fine-tune with wheel if needed.
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (bookIndex >= windowStart && bookIndex < windowStart + 6) break;
    const needDown = bookIndex >= windowStart + 6;
    await page.mouse.move(thumbX.x - 80, thumbX.y);
    await page.mouse.wheel(0, needDown ? 240 : -240);
    await page.waitForTimeout(80);
    windowStart = Number(await page.evaluate(() => document.body.dataset.bookWindow || '0'));
  }
  if (bookIndex < windowStart || bookIndex >= windowStart + 6) {
    throw new Error(`could not scroll to idx=${bookIndex} win=${windowStart}`);
  }

  const visibleRow = bookIndex - windowStart;
  const row = designPoint(vp, 700, panelTop + 56 * visibleRow + 28);
  await page.mouse.click(row.x, row.y);
  await page.waitForTimeout(450);
  let selected = await page.evaluate(() => document.body.dataset.bookSelect);
  // Default book may already be selected; accept if chip matches.
  if (selected !== book) {
    await page.mouse.click(row.x, row.y);
    await page.waitForTimeout(300);
    selected = await page.evaluate(() => document.body.dataset.bookSelect);
  }
  if (selected !== book) {
    throw new Error(`UI select got ${selected} want ${book} (idx=${bookIndex} win=${windowStart})`);
  }

  // Ensure dropdown closed before start.
  if (await page.evaluate(() => document.body.dataset.bookDropdownOpen === '1')) {
    await page.mouse.click(designPoint(vp, 200, 200).x, designPoint(vp, 200, 200).y);
    await page.waitForTimeout(200);
  }

  const start = designPoint(vp, startX, startY);
  await page.mouse.click(start.x, start.y);
  await page.waitForTimeout(400);
  let view = await page.evaluate(() => document.body.dataset.gameView);
  if (view === 'intro') {
    await page.evaluate(() => {
      if (typeof window.__triggerIntroStart === 'function') window.__triggerIntroStart();
    });
    await page.mouse.click(start.x, start.y);
    await page.waitForTimeout(400);
  }
  // Reading shatter FX can take ~1.5s before onStart
  await waitKp(page, book, 60000);
  const diag = await page.evaluate(() => ({
    bookSelect: document.body.dataset.bookSelect,
    filter: document.body.dataset.filterBook,
    kp: document.body.dataset.questionKp,
    stem: document.body.dataset.questionStem,
  }));
  if (diag.kp !== book) throw new Error(`intro path kp=${diag.kp}`);
  return diag;
}

const catalog = [
  '西游记', '三国演义', '红楼梦', '水浒传', '安徒生童话', '格林童话',
  '伊索寓言', '中国古代寓言', '中国民间故事', '山海经', '世界神话传说',
  '希腊神话与英雄传说', '一千零一夜', '稻草人', '小英雄雨来', '骆驼祥子',
  '童年', '爱的教育', '鲁滨逊漂流记', '金银岛', '秘密花园', '爱丽丝漫游奇境',
  '列那狐的故事', '绿野仙踪', '绿野仙踪（注音版）', '克雷洛夫寓言',
  '灰尘的旅行', '看看我们的地球', '米·伊林十万个为什么', '愿望的实现',
  '和大人一起读1', '和大人一起读2', '和大人一起读3', '和大人一起读4',
  '读读儿童故事1', '读读儿童故事2', '读读儿童故事3', '读读儿童故事4',
  '读读童话故事1', '读读童话故事2', '读读童话故事3', '读读童话故事4',
  '读读童谣和儿歌1', '读读童谣和儿歌2', '读读童谣和儿歌3', '读读童谣和儿歌4',
  '孤独的小螃蟹', '神笔马良', '尼尔斯骑鹅旅行记', '汤姆·索亚历险记',
];

const server = process.env.MULTI_BOOK_URL ? null : spawn(
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

const report = { filter: [], intro: [], failures: [] };

try {
  if (server) await waitForServer();
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const vp = { width: 1440, height: 810 };
  const page = await browser.newPage({ viewport: vp });

  for (const book of books) {
    process.stdout.write(`filter ${book} ... `);
    try {
      const diag = await checkFilterPath(page, book);
      report.filter.push({ book, ok: true, ...diag });
      console.log('OK', (diag.stem || '').slice(0, 24));
    } catch (error) {
      report.filter.push({ book, ok: false, error: String(error) });
      report.failures.push(`filter:${book}`);
      console.log('FAIL', error.message || error);
    }
  }

  // Intro UI path for first 8 requested books that exist in catalog
  const introBooks = books
    .map((b) => ({ book: b, index: catalog.indexOf(b) }))
    .filter((x) => x.index >= 0)
    .slice(0, 8);

  for (const { book, index } of introBooks) {
    process.stdout.write(`intro  ${book} ... `);
    try {
      const diag = await checkIntroPath(page, book, index, vp);
      report.intro.push({ book, ok: true, ...diag });
      console.log('OK', (diag.stem || '').slice(0, 24));
      await page.screenshot({ path: path.join(outDir, `intro-${index}.png`) });
    } catch (error) {
      report.intro.push({ book, ok: false, error: String(error) });
      report.failures.push(`intro:${book}`);
      console.log('FAIL', error.message || error);
    }
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    filterPass: report.filter.filter((r) => r.ok).length,
    filterTotal: report.filter.length,
    introPass: report.intro.filter((r) => r.ok).length,
    introTotal: report.intro.length,
    failures: report.failures,
  }, null, 2));
  if (report.failures.length) {
    console.error('MULTI_BOOK_FAIL');
    process.exit(1);
  }
  console.log('MULTI_BOOK_ALL_PASS');
} finally {
  if (server?.pid) {
    try { process.kill(server.pid); } catch { /* ignore */ }
  }
}
