import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { appendEvents, flushWrites, validateEvents } from './analytics-store.mjs';
import { inspectQuestionBank } from './bank-health.mjs';
import { allowRequest, cleanupRateLimits, securityHeaders } from './http-security.mjs';
import { serveStatic } from './static-assets.mjs';
import {
  asrConfigured,
  normalizeAudioContentType,
  parseAsrHints,
  recognizeAudio,
} from './asr.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.resolve(process.env.PUBLIC_ROOT ?? path.join(root, 'build/web-mobile'));
const mediaRoot = path.resolve(process.env.MEDIA_ROOT ?? path.join(root, 'customer-media'));
const bankFile = path.resolve(process.env.BANK_FILE ?? path.join(root, 'config/question-bank.json'));
const analyticsFile = path.resolve(
  process.env.ANALYTICS_FILE ?? path.join(root, 'data/analytics/events.jsonl'),
);
const port = Number(process.env.PORT ?? 8082);
const gameId = 'writing-treasure';
const sceneIds = ['treasure', 'desert', 'dinosaur', 'dunhuang', 'magic'];
function send(request, response, status, body, type = 'application/json; charset=utf-8') {
  response.writeHead(status, {
    ...securityHeaders(request),
    'content-type': type,
    'cache-control': status === 200 ? 'no-cache' : 'no-store',
  });
  response.end(body);
}

async function readBody(request, limit = 256 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw new Error('payload too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function handler(request, response) {
  const url = new URL(request.url ?? '/', 'http://localhost');
  if (request.method === 'POST' && url.pathname === '/api/track' && !allowRequest(request)) {
    return send(request, response, 429, JSON.stringify({ error: 'rate limit exceeded' }));
  }
  if (request.method === 'POST' && url.pathname === '/api/asr' && !allowRequest(request, 30)) {
    return send(request, response, 429, JSON.stringify({ error: 'rate limit exceeded' }));
  }
  if (request.method === 'OPTIONS') return send(request, response, 204, '');
  if (request.method === 'GET' && url.pathname === '/health') {
    let bank = null;
    try {
      bank = JSON.parse(await fsp.readFile(bankFile, 'utf8'));
    } catch {
      // Health still responds while reporting that the bank is unavailable.
    }
    const health = inspectQuestionBank(bank, gameId, sceneIds);
    return send(request, response, health.ok ? 200 : 503, JSON.stringify({
      ok: health.ok,
      bankVersion: health.version,
      enabledQuestions: health.enabled,
      missingScenes: health.missingScenes,
      time: new Date().toISOString(),
    }));
  }
  if (request.method === 'GET' && url.pathname === '/api/bank') {
    try {
      return send(request, response, 200, await fsp.readFile(bankFile, 'utf8'));
    } catch {
      return send(request, response, 404, JSON.stringify({ error: 'bank unavailable' }));
    }
  }
  if (request.method === 'GET' && url.pathname === '/api/asr/status') {
    return send(request, response, 200, JSON.stringify({ enabled: asrConfigured() }));
  }
  if (request.method === 'POST' && url.pathname === '/api/asr') {
    if (!asrConfigured()) {
      return send(request, response, 503, JSON.stringify({ error: 'speech recognition unavailable' }));
    }
    const type = normalizeAudioContentType(request.headers['content-type']);
    if (!type) {
      return send(request, response, 415, JSON.stringify({ error: 'unsupported audio format' }));
    }
    try {
      const audio = await readBodyBuffer(request, 4 * 1024 * 1024);
      if (audio.length < 128) {
        return send(request, response, 400, JSON.stringify({ error: 'audio payload is empty' }));
      }
      const hints = parseAsrHints(request.headers['x-asr-hints']);
      const result = await recognizeAudio(audio, { hints });
      return send(request, response, 200, JSON.stringify(result));
    } catch (error) {
      const status = error.statusCode === 413 ? 413 : 502;
      if (status === 502) console.error('[asr] recognition failed', error);
      return send(request, response, status, JSON.stringify({
        error: status === 413 ? 'audio payload is too large' : 'speech recognition failed',
      }));
    }
  }
  if (request.method === 'POST' && url.pathname === '/api/track') {
    try {
      const events = validateEvents(JSON.parse(await readBody(request)));
      await appendEvents(analyticsFile, events);
      return send(request, response, 202, JSON.stringify({ accepted: events.length }));
    } catch (error) {
      return send(request, response, 400, JSON.stringify({ error: error.message }));
    }
  }
  if ((request.method === 'GET' || request.method === 'HEAD')
    && url.pathname.startsWith('/media/')) {
    const relativeMedia = decodeURIComponent(url.pathname.slice('/media/'.length));
    const mediaFile = path.resolve(mediaRoot, relativeMedia);
    if (!mediaFile.startsWith(`${mediaRoot}${path.sep}`)) {
      return send(request, response, 403, 'Forbidden', 'text/plain');
    }
    try {
      await serveStatic(
        request,
        response,
        mediaFile,
        securityHeaders(request),
        'public, max-age=31536000, immutable',
      );
    } catch {
      send(request, response, 404, 'Not found', 'text/plain; charset=utf-8');
    }
    return;
  }
  const relative = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
  const file = path.resolve(publicRoot, `.${relative}`);
  if (!file.startsWith(`${publicRoot}${path.sep}`) && file !== publicRoot) {
    return send(request, response, 403, 'Forbidden', 'text/plain');
  }
  try {
    const cache = path.basename(file) === 'index.html'
      ? 'no-cache'
      : 'public, max-age=31536000, immutable';
    await serveStatic(request, response, file, securityHeaders(request), cache);
  } catch {
    send(request, response, 404, 'Not found', 'text/plain; charset=utf-8');
  }
}

const server = http.createServer((request, response) => {
  void handler(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) {
      send(request, response, 500, JSON.stringify({ error: 'internal error' }));
    }
  });
});
const cleanupTimer = setInterval(cleanupRateLimits, 60000);
cleanupTimer.unref();
server.listen(port, '0.0.0.0', () => {
  console.log(`Writing Treasure server: http://localhost:${port}`);
});
async function shutdown() {
  const forced = setTimeout(() => process.exit(1), 5000);
  forced.unref();
  server.closeIdleConnections?.();
  await Promise.all([
    new Promise((resolve) => server.close(resolve)),
    flushWrites(),
  ]);
  clearTimeout(forced);
  process.exit(0);
}

async function readBodyBuffer(request, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) {
      const error = new Error('payload too large');
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
process.once('SIGINT', () => { void shutdown(); });
process.once('SIGTERM', () => { void shutdown(); });
