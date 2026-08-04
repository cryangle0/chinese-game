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
const output = process.env.E2E_OUTPUT
  ? path.resolve(process.env.E2E_OUTPUT)
  : path.join(root, 'test-results', 'e2e');
const port = Number(process.env.E2E_PORT ?? 42881);
const configuredBaseUrl = process.env.E2E_BASE_URL?.trim();
const baseUrl = configuredBaseUrl || `http://127.0.0.1:${port}`;
const pageBaseUrl = baseUrl;
const feedbackSettleMs = configuredBaseUrl ? 2200 : 1650;
const publicPathPrefix = configuredBaseUrl
  ? new URL(configuredBaseUrl).pathname.replace(/\/[^/]*$/, '')
  : '';
const enabledPhases = new Set(
  (process.env.E2E_PHASES ?? 'desktop,mobile,themes,pose')
    .split(',').map((value) => value.trim()).filter(Boolean),
);
const startupOnly = process.env.E2E_STARTUP_ONLY === '1';
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
  const directory = path.join(root, 'build', 'web-mobile', 'cocos-js');
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
  await locator.waitFor({ state: 'visible', timeout: 4000 });
  await page.waitForFunction(({ motionMarker, pathName }) => {
    const image = document.querySelector(`img[data-customer-motion="${motionMarker}"]`);
    if (!(image instanceof HTMLImageElement) || getComputedStyle(image).display === 'none') {
      return false;
    }
    const source = image.currentSrc || image.getAttribute('src') || '';
    return new URL(source, location.href).pathname.endsWith(pathName);
  }, { motionMarker: marker, pathName: expectedPath }, { timeout: 4000 });
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

async function waitForResultMotion(page, label) {
  await page.waitForFunction(() => {
    const images = [...document.querySelectorAll(
      'img[data-customer-motion="ResultCharacterMotion"]',
    )];
    return images.some((image) => image.complete && getComputedStyle(image).display !== 'none');
  }, null, { timeout: 5000 });
  const feedbackVisible = await page.locator(
    'img[data-customer-motion="Feedback"]',
  ).evaluateAll((images) => images.some((image) => getComputedStyle(image).display !== 'none'));
  if (feedbackVisible) throw new Error(`${label} retained answer feedback over its result`);
}

async function assertIntroCameraOverlay(page, label, minWidth, maxWidth) {
  await page.waitForFunction(() => {
    const node = document.getElementById('reading-pose-overlay');
    const state = node?.dataset.poseState;
    return Boolean(state && state !== 'idle');
  }, null, { timeout: 8000 });
  const overlay = await page.locator('#reading-pose-overlay').evaluate((node) => ({
    state: node.dataset.poseState,
    videoLive: node.querySelector('video')?.classList.contains('is-live') ?? false,
    root: node.getBoundingClientRect().toJSON(),
    viewport: node.querySelector('.pose-camera__viewport')?.getBoundingClientRect().toJSON(),
  }));
  const activeStates = new Set(['requesting', 'loading', 'ready', 'lost', 'fallback']);
  const ratio = overlay.viewport.width / Math.max(1, overlay.viewport.height);
  const sizeOk = overlay.state === 'fallback'
    || (overlay.viewport.width >= minWidth && overlay.viewport.width <= maxWidth
      && Math.abs(ratio - 16 / 9) <= 0.08);
  if (!activeStates.has(overlay.state) || !sizeOk) {
    throw new Error(`${label} intro camera overlay regressed: ${JSON.stringify(overlay)}`);
  }
}

