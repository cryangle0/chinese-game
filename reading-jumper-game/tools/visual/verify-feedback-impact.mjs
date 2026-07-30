/**
 * Verify reading-jumper feedback deer is enlarged + grounded (customer: 太小/冲击弱).
 * Screenshots: test-results/feedback-impact/
 */
import { spawn } from 'node:child_process';
import fs from 'fs';
import path from 'path';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const outDir = path.join(root, 'test-results', 'feedback-impact');
const baseUrl = process.env.READING_URL?.trim() || 'http://127.0.0.1:43931';
const chromePath = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

const scenes = [
  { id: 'mario', minH: 500, pressX: 720, minOpaquePct: 42 },
  { id: 'deep-sea', minH: 560, pressX: 720, minOpaquePct: 42 },
  { id: 'food', minH: 480, pressX: 720, minOpaquePct: 40 },
  { id: 'poetry', minH: 480, pressX: 720, minOpaquePct: 40 },
  {
    id: 'space',
    minH: 600,
    pressX: 720,
    minOpaquePct: 40,
    groundY: 720,
    groundTolerance: 18,
    minWrongScale: 1.44,
  },
];

fs.mkdirSync(outDir, { recursive: true });

function measureOpaquePct(shotPath) {
  const png = PNG.sync.read(fs.readFileSync(shotPath));
  let minY = png.height;
  let maxY = -1;
  for (let y = 0; y < png.height; y += 2) {
    for (let x = 0; x < png.width; x += 2) {
      const i = (png.width * y + x) << 2;
      const r = png.data[i];
      const g = png.data[i + 1];
      const b = png.data[i + 2];
      const sat = Math.max(r, g, b) - Math.min(r, g, b);
      if (sat > 45 && r > 70 && g > 60 && (r + g) > b + 50 && b < 190) {
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxY < minY) return 0;
  return Math.round((100 * (maxY - minY + 1)) / png.height);
}

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

async function forceBank(page, correctIndex) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({
      ...q,
      correctIndex,
    }));
    await route.fulfill({ response, json: pack });
  });
}

async function press(page, vp, x, y) {
  const p = designPoint(vp, x, y);
  await page.mouse.click(p.x, p.y);
}

