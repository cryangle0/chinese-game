/**
 * Verify voice matcher sensitivity + play backdrop stretch (no side black bars).
 * Usage: node tools/visual/verify-voice-letterbox.mjs
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = path.join(root, 'test-results', 'voice-letterbox');
const port = process.env.VOICE_LB_PORT?.trim() || '43991';
const baseUrl = process.env.VOICE_LB_URL?.trim() || `http://127.0.0.1:${port}`;
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

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

function isNearBlack(r, g, b) {
  return r < 28 && g < 28 && b < 28;
}

const server = process.env.VOICE_LB_URL ? null : spawn(
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

const report = { voice: [], letterbox: null, failures: [] };

try {
  if (server) await waitForServer();
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  // Ultrawide phone-like viewport to force letterbox sides.
  const page = await browser.newPage({ viewport: { width: 1920, height: 810 } });

  await page.goto(
    `${baseUrl}/index.html?skipIntro=1&book=${encodeURIComponent('西游记')}&_=${Date.now()}`,
    { waitUntil: 'domcontentloaded', timeout: 90000 },
  );
  await page.waitForFunction(
    () => document.body?.dataset?.gameView === 'play'
      && document.body?.dataset?.questionStem
      && typeof window.__matchSpokenOption === 'function',
    null,
    { timeout: 90000 },
  );

  const voiceCases = await page.evaluate(() => {
    const match = window.__matchSpokenOption;
    const raw = (document.body.dataset.optionLabels || '')
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);
    // UI shows "A、流沙河"; matcher uses bank stems without letter prefix.
    const options = raw.map((s) => s.replace(/^[A-Da-d][、.\s]*/, '').trim()).filter(Boolean);
    if (!options.length || options.length < 2) {
      return { options, raw, cases: [], error: 'no optionLabels' };
    }
    const cases = [
      { spoken: options[0], expect: 0 },
      { spoken: `A、${options[0]}`, expect: 0 },
      { spoken: raw[0], expect: 0 },
      { spoken: '选B', expect: 1 },
      { spoken: `答案是${options[1]}`, expect: 1 },
      { spoken: `B${options[1]}`, expect: 1 },
    ];
    if (options[2]) {
      cases.push({ spoken: options[2], expect: 2 });
      cases.push({ spoken: `C、${options[2]}`, expect: 2 });
    }
    return {
      options,
      raw,
      cases: cases.map((c) => ({
        ...c,
        got: match(c.spoken, options),
        ok: match(c.spoken, options) === c.expect,
      })),
    };
  });

  if (voiceCases.error) report.failures.push(`voice:${voiceCases.error}`);
  for (const c of voiceCases.cases || []) {
    report.voice.push(c);
    process.stdout.write(`voice "${c.spoken}" -> ${c.got} (want ${c.expect}) ... `);
    if (c.ok) console.log('OK');
    else {
      console.log('FAIL');
      report.failures.push(`voice:${c.spoken}`);
    }
  }

  await page.waitForTimeout(400);
  const diag = await page.evaluate(() => ({
    playBackdropScale: Number(document.body.dataset.playBackdropScale || '0'),
    stageVisible: document.body.dataset.stageVisible || '',
    stageAspect: Number(document.body.dataset.stageAspect || '0'),
    gameView: document.body.dataset.gameView,
  }));
  const shotPath = path.join(outDir, 'play-ultrawide.png');
  await page.screenshot({ path: shotPath });

  // Sample left/right edge pixels — should not be near-black once stretch-X fills.
  const edge = await page.evaluate(() => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return { error: 'no canvas' };
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return { error: 'no 2d' };
    const sample = (x) => {
      const y = Math.floor(h * 0.45);
      const d = ctx.getImageData(x, y, 1, 1).data;
      return [d[0], d[1], d[2]];
    };
    return {
      w, h,
      left: sample(4),
      right: sample(w - 5),
      mid: sample(Math.floor(w / 2)),
    };
  });

  const leftBlack = edge.left && isNearBlack(...edge.left);
  const rightBlack = edge.right && isNearBlack(...edge.right);
  report.letterbox = { diag, edge, leftBlack, rightBlack, shotPath };
  console.log(JSON.stringify({ diag, edge, leftBlack, rightBlack }, null, 2));

  if (!(diag.playBackdropScale > 1.01)) {
    report.failures.push(`letterbox:playBackdropScale=${diag.playBackdropScale}`);
  }
  // WebGL canvas often can't read pixels via 2d — treat scale as primary gate.
  if (edge.error) {
    console.log('canvas pixel sample skipped:', edge.error);
  } else if (leftBlack || rightBlack) {
    report.failures.push(`letterbox:edgeBlack L=${leftBlack} R=${rightBlack}`);
  }

  await browser.close();
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  if (report.failures.length) {
    console.error('VOICE_LETTERBOX_FAIL', report.failures);
    process.exit(1);
  }
  console.log('VOICE_LETTERBOX_PASS');
} finally {
  if (server?.pid) {
    try { process.kill(server.pid); } catch { /* ignore */ }
  }
}