async function assertAnimatedRegion(page, label) {
  const clip = { x: 620, y: 500, width: 200, height: 260 };
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
    throw new Error(`${label} character did not animate continuously: ${changed} changed pixels`);
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
  const poseTransfer = resources
    .filter((entry) => /\/(?:vendor|models|wasm)\//.test(normalizePublicPath(entry.name)))
    .reduce((sum, entry) => sum + entry.transfer, 0);
  const totalTransfer = resources.reduce((sum, entry) => sum + entry.transfer, 0)
    - testBankTransfer + productionBankTransferBytes;
  const coreTransfer = totalTransfer - poseTransfer;
  if (coreTransfer > 2 * 1024 * 1024 || poseTransfer > 5.2 * 1024 * 1024) {
    const largest = resources.slice(0, 8)
      .map((entry) => `${(entry.transfer / 1024).toFixed(0)} KB ${normalizePublicPath(entry.name)}`)
      .join('\n');
    throw new Error(
      `${label} transferred ${(coreTransfer / 1048576).toFixed(2)} MB core + `
      + `${(poseTransfer / 1048576).toFixed(2)} MB pose `
      + `(${(totalTransfer / 1048576).toFixed(2)} MB total)\n${largest}`,
    );
  }
  console.log(
    `[e2e] ${label} startup=${startupMs}ms frameP95=${frame.p95.toFixed(2)}ms; `
    + 'pre-interaction transfer: '
    + `${(coreTransfer / 1048576).toFixed(2)} MB core + `
    + `${(poseTransfer / 1048576).toFixed(2)} MB pose`,
  );
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

async function assertReadingDeerIdle(page, label) {
  await page.waitForSelector('body[data-deer-state="idle"]', { timeout: 4000 });
  const idleMotion = await page.getAttribute('body', 'data-deer-idle-motion');
  const renderer = await page.getAttribute('body', 'data-deer-locomotion-renderer');
  if (idleMotion !== 'sprite-sheet-run-in-place' || renderer !== 'sprite-sheet') {
    throw new Error(
      `${label} did not use sprite-sheet run-in-place idle: `
      + `${idleMotion || 'missing'}/${renderer || 'missing'}`,
    );
  }
}

async function assertReadingDeerRun(page, scene) {
  await page.waitForFunction((sceneId) => {
    const { deerState, deerRunAsset, deerLocomotionRenderer } = document.body.dataset;
    return deerState === 'run'
      && deerLocomotionRenderer === 'sprite-sheet'
      && deerRunAsset?.startsWith(`themes/reading/${sceneId}/locomotion-run-`);
  }, scene, { timeout: 5000 });
}

async function assertMediaPlayback(page) {
  await page.waitForTimeout(200);
  const played = [...new Set((await page.evaluate(() => (
    window.__mediaPlaybackAudit
      .filter((entry) => entry.status === 'playing')
      .map((entry) => entry.src)
  ))).map(normalizePublicPath))];
  const expected = [
    '/audio/reading/bgm.mp3',
    '/audio/mario/button.mp3',
    '/audio/mario/strike.mp3',
    '/audio/mario/reward.mp3',
    '/audio/mario/danger.mp3',
    '/audio/mario/result.mp3',
    '/audio/mario/firework.mp3',
    '/audio/mario/wrong.mp3',
    '/audio/mario/intro-title.mp3',
    '/audio/mario/start-appear.mp3',
    ...stages.map((stage) => (
      stage === 'mario'
        ? '/audio/mario/correct.mp3'
        : `/audio/reading/${stage}/correct.mp3`
    )),
    '/audio/mario/transition.mp3',
    ...stages.slice(1).map((stage) => `/audio/reading/${stage}/transition.mp3`),
    '/audio/reading/deep-sea/ambient.mp3',
  ];
  const missing = expected.filter((pathName) => !played.includes(pathName));
  if (missing.length) {
    throw new Error(`reading runtime media did not play: ${missing.join(', ')}`);
  }
}

const stages = ['mario', 'deep-sea', 'space', 'food', 'poetry'];

async function useDeterministicAnswers(page) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({ ...question, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });
}

async function completeCampaign(page, answer, nextStage, label, firstAnswered = 0) {
  for (let stageIndex = 0; stageIndex < stages.length; stageIndex += 1) {
    const stage = stages[stageIndex];
    await page.waitForSelector(`body[data-game-stage="${stage}"]`);
    if (await page.getAttribute('body', 'data-transition-active') === 'true') {
      await page.waitForFunction(() => document.body.dataset.transitionActive === undefined, null, {
        timeout: 5000,
      });
    }
    await page.waitForTimeout(800);
    await capture(page, `${label}-reading-theme-${stage}`);
    const answered = stageIndex === 0 ? firstAnswered : 0;
    for (let question = answered; question < 5; question += 1) {
      await page.waitForSelector('body[data-answer-ready="true"]', { timeout: 6000 });
      const previousScore = Number(await page.getAttribute('body', 'data-game-score') ?? '0');
      await answer();
      await page.waitForFunction((score) => (
        Number(document.body.dataset.gameScore ?? '0') > score
      ), previousScore, { timeout: 3000 });
      await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 3000 });
      if (stageIndex === 0 && question === answered && label === 'desktop') {
        await page.waitForTimeout(650);
        await capture(page, 'desktop-reading-feedback');
      }
      if (question < 4) {
        await page.waitForSelector('body[data-answer-ready="true"]', { timeout: 6000 });
      } else {
        await page.waitForSelector(`body[data-stage-result="${stage}"]`, { timeout: 6000 });
      }
      if (question < 4 && await page.getAttribute('body', 'data-game-stage') !== stage) {
        throw new Error(`${label} changed scene before five questions`);
      }
    }
    await page.waitForSelector(`body[data-stage-result="${stage}"]`);
    await waitForResultMotion(page, `${label}/${stage}`);
    if (Number(await page.getAttribute('body', 'data-stage-score')) <= 0) {
      throw new Error(`${label} stage result did not retain its score`);
    }
    if (label === 'desktop' && stageIndex === 0) {
      await assertPosterShare(page, () => page.mouse.click(906, 685), label);
    }
    await capture(page, `${label}-reading-stage-result-${stage}`);
    await nextStage();
    if (stageIndex === stages.length - 1) {
      await page.waitForSelector('body[data-game-view="result"]');
      break;
    }
    if (label === 'desktop') {
      await page.waitForSelector('body[data-transition-active="true"]', { timeout: 4000 });
      await assertVisibleMotion(
        page,
        'CustomerTransition',
        `/media/transitions/${stageIndex + 1}.webp`,
        `${label}/${stage} transition`,
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

async function answerThemeQuestion(page, scene, finalQuestion) {
  await page.waitForSelector('body[data-answer-ready="true"]', { timeout: 6000 });
  const previousQuestionId = await page.getAttribute('body', 'data-question-id');
  await page.mouse.click(320, 430);
  await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 3000 });
  if (finalQuestion) {
    await page.waitForSelector(`body[data-stage-result="${scene}"]`, { timeout: 6000 });
    return;
  }
  await page.waitForFunction((questionId) => (
    document.body.dataset.answerReady === 'true'
      && document.body.dataset.questionId !== questionId
  ), previousQuestionId, { timeout: 6000 });
}

async function runDesktop(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  await context.grantPermissions(['camera']);
  const page = await context.newPage();
  await installMediaPlaybackAudit(page);
  await useDeterministicAnswers(page);
  const failures = collectFailures(page);
  const startedAt = Date.now();
  await page.goto(launchUrl(), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('canvas', { state: 'visible' });
  await page.waitForSelector('body[data-game-ready="true"]');
  const readyAt = Date.now();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  await assertRuntime(page, startedAt, readyAt, 'desktop');
  await assertIntroCameraOverlay(page, 'desktop', 322, 334);
  await capture(page, 'desktop-reading-intro');
  if (startupOnly) {
    if (failures.length) throw new Error(failures.join('\n'));
    await context.close();
    return;
  }
  await page.mouse.click(720, 365);
  await page.waitForSelector('body[data-game-view="play"]', { timeout: 2500 });
  await capture(page, 'desktop-reading-game');
  for (let wrong = 0; wrong < 3; wrong += 1) {
    await page.waitForSelector('body[data-answer-ready="true"]', { timeout: 6000 });
    await page.mouse.click(720, 430);
    await page.waitForSelector('body[data-answer-correct="false"]', { timeout: 3000 });
    if (wrong === 0) {
      await page.waitForTimeout(650);
      await capture(page, 'desktop-reading-wrong-feedback');
    }
    await page.waitForSelector('body[data-answer-ready="true"]', { timeout: 6000 });
    if (await page.getAttribute('body', 'data-game-stage') !== 'mario'
      || await page.getAttribute('body', 'data-game-view') !== 'play') {
      throw new Error('reading ended the first scene before five questions after wrong answers');
    }
  }
  await completeCampaign(
    page,
    () => page.mouse.click(320, 430),
    () => page.mouse.click(1153, 685),
    'desktop',
    3,
  );
  if (!await page.getAttribute('body', 'data-finish-reason')) {
    throw new Error('result did not expose its finish reason');
  }
  await capture(page, 'desktop-reading-result');
  await page.mouse.click(1153, 685);
  await page.waitForSelector('body[data-game-view="intro"]');
  await page.waitForTimeout(300);
  await capture(page, 'desktop-reading-replay');
  await assertMediaPlayback(page);
  if (failures.length) throw new Error(failures.join('\n'));
  await context.close();
}

async function runMobile(browser) {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true,
  });
  await context.grantPermissions(['camera']);
  const page = await context.newPage();
  // Keep the 4× CPU gate focused on Cocos/UI work. Real MoveNet latency has
  // its own benchmark:pose threshold; combining both double-throttles WebGL.
  await installPoseMovementStub(page);
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
  await assertIntroCameraOverlay(page, 'mobile', 180, 205);
  await capture(page, 'mobile-reading-intro');
  await page.touchscreen.tap(422, 176);
  await page.waitForSelector('body[data-game-view="play"]', { timeout: 2500 });
  await page.waitForTimeout(300);
  await capture(page, 'mobile-reading-game');
  await completeCampaign(
    page,
    () => page.touchscreen.tap(229, 207),
    () => page.touchscreen.tap(631, 330),
    'mobile',
  );
  await capture(page, 'mobile-reading-result');
  if (failures.length) throw new Error(failures.join('\n'));
  await context.close();
}

