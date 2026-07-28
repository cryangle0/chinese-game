import fs from 'node:fs';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const bytes = fs.readFileSync('reading-jumper-game/customer-media/mario/idle.webp');
const b64 = bytes.toString('base64');

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.setContent(`<img id="i" src="data:image/webp;base64,${b64}">`);
await page.waitForTimeout(300);
const samples = [];
for (let t = 0; t < 24; t += 1) {
  samples.push(await page.evaluate(() => {
    const img = document.getElementById('i');
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const counts = new Array(c.height).fill(0);
    for (let y = 0; y < c.height; y += 1) {
      for (let x = 0; x < c.width; x += 1) {
        if (data[(y * c.width + x) * 4 + 3] > 80) counts[y] += 1;
      }
    }
    let peak = 0;
    for (const v of counts) peak = Math.max(peak, v);
    const th = Math.max(4, peak * 0.22);
    let head = 0;
    let feet = c.height - 1;
    for (let y = 0; y < c.height; y += 1) {
      if (counts[y] >= th) { head = y; break; }
    }
    for (let y = c.height - 1; y >= 0; y -= 1) {
      if (counts[y] >= th) { feet = y; break; }
    }
    return { head, feet };
  }));
  await page.waitForTimeout(40);
}
console.log(JSON.stringify({
  samples,
  minFeet: Math.min(...samples.map((s) => s.feet)),
  maxFeet: Math.max(...samples.map((s) => s.feet)),
  minHead: Math.min(...samples.map((s) => s.head)),
  maxHead: Math.max(...samples.map((s) => s.head)),
}, null, 2));
await browser.close();
