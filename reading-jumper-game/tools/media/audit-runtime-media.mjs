import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const staticRoot = path.join(root, 'static');
const mediaRoot = path.join(root, 'customer-media');
const configuredBaseUrl = process.env.MEDIA_BASE_URL?.trim();
const port = Number(process.env.MEDIA_PORT ?? 43881);
const baseUrl = configuredBaseUrl || `http://127.0.0.1:${port}`;
const releaseVersion = process.env.MEDIA_RELEASE?.trim();
const output = path.resolve(
  process.env.MEDIA_OUTPUT ?? path.join(root, 'test-results', 'media-audit.json'),
);
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function filesBelow(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

function digest(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // The local server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('media audit server did not start');
}

async function assertPortAvailable() {
  if (configuredBaseUrl) return;
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', (error) => {
      reject(new Error(`media audit port ${port} is unavailable`, { cause: error }));
    });
    probe.listen(port, '127.0.0.1', () => probe.close(resolve));
  });
}

async function localInventory() {
  const manifest = JSON.parse(await fs.readFile(path.join(mediaRoot, 'manifest.json'), 'utf8'));
  const failures = [];
  const motions = [];
  for (const item of manifest.items) {
    const file = path.join(mediaRoot, item.output);
    const bytes = await fs.readFile(file);
    const actual = {
      bytes: bytes.length,
      sha256: digest(bytes),
    };
    if (actual.bytes !== item.bytes || actual.sha256 !== item.sha256) {
      failures.push(`motion manifest mismatch: ${item.output}`);
    }
    motions.push({
      path: `media/${item.output.replace(/\\/g, '/')}`,
      width: item.width,
      height: item.height,
      sourceFrames: item.sourceFrames,
      ...actual,
    });
  }
  const audioFiles = (await filesBelow(path.join(staticRoot, 'audio')))
    .filter((file) => file.toLowerCase().endsWith('.mp3'));
  const audio = await Promise.all(audioFiles.map(async (file) => {
    const bytes = await fs.readFile(file);
    return {
      path: path.relative(staticRoot, file).replace(/\\/g, '/'),
      bytes: bytes.length,
      sha256: digest(bytes),
    };
  }));
  return { audio, failures, manifest, motions };
}

async function verifyMirror(entries, mirrorRoot, label, failures) {
  for (const entry of entries) {
    const file = path.join(mirrorRoot, ...entry.path.split('/'));
    try {
      const bytes = await fs.readFile(file);
      if (bytes.length !== entry.bytes || digest(bytes) !== entry.sha256) {
        failures.push(`${label} differs: ${entry.path}`);
      }
    } catch {
      failures.push(`${label} missing: ${entry.path}`);
    }
  }
}

function publicUrl(relative) {
  return new URL(relative, baseUrl).href;
}