async function installPoseMovementStub(page) {
  await page.route('**/runtime-config.json', (route) => route.fulfill({
    contentType: 'application/json',
    json: { pose: { movementSensitivity: 1.8 } },
  }));
  await page.route('**/vendor/*.js', (route) => route.fulfill({
    contentType: 'application/javascript',
    body: '',
  }));
  await page.addInitScript(() => {
    window.__poseMoveEnabled = false;
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          const canvas = document.createElement('canvas');
          canvas.width = 192;
          canvas.height = 144;
          const graphics = canvas.getContext('2d');
          graphics.fillStyle = '#17324d';
          graphics.fillRect(0, 0, canvas.width, canvas.height);
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
    let frame = 0;
    window.poseDetection = {
      SupportedModels: { MoveNet: 'MoveNet' },
      movenet: { modelType: { SINGLEPOSE_LIGHTNING: 'lightning' } },
      createDetector: async () => ({
        estimatePoses: async () => {
          if (window.__poseMoveEnabled) frame += 1;
          const rawX = !window.__poseMoveEnabled || frame < 5
            ? 96
            : frame < 17 ? 132 : frame < 31 ? 60 : 96;
          const keypoints = Array.from({ length: 17 }, () => ({
            x: rawX, y: 72, score: 0.95,
          }));
          keypoints[5] = { x: rawX - 14, y: 32, score: 0.95 };
          keypoints[6] = { x: rawX + 14, y: 32, score: 0.95 };
          keypoints[11] = { x: rawX - 12, y: 72, score: 0.95 };
          keypoints[12] = { x: rawX + 12, y: 72, score: 0.95 };
          return [{ keypoints }];
        },
        dispose: () => undefined,
      }),
    };
  });
}

