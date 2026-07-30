import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const baseUrl = process.env.READING_URL?.trim() || 'http://127.0.0.1:43971';
const outDir = path.join(root, 'test-results', 'question-content-0729');
const viewport = { width: 844, height: 390 };
const targets = [
  {
    file: 'reading-space-huckleberry.png',
    scene: 'space',
    stem: '英琼·乔杀死医生后，把罪行嫁祸给了谁？',
  },
  {
    file: 'reading-food-punctuation-wrap.png',
    scene: 'food',
    stem: '下列哪一神话生物出自《大荒东经》？',
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
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
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
    await context.grantPermissions(['camera']);
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
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () => {
            const canvas = document.createElement('canvas');
            canvas.width = 192;
            canvas.height = 144;
            return canvas.captureStream(24);
          },
        },
      });
      window.tf = {
        setBackend: async () => true,
        ready: async () => undefined,
        getBackend: () => 'webgl',
        wasm: { setWasmPaths: () => undefined },
      };
      window.poseDetection = {
        SupportedModels: { MoveNet: 'MoveNet' },
        movenet: { modelType: { SINGLEPOSE_LIGHTNING: 'lightning' } },
        createDetector: async () => ({
          estimatePoses: async () => [],
          dispose: () => undefined,
        }),
      };
    });
    await page.route('**/question-bank.json*', (route) => route.fulfill({
      contentType: 'application/json',
      json: packFor(target),
    }));
    await page.route('**/vendor/*.js', (route) => route.fulfill({
      contentType: 'application/javascript',
      body: '',
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