async function runScene(browser, scene, correct) {
  const vp = { width: 1440, height: 810 };
  const context = await browser.newContext({ viewport: vp });
  const page = await context.newPage();
  await forceBank(page, correct ? 1 : 0);
  await page.goto(`${baseUrl}/?skipIntro=1&scene=${scene.id}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 30000,
  });
  await page.waitForTimeout(400);
  const pressX = correct ? scene.pressX : 1100;
  await press(page, vp, pressX, 405);
  await page.waitForFunction(
    (want) => document.body.dataset.feedbackY !== undefined
      && document.body.dataset.feedbackCorrect === want,
    correct ? '1' : '0',
    { timeout: 20000 },
  );
  await page.waitForTimeout(450);
  const label = `${scene.id}-${correct ? 'correct' : 'wrong'}`;
  const shot = path.join(outDir, `${label}.png`);
  await page.screenshot({ path: shot, clip: { x: 0, y: 0, width: 1440, height: 810 } });
  const diag = await page.evaluate(() => {
    const img = document.querySelector('img[data-customer-motion="Feedback"]');
    const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
    const scale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
    const top0 = canvas ? canvas.y + (canvas.height - 810 * scale) / 2 : 0;
    const r = img?.getBoundingClientRect();
    let visibleBottom = null;
    if (img instanceof HTMLImageElement && r) {
      const sample = document.createElement('canvas');
      sample.width = img.naturalWidth;
      sample.height = img.naturalHeight;
      const context2d = sample.getContext('2d', { willReadFrequently: true });
      if (context2d) {
        context2d.drawImage(img, 0, 0);
        const pixels = context2d.getImageData(0, 0, sample.width, sample.height).data;
        let maxY = -1;
        for (let y = 0; y < sample.height; y += 1) {
          for (let x = 0; x < sample.width; x += 1) {
            if (pixels[(y * sample.width + x) * 4 + 3] > 32) maxY = y;
          }
        }
        if (maxY >= 0) {
          const style = getComputedStyle(img);
          const top = Number.parseFloat(style.top);
          const height = Number.parseFloat(style.height);
          const originY = Number.parseFloat(style.transformOrigin.split(' ')[1]);
          const matrix = new DOMMatrixReadOnly(style.transform);
          const rawBottom = ((maxY + 1) / sample.height) * height;
          visibleBottom = top + originY + matrix.d * (rawBottom - originY);
        }
      }
    }
    return {
      feedbackY: document.body.dataset.feedbackY,
      feedbackBaseY: document.body.dataset.feedbackBaseY,
      feedbackW: document.body.dataset.feedbackW,
      feedbackH: document.body.dataset.feedbackH,
      feedbackCorrect: document.body.dataset.feedbackCorrect,
      naturalW: img instanceof HTMLImageElement ? img.naturalWidth : null,
      naturalH: img instanceof HTMLImageElement ? img.naturalHeight : null,
      motionW: r ? Math.round(r.width / scale) : null,
      motionH: r ? Math.round(r.height / scale) : null,
      motionBottom: r ? Math.round((r.bottom - top0) / scale) : null,
      visibleBottom: visibleBottom === null
        ? null
        : Math.round((visibleBottom - top0) / scale),
      deerOpaqueH: document.body.dataset.deerOpaqueH,
      deerPinScale: document.body.dataset.deerPinScale,
      feedbackScale: document.body.dataset.feedbackScale,
    };
  });
  await context.close();
  const opaquePct = measureOpaquePct(shot);
  diag.opaquePct = opaquePct;
  const naturalAspect = Number(diag.naturalW) / Math.max(1, Number(diag.naturalH));
  const motionAspect = Number(diag.motionW) / Math.max(1, Number(diag.motionH));
  const aspectErrorPct = Math.abs(motionAspect / naturalAspect - 1) * 100;
  diag.aspectErrorPct = Number(aspectErrorPct.toFixed(3));
  const issues = [];
  const warnings = [];
  const fh = Number(diag.feedbackH);
  if (!(fh >= scene.minH)) issues.push(`feedbackH=${fh}<${scene.minH}`);
  if (opaquePct < scene.minOpaquePct) {
    warnings.push(`opaquePct=${opaquePct}<${scene.minOpaquePct}`);
  }
  if (!(aspectErrorPct <= 1)) issues.push(`aspectError=${aspectErrorPct.toFixed(3)}%`);
  if (diag.feedbackCorrect !== (correct ? '1' : '0')) {
    issues.push(`correct=${diag.feedbackCorrect}`);
  }
  if (scene.groundY !== undefined) {
    const groundError = Math.abs(Number(diag.visibleBottom) - scene.groundY);
    diag.groundError = groundError;
    if (groundError > (scene.groundTolerance ?? 12)) {
      issues.push(`ground=${diag.visibleBottom}/${scene.groundY}`);
    }
  }
  if (!correct && scene.minWrongScale !== undefined
    && Number(diag.feedbackScale) < scene.minWrongScale) {
    issues.push(`wrongScale=${diag.feedbackScale}<${scene.minWrongScale}`);
  }
  return {
    label, diag, issues, warnings, shot: path.basename(shot),
  };
}

const server = process.env.READING_URL ? null : spawn(
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

const report = [];
const failures = [];
try {
  if (server) await waitForServer();
  const browser = await chromium.launch({
    executablePath: chromePath,
    headless: true,
  });
  try {
    for (const scene of scenes) {
      for (const correct of [true, false]) {
        const row = await runScene(browser, scene, correct);
        report.push(row);
        if (row.issues.length) failures.push(`${row.label}: ${row.issues.join('; ')}`);
        else {
          console.log(
            'PASS',
            row.label,
            `aspect-error=${row.diag.aspectErrorPct}%`,
            row.warnings.length ? `WARN ${row.warnings.join('; ')}` : '',
            JSON.stringify(row.diag),
          );
        }
      }
    }
  } finally {
    await browser.close();
  }
} finally {
  if (server?.pid) {
    try { process.kill(server.pid); } catch { /* ignore */ }
  }
}

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
if (failures.length) {
  console.error('FAIL\n' + failures.join('\n'));
  process.exit(1);
}
console.log('ALL PASS', outDir);