async function browserAudit(audio, motions) {
  const browser = await chromium.launch({ executablePath: chrome, headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
    const page = await context.newPage();
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().includes('Failed to load resource')) {
        runtimeErrors.push(`console: ${message.text()}`);
      }
    });
    page.on('requestfailed', (request) => {
      const reason = request.failure()?.errorText ?? 'failed';
      if (reason !== 'net::ERR_ABORTED') {
        runtimeErrors.push(`request: ${request.url()} ${reason}`);
      }
    });
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body[data-game-ready="true"]', { timeout: 15000 });
    const result = await page.evaluate(async ({ audioEntries, motionEntries }) => {
      const failures = [];
      const sha256 = async (bytes) => Array.from(
        new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
        (value) => value.toString(16).padStart(2, '0'),
      ).join('');
      const audioContext = new AudioContext();
      const decodedAudio = [];
      for (const entry of audioEntries) {
        try {
          const response = await fetch(entry.url, { cache: 'no-cache' });
          const contentType = response.headers.get('content-type') ?? '';
          const bytes = await response.arrayBuffer();
          if (!response.ok || !contentType.startsWith('audio/mpeg')) {
            throw new Error(`HTTP ${response.status} ${contentType}`);
          }
          const actualSha256 = await sha256(bytes);
          if (bytes.byteLength !== entry.bytes || actualSha256 !== entry.sha256) {
            throw new Error(
              `content mismatch: ${bytes.byteLength} bytes ${actualSha256},`
              + ` expected ${entry.bytes} bytes ${entry.sha256}`,
            );
          }
          const decoded = await audioContext.decodeAudioData(bytes.slice(0));
          if (decoded.duration <= 0.05 || decoded.numberOfChannels < 1) {
            throw new Error('decoded audio is empty');
          }
          decodedAudio.push({
            path: entry.path,
            bytes: bytes.byteLength,
            sha256: actualSha256,
            channels: decoded.numberOfChannels,
            duration: decoded.duration,
            sampleRate: decoded.sampleRate,
          });
        } catch (error) {
          failures.push(`audio ${entry.path}: ${error instanceof Error ? error.message : error}`);
        }
      }
      await audioContext.close();
      const decodedMotions = [];
      for (const entry of motionEntries) {
        try {
          const response = await fetch(entry.url, { cache: 'no-cache' });
          const contentType = response.headers.get('content-type') ?? '';
          const bytes = await response.arrayBuffer();
          if (!response.ok || !contentType.startsWith('image/webp')) {
            throw new Error(`HTTP ${response.status} ${contentType}`);
          }
          const actualSha256 = await sha256(bytes);
          if (bytes.byteLength !== entry.bytes || actualSha256 !== entry.sha256) {
            throw new Error(
              `content mismatch: ${bytes.byteLength} bytes ${actualSha256},`
              + ` expected ${entry.bytes} bytes ${entry.sha256}`,
            );
          }
          let image;
          try {
            image = await createImageBitmap(new Blob([bytes], { type: contentType }));
            if (image.width !== entry.width || image.height !== entry.height) {
              throw new Error(
                `decoded ${image.width}x${image.height},`
                + ` expected ${entry.width}x${entry.height}`,
              );
            }
          } finally {
            image?.close();
          }
          decodedMotions.push({
            path: entry.path,
            bytes: bytes.byteLength,
            sha256: actualSha256,
            width: entry.width,
            height: entry.height,
            sourceFrames: entry.sourceFrames,
          });
        } catch (error) {
          failures.push(`motion ${entry.path}: ${error instanceof Error ? error.message : error}`);
        }
      }
      return { decodedAudio, decodedMotions, failures };
    }, {
      audioEntries: audio.map((entry) => ({ ...entry, url: publicUrl(entry.path) })),
      motionEntries: motions.map((entry) => ({ ...entry, url: publicUrl(entry.path) })),
    });
    return { ...result, runtimeErrors };
  } finally {
    await browser.close();
  }
}

await fs.mkdir(path.dirname(output), { recursive: true });
const inventory = await localInventory();
const failures = [...inventory.failures];
await verifyMirror(inventory.audio, path.join(root, 'build', 'web-mobile'), 'build', failures);
if (releaseVersion) {
  const releaseWeb = path.join(root, 'release', releaseVersion, 'web');
  await verifyMirror(inventory.audio, releaseWeb, 'release', failures);
  await verifyMirror(inventory.motions, releaseWeb, 'release', failures);
}
await assertPortAvailable();
const server = configuredBaseUrl ? null : spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
  windowsHide: true,
});
try {
  if (server) await waitForServer();
  const browser = await browserAudit(inventory.audio, inventory.motions);
  failures.push(...browser.failures, ...browser.runtimeErrors);
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    releaseVersion: releaseVersion || null,
    audio: browser.decodedAudio,
    motions: browser.decodedMotions,
    manifest: {
      version: inventory.manifest.version,
      items: inventory.manifest.items.length,
      sourceFrames: inventory.manifest.sourceFrames,
      totalBytes: inventory.manifest.totalBytes,
    },
    failures,
  };
  await fs.writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  if (failures.length) {
    throw new Error(`runtime media audit failed:\n${failures.join('\n')}`);
  }
  console.log(
    `runtime media audit passed: ${report.audio.length} audio,`
    + ` ${report.motions.length} motion assets`,
  );
  console.log(`report: ${output}`);
} finally {
  if (server) {
    server.kill();
    await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 6000))]);
  }
}