async function runPlaceholderThemes(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  for (const scene of stages) {
    const page = await context.newPage();
    await installMediaPlaybackAudit(page);
    await installPoseMovementStub(page);
    await useDeterministicAnswers(page);
    const failures = collectFailures(page);
    await page.goto(launchUrl({ skipIntro: 1, scene }), { waitUntil: 'networkidle' });
    await page.waitForSelector(`body[data-game-stage="${scene}"]`);
    await page.waitForSelector('body[data-pose-state="ready"]', { timeout: 10000 });
    await page.mouse.click(10, 10);
    await page.evaluate(() => { window.__poseMoveEnabled = true; });
    await assertReadingDeerRun(page, scene);
    await page.evaluate(() => { window.__poseMoveEnabled = false; });
    await assertReadingDeerIdle(page, `${scene} idle`);
    await capture(page, `desktop-reading-${scene}-placeholder`);

    await page.mouse.click(720, 430);
    await assertVisibleMotion(
      page, 'ReadingDeer', `/media/${scene}/action.webp`, `${scene} wrong action`,
    );
    await assertVisibleMotion(
      page, 'Feedback', `/media/${scene}/wrong.webp`, `${scene} wrong feedback`,
    );
    await page.locator('img[data-customer-motion="Feedback"]')
      .waitFor({ state: 'hidden', timeout: 3000 });

    await page.mouse.click(320, 430);
    await assertVisibleMotion(
      page, 'ReadingDeer', `/media/${scene}/action.webp`, `${scene} correct action`,
    );
    await assertVisibleMotion(
      page, 'Feedback', `/media/${scene}/correct.webp`, `${scene} correct feedback`,
    );
    await page.locator('img[data-customer-motion="Feedback"]')
      .waitFor({ state: 'hidden', timeout: 3000 });

    for (let question = 2; question < 5; question += 1) {
      await answerThemeQuestion(page, scene, question === 4);
    }
    await page.waitForSelector(`body[data-stage-result="${scene}"]`);
    await waitForResultMotion(page, scene);
    await assertVisibleMotion(
      page,
      'ResultCharacterMotion',
      `/media/${scene}/result.webp`,
      `${scene} result`,
      !['deep-sea', 'space'].includes(scene),
    );
    await capture(page, `desktop-reading-${scene}-result`);
    const themeAudioBase = scene === 'mario'
      ? '/audio/mario'
      : `/audio/reading/${scene}`;
    await assertPlayedPaths(page, [
      '/audio/mario/run.mp3',
      ...(scene === 'space' ? [] : ['/audio/mario/strike.mp3']),
      '/audio/mario/reward.mp3',
      '/audio/mario/danger.mp3',
      '/audio/mario/result.mp3',
      `${themeAudioBase}/correct.mp3`,
      `${themeAudioBase}/wrong.mp3`,
    ], scene);
    await assertObservedMotionPaths(page, [
      `/media/${scene}/action.webp`,
      `/media/${scene}/correct.webp`,
      `/media/${scene}/wrong.webp`,
      `/media/${scene}/result.webp`,
    ], scene);
    if (failures.length) throw new Error(`${scene}: ${failures.join('\n')}`);
    await page.close();
  }
  await context.close();
}

