/**
 * Verify dig/action character is ~260×360 (not huge blurry 462×640 / pinFeet blow-up).
 */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const out = 'e:/angsa/angsa_data/项目/作业帮游戏/writing-treasure-game/test-results/fb-0721-action-size';
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

await page.goto('http://127.0.0.1:43886/', { waitUntil: 'domcontentloaded', timeout: 60000 });
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
await page.waitForTimeout(400);

await click(712, 610);
await page.waitForSelector('body[data-action-ready="true"]', { timeout: 10000 });
await page.waitForTimeout(200);

const measure = async () => page.evaluate(() => {
  const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
  const stageScale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
  return [...document.querySelectorAll('img[data-customer-motion="WizardDeer"]')]
    .filter((img) => img.style.display !== 'none')
    .map((img) => {
      const r = img.getBoundingClientRect();
      return {
        name: img.dataset.customerMotion,
        cssW: Math.round(r.width / stageScale),
        cssH: Math.round(r.height / stageScale),
        naturalW: img.naturalWidth,
        naturalH: img.naturalHeight,
        top: Math.round((r.top - (canvas?.top ?? 0) - (canvas ? (canvas.height - 810 * stageScale) / 2 : 0)) / stageScale),
      };
    });
});

const dig = await measure();
await page.screenshot({ path: path.join(out, '01-dig-action.png'), clip: { x: 0, y: 0, width: 1440, height: 810 } });

for (let i = 0; i < 3; i += 1) {
  await click(712, 610);
  await page.waitForTimeout(350);
}
await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 8000 });
await page.waitForTimeout(250);

const feedback = await page.evaluate(() => ({
  mode: document.body.dataset.feedbackMode,
  layers: [...document.querySelectorAll('img[data-customer-motion^="Feedback"]')]
    .filter((img) => img.style.display !== 'none')
    .map((img) => {
      const r = img.getBoundingClientRect();
      const canvas = document.getElementById('GameCanvas')?.getBoundingClientRect();
      const stageScale = canvas ? Math.min(canvas.width / 1440, canvas.height / 810) : 1;
      return {
        name: img.dataset.customerMotion,
        cssW: Math.round(r.width / stageScale),
        cssH: Math.round(r.height / stageScale),
        src: (img.currentSrc || '').split('/').pop(),
      };
    }),
}));
await page.screenshot({ path: path.join(out, '02-correct-feedback.png'), clip: { x: 0, y: 0, width: 1440, height: 810 } });

const digOk = dig.some((m) => m.cssW <= 300 && m.cssH <= 420);
const report = { dig, digOk, feedback, pass: digOk };
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
process.exit(digOk ? 0 : 1);
