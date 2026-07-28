/**
 * Runtime: skipIntro + book=… → every drawn question.knowledgePoint === book.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'test-results', 'book-filter');
const baseUrl = process.env.BOOK_FILTER_URL?.trim() || 'http://127.0.0.1:43931';
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const book = process.env.BOOK_FILTER_BOOK?.trim() || '西游记';

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

const server = process.env.BOOK_FILTER_URL ? null : spawn(
  process.execPath,
  ['server/index.mjs'],
  {
    cwd: root,
    env: {
      ...process.env,
      PORT: '43931',
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

  await page.goto(
    `${baseUrl}/index.html?skipIntro=1&book=${encodeURIComponent(book)}`,
    { waitUntil: 'domcontentloaded', timeout: 90000 },
  );
  await page.waitForFunction(
    () => document.body?.dataset?.questionKp,
    { timeout: 60000 },
  );

  const seen = [];
  for (let i = 0; i < 5; i += 1) {
    await page.waitForFunction(
      (prev) => document.body?.dataset?.questionId
        && document.body.dataset.questionId !== prev,
      seen[seen.length - 1]?.id ?? '',
      { timeout: 20000 },
    ).catch(() => null);
    const row = await page.evaluate(() => ({
      id: document.body.dataset.questionId || '',
      kp: document.body.dataset.questionKp || '',
      stem: document.body.dataset.questionStem || '',
      bookSelect: document.body.dataset.bookSelect || '',
    }));
    if (row.id && !seen.some((s) => s.id === row.id)) seen.push(row);
    const p = designPoint(vp, 720, 250);
    await page.mouse.click(p.x, p.y);
    await page.waitForTimeout(900);
  }

  await page.screenshot({ path: path.join(outDir, `play-${book}.png`) });
  await browser.close();

  const leaks = seen.filter((row) => row.kp !== book);
  const report = { book, seen, leaks };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!seen.length) throw new Error('no questions captured');
  if (leaks.length) throw new Error(`book filter leaked: ${leaks.map((l) => l.kp).join(',')}`);
  console.log(`BOOK_FILTER_OK book=${book} n=${seen.length}`);
} finally {
  if (server?.pid) {
    try { process.kill(server.pid); } catch { /* ignore */ }
  }
}
