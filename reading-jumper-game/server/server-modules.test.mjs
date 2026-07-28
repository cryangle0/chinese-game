import assert from 'node:assert/strict';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { appendEvents, flushWrites } from './analytics-store.mjs';
import { inspectQuestionBank } from './bank-health.mjs';
import { clientAddress, securityHeaders } from './http-security.mjs';
import { parseRangeHeader } from './static-assets.mjs';

test('health rejects empty and uncovered banks', () => {
  const empty = inspectQuestionBank(
    { version: 'v1', questions: [] },
    'reading-jumper',
    ['deep-sea'],
  );
  assert.equal(empty.ok, false);
  assert.deepEqual(empty.missingScenes, ['deep-sea']);
});

test('health accepts enabled scene coverage', () => {
  const health = inspectQuestionBank({
    version: 'v1',
    questions: [{
      enabled: true,
      games: ['reading-jumper'],
      scenes: ['deep-sea'],
    }],
  }, 'reading-jumper', ['deep-sea']);
  assert.equal(health.ok, true);
  assert.equal(health.enabled, 1);
});

test('cors preflight exposes required methods and headers', () => {
  process.env.CORS_ORIGINS = 'https://activity.example.com';
  const headers = securityHeaders({
    headers: { origin: 'https://activity.example.com' },
  });
  assert.equal(headers['access-control-allow-methods'], 'GET,POST,OPTIONS');
  assert.equal(headers['access-control-allow-headers'], 'content-type');
  assert.match(headers['content-security-policy'], /https:\/\/res\.wx\.qq\.com/);
  assert.equal(headers['permissions-policy'], 'camera=(self), microphone=(), geolocation=()');
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
  const directory = await fsp.mkdtemp(path.join(os.tmpdir(), 'reading-analytics-'));
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
