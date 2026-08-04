import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { PNG } from 'pngjs';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const publicRoot = path.resolve(
  process.env.PUBLIC_ROOT ?? path.join(root, 'build', 'web-mobile'),
);
const output = process.env.E2E_OUTPUT
  ? path.resolve(process.env.E2E_OUTPUT)
  : path.join(root, 'test-results', 'e2e');
const port = Number(process.env.E2E_PORT ?? 42882);
const configuredBaseUrl = process.env.E2E_BASE_URL?.trim();
const baseUrl = configuredBaseUrl || `http://127.0.0.1:${port}`;
const pageBaseUrl = baseUrl;
const publicPathPrefix = configuredBaseUrl
  ? new URL(configuredBaseUrl).pathname.replace(/\/[^/]*$/, '')
  : '';
const enabledPhases = new Set(
  (process.env.E2E_PHASES ?? 'desktop,mobile,themes')
    .split(',').map((value) => value.trim()).filter(Boolean),
);
const enabledScenes = new Set(
  (process.env.E2E_SCENES ?? 'treasure,desert,dinosaur,dunhuang,magic')
    .split(',').map((value) => value.trim()).filter(Boolean),
);
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let productionBankTransferBytes = 0;
if (process.platform === 'win32') {
  try {
    os.setPriority(0, os.constants.priority.PRIORITY_HIGH);
  } catch {
    // The test remains valid when the host does not allow priority changes.
  }
}

function launchUrl(parameters = {}) {
  const url = new URL(pageBaseUrl);
  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, String(value));
  }
  return url.href;
}

function normalizePublicPath(value) {
  const pathname = new URL(value, pageBaseUrl).pathname;
  return publicPathPrefix && pathname.startsWith(`${publicPathPrefix}/`)
    ? pathname.slice(publicPathPrefix.length)
    : pathname;
}

async function waitForServer(timeoutMs = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('local server did not start');
}

async function assertExternalDelivery() {
  const delivery = await compressedTransfer(new URL('question-bank.json', pageBaseUrl));
  if (delivery.status !== 200 || !['br', 'gzip'].includes(delivery.encoding ?? '')) {
    throw new Error(
      `CDN question bank compression failed: HTTP ${delivery.status} ${delivery.encoding}`,
    );
  }
  productionBankTransferBytes = delivery.bytes;
}

function compressedTransfer(url) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { 'accept-encoding': 'br, gzip', 'cache-control': 'no-cache' },
    }, (response) => {
      let bytes = 0;
      response.on('data', (chunk) => { bytes += chunk.length; });
      response.on('end', () => resolve({
        bytes,
        encoding: response.headers['content-encoding'],
        status: response.statusCode ?? 0,
      }));
    });
    request.on('error', reject);
  });
}

async function assertCompressedBuild() {
  const directory = path.join(publicRoot, 'cocos-js');
  const engine = (await fs.readdir(directory)).find((file) => file.endsWith('.js'));
  if (!engine) throw new Error('engine script is missing');
  const response = await fetch(`${baseUrl}/cocos-js/${engine}`, {
    headers: { 'accept-encoding': 'br, gzip' },
  });
  if (response.headers.get('content-encoding') !== 'br') {
    throw new Error('server did not negotiate Brotli');
  }
  const bankResponse = await fetch(`${baseUrl}/question-bank.json`, {
    headers: { 'accept-encoding': 'br, gzip' },
  });
  if (bankResponse.headers.get('content-encoding') !== 'br') {
    throw new Error('question bank did not negotiate Brotli');
  }
  productionBankTransferBytes = Number(bankResponse.headers.get('content-length') ?? 0);
  if (!productionBankTransferBytes) throw new Error('question bank compressed size is unavailable');
}

