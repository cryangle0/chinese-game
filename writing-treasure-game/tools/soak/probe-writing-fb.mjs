import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ingest = 'http://127.0.0.1:7722/ingest/06597970-d75a-468c-bb47-239c9e31ac6d';

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 810 } })).newPage();
await page.route('**/question-bank.json', async (route) => {
  const response = await route.fetch();
  const pack = await response.json();
  pack.questions = (pack.questions || []).map((q) => ({ ...q, correctIndex: 0 }));
  await route.fulfill({ response, json: pack });
});
await page.goto('http://127.0.0.1:43886/?skipIntro=1&scene=treasure', {
  waitUntil: 'domcontentloaded', timeout: 60000,
});
await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });

const geom = async () => {
  const box = await page.locator('#GameCanvas').boundingBox();
  const scale = Math.min(box.width / 1440, box.height / 810);
  return {
    scale,
    ox: box.x + (box.width - 1440 * scale) / 2,
    oy: box.y + (box.height - 810 * scale) / 2,
  };
};
const click = async (dx, dy) => {
  const g = await geom();
  await page.mouse.click(g.ox + dx * g.scale, g.oy + dy * g.scale);
};

for (const [dx, dy] of [[937.5, 466], [980, 550], [720, 520]]) {
  await click(dx, dy);
  await page.waitForTimeout(300);
  if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
}
await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, { timeout: 20000 });
await click(720, 610);
await page.waitForFunction(() => document.body.dataset.feedbackMode != null, null, { timeout: 15000 });
await page.waitForTimeout(400);

const probe = await page.evaluate(() => {
  const imgs = [...document.querySelectorAll('img[data-customer-motion]')].map((img) => ({
    name: img.dataset.customerMotion,
    display: getComputedStyle(img).display,
    opacity: getComputedStyle(img).opacity,
    w: Math.round(img.getBoundingClientRect().width),
    h: Math.round(img.getBoundingClientRect().height),
    src: (img.currentSrc || '').split('/').pop(),
    naturalW: img.naturalWidth,
  }));
  return {
    meta: {
      ac: document.body.dataset.answerCorrect,
      fm: document.body.dataset.feedbackMode,
      col: document.body.dataset.feedbackColumn,
    },
    imgs,
  };
});

await fetch(ingest, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': 'ffb02e' },
  body: JSON.stringify({
    sessionId: 'ffb02e', runId: 'pn-feedback', hypothesisId: 'H-w-dom',
    location: 'probe-writing-fb.mjs', message: 'writing feedback dom probe',
    data: probe, timestamp: Date.now(),
  }),
}).catch(() => {});

console.log(JSON.stringify(probe, null, 2));
await browser.close();