async function runPoseSimulation(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
  const page = await context.newPage();
  await useDeterministicAnswers(page);
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
          const draw = () => {
            const graphics = canvas.getContext('2d');
            graphics.fillStyle = '#17324d';
            graphics.fillRect(0, 0, canvas.width, canvas.height);
            graphics.fillStyle = '#ffd54f';
            graphics.beginPath();
            graphics.arc(96, 38, 18, 0, Math.PI * 2);
            graphics.fill();
            graphics.strokeStyle = '#fff';
            graphics.lineWidth = 8;
            graphics.beginPath();
            graphics.moveTo(96, 56);
            graphics.lineTo(96, 105);
            graphics.moveTo(96, 70);
            graphics.lineTo(62, 90);
            graphics.moveTo(96, 70);
            graphics.lineTo(130, 90);
            graphics.stroke();
          };
          draw();
          window.__poseCanvas = canvas;
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
    let frame = 0;
    let questionReadyFrame = 0;
    window.poseDetection = {
      SupportedModels: { MoveNet: 'MoveNet' },
      movenet: { modelType: { SINGLEPOSE_LIGHTNING: 'lightning' } },
      createDetector: async () => ({
        estimatePoses: async () => {
          frame += 1;
          const interactionReady = document.body.dataset.poseInteractionReady === 'true';
          if (!questionReadyFrame
            && interactionReady
            && document.body.dataset.answerReady === 'true') {
            questionReadyFrame = frame;
          }
          const questionFrame = questionReadyFrame ? frame - questionReadyFrame : -1;
          const rawX = interactionReady ? 132 : 96;
          const rawY = questionFrame >= 10 && questionFrame <= 12 ? 40 : 72;
          const keypoints = Array.from({ length: 17 }, () => ({
            x: rawX, y: rawY, score: 0.95,
          }));
          keypoints[5] = { x: rawX - 14, y: rawY - 40, score: 0.95 };
          keypoints[6] = { x: rawX + 14, y: rawY - 40, score: 0.95 };
          keypoints[11] = { x: rawX - 12, y: rawY, score: 0.95 };
          keypoints[12] = { x: rawX + 12, y: rawY, score: 0.95 };
          return [{ keypoints }];
        },
        dispose: () => undefined,
      }),
    };
  });
  const failures = collectFailures(page);
  await page.goto(launchUrl({ skipIntro: 1, scene: 'mario' }), { waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-pose-state="ready"]', { timeout: 10000 });
  if (await page.getAttribute('body', 'data-pose-movement-sensitivity') !== '1.8') {
    throw new Error('pose movement sensitivity config was not applied');
  }
  await page.waitForFunction(() => Number(document.body.dataset.gameScore) >= 20, null, {
    timeout: 10000,
  });
  const overlay = await page.locator('#reading-pose-overlay').evaluate((node) => ({
    state: node.dataset.poseState,
    videoLive: node.querySelector('video')?.classList.contains('is-live'),
    root: node.getBoundingClientRect().toJSON(),
    viewport: node.querySelector('.pose-camera__viewport')?.getBoundingClientRect().toJSON(),
    headerVisible: getComputedStyle(node.querySelector('.pose-camera__header')).display !== 'none',
    borderWidth: parseFloat(getComputedStyle(node.querySelector('.pose-camera__viewport')).borderTopWidth),
  }));
  if (overlay.state !== 'ready' || !overlay.videoLive) {
    throw new Error(`pose overlay did not become live: ${JSON.stringify(overlay)}`);
  }
  const ratio = overlay.viewport.width / overlay.viewport.height;
  if (Math.abs(ratio - 16 / 9) > 0.08
    || overlay.headerVisible
    || overlay.borderWidth < 3
    || overlay.viewport.width < 322
    || overlay.viewport.width > 334
    || overlay.root.left < 1105
    || overlay.root.right > 1435
    || overlay.root.top < 10
    || overlay.root.top > 14) {
    throw new Error(`pose overlay geometry regressed: ${JSON.stringify(overlay)}`);
  }
  await capture(page, 'desktop-reading-pose-simulation');
  if (failures.length) throw new Error(failures.join('\n'));
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
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
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
      await runPlaceholderThemes(browser);
      console.log('[e2e] themes: passed');
    }
    if (enabledPhases.has('pose')) {
      console.log('[e2e] pose: start');
      await runPoseSimulation(browser);
      console.log('[e2e] pose: passed');
    }
  } finally {
    await browser.close();
  }
  console.log(`Reading Jumper E2E passed: ${output}`);
} finally {
  if (server) {
    server.kill();
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 6000))]);
  }
}