async function assertAudioRange() {
  const response = await fetch(`${baseUrl}/audio/bgm.mp3`, {
    headers: { range: 'bytes=0-99' },
  });
  if (response.status !== 206
    || response.headers.get('content-type') !== 'audio/mpeg'
    || !/^bytes 0-99\/\d+$/.test(response.headers.get('content-range') ?? '')) {
    throw new Error('server did not provide the expected MP3 byte range');
  }
}

function assertNonBlank(buffer, label) {
  const image = PNG.sync.read(buffer);
  let colorful = 0;
  let luminanceSum = 0;
  let luminanceSquared = 0;
  for (let offset = 0; offset < image.data.length; offset += 16) {
    const red = image.data[offset];
    const green = image.data[offset + 1];
    const blue = image.data[offset + 2];
    const luminance = (red + green + blue) / 3;
    luminanceSum += luminance;
    luminanceSquared += luminance * luminance;
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 16) colorful += 1;
  }
  const sampled = Math.ceil(image.width * image.height / 4);
  const mean = luminanceSum / sampled;
  const variance = luminanceSquared / sampled - mean * mean;
  if (colorful < sampled * 0.02 || variance < 80) {
    throw new Error(`${label} appears blank: colorful=${colorful}, variance=${variance}`);
  }
}

async function capture(page, name) {
  const buffer = await page.screenshot({ path: path.join(output, `${name}.png`) });
  assertNonBlank(buffer, name);
}

async function assertPosterShare(page, clickShare, label) {
  await clickShare();
  const overlay = page.locator('[data-result-poster-overlay="1"]');
  await overlay.waitFor({ state: 'visible', timeout: 4000 });
  const image = overlay.locator('img');
  const source = await image.getAttribute('src');
  const tip = await overlay.textContent();
  const download = await overlay.locator('a[download]').getAttribute('download');
  if (!source?.startsWith('data:image/png;base64,')
    || !tip?.includes('长按图片保存')
    || !download?.endsWith('.png')) {
    throw new Error(`${label} share poster was incomplete`);
  }
  await overlay.getByRole('button', { name: '关闭' }).click();
  await overlay.waitFor({ state: 'detached' });
}

async function assertVisibleMotion(page, marker, expectedPath, label, animated = true) {
  const locator = page.locator(`img[data-customer-motion="${marker}"]`);
  try {
    await locator.waitFor({ state: 'visible', timeout: 4000 });
  } catch (error) {
    const state = await locator.evaluateAll((images) => images.map((image) => ({
      src: image.currentSrc || image.getAttribute('src'),
      display: image.style.display,
      visibility: image.style.visibility,
    })));
    const feedback = await page.evaluate(() => ({
      href: location.href,
      mode: document.body.dataset.feedbackMode,
      layers: document.body.dataset.feedbackLayers,
      selected: document.body.dataset.feedbackSelected,
      scene: document.body.dataset.feedbackScene,
      scripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean),
    }));
    throw new Error(
      `${label} was not visible: ${JSON.stringify({ state, feedback })}`,
      { cause: error },
    );
  }
  const source = normalizePublicPath(await locator.evaluate((image) => (
    image.currentSrc || image.getAttribute('src') || ''
  )));
  if (source !== expectedPath) {
    throw new Error(`${label} used ${source || 'no source'}, expected ${expectedPath}`);
  }
  if (!animated) return;
  const box = await locator.boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) throw new Error(`${label} has no visible motion bounds`);
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const width = Math.min(viewport.width - x, Math.max(1, Math.ceil(box.width)));
  const height = Math.min(viewport.height - y, Math.max(1, Math.ceil(box.height)));
  if (width < 8 || height < 8) {
    throw new Error(`${label} motion bounds are too small: ${width}x${height}`);
  }
  const clip = { x, y, width, height };
  const before = PNG.sync.read(await page.screenshot({ clip }));
  await page.waitForTimeout(320);
  const after = PNG.sync.read(await page.screenshot({ clip }));
  let changed = 0;
  for (let offset = 0; offset < before.data.length; offset += 4) {
    const delta = Math.max(
      Math.abs(before.data[offset] - after.data[offset]),
      Math.abs(before.data[offset + 1] - after.data[offset + 1]),
      Math.abs(before.data[offset + 2] - after.data[offset + 2]),
    );
    if (delta > 8) changed += 1;
  }
  if (changed < 80) {
    throw new Error(`${label} did not animate: ${changed} changed pixels`);
  }
}

