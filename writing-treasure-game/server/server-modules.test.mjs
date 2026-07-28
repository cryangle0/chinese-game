import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { appendEvents, flushWrites } from './analytics-store.mjs';
import {
  buildHotwordList,
  normalizeAudioContentType,
  parseAsrHints,
  resolveEngineType,
  resolveLetterEngineType,
  shouldRetryLetterRecognition,
} from './asr.mjs';
import { inspectQuestionBank } from './bank-health.mjs';
import { clientAddress, securityHeaders } from './http-security.mjs';
import { parseRangeHeader } from './static-assets.mjs';

test('health rejects empty and uncovered banks', () => {
  const empty = inspectQuestionBank(
    { version: 'v1', questions: [] },
    'writing-treasure',
    ['magic'],
  );
  assert.equal(empty.ok, false);
  assert.deepEqual(empty.missingScenes, ['magic']);
});

test('health accepts enabled scene coverage', () => {
  const health = inspectQuestionBank({
    version: 'v1',
    questions: [{
      enabled: true,
      games: ['writing-treasure'],
      scenes: ['magic'],
    }],
  }, 'writing-treasure', ['magic']);
  assert.equal(health.ok, true);
  assert.equal(health.enabled, 1);
});

test('cors preflight exposes required methods and headers', () => {
  process.env.CORS_ORIGINS = 'https://activity.example.com';
  const headers = securityHeaders({
    headers: { origin: 'https://activity.example.com' },
  });
  assert.equal(headers['access-control-allow-methods'], 'GET,POST,OPTIONS');
  assert.equal(headers['access-control-allow-headers'], 'content-type,x-asr-hints');
  assert.match(headers['content-security-policy'], /https:\/\/res\.wx\.qq\.com/);
  assert.equal(headers['permissions-policy'], 'camera=(), microphone=(self), geolocation=()');
});

test('asr accepts browser audio formats and safely parses option hints', () => {
  assert.equal(normalizeAudioContentType('audio/webm;codecs=opus'), 'audio/webm');
  assert.equal(normalizeAudioContentType('audio/mp4'), 'audio/mp4');
  assert.equal(normalizeAudioContentType('application/octet-stream'), null);
  const hints = parseAsrHints(encodeURIComponent(JSON.stringify([
    '连接补语',
    '表示拥有',
    '表示过去',
  ])));
  assert.deepEqual(hints, ['连接补语', '表示拥有', '表示过去']);
  assert.equal(buildHotwordList(hints), '连接补语|8,表示拥有|8,表示过去|8');
});

test('asr keeps Chinese primary and uses English fallback for bare ABC', () => {
  assert.equal(resolveEngineType(undefined), '16k_zh');
  assert.equal(resolveEngineType('16k_zh-PY'), '16k_zh-PY');
  assert.equal(resolveEngineType('invalid-engine'), '16k_zh');
  assert.equal(resolveEngineType('16k_zh_en'), '16k_zh');
  assert.equal(resolveLetterEngineType(undefined), '16k_en');
  const hints = ['画眉鸟', '百灵鸟', '公鸡', 'A', 'B', 'C'];
  assert.equal(shouldRetryLetterRecognition('', hints), true);
  assert.equal(shouldRetryLetterRecognition('比', hints), true);
  assert.equal(shouldRetryLetterRecognition('C', hints), false);
  assert.equal(shouldRetryLetterRecognition('画眉鸟', hints), false);
});

test('asr hotwords reject malformed, oversized, and delimiter-injected hints', () => {
  assert.deepEqual(parseAsrHints('%not-json'), []);
  assert.equal(buildHotwordList([
    'a',
    '这是一个超过十个汉字限制的无效选项',
    '安全|词,另一个',
    '安全词',
    '安全词',
  ]), 'a|8,安全词另一个|8,安全词|8');
});

test('asr hints accept letter + option packs up to 16', () => {
  const packed = [
    '画眉鸟', '选项A', '选A', 'A画眉鸟',
    '百灵鸟', '选项B', '选B', 'B百灵鸟',
    '公鸡', '选项C', '选C', 'C公鸡',
  ];
  const hints = parseAsrHints(encodeURIComponent(JSON.stringify(packed)));
  assert.equal(hints.length, 12);
  assert.match(buildHotwordList(hints), /选项A\|8/);
  assert.match(buildHotwordList(hints), /画眉鸟\|8/);
});

test('trusted proxy rate limiting uses the original client address', () => {
  const previous = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = '1';
  try {
    assert.equal(clientAddress({
      headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.2' },
      socket: { remoteAddress: '10.0.0.1' },
    }), '203.0.113.8');
  } finally {
    if (previous === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previous;
  }
});

test('static range parsing supports bounded and suffix ranges', () => {
  assert.deepEqual(parseRangeHeader('bytes=10-19', 100), { start: 10, end: 19 });
  assert.deepEqual(parseRangeHeader('bytes=-10', 100), { start: 90, end: 99 });
  assert.deepEqual(parseRangeHeader('bytes=100-120', 100), { invalid: true });
});

test('analytics storage rotates before exceeding the configured limit', async () => {
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'writing-analytics-'));
  const file = path.join(directory, 'events.jsonl');
  try {
    await appendEvents(file, [{ id: '1' }], { maxBytes: 20, maxFiles: 2 });
    await appendEvents(file, [{ id: '2' }], { maxBytes: 20, maxFiles: 2 });
    await flushWrites();
    const files = await fsp.readdir(directory);
    assert.equal(files.filter((name) =>
      name.startsWith('events.') && name !== 'events.jsonl').length, 1);
    assert.equal((await fsp.readFile(file, 'utf8')).includes('"2"'), true);
  } finally {
    await fsp.rm(directory, { recursive: true, force: true });
  }
});
