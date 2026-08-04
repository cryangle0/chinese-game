import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const sourceRoot = path.join(
  path.dirname(root),
  '\u5ba2\u6237\u63d0\u4f9b\u7d20\u6750',
  '\u52a8\u6548\u97f3\u4e50\u7d20\u6750',
  '\u9605\u8bfb\u8df3\u8df3\u4e50-\u52a8\u6548\u6587\u4ef6',
);
const mediaRoot = path.join(root, 'customer-media');
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const fps = Number(process.env.LOCOMOTION_FPS ?? 15);
const concurrency = Math.max(
  1,
  Math.min(3, Number(process.env.MEDIA_CONCURRENCY ?? 2)),
);

const sceneMarkers = new Map([
  ['mario', '\u9a6c\u91cc\u5965'],
  ['deep-sea', '\u6df1\u6d77\u9f99\u5bab'],
  ['space', '\u661f\u9645\u7a7f\u8d8a'],
  ['food', '\u7f8e\u98df\u5927\u5192\u9669'],
  ['poetry', '\u8bd7\u8bcd\u5c71\u6c34'],
]);

const actionMarkers = new Map([
  ['idle', ['\u5f85\u673a', '\u6b63\u9762\u8dd1']],
  ['run-left', ['\u8dd1-\u5de6', '\u5de6\u4fa7\u8dd1']],
  ['run-right', ['\u8dd1-\u53f3', '\u53f3\u4fa7\u8dd1']],
]);

const sceneDirectories = (await fs.readdir(sourceRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory());
const jobs = [];

for (const [scene, sceneMarker] of sceneMarkers) {
  const sceneEntry = sceneDirectories.find((entry) => entry.name.includes(sceneMarker));
  if (!sceneEntry) throw new Error(`Missing reading scene source: ${scene}`);
  const sceneDirectory = path.join(sourceRoot, sceneEntry.name);
  const actionDirectories = (await fs.readdir(sceneDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory());
  for (const [action, markers] of actionMarkers) {
    const actionEntry = actionDirectories.find((entry) =>
      markers.some((marker) => entry.name === marker));
    if (!actionEntry) throw new Error(`Missing reading locomotion source: ${scene}/${action}`);
    const source = path.join(sceneDirectory, actionEntry.name);
    const sequence = await sequenceInfo(source);
    jobs.push({
      scene,
      action,
      source,
      output: path.join(mediaRoot, scene, `${action}.webp`),
      ...sequence,
    });
  }
}

const completed = [];
let cursor = 0;
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor];
    cursor += 1;
    await encode(job);
    const bytes = await fs.readFile(job.output);
    completed.push({
      game: 'reading',
      scene: job.scene,
      action: job.action,
      source: path.relative(path.dirname(root), job.source).replaceAll('\\', '/'),
      sourceFrames: job.frames,
      output: path.relative(mediaRoot, job.output).replaceAll('\\', '/'),
      width: job.width,
      height: job.height,
      fps,
      bytes: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      lossless: true,
    });
    console.log(
      `Locomotion ${completed.length}/${jobs.length}: ${job.scene}/${job.action} `
      + `${job.width}x${job.height}, ${job.frames} frames`,
    );
  }
}));

const manifestPath = path.join(mediaRoot, 'manifest.json');
const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
for (const item of completed) {
  const existing = manifest.items.find((entry) =>
    entry.scene === item.scene && entry.action === item.action);
  if (existing) Object.assign(existing, item);
  else manifest.items.push(item);
}
manifest.version = 'customer-motion-20260801-lossless-locomotion';
manifest.generatedAt = new Date().toISOString();
manifest.totalBytes = manifest.items.reduce((sum, item) => sum + item.bytes, 0);
manifest.sourceFrames = manifest.items.reduce(
  (sum, item) => sum + item.sourceFrames,
  0,
);
await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(
  `Rebuilt ${completed.length} reading locomotion animations from original PNG frames `
  + `at source resolution, ${fps} fps, lossless WebP.`,
);

async function sequenceInfo(directory) {
  const files = (await fs.readdir(directory))
    .filter((file) => file.toLowerCase().endsWith('.png'))
    .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));
  if (!files.length) throw new Error(`Animation directory is empty: ${directory}`);
  const parsed = files.map((file) => {
    const match = file.match(/^(.*?)(\d+)\.png$/i);
    if (!match) throw new Error(`Animation frame does not end in a number: ${file}`);
    return {
      prefix: match[1],
      number: Number(match[2]),
      digits: match[2].length,
    };
  });
  const first = parsed[0];
  if (parsed.some((item, index) =>
    item.prefix !== first.prefix || item.number !== first.number + index)) {
    throw new Error(`Animation sequence contains a gap or mixed prefix: ${directory}`);
  }
  const fixedDigits = parsed.every((item) => item.digits === first.digits);
  const placeholder = fixedDigits ? `%0${first.digits}d` : '%d';
  const firstFrame = await fs.readFile(path.join(directory, files[0]));
  return {
    frames: parsed.length,
    startNumber: first.number,
    inputPattern: path.join(directory, `${first.prefix}${placeholder}.png`),
    width: firstFrame.readUInt32BE(16),
    height: firstFrame.readUInt32BE(20),
  };
}

function encode(job) {
  const argumentsList = [
    '-y',
    '-hide_banner',
    '-loglevel',
    'error',
    '-framerate',
    String(fps),
    '-start_number',
    String(job.startNumber),
    '-i',
    job.inputPattern,
    '-frames:v',
    String(job.frames),
    '-vf',
    'format=bgra',
    '-an',
    '-c:v',
    'libwebp_anim',
    '-lossless',
    '1',
    '-compression_level',
    '4',
    '-loop',
    '0',
    job.output,
  ];
  return fs.mkdir(path.dirname(job.output), { recursive: true }).then(() =>
    new Promise((resolve, reject) => {
      const child = spawn(ffmpeg, argumentsList, {
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'pipe'],
      });
      let errorText = '';
      child.stderr.on('data', (chunk) => { errorText += chunk; });
      child.once('error', reject);
      child.once('exit', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`ffmpeg failed for ${job.source}: ${errorText.trim()}`));
      });
    }));
}