async function assertRuntime(page, startedAt, readyAt, label) {
  const startupMs = readyAt - startedAt;
  const startupLimit = label === 'mobile' ? 9000 : 7000;
  if (startupMs > startupLimit) throw new Error(`${label} startup exceeded ${startupMs}ms`);
  const frame = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0;
    const started = performance.now();
    let previous = started;
    const intervals = [];
    const sample = () => {
      frames += 1;
      const now = performance.now();
      intervals.push(now - previous);
      previous = now;
      if (frames >= 60) {
        intervals.sort((left, right) => left - right);
        resolve({ total: now - started, p95: intervals[Math.floor(intervals.length * 0.95)] });
      } else requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  }));
  if (frame.total > 2500 || frame.p95 > 45) {
    throw new Error(`${label} frame budget failed: total=${frame.total}ms p95=${frame.p95}ms`);
  }
  const resources = await page.evaluate(() => performance.getEntriesByType('resource')
    .map((entry) => ({ name: entry.name, transfer: entry.transferSize }))
    .sort((left, right) => right.transfer - left.transfer));
  const testBankTransfer = resources
    .filter((entry) => normalizePublicPath(entry.name) === '/question-bank.json')
    .reduce((sum, entry) => sum + entry.transfer, 0);
  const transfer = resources.reduce((sum, entry) => sum + entry.transfer, 0)
    - testBankTransfer + productionBankTransferBytes;
  if (transfer > 2 * 1024 * 1024) {
    const largest = resources.slice(0, 8)
      .map((entry) => `${(entry.transfer / 1024).toFixed(0)} KB ${normalizePublicPath(entry.name)}`)
      .join('\n');
    throw new Error(
      `${label} transferred ${(transfer / 1048576).toFixed(2)} MB\n${largest}`,
    );
  }
}

async function constrain(page) {
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await session.send('Network.enable');
  await session.send('Network.emulateNetworkConditions', {
    offline: false,
    latency: 80,
    downloadThroughput: 512 * 1024,
    uploadThroughput: 192 * 1024,
  });
}

function collectFailures(page) {
  const failures = [];
  page.on('pageerror', (error) => failures.push(error.stack ?? error.message));
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
      failures.push(message.text());
    }
  });
  return failures;
}

async function installMediaPlaybackAudit(page) {
  await page.addInitScript(() => {
    window.__mediaPlaybackAudit = [];
    window.__motionSourceAudit = [];
    const originalPlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function auditedPlay(...args) {
      const entry = {
        loop: this.loop,
        src: this.currentSrc || this.src || this.getAttribute('src') || '',
        status: 'pending',
      };
      window.__mediaPlaybackAudit.push(entry);
      try {
        const playback = originalPlay.apply(this, args);
        Promise.resolve(playback).then(
          () => { entry.status = 'playing'; },
          () => { entry.status = 'rejected'; },
        );
        return playback;
      } catch (error) {
        entry.status = 'threw';
        throw error;
      }
    };
    const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    if (descriptor?.get && descriptor.set) {
      Object.defineProperty(HTMLImageElement.prototype, 'src', {
        ...descriptor,
        set(value) {
          if (this.dataset.customerMotion) {
            window.__motionSourceAudit.push({
              marker: this.dataset.customerMotion,
              src: String(value),
            });
          }
          descriptor.set.call(this, value);
        },
      });
    }
  });
}

