import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const readingRoot = path.resolve(import.meta.dirname, '../..');
const workspaceRoot = path.resolve(readingRoot, '..');
const outputRoot = path.join(
  workspaceRoot,
  'result-score-fix-verification',
  'wechat-mp-host',
);
const viewport = { width: 844, height: 390 };
const readingUrl = process.env.READING_URL?.trim()
  || 'http://127.0.0.1:43971/index.html';
const writingUrl = process.env.WRITING_URL?.trim()
  || 'http://127.0.0.1:43972/index.html';
const chromePath = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function launchUrl(baseUrl, scene) {
  const url = new URL(baseUrl);
  url.searchParams.set('host', 'wechat-mp');
  url.searchParams.set('sessionId', `local-mp-${Date.now()}`);
  url.searchParams.set('skipIntro', '1');
  if (scene) url.searchParams.set('scene', scene);
  return url.href;
}

function designPoint(x, y) {
  const scale = Math.min(viewport.width / 1440, viewport.height / 810);
  return {
    x: (viewport.width - 1440 * scale) / 2 + x * scale,
    y: (viewport.height - 810 * scale) / 2 + y * scale,
  };
}

async function tap(page, x, y) {
  const point = designPoint(x, y);
  await page.touchscreen.tap(point.x, point.y);
}

async function installWechatHost(page) {
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
}

async function useDeterministicAnswers(page) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({
      ...question,
      correctIndex: 0,
    }));
    await route.fulfill({ response, json: pack });
  });
}

async function installReadingPoseStub(page) {
  await page.route('**/runtime-config.json', (route) => route.fulfill({
    contentType: 'application/json',
    json: { pose: { movementSensitivity: 1.8 } },
  }));
  await page.route('**/vendor/*.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: '',
  }));
  await page.addInitScript(() => {
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
        estimatePoses: async () => [{
          keypoints: Array.from({ length: 17 }, () => ({
            x: 96,
            y: 72,
            score: 0.95,
          })),
        }],
        dispose: () => undefined,
      }),
    };
  });
}

async function waitForQuestionAdvance(page, previousQuestionId) {
  await page.waitForFunction((questionId) => {
    const view = document.body.dataset.gameView;
    if (view === 'stage-result' || view === 'result') return true;
    return document.body.dataset.questionId !== questionId
      && document.body.dataset.answerCorrect === undefined;
  }, previousQuestionId, { timeout: 10000 });
}

async function advanceFromStageResult(page, points, targetView, label) {
  await page.waitForTimeout(900);
  for (const [x, y] of points) {
    await page.touchscreen.tap(x, y);
    try {
      await page.waitForSelector(`body[data-game-view="${targetView}"]`, {
        timeout: 6000,
      });
      return;
    } catch {
      // Retry inside the same rendered button after refreshing its pointer gate.
    }
  }
  const screenshot = path.join(
    outputRoot,
    `${label.replaceAll('/', '-')}-stage-action-failure.png`,
  );
  await page.screenshot({ path: screenshot });
  const state = await page.evaluate(() => ({
    bodyDataset: { ...document.body.dataset },
    viewport: { width: innerWidth, height: innerHeight },
  }));
  throw new Error(`${label} stage action failed: ${JSON.stringify({
    screenshot,
    state,
  })}`);
}

async function completeReadingCampaign(page) {
  const stages = ['mario', 'deep-sea', 'space', 'food', 'poetry'];
  const nextButtonPoints = {
    mario: [[703, 330], [690, 330], [715, 330]],
    'deep-sea': [[703, 330], [690, 330], [715, 330]],
    space: [[728, 330], [712, 330], [740, 330]],
    food: [[679, 359], [665, 359], [692, 359]],
    poetry: [[720, 330], [705, 330], [735, 330]],
  };
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex];
    await page.waitForSelector(`body[data-game-stage="${stage}"]`, { timeout: 30000 });
    for (let question = 0; question < 5; question += 1) {
      await page.waitForSelector('body[data-answer-ready="true"]', { timeout: 10000 });
      const questionId = await page.getAttribute('body', 'data-question-id');
      await tap(page, 320, 430);
      await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 6000 });
      if (question < 4) {
        await waitForQuestionAdvance(page, questionId);
      } else {
        await page.waitForSelector(`body[data-stage-result="${stage}"]`, {
          timeout: 10000,
        });
      }
    }
    await page.waitForSelector(`body[data-stage-result="${stage}"]`, { timeout: 10000 });
    const targetView = stageIndex === stages.length - 1 ? 'result' : 'play';
    await advanceFromStageResult(
      page,
      nextButtonPoints[stage],
      targetView,
      `reading/${stage}`,
    );
  }
}

