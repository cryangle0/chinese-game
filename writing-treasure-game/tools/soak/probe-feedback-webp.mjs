import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const media = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/customer-media';
const files = [
  'treasure/correct.webp', 'treasure/wrong.webp',
  'desert/correct.webp', 'desert/wrong.webp',
];

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
const results = [];
for (const rel of files) {
  const file = path.join(media, rel).replace(/\\/g, '/');
  const url = `file:///${file}`;
  await page.setContent(`<img id="i" src="${url}">`);
  await page.waitForFunction(() => {
    const i = document.getElementById('i');
    return i && i.complete && i.naturalWidth > 0;
  }, null, { timeout: 10000 });
  const info = await page.evaluate(async () => {
    const img = document.getElementById('i');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    let transparent = 0;
    let opaque = 0;
    let edgeOpaque = 0;
    const w = c.width;
    const h = c.height;
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const a = data[(y * w + x) * 4 + 3];
        if (a < 16) transparent += 1;
        else opaque += 1;
        if ((x < 2 || y < 2 || x >= w - 2 || y >= h - 2) && a > 200) edgeOpaque += 1;
      }
    }
    return {
      w, h,
      transparent,
      opaque,
      edgeOpaque,
      edgeRatio: edgeOpaque / Math.max(1, (w * 2 + h * 2) * 2),
      alphaRatio: transparent / (w * h),
    };
  });
  results.push({ rel, ...info, bytes: fs.statSync(path.join(media, rel)).size });
}
await browser.close();
console.log(JSON.stringify(results, null, 2));