async function assertPlayedPaths(page, expected, label) {
  await page.waitForTimeout(200);
  const played = [...new Set((await page.evaluate(() => (
    window.__mediaPlaybackAudit
      .filter((entry) => entry.status === 'playing')
      .map((entry) => entry.src)
  ))).map(normalizePublicPath))];
  const missing = expected.filter((pathName) => !played.includes(pathName));
  if (missing.length) throw new Error(`${label} audio did not play: ${missing.join(', ')}`);
}

async function assertObservedMotionPaths(page, expected, label) {
  await page.waitForFunction((paths) => {
    const observed = window.__motionSourceAudit.map((entry) => (
      new URL(entry.src, location.href).pathname
    ));
    return paths.every((pathName) => observed.includes(pathName));
  }, expected, { timeout: 5000 });
  const observed = [...new Set((await page.evaluate(() => (
    window.__motionSourceAudit.map((entry) => entry.src)
  ))).map(normalizePublicPath))];
  const missing = expected.filter((pathName) => !observed.includes(pathName));
  if (missing.length) throw new Error(`${label} motion was not used: ${missing.join(', ')}`);
}

async function assertMediaPlayback(page) {
  await page.waitForTimeout(200);
  const played = [...new Set((await page.evaluate(() => (
    window.__mediaPlaybackAudit
      .filter((entry) => entry.status === 'playing')
      .map((entry) => entry.src)
  ))).map(normalizePublicPath))];
  const expected = [
    '/audio/writing/bgm.mp3',
    '/audio/writing/button.mp3',
    '/audio/writing/start.mp3',
    '/audio/writing/question.mp3',
    '/audio/writing/treasure/wrong.mp3',
    ...stages.flatMap((stage) => [
      `/audio/writing/${stage}/walk.mp3`,
      `/audio/writing/${stage}/correct.mp3`,
      `/audio/writing/${stage}/result.mp3`,
    ]),
    ...stages.slice(0, -1).map((stage) => `/audio/writing/${stage}/transition.mp3`),
    '/audio/writing/magic/reveal.mp3',
  ];
  const missing = expected.filter((pathName) => !played.includes(pathName));
  if (missing.length) {
    throw new Error(`writing runtime media did not play: ${missing.join(', ')}`);
  }
}

const stages = ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic'];

async function useDeterministicAnswers(page) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({ ...question, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });
}

async function waitForQuestionAdvance(page, previousQuestionId) {
  await page.waitForFunction((questionId) => {
    const view = document.body.dataset.gameView;
    if (view === 'stage-result' || view === 'result') return true;
    return document.body.dataset.questionId !== questionId
      && document.body.dataset.answerCorrect === undefined;
  }, previousQuestionId, { timeout: 7000 });
}

async function completeCorrectQuestion(page, answer, _strike, onFeedback) {
  const questionId = await page.getAttribute('body', 'data-question-id');
  await answer();
  await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 5000 });
  await onFeedback?.();
  await waitForQuestionAdvance(page, questionId);
}

async function clickStageAction(page, clickAt, points, targetView = 'play') {
  for (const [x, y] of points) {
    await clickAt(x, y);
    try {
      await page.waitForSelector(`body[data-game-view="${targetView}"]`, { timeout: 1200 });
      return;
    } catch {
      // Try another point inside the rendered Cocos button.
    }
  }
  const diagnostics = await page.evaluate((expectedView) => ({
    pointer: document.body.dataset.resultPointer ?? 'none',
    stageAction: document.body.dataset.stageAction ?? 'none',
    view: document.body.dataset.gameView ?? 'none',
    gameStage: document.body.dataset.gameStage ?? 'none',
    stageResult: document.body.dataset.stageResult ?? 'none',
    stageScore: document.body.dataset.stageScore ?? 'none',
    targetView: expectedView,
    canvas: document.getElementById('GameCanvas')?.getBoundingClientRect().toJSON(),
  }), targetView);
  throw new Error(`stage result action did not respond: ${JSON.stringify(diagnostics)}`);
}

