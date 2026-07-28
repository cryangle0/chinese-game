import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const baseUrl = process.env.E2E_BASE_URL?.trim() || 'http://127.0.0.1:43882';
const asrEndpoint = process.env.E2E_ASR_ENDPOINT?.trim()
  || 'https://agent.onnsa.cn/writing-treasure/api/asr';
const trackEndpoint = 'https://agent.onnsa.cn/writing-treasure/api/track';
const audioFile = path.join(root, 'test-results', 'asr-production', 'exact-possess.wav');
const output = path.join(root, 'test-results', 'voice-production');
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

await fs.mkdir(output, { recursive: true });
await waitForServer();

const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: [
    '--autoplay-policy=no-user-gesture-required',
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-audio-capture=${audioFile}`,
  ],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 810 },
  permissions: ['microphone'],
});
const page = await context.newPage();
const consoleMessages = [];
const pageErrors = [];
let asrResult = null;
const trackResults = [];

page.on('console', (message) => {
  consoleMessages.push({ type: message.type(), text: message.text() });
});
page.on('pageerror', (error) => pageErrors.push(error.stack || error.message));

await page.route('**/question-bank.json', async (route) => {
  const response = await route.fetch();
  const pack = await response.json();
  pack.questions = pack.questions.map((question) => ({
    ...question,
    options: ['惊喜', '焦急和伤心', '激动'],
    correctIndex: 1,
  }));
  await route.fulfill({ response, json: pack });
});

await page.route('**/api/asr', async (route) => {
  const request = route.request();
  const startedAt = Date.now();
  const encodedHints = request.headers()['x-asr-hints'] || '';
  const response = await fetch(asrEndpoint, {
    method: 'POST',
    headers: {
      'content-type': request.headers()['content-type'] || 'audio/webm',
      'x-asr-hints': request.headers()['x-asr-hints'] || '',
      origin: 'https://game.xyouxing.com',
    },
    body: request.postDataBuffer(),
  });
  const body = Buffer.from(await response.arrayBuffer());
  asrResult = {
    status: response.status,
    elapsedMs: Date.now() - startedAt,
    cors: response.headers.get('access-control-allow-origin'),
    hints: encodedHints ? JSON.parse(decodeURIComponent(encodedHints)) : [],
    body: JSON.parse(body.toString('utf8')),
  };
  await route.fulfill({
    status: response.status,
    contentType: response.headers.get('content-type') || 'application/json',
    body,
  });
});

await page.route('**/api/track', async (route) => {
  const payload = route.request().postDataJSON();
  const response = await fetch(trackEndpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: 'https://game.xyouxing.com',
    },
    body: JSON.stringify(payload),
  });
  const body = Buffer.from(await response.arrayBuffer());
  trackResults.push({
    status: response.status,
    cors: response.headers.get('access-control-allow-origin'),
    payload,
    body: JSON.parse(body.toString('utf8')),
  });
  await route.fulfill({
    status: response.status,
    contentType: response.headers.get('content-type') || 'application/json',
    body,
  });
});

try {
  const gameUrl = new URL(baseUrl);
  // Local acceptance must use a same-origin runtime URL; the route below
  // forwards it to the trusted production diagnostics service.
  gameUrl.searchParams.set('trackEndpoint', '/api/track');
  await page.goto(gameUrl.href, { waitUntil: 'networkidle' });
  await page.waitForSelector('body[data-game-ready="true"]');
  await page.mouse.click(935, 465);
  await page.waitForSelector('body[data-game-view="play"]', { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.mouse.move(720, 760);
  await page.mouse.down();
  await page.waitForSelector('body[data-speech-state="listening"]');
  await page.screenshot({ path: path.join(output, 'voice-listening.png') });
  await page.waitForTimeout(1400);
  await page.mouse.up();
  await page.waitForFunction(() => {
    const state = document.body.dataset.speechState;
    return state !== 'listening' && state !== 'processing';
  }, null, { timeout: 15000 });
  await page.screenshot({ path: path.join(output, 'voice-recognized.png') });

  if (!asrResult || asrResult.status !== 200
    || asrResult.body.transcript !== '焦急和伤心'
    || asrResult.cors !== 'https://game.xyouxing.com'
    || asrResult.elapsedMs > 3000) {
    throw new Error(`production ASR mismatch: ${JSON.stringify(asrResult)}`);
  }

  await waitForVoicePhases(trackResults, ['asr_response', 'match_success', 'accepted']);
  const voiceEvents = trackResults.flatMap((result) => result.payload.events)
    .filter((event) => event.name === 'voice_diagnostic');
  const phases = voiceEvents.map((event) => event.properties?.phase);
  const forbiddenFields = ['audio', 'transcript', 'options', 'question', 'errorMessage'];
  if (!trackResults.some((result) => result.status === 202)
    || !['asr_response', 'match_success', 'accepted'].every((phase) => phases.includes(phase))
    || voiceEvents.some((event) => forbiddenFields.some((field) =>
      Object.prototype.hasOwnProperty.call(event.properties || {}, field)))) {
    throw new Error(`voice diagnostics mismatch: ${JSON.stringify(trackResults)}`);
  }
  await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 4000 });
  const feedbackMode = await page.getAttribute('body', 'data-feedback-mode');
  const feedbackColumn = await page.getAttribute('body', 'data-feedback-column');
  if (feedbackMode !== 'motion' || feedbackColumn !== '1') {
    throw new Error(`voice feedback mismatch: ${feedbackMode}/${feedbackColumn}`);
  }
  await page.screenshot({ path: path.join(output, 'voice-answer-correct.png') });
  await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
    timeout: 5000,
  });
  await page.waitForSelector('body[data-speech-state="idle"]');
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(output, 'voice-next-question.png') });

  const recognitionWarnings = consoleMessages.filter((message) =>
    message.text.includes('[SpeechSelectionService] recognition failed'));
  if (recognitionWarnings.length || pageErrors.length) {
    throw new Error(JSON.stringify({ recognitionWarnings, pageErrors }));
  }
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({
    passed: true,
    asr: asrResult,
    analytics: trackResults,
    speechState: await page.getAttribute('body', 'data-speech-state'),
    bodyDataset: await page.evaluate(() => ({ ...document.body.dataset })),
    consoleMessages,
    pageErrors,
  }, null, 2));
  console.log(`voice production e2e ok: ${asrResult.body.transcript}, ${asrResult.elapsedMs}ms`);
} catch (error) {
  await page.screenshot({ path: path.join(output, 'voice-failure.png') }).catch(() => undefined);
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({
    passed: false,
    error: error.stack || error.message,
    asr: asrResult,
    speechState: await page.getAttribute('body', 'data-speech-state').catch(() => null),
    bodyDataset: await page.evaluate(() => ({ ...document.body.dataset })).catch(() => null),
    consoleMessages,
    pageErrors,
  }, null, 2));
  throw error;
} finally {
  await context.close();
  await browser.close();
}

async function waitForServer(timeoutMs = 15000) {
  const startedAt = Date.now();
  const probeUrl = new URL(baseUrl);
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fetch(probeUrl)).ok) return;
    } catch {
      // The local build server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`game server unavailable: ${baseUrl}`);
}

async function waitForVoicePhases(results, expected, timeoutMs = 9000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const phases = results.flatMap((result) => result.payload.events)
      .filter((event) => event.name === 'voice_diagnostic')
      .map((event) => event.properties?.phase);
    if (expected.every((phase) => phases.includes(phase))) return;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`voice diagnostics timed out: ${JSON.stringify(results)}`);
}
