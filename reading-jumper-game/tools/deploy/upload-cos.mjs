import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import COS from 'cos-nodejs-sdk-v5';

const releaseDir = path.resolve(process.env.RELEASE_DIR ?? '');
const sourceDir = path.resolve(process.env.COS_SOURCE ?? path.join(releaseDir, 'web'));
const bucket = process.env.COS_BUCKET?.trim();
const region = process.env.COS_REGION?.trim();
const prefix = (process.env.COS_PREFIX ?? '').trim().replace(/^\/+|\/+$/g, '');
const secretId = process.env.COS_SECRET_ID?.trim();
const secretKey = process.env.COS_SECRET_KEY?.trim();
const concurrency = Math.max(1, Math.min(16, Number(process.env.COS_CONCURRENCY ?? 6)));

if (!process.env.RELEASE_DIR || !bucket || !region || !prefix || !secretId || !secretKey) {
  throw new Error(
    'Set RELEASE_DIR, COS_BUCKET, COS_REGION, COS_PREFIX, COS_SECRET_ID and COS_SECRET_KEY',
  );
}
if ((!sourceDir.startsWith(`${releaseDir}${path.sep}`) && sourceDir !== releaseDir)
  || !await exists(path.join(sourceDir, 'index.html'))) {
  throw new Error('COS source must be inside the release and contain index.html');
}

const cos = new COS({ SecretId: secretId, SecretKey: secretKey });
const files = await filesBelow(sourceDir);
const orderedFiles = files.sort((left, right) => uploadPriority(left) - uploadPriority(right)
  || left.localeCompare(right));
let uploaded = 0;
let uploadedBytes = 0;

console.log(`Uploading ${orderedFiles.length} files to cos://${bucket}/${prefix}/`);
await runPool(orderedFiles, concurrency, async (file) => {
  const relativePath = path.relative(sourceDir, file).replace(/\\/g, '/');
  const key = `${prefix}/${relativePath}`;
  const body = await fs.readFile(file);
  const expectedEtag = crypto.createHash('md5').update(body).digest('hex');
  const metadata = objectMetadata(relativePath);
  const result = await retry(() => callCos('putObject', {
    Bucket: bucket,
    Region: region,
    Key: key,
    Body: body,
    ContentLength: body.length,
    ...metadata,
  }));
  const actualEtag = String(result.ETag ?? '').replaceAll('"', '').toLowerCase();
  if (actualEtag && actualEtag !== expectedEtag) {
    throw new Error(`ETag mismatch after uploading ${key}`);
  }
  uploaded += 1;
  uploadedBytes += body.length;
  if (uploaded % 25 === 0 || uploaded === orderedFiles.length) {
    console.log(`Uploaded ${uploaded}/${orderedFiles.length}`);
  }
});

for (const required of ['index.html', 'question-bank.json']) {
  await callCos('headObject', {
    Bucket: bucket,
    Region: region,
    Key: `${prefix}/${required}`,
  });
}
console.log(`COS upload completed: ${uploaded} files, ${uploadedBytes} bytes`);

async function exists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

async function filesBelow(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

function uploadPriority(file) {
  const name = path.basename(file).toLowerCase();
  if (name === 'index.html') return 3;
  if (name === 'question-bank.json' || name === 'runtime-config.json') return 2;
  return 1;
}

function objectMetadata(relativePath) {
  const lower = relativePath.toLowerCase();
  const encoding = lower.endsWith('.br') ? 'br' : lower.endsWith('.gz') ? 'gzip' : undefined;
  const logicalPath = encoding ? lower.replace(/\.(br|gz)$/, '') : lower;
  const contentType = mimeType(logicalPath);
  const indexEntry = logicalPath.endsWith('/index.html') || logicalPath === 'index.html';
  const questionBank = logicalPath.endsWith('/question-bank.json')
    || logicalPath === 'question-bank.json';
  const runtimeConfig = logicalPath.endsWith('/runtime-config.json')
    || logicalPath === 'runtime-config.json';
  const hashed = /\.[0-9a-f]{5,}\.[^.]+$/i.test(logicalPath);
  const versionedRuntime = /^(vendor|wasm|models)\//i.test(logicalPath);
  return {
    ContentType: contentType,
    ...(encoding ? { ContentEncoding: encoding } : {}),
    CacheControl: indexEntry
      ? 'no-cache, no-store, must-revalidate'
      : questionBank || runtimeConfig
        ? 'public, max-age=300, stale-while-revalidate=30'
      : hashed || versionedRuntime
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=86400',
  };
}

function mimeType(file) {
  const extension = path.extname(file);
  return {
    '.bin': 'application/octet-stream',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.jpeg': 'image/jpeg',
    '.jpg': 'image/jpeg',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.mp3': 'audio/mpeg',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
    '.webp': 'image/webp',
  }[extension] ?? 'application/octet-stream';
}

async function runPool(items, limit, worker) {
  let nextIndex = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index]);
    }
  }));
}

async function retry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, attempt * 500));
    }
  }
  throw lastError;
}

function callCos(method, params) {
  return new Promise((resolve, reject) => {
    cos[method](params, (error, data) => {
      if (error) reject(error);
      else resolve(data);
    });
  });
}