async function completeCampaign(page, answer, strike, nextStage, label, firstAnswered = 0) {
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex];
    await page.waitForSelector(`body[data-game-stage="${stage}"]`);
    const answered = stageIndex === 0 ? firstAnswered : 0;
    for (let question = answered; question < 5; question += 1) {
      const captureFeedback = stageIndex === 0 && question === answered && label === 'desktop'
        ? () => capture(page, 'desktop-writing-feedback')
        : undefined;
      await completeCorrectQuestion(page, answer, strike, captureFeedback);
      if (question < 4 && await page.getAttribute('body', 'data-game-stage') !== stage) {
        throw new Error(`${label} changed scene before five questions`);
      }
    }
    await page.waitForSelector(`body[data-stage-result="${stage}"]`);
    if (await page.getAttribute('body', 'data-answer-correct') !== null) {
      throw new Error(`${label} stage result retained the previous answer feedback state`);
    }
    if (Number(await page.getAttribute('body', 'data-stage-score')) <= 0) {
      throw new Error(`${label} stage result did not retain its score`);
    }
    const starSlots = await page.getAttribute('body', 'data-result-star-slots');
    const starsEarned = await page.getAttribute('body', 'data-result-stars-earned');
    const expectedEarned = stageIndex === 0 ? 5 - firstAnswered : 5;
    if (starSlots !== '5' || starsEarned !== String(expectedEarned)) {
      throw new Error(
        `${label} stage result stars were not 5/${expectedEarned}: ${starSlots}/${starsEarned}`,
      );
    }
    if (label === 'desktop' && stageIndex === 0) {
      await assertPosterShare(page, () => page.mouse.click(918, 723), label);
    }
    if (stageIndex === 0 || stageIndex === stages.length - 1) {
      await capture(page, `${label}-writing-stage-result-${stage}`);
    }
    const finalStage = stageIndex === stages.length - 1;
      await nextStage(finalStage ? 'result' : 'play');
      if (finalStage) break;
      if (label === 'desktop') {
        const nextStage = stages[stageIndex + 1];
        const transitionByScene = {
          desert: 1, dinosaur: 3, dunhuang: 2, magic: 4,
        };
        await page.waitForSelector('body[data-transition-active="true"]', { timeout: 4000 });
        await assertVisibleMotion(
          page,
          'CustomerTransition',
        `/media/transitions/${transitionByScene[nextStage]}.webp`,
        `${label}/${nextStage} transition`,
      );
    }
    await page.waitForSelector('body[data-game-view="play"]');
    await page.waitForSelector(`body[data-game-stage="${stages[stageIndex + 1]}"]`);
    if (await page.getAttribute('body', 'data-game-score') !== '0') {
      throw new Error(`${label} score was not reset for the next scene`);
    }
  }
  await page.waitForSelector('body[data-game-view="result"]');
  if (await page.getAttribute('body', 'data-game-answered') !== '25') {
    throw new Error(`${label} final result did not aggregate all 25 questions`);
  }
}

