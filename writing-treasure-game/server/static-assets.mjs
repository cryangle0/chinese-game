import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

const mime = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.wasm': 'application/wasm',
};

export function parseRangeHeader(value, size) {
  if (!value || !value.startsWith('bytes=') || value.includes(',')) return null;
  const [startText, endText] = value.slice(6).split('-');
  let start = startText ? Number(startText) : NaN;
  let end = endText ? Number(endText) : NaN;
  if (!startText && Number.isFinite(end)) {
    start = Math.max(0, size - end);
    end = size - 1;
  } else {
    if (!Number.isFinite(start)) return { invalid: true };
    if (!Number.isFinite(end)) end = size - 1;
  }
  if (start < 0 || end < start || start >= size) return { invalid: true };
  return { start, end: Math.min(end, size - 1) };
}

async function encodedFile(file, accepted) {
  const choices = [
    { token: 'br', suffix: '.br' },
    { token: 'gzip', suffix: '.gz' },
  ];
  for (const choice of choices) {
    const candidate = `${file}${choice.suffix}`;
    if (accepted.includes(choice.token)) {
      try {
        const stat = await fsp.stat(candidate);
        if (stat.isFile()) return { file: candidate, encoding: choice.token, stat };
      } catch {
        // Try the next encoding or the original file.
      }
    }
  }
  return { file, encoding: '', stat: await fsp.stat(file) };
}

export async function serveStatic(request, response, file, headers, cacheControl) {
  const original = await fsp.stat(file);
  if (!original.isFile()) throw new Error('not a file');
  const etag = `W/"${original.size.toString(16)}-${Math.floor(original.mtimeMs).toString(16)}"`;
  const common = {
    ...headers,
    'cache-control': cacheControl,
    'content-type': mime[path.extname(file)] ?? 'application/octet-stream',
    etag,
    'accept-ranges': 'bytes',
    vary: 'Accept-Encoding',
  };
  const range = parseRangeHeader(request.headers.range, original.size);
  if (range?.invalid) {
    response.writeHead(416, {
      ...common,
      'content-range': `bytes */${original.size}`,
    });
    response.end();
    return;
  }
  if (!range && request.headers['if-none-match'] === etag) {
    response.writeHead(304, common);
    response.end();
    return;
  }
  if (range) {
    response.writeHead(206, {
      ...common,
      'content-range': `bytes ${range.start}-${range.end}/${original.size}`,
      'content-length': range.end - range.start + 1,
    });
    if (request.method === 'HEAD') response.end();
    else fs.createReadStream(file, { start: range.start, end: range.end }).pipe(response);
    return;
  }
  const selected = await encodedFile(file, request.headers['accept-encoding'] ?? '');
  response.writeHead(200, {
    ...common,
    ...(selected.encoding ? { 'content-encoding': selected.encoding } : {}),
    'content-length': selected.stat.size,
  });
  if (request.method === 'HEAD') response.end();
  else fs.createReadStream(selected.file).pipe(response);
}
