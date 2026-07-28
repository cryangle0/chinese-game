/**
 * Verify cover book picker: 40 titles, fixed-height dropdown, interactive soon after ready.
 * Screenshots: test-results/book-picker/
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'test-results', 'book-picker');
const baseUrl = process.env.BOOK_PICKER_URL?.trim() || 'http://127.0.0.1:43942';
const chromePath = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const EXPECT_BOOKS = 50;
const EXPECT_DROPDOWN_H = 6 * 56 + 24; // 360

fs.mkdirSync(outDir, { recursive: true });

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

const server = process.env.BOOK_PICKER_URL ? null : spawn(
  process.execPath,
  ['server/index.mjs'],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: '43942',
      PUBLIC_ROOT: path.join(root, 'build', 'web-mobile'),
      MEDIA_ROOT: path.join(root, 'customer-media'),
    },
    stdio: 'ignore',
    windowsHide: true,
  },
);

const report = [];
const failures = [];

try {
  if (server) await waitForServer();
  const browser = await chromium.launch({ executablePath: chromePath, headless: true });
  const vp = { width: 1440, height: 810 };
  const page = await browser.newPage({ viewport: vp });
  const t0 = Date.now();
  await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await page.waitForFunction(
    () => document.body?.dataset?.gameReady === 'true'
      && document.body?.dataset?.gameView === 'intro'
      && document.body?.dataset?.hasBookSelect === '1',
    null,
    { timeout: 90000 },
  );
  const readyMs = Date.now() - t0;

  // Book chip at cocos (0,348) 鈫?design top-left (720, 405-348).
  const interactT0 = Date.now();
  const chipPt = designPoint(vp, 720, 405 - 360);
  await page.mouse.click(chipPt.x, chipPt.y);
  await page.waitForFunction(
    () => document.body?.dataset?.bookDropdownOpen === '1',
    null,
    { timeout: 5000 },
  );
  const openMs = Date.now() - interactT0;

  const diag = await page.evaluate(() => ({
    bookCount: document.body.dataset.bookCount,
    bookSelect: document.body.dataset.bookSelect,
    dropdownH: document.body.dataset.bookDropdownH,
    dropdownOpen: document.body.dataset.bookDropdownOpen,
  }));

  await page.screenshot({ path: path.join(outDir, '01-dropdown-open.png') });

  // Drag list upward 鈫?windowStart should increase.
  const panelTopDesign = (405 - 360) + 43;
  const dragFrom = designPoint(vp, 700, panelTopDesign + 56 * 3 + 20);
  const winBefore = await page.evaluate(() => Number(document.body.dataset.bookWindow || '0'));
  await page.mouse.move(dragFrom.x, dragFrom.y);
  await page.mouse.down();
  await page.mouse.move(dragFrom.x, dragFrom.y - 200, { steps: 20 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const winAfterDrag = await page.evaluate(() => Number(document.body.dataset.bookWindow || '0'));

  // Wheel
  await page.mouse.move(dragFrom.x, dragFrom.y);
  await page.mouse.wheel(0, 480);
  await page.waitForTimeout(150);
  const winAfterWheel = await page.evaluate(() => Number(document.body.dataset.bookWindow || '0'));

  // Drag scrollbar thumb (right edge of panel).
  const thumbPt = designPoint(vp, 720 + 200, panelTopDesign + EXPECT_DROPDOWN_H * 0.25);
  const winBeforeThumb = await page.evaluate(() => Number(document.body.dataset.bookWindow || '0'));
  await page.mouse.move(thumbPt.x, thumbPt.y);
  await page.mouse.down();
  await page.mouse.move(thumbPt.x, thumbPt.y + 140, { steps: 14 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const winAfterThumb = await page.evaluate(() => Number(document.body.dataset.bookWindow || '0'));

  await page.screenshot({ path: path.join(outDir, '02-after-scroll.png') });

  const rowClick = designPoint(vp, 700, panelTopDesign + 56 * 2 + 28);
  await page.mouse.click(rowClick.x, rowClick.y);
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(outDir, '03-after-select.png') });

  const after = await page.evaluate(() => ({
    bookSelect: document.body.dataset.bookSelect,
    dropdownOpen: document.body.dataset.bookDropdownOpen,
    bookWindow: document.body.dataset.bookWindow,
  }));

  await browser.close();

  const scrollOk = winAfterDrag > winBefore
    || winAfterWheel > winBefore
    || winAfterThumb > winBeforeThumb;
  const scrollDiag = {
    winBefore, winAfterDrag, winAfterWheel, winBeforeThumb, winAfterThumb, scrollOk,
  };

  const issues = [];
  if (Number(diag.bookCount) !== EXPECT_BOOKS) {
    issues.push(`bookCount=${diag.bookCount} want ${EXPECT_BOOKS}`);
  }
  if (Number(diag.dropdownH) !== EXPECT_DROPDOWN_H) {
    issues.push(`dropdownH=${diag.dropdownH} want ${EXPECT_DROPDOWN_H}`);
  }
  if (readyMs > 8000) issues.push(`readyMs=${readyMs}>8000`);
  if (openMs > 1500) issues.push(`openMs=${openMs}>1500`);
  if (!scrollOk) issues.push(`scroll stuck ${JSON.stringify(scrollDiag)}`);
  report.push({ readyMs, openMs, diag, after, scrollDiag, issues });
  if (issues.length) failures.push(issues.join('; '));
  else console.log('PASS book-picker', { readyMs, openMs, diag, after, scrollDiag });

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  if (failures.length) {
    console.error('FAIL', failures.join('\n'));
    process.exit(1);
  }
  console.log('ALL PASS', outDir);
} finally {
  if (server?.pid) {
    try { process.kill(server.pid); } catch { /* ignore */ }
  }
}