async function runDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  const page = await context.newPage();
  await installMediaPlaybackAudit(page);
  await useDeterministicAnswers(page);
  const failures = collectFailures(page);
  const startedAt = Date.now();
  await page.goto(launchUrl({ difficulty: 'challenge' }), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { state: 'visible' });
  await page.waitForSelector('body[data-game-ready="true"]');
  const readyAt = Date.now();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await assertRuntime(page, startedAt, readyAt, 'desktop');
  await capture(page, 'desktop-writing-intro');
  await page.mouse.click(938, 466);
  await page.waitForSelector('body[data-game-view="play"]', { timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, 'desktop-writing-game');
  for (let wrong = 0; wrong < 3; wrong += 1) {
    await page.mouse.click(1080, 595);
    await page.waitForSelector('body[data-answer-correct="false"]');
    if (wrong === 0) await capture(page, 'desktop-writing-wrong-feedback');
    await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
      timeout: 3000,
    });
    if (await page.getAttribute('body', 'data-game-stage') !== 'treasure'
      || await page.getAttribute('body', 'data-game-view') !== 'play') {
      throw new Error('writing ended the first scene before five questions after wrong answers');
    }
  }
  await completeCampaign(
    page,
    () => page.mouse.click(310, 595),
    () => page.mouse.click(310, 595),
    (targetView) => clickStageAction(
      page,
      (x, y) => page.mouse.click(x, y),
      [[1165, 725], [1165, 740], [1125, 725]],
      targetView,
    ),
    'desktop',
    3,
  );
  if (!await page.getAttribute('body', 'data-finish-reason')) {
    throw new Error('result did not expose its finish reason');
  }
  await capture(page, 'desktop-writing-result');
  await page.mouse.click(1165, 725);
  await page.waitForSelector('body[data-game-view="intro"]');
  await page.waitForTimeout(300);
  await capture(page, 'desktop-writing-replay');
  await assertMediaPlayback(page);
  if (failures.length) throw new Error(failures.join('\n'));
  await context.close();
}

async function runMobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
  });
  const page = await context.newPage();
  await useDeterministicAnswers(page);
  await constrain(page);
  const failures = collectFailures(page);
  const startedAt = Date.now();
  await page.goto(launchUrl(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { state: 'visible' });
  await page.waitForSelector('body[data-game-ready="true"]');
  const readyAt = Date.now();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await assertRuntime(page, startedAt, readyAt, 'mobile');
  await capture(page, 'mobile-writing-intro');
  await page.touchscreen.tap(528, 224);
  await page.waitForSelector('body[data-game-view="play"]', { timeout: 5000 });
  await page.waitForTimeout(300);
  await capture(page, 'mobile-writing-game');
  await completeCampaign(
    page,
    () => page.touchscreen.tap(224, 286),
    () => page.touchscreen.tap(224, 286),
    (targetView) => clickStageAction(
      page,
      (x, y) => page.touchscreen.tap(x, y),
      [[637, 348], [637, 360], [610, 348]],
      targetView,
    ),
    'mobile',
  );
  await capture(page, 'mobile-writing-result');
  if (failures.length) throw new Error(failures.join('\n'));
  await context.close();
}

