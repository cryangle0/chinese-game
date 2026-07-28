import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = 'test-results/fb-0721-idle-size';
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });

await page.route('**/question-bank.json', async (route) => {
  const response = await route.fetch();
  const pack = await response.json();
  pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 1 }));
  await route.fulfill({ response, json: pack });
});

await page.goto(`http://127.0.0.1:43886/?t=${Date.now()}`, {
  waitUntil: 'domcontentloaded',
  timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });

const box = await page.locator('#GameCanvas').boundingBox();
const scale = Math.min(box.width / 1440, box.height / 810);
const ox = box.x + (box.width - 1440 * scale) / 2;
const oy = box.y + (box.height - 810 * scale) / 2;
const click = async (dx, dy) => page.mouse.click(ox + dx * scale, oy + dy * scale);

for (const [dx, dy] of [[937.5, 466], [980, 550], [720, 520]]) {
  await click(dx, dy);
  await page.waitForTimeout(350);
  if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
}
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, { timeout: 20000 });
await page.waitForTimeout(500);

const measure = () => page.evaluate(() => {
  const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
  const stageScale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
  return [...document.querySelectorAll('img[data-customer-motion="WizardDeer"]')]
    .filter((img) => img.style.display !== 'none')
    .map((img) => {
      const r = img.getBoundingClientRect();
      return {
        cssW: Math.round(r.width / stageScale),
        cssH: Math.round(r.height / stageScale),
        nw: img.naturalWidth,
        nh: img.naturalHeight,
      };
    });
});

const idle = await measure();
await page.screenshot({
  path: path.join(out, '01-idle.png'),
  clip: { x: 0, y: 0, width: 1440, height: 810 },
});

await click(712, 610);
await page.waitForSelector('body[data-action-ready="true"]', { timeout: 10000 });
await page.waitForTimeout(200);
const dig = await measure();
await page.screenshot({
  path: path.join(out, '02-dig.png'),
  clip: { x: 0, y: 0, width: 1440, height: 810 },
});

const report = {
  idle,
  dig,
  idleOk: idle.some((m) => m.cssH >= 320 && m.cssH <= 420),
  digOk: dig.some((m) => m.cssW >= 280 && m.cssW <= 340 && m.cssH >= 350 && m.cssH <= 430),
};
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(report.idleOk && report.digOk ? 0 : 1);
