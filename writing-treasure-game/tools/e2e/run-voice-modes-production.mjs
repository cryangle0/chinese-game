import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const exec = promisify(execFile);
const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'test-results', 'voice-modes-production');
const endpoint = process.env.E2E_ASR_ENDPOINT?.trim()
  || 'https://agent.onnsa.cn/writing-treasure/api/asr';
const gameUrl = 'https://game.xyouxing.com/writing-treasure/index.html?voiceModes=20260727';
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
const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const results = [];

try {
  await page.goto(gameUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.gameReady === 'true');
  await page.mouse.click(935, 465);
  await page.waitForFunction(() =>
    document.body.dataset.gameView === 'play'
    && typeof window.__matchSpokenTranscripts === 'function');

  for (const [index, testCase] of cases.entries()) {
    const audioFile = path.join(output, `${index + 1}-${testCase.mode}.wav`);
    await synthesize(testCase.synthText ?? testCase.spoken, audioFile, testCase.voice);
    const audio = await fs.readFile(audioFile);
    const startedAt = Date.now();
    let response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'audio/wav',
        'x-asr-hints': encodeHints(options),
        origin: 'https://game.xyouxing.com',
      },
      body: audio,
    });
    let body = await response.json();
    let attempts = 1;
    if (!body.transcript && testCase.mode === 'letter') {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'audio/wav',
          'x-asr-hints': encodeURIComponent(JSON.stringify([
            'A', 'B', 'C', '选A', '选B', '选C',
          ])),
          origin: 'https://game.xyouxing.com',
        },
        body: audio,
      });
      body = await response.json();
      attempts += 1;
    }
    const transcripts = [
      body.transcript,
      ...(Array.isArray(body.alternatives) ? body.alternatives : []),
    ].filter((value) => typeof value === 'string');
    const matched = await page.evaluate(
      ({ values, answerOptions }) =>
        window.__matchSpokenTranscripts(values, answerOptions),
      { values: transcripts, answerOptions: options },
    );
    results.push({
      mode: testCase.mode,
      spoken: testCase.spoken,
      status: response.status,
      elapsedMs: Date.now() - startedAt,
      attempts,
      transcript: body.transcript ?? '',
      requestId: body.requestId ?? '',
      matched,
      passed: response.status === 200 && matched === testCase.expected,
    });
  }
} finally {
  await browser.close();
}

await fs.writeFile(
  path.join(output, 'result.json'),
  JSON.stringify({ passed: results.every((item) => item.passed), results }, null, 2),
);
for (const result of results) {
  console.log(
    `${result.passed ? 'PASS' : 'FAIL'} ${result.mode} "${result.spoken}"`
    + ` -> ASR "${result.transcript}" -> ${result.matched} (${result.elapsedMs}ms)`,
  );
}
if (results.some((item) => !item.passed)) process.exitCode = 1;

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

function encodeHints(answerOptions) {
  const letters = answerOptions.map((_text, index) => String.fromCharCode(65 + index));
  const hints = [
    ...answerOptions,
    ...letters,
    ...answerOptions.map((text, index) => `${letters[index]}${text}`),
    ...letters.map((letter) => `选项${letter}`),
    ...letters.map((letter) => `选${letter}`),
  ];
  return encodeURIComponent(JSON.stringify(hints));
}