async function runThemeResults(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  for (const scene of ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic']
    .filter((value) => enabledScenes.has(value))) {
    console.log(`[e2e] theme ${scene}: start`);
    const page = await context.newPage();
    await installMediaPlaybackAudit(page);
    await useDeterministicAnswers(page);
    const failures = collectFailures(page);
    await page.goto(launchUrl({ skipIntro: 1, scene }), { waitUntil: 'networkidle' });
    await page.waitForSelector(`body[data-game-stage="${scene}"]`);
    await page.waitForTimeout(500);
    await page.waitForSelector('body[data-deer-idle-mode="breathing-static"]');
    await capture(page, `desktop-writing-${scene}-game`);

    await page.mouse.click(1080, 595);
    await assertVisibleMotion(
      page, 'WizardDeer', `/media/${scene}/run-right.webp`, `${scene} run right`,
    );
    await page.waitForSelector('body[data-answer-correct="false"]', { timeout: 4000 });
    if (scene === 'desert') {
      await assertVisibleMotion(
        page, 'FeedbackLayer0',
        '/media/static-feedback/desert/wrong-layer-1.png',
        'desert selected pit wrong feedback', false,
      );
      await capture(page, 'desktop-writing-desert-wrong-feedback');
    } else if (scene === 'dinosaur') {
      await assertVisibleMotion(
        page, 'FeedbackLayer0',
        '/media/static-feedback/dinosaur/wrong-layer-2-orange.png',
        'dinosaur selected orange broken egg', false,
      );
      await capture(page, 'desktop-writing-dinosaur-wrong-feedback');
    }
    if (scene !== 'desert') {
      await assertVisibleMotion(
        page, scene === 'dinosaur' ? 'FeedbackStageMotion' : 'FeedbackFallback',
        `/media/${scene}/wrong.webp`, `${scene} wrong feedback`,
      );
    }
    await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
      timeout: 3500,
    });

    await page.mouse.click(310, 595);
    await assertVisibleMotion(
      page, 'WizardDeer', `/media/${scene}/run-left.webp`, `${scene} run left`,
    );
    await assertVisibleMotion(
      page, 'WizardDeer', `/media/${scene}/action.webp`, `${scene} action`,
    );
    await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 5000 });
    await assertVisibleMotion(
      page, 'FeedbackFallback', `/media/${scene}/correct.webp`, `${scene} correct feedback`,
    );
    if (scene === 'dinosaur') {
      await assertVisibleMotion(
        page, 'FeedbackLayer0',
        '/media/static-feedback/dinosaur/correct-layer-1-blue.png',
        'dinosaur selected blue hatchling', false,
      );
      await capture(page, 'desktop-writing-dinosaur-correct-feedback');
    }
    const correctQuestionId = await page.getAttribute('body', 'data-question-id');
    await waitForQuestionAdvance(page, correctQuestionId);

    for (let question = 2; question < 5; question += 1) {
      await completeCorrectQuestion(
        page,
        () => page.mouse.click(310, 595),
        () => page.mouse.click(310, 595),
      );
    }
    await page.waitForSelector(`body[data-stage-result="${scene}"]`);
    await page.waitForTimeout(500);
    await assertVisibleMotion(
      page, 'ResultCharacterMotion', `/media/${scene}/result.webp`, `${scene} result`,
    );
    await capture(page, `desktop-writing-${scene}-result`);
    await assertPlayedPaths(page, [
      `/audio/writing/${scene}/walk.mp3`,
      `/audio/writing/${scene}/correct.mp3`,
      `/audio/writing/${scene}/wrong.mp3`,
      `/audio/writing/${scene}/result.mp3`,
      ...(scene === 'magic' ? [`/audio/writing/${scene}/reveal.mp3`] : []),
    ], scene);
    await assertObservedMotionPaths(page, [
      `/media/${scene}/idle.webp`,
      `/media/${scene}/action.webp`,
      `/media/${scene}/run-left.webp`,
      `/media/${scene}/run-right.webp`,
      `/media/${scene}/correct.webp`,
      ...(scene === 'desert' ? [] : [`/media/${scene}/wrong.webp`]),
      `/media/${scene}/result.webp`,
    ], scene);
    if (failures.length) throw new Error(`${scene}: ${failures.join('\n')}`);
    await page.close();
    console.log(`[e2e] theme ${scene}: passed`);
  }
  await context.close();
}

await fs.mkdir(output, { recursive: true });
const server = configuredBaseUrl ? null : spawn(process.execPath, ['server/index.mjs'], {
  cwd: root, env: { ...process.env, PORT: String(port) }, stdio: 'ignore', windowsHide: true,
});
try {
  if (server) {
    await waitForServer();
    await assertCompressedBuild();
    await assertAudioRange();
  } else await assertExternalDelivery();
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    if (enabledPhases.has('desktop')) {
      console.log('[e2e] desktop: start');
      await runDesktop(browser);
      console.log('[e2e] desktop: passed');
    }
    if (enabledPhases.has('mobile')) {
      console.log('[e2e] mobile: start');
      await runMobile(browser);
      console.log('[e2e] mobile: passed');
    }
    if (enabledPhases.has('themes')) {
      console.log('[e2e] themes: start');
      await runThemeResults(browser);
      console.log('[e2e] themes: passed');
    }
  } finally {
    await browser.close();
  }
  console.log(`Writing Treasure E2E passed: ${output}`);
} finally {
  if (server) {
    server.kill();
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 6000))]);
  }
}