async function completeWritingCampaign(
  page,
  stages = ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic'],
  initialWrongAnswers = 0,
) {
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex];
    await page.waitForSelector(`body[data-game-stage="${stage}"]`, { timeout: 30000 });
    const wrongAnswers = stageIndex === 0 ? initialWrongAnswers : 0;
    for (let question = 0; question < wrongAnswers; question += 1) {
      await page.waitForFunction(() => (
        document.body.dataset.gameView === 'play'
        && Boolean(document.body.dataset.questionId)
        && document.body.dataset.answerCorrect === undefined
      ), null, { timeout: 10000 });
      const questionId = await page.getAttribute('body', 'data-question-id');
      await tap(page, 1080, 595);
      await page.waitForSelector('body[data-answer-correct="false"]', { timeout: 7000 });
      await waitForQuestionAdvance(page, questionId);
    }
    for (let question = wrongAnswers; question < 5; question += 1) {
      await page.waitForFunction(() => (
        document.body.dataset.gameView === 'play'
        && Boolean(document.body.dataset.questionId)
        && document.body.dataset.answerCorrect === undefined
      ), null, { timeout: 10000 });
      const questionId = await page.getAttribute('body', 'data-question-id');
      await tap(page, 310, 595);
      await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 7000 });
      await waitForQuestionAdvance(page, questionId);
    }
    await page.waitForSelector(`body[data-stage-result="${stage}"]`, { timeout: 10000 });
    const targetView = stageIndex === stages.length - 1 ? 'result' : 'play';
    await advanceFromStageResult(
      page,
      [[637, 348], [620, 348], [650, 348]],
      targetView,
      `writing/${stage}`,
    );
  }
}

async function diagnostics(page) {
  return page.evaluate(() => ({
    url: location.href,
    hostQuery: new URL(location.href).searchParams.get('host'),
    wxEnvironment: window.__wxjs_environment,
    viewport: { width: innerWidth, height: innerHeight },
    view: document.body.dataset.gameView,
    scene: document.body.dataset.gameStage,
    answered: document.body.dataset.gameAnswered,
    score: document.body.dataset.gameScore,
    rankMaxScore: document.body.dataset.rankMaxScore,
    rankScores: document.body.dataset.rankScores,
    scoreValue: document.body.dataset.scoreValue,
  }));
}

async function runGame(browser, config) {
  const context = await browser.newContext({
    viewport,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await context.grantPermissions(['camera']);
  const page = await context.newPage();
  const runtimeErrors = [];
  page.on('pageerror', (error) => {
    runtimeErrors.push(error.stack || error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error') runtimeErrors.push(message.text());
  });
  await installWechatHost(page);
  await useDeterministicAnswers(page);
  if (config.kind === 'reading') await installReadingPoseStub(page);
  const targetUrl = launchUrl(config.url, config.scene);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForFunction(
      () => document.body?.dataset.gameReady === 'true',
      null,
      { timeout: 60000 },
    );
  } catch (error) {
    const failureScreenshot = path.join(outputRoot, `${config.kind}-startup-failure.png`);
    await page.screenshot({ path: failureScreenshot }).catch(() => undefined);
    const startup = await page.evaluate(() => ({
      url: location.href,
      title: document.title,
      bodyDataset: { ...document.body?.dataset },
      bodyText: document.body?.innerText?.slice(0, 500),
      canvasCount: document.querySelectorAll('canvas').length,
      imageCount: document.images.length,
    })).catch(() => null);
    throw new Error(`${config.kind} startup failed: ${JSON.stringify({
      targetUrl,
      failureScreenshot,
      startup,
      runtimeErrors,
    })}`, { cause: error });
  }
  await page.waitForSelector('body[data-game-view="play"]', { timeout: 30000 });
  await config.complete(page);
  await page.waitForTimeout(1200);

  const report = await diagnostics(page);
  const expectedScore = String(config.expectedScore ?? 500);
  if (report.hostQuery !== 'wechat-mp'
    || report.wxEnvironment !== 'miniprogram'
    || report.view !== 'result'
    || report.answered !== '25'
    || report.score !== expectedScore
    || report.rankMaxScore !== '500') {
    throw new Error(`${config.kind} mini-program host verification failed: ${
      JSON.stringify(report)
    }`);
  }

  const screenshot = path.join(outputRoot, `${config.kind}-final-844x390.png`);
  await page.screenshot({ path: screenshot });
  await context.close();
  return { screenshot, ...report };
}

await fs.mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: chromePath,
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
  ],
});

try {
  const selectedGame = process.env.MP_CAPTURE_GAME?.trim();
  const capture440 = process.env.MP_CAPTURE_VARIANT?.trim() === '440';
  const reading = selectedGame === 'writing'
    ? null
    : await runGame(browser, {
      kind: 'reading',
      url: readingUrl,
      complete: completeReadingCampaign,
    });
  const writing = selectedGame === 'reading'
    ? null
    : await runGame(browser, {
      kind: capture440 ? 'writing-magic-440' : 'writing-treasure',
      url: writingUrl,
      scene: capture440 ? 'treasure' : 'desert',
      expectedScore: capture440 ? 440 : 500,
      complete: capture440
        ? (page) => completeWritingCampaign(page, undefined, 3)
        : (page) => completeWritingCampaign(
          page,
          ['desert', 'dinosaur', 'dunhuang', 'magic', 'treasure'],
        ),
    });
  const reportPath = path.join(outputRoot, 'report.json');
  const previousReport = await fs.readFile(reportPath, 'utf8')
    .then((value) => JSON.parse(value))
    .catch(() => ({}));
  const combinedReport = {
    reading: reading ?? previousReport.reading ?? null,
    writing: writing ?? previousReport.writing ?? null,
  };
  await fs.writeFile(
    reportPath,
    `${JSON.stringify(combinedReport, null, 2)}\n`,
  );
  console.log(JSON.stringify({ reportPath, ...combinedReport }, null, 2));
} finally {
  await browser.close();
}
