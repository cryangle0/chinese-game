/**
 * Verify option boxes/fonts are enlarged and stay on-canvas (all reading scenes).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outDir = path.join(root, 'test-results', 'option-size');
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const base = 'http://127.0.0.1:43952';
const scenes = ['deep-sea', 'space', 'mario', 'food', 'poetry'];

async function waitHealth(ms = 30000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    try { if ((await fetch(`${base}/health`)).ok) return; } catch { /* */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error('server down');
}

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: {
    ...process.env,
    PORT: '43952',
    PUBLIC_ROOT: path.join(root, 'build', 'web-mobile'),
    MEDIA_ROOT: path.join(root, 'product-media'),
  },
  stdio: 'ignore',
  windowsHide: true,
});

try {
  await waitHealth();
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  const report = [];
  for (const scene of scenes) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
    await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
    if (scene === 'space') {
      await page.route('**/question-bank.json', async (route) => {
        const response = await route.fetch();
        const pack = await response.json();
        pack.questions = pack.questions.map((question) => ({
          ...question,
          options: [
            '\u82b1\u5bb9\u6708\u8c8c\u7684\u5973\u5b50',
            '\u8001\u5987\u4eba',
            '\u8001\u516c\u516c',
          ],
        }));
        await route.fulfill({
          status: 200,
          contentType: 'application/json; charset=utf-8',
          body: JSON.stringify(pack),
        });
      });
    }
    await page.goto(
      `${base}/index.html?skipIntro=1&scene=${scene}&book=${encodeURIComponent('安徒生童话')}`,
      { waitUntil: 'domcontentloaded', timeout: 90000 },
    );
    await page.waitForFunction(() => document.body?.dataset?.optionLabels, { timeout: 60000 });
    await page.waitForTimeout(800);
    const meta = await page.evaluate(() => ({
      scene: document.body.dataset.sceneId || document.body.dataset.themeId,
      optionBox: document.body.dataset.optionBox,
      optionContentBox: document.body.dataset.optionContentBox,
      optionFontSize: document.body.dataset.optionFontSize,
      optionEffectiveFontSizes: document.body.dataset.optionEffectiveFontSizes,
      optionPadX: document.body.dataset.optionPadX,
      optionAlign: document.body.dataset.optionAlign,
      optionLineMode: document.body.dataset.optionLineMode,
      labels: document.body.dataset.optionLabels,
    }));
    const box = await page.locator('#GameCanvas').boundingBox();
    const scale = Math.min(box.width / 1440, box.height / 810);
    const shot = path.join(outDir, `${scene}-options.png`);
    await page.screenshot({
      path: shot,
      clip: {
        x: box.x + (box.width - 1440 * scale) / 2,
        y: box.y + (box.height - 810 * scale) / 2,
        width: 1440 * scale,
        height: 810 * scale,
      },
    });
    await page.close();
    const font = Number(meta.optionFontSize);
    const [bw, bh] = String(meta.optionBox || '0x0').split('x').map(Number);
    if (font !== 32) {
      throw new Error(`${scene}: bad optionFontSize ${meta.optionFontSize} (want 32)`);
    }
    if (!(bw >= 350 && bh >= 118)) {
      throw new Error(`${scene}: option box too small ${meta.optionBox}`);
    }
    if (meta.optionAlign !== 'center') {
      throw new Error(`${scene}: option text is not centered (${meta.optionAlign})`);
    }
    if (meta.optionLineMode !== 'single-line-shrink') {
      throw new Error(`${scene}: option text is not single-line shrink (${meta.optionLineMode})`);
    }
    if (scene === 'space') {
      const [contentWidth] = String(meta.optionContentBox || '0x0').split('x').map(Number);
      const effectiveFonts = String(meta.optionEffectiveFontSizes || '')
        .split(',')
        .map(Number);
      if (!(contentWidth <= 230)) {
        throw new Error(`space: unsafe option content width ${meta.optionContentBox}`);
      }
      if (!(effectiveFonts[0] < font && effectiveFonts[1] === font && effectiveFonts[2] === font)) {
        throw new Error(`space: options did not adapt fonts (${meta.optionEffectiveFontSizes})`);
      }
    }
    report.push({ scene, ...meta, shot });
    console.log(
      scene,
      meta.optionBox,
      `content=${meta.optionContentBox}`,
      `fonts=${meta.optionEffectiveFontSizes}`,
      meta.labels,
    );
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'meta.json'), JSON.stringify(report, null, 2));
  console.log('OPTION_SIZE_OK', outDir);
} finally {
  if (server?.pid) try { process.kill(server.pid); } catch { /* */ }
}
