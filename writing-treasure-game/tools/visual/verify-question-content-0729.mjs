import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const baseUrl = process.env.WRITING_URL?.trim() || 'http://127.0.0.1:43972';
const outDir = path.join(root, 'test-results', 'question-content-0729');
const viewport = { width: 844, height: 390 };
const targets = [
  {
    file: 'writing-magic-dash.png',
    scene: 'magic',
    stem: '“照看着自己那六个可爱的小孙女——海公主”中破折号的作用是什么？',
  },
  {
    file: 'writing-magic-blank.png',
    scene: 'magic',
    stem: '“面临绝境，我总会想起城楼上抚琴的________。”应该写谁？',
  },
  {
    file: 'writing-dunhuang-answer-a.png',
    scene: 'dunhuang',
    stem: '“大圣被魔使法压在山根之下，珠泪如雨”，作者把眼泪比作什么？',
  },
  {
    file: 'writing-dinosaur-rhetoric.png',
    scene: 'dinosaur',
    stem: '“等她们散了，咱们有多少诗不能作呢？”这句话运用了什么修辞？',
  },
];

const bank = JSON.parse(await fs.readFile(
  path.join(root, 'build', 'web-mobile', 'question-bank.json'),
  'utf8',
));

function questionFor(target) {
  const question = bank.questions.find((item) => item.stem === target.stem);
  if (!question) throw new Error(`missing built question: ${target.stem}`);
  return question;
}

function packFor(target) {
  const question = questionFor(target);
  return {
    ...bank,
    questions: Array.from({ length: 5 }, (_, index) => ({
      ...question,
      id: `${question.id}_VERIFY_${index}`,
    })),
  };
}

await fs.mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH
    || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: true,
});

try {
  for (const target of targets) {
    const question = questionFor(target);
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__wxjs_environment = 'miniprogram';
      window.wx = {
        miniProgram: {
          navigateBack: () => undefined,
          navigateTo: () => undefined,
          postMessage: () => undefined,
        },
      };
    });
    await page.route('**/question-bank.json*', (route) => route.fulfill({
      contentType: 'application/json',
      json: packFor(target),
    }));
    await page.goto(
      `${baseUrl}/index.html?host=wechat-mp&skipIntro=1`
        + `&scene=${target.scene}&book=${encodeURIComponent(question.knowledgePoint)}`
        + `&_=${Date.now()}`,
      { waitUntil: 'domcontentloaded', timeout: 60000 },
    );
    await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
    await page.waitForFunction(
      (stem) => document.body.dataset.questionStem === stem,
      target.stem,
      { timeout: 30000 },
    );
    await page.waitForTimeout(400);
    const screenshot = path.join(outDir, target.file);
    await page.screenshot({ path: screenshot });
    console.log(JSON.stringify({
      screenshot,
      scene: target.scene,
      stem: await page.getAttribute('body', 'data-question-stem'),
      options: await page.getAttribute('body', 'data-option-labels'),
    }));
    await context.close();
  }
} finally {
  await browser.close();
}
