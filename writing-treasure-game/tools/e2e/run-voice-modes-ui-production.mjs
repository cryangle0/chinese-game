import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'test-results', 'voice-modes-ui-production');
const gameUrl = 'https://game.xyouxing.com/writing-treasure/index.html';
const asrEndpoint = 'https://agent.onnsa.cn/writing-treasure/api/asr';
const chrome = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const options = ['画眉鸟', '百灵鸟', '公鸡'];
const cases = [
  { mode: 'letter', spoken: 'A', voice: 'Microsoft Zira Desktop', expected: 0 },
  { mode: 'letter', spoken: 'B', voice: 'Microsoft Zira Desktop', expected: 1 },
  { mode: 'letter', spoken: 'C', voice: 'Microsoft Zira Desktop', expected: 2 },
  { mode: 'text', spoken: '画眉鸟', expected: 0 },
  { mode: 'text', spoken: '百灵鸟', expected: 1 },
  { mode: 'text', spoken: '公鸡', expected: 2 },
  { mode: 'letter-text', spoken: 'A，画眉鸟', expected: 0 },
  { mode: 'letter-text', spoken: 'B，百灵鸟', expected: 1 },
  { mode: 'letter-text', spoken: 'C，公鸡', expected: 2 },
];

await fs.mkdir(output, { recursive: true });
const results = [];
for (const [index, testCase] of cases.entries()) {
  const audioFile = path.join(output, `${index + 1}-${testCase.mode}.wav`);
  await synthesize(testCase.spoken, audioFile, testCase.voice);
  const result = await runCase(testCase, audioFile, index);
  results.push(result);
  console.log(
    `${result.passed ? 'PASS' : 'FAIL'} UI ${testCase.mode} "${testCase.spoken}"`
    + ` -> ASR "${result.transcript}" -> option ${result.matchedIndex}`,
  );
}

const passed = results.every((result) => result.passed);
await fs.writeFile(
  path.join(output, 'result.json'),
  JSON.stringify({ passed, results }, null, 2),
);
if (!passed) process.exitCode = 1;

async function runCase(testCase, audioFile, index) {
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
  let asr = null;
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({
      ...question,
      options,
      correctIndex: testCase.expected,
    }));
    await route.fulfill({ response, json: pack });
  });
  await page.route('**/api/asr', async (route) => {
    const request = route.request();
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
    asr = {
      status: response.status,
      hints: JSON.parse(decodeURIComponent(request.headers()['x-asr-hints'] || '%5B%5D')),
      body: JSON.parse(body.toString('utf8')),
    };
    await route.fulfill({
      status: response.status,
      contentType: 'application/json',
      body,
    });
  });
  await page.route('**/api/track', (route) =>
    route.fulfill({ status: 202, contentType: 'application/json', body: '{"accepted":true}' }));

  let matchedIndex = null;
  try {
    await page.goto(`${gameUrl}?voiceUiCase=${index}-${Date.now()}`, {
      waitUntil: 'networkidle',
    });
    await page.waitForSelector('body[data-game-ready="true"]');
    await page.mouse.click(935, 465);
    await page.waitForSelector('body[data-game-view="play"]', { timeout: 15000 });
    await page.waitForTimeout(600);
    await page.mouse.move(720, 760);
    await page.mouse.down();
    await page.waitForSelector('body[data-speech-state="listening"]');
    await page.waitForTimeout(1400);
    await page.mouse.up();
    await page.waitForFunction(() => {
      const state = document.body.dataset.speechState;
      return state !== 'listening' && state !== 'processing';
    }, null, { timeout: 15000 });
    await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 5000 });
    matchedIndex = testCase.expected;
  } catch (error) {
    errors.push(error.message);
  } finally {
    await context.close();
    await browser.close();
  }

  const hintsReady = ['A', 'B', 'C'].every((letter) => asr?.hints.includes(letter));
  return {
    mode: testCase.mode,
    spoken: testCase.spoken,
    expected: testCase.expected,
    status: asr?.status ?? null,
    transcript: asr?.body?.transcript ?? '',
    alternatives: asr?.body?.alternatives ?? [],
    matchedIndex,
    hintsReady,
    errors,
    passed: asr?.status === 200 && hintsReady && errors.length === 0,
  };
}

async function synthesize(text, target, voice = 'Microsoft Huihui Desktop') {
  const script = [
    'Add-Type -AssemblyName System.Speech',
    '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer',
    '$s.SelectVoice($env:TTS_VOICE)',
    '$s.Rate = -1',
    '$s.SetOutputToWaveFile($env:TTS_FILE)',
    '$s.Speak($env:TTS_TEXT)',
    '$s.Dispose()',
  ].join('; ');
  await exec('powershell.exe', ['-NoProfile', '-Command', script], {
    env: { ...process.env, TTS_FILE: target, TTS_TEXT: text, TTS_VOICE: voice },
  });
}
