import fsp from 'node:fs/promises';
import path from 'node:path';

const GAME_ID = 'reading-jumper';
let writeChain = Promise.resolve();
const DEFAULT_MAX_BYTES = 20 * 1024 * 1024;
const DEFAULT_MAX_FILES = 7;

function isEvent(value) {
  if (!value || typeof value !== 'object') return false;
  if (typeof value.id !== 'string' || value.id.length > 100) return false;
  if (typeof value.name !== 'string' || value.name.length > 64) return false;
  if (!Number.isFinite(value.timestamp) || typeof value.sessionId !== 'string') return false;
  if (value.game != null && value.game !== GAME_ID) return false;
  return value.properties == null
    || (typeof value.properties === 'object' && JSON.stringify(value.properties).length <= 4096);
}

export function validateEvents(payload) {
  if (!payload || !Array.isArray(payload.events)) throw new Error('events must be an array');
  if (!payload.events.length || payload.events.length > 50) {
    throw new Error('events batch must contain 1 to 50 items');
  }
  if (!payload.events.every(isEvent)) throw new Error('invalid analytics event');
  return payload.events;
}

function numberSetting(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function rotate(file, incomingBytes, maxBytes, maxFiles) {
  let stat = null;
  try {
    stat = await fsp.stat(file);
  } catch {
    return;
  }
  if (!stat.isFile() || stat.size === 0 || stat.size + incomingBytes <= maxBytes) return;
  const extension = path.extname(file);
  const basename = path.basename(file, extension);
  const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '');
  await fsp.rename(file, path.join(path.dirname(file), `${basename}.${stamp}${extension}`));
  const entries = await fsp.readdir(path.dirname(file), { withFileTypes: true });
  const rotated = await Promise.all(entries
    .filter((entry) => entry.isFile()
      && entry.name.startsWith(`${basename}.`) && entry.name.endsWith(extension))
    .map(async (entry) => ({
      file: path.join(path.dirname(file), entry.name),
      mtime: (await fsp.stat(path.join(path.dirname(file), entry.name))).mtimeMs,
    })));
  rotated.sort((left, right) => right.mtime - left.mtime);
  await Promise.all(rotated.slice(maxFiles).map((entry) => fsp.rm(entry.file, { force: true })));
}

export function appendEvents(file, events, options = {}) {
  const lines = `${events.map((event) => JSON.stringify(event)).join('\n')}\n`;
  const bytes = Buffer.byteLength(lines);
  const maxBytes = numberSetting(
    options.maxBytes ?? process.env.ANALYTICS_MAX_BYTES,
    DEFAULT_MAX_BYTES,
  );
  const maxFiles = numberSetting(
    options.maxFiles ?? process.env.ANALYTICS_MAX_FILES,
    DEFAULT_MAX_FILES,
  );
  writeChain = writeChain.then(async () => {
    await fsp.mkdir(path.dirname(file), { recursive: true });
    if (bytes > maxBytes) throw new Error('analytics batch exceeds file limit');
    await rotate(file, bytes, maxBytes, maxFiles);
    await fsp.appendFile(file, lines, 'utf8');
  });
  return writeChain;
}

export function flushWrites() {
  return writeChain;
}
