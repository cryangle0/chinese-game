import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const projectRoot = path.resolve(import.meta.dirname, '../..');
const sourceRoot = process.env.WRITING_TREASURE_MOTION_ROOT
  ?? path.resolve(
    projectRoot,
    '..',
    '\u5ba2\u6237\u63d0\u4f9b\u7d20\u6750',
    '\u52a8\u6548\u97f3\u4e50\u7d20\u6750',
    '\u5199\u4f5c\u5b9d\u85cf-\u52a8\u6548\u6587\u4ef6',
    '\u5199\u4f5c\u5b9d\u85cf-\u57fa\u7840\u7248-\u52a8\u6548',
  );
const outputRoot = path.join(projectRoot, 'customer-media', 'treasure');
const manifestPath = path.join(projectRoot, 'customer-media', 'manifest.json');
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';

const motions = [
  {
    output: 'action.webp',
    folder: '\u6316\u6398',
    pattern: '\u6316\u6398_%05d.png',
    startNumber: 42,
    frames: 57,
    fps: 15,
  },
  {
    output: 'run-left.webp',
    folder: '\u8dd1-\u5de6',
    pattern: '\u8dd1-\u5de6_%05d.png',
    startNumber: 27,
    frames: 15,
    fps: 15,
  },
  {
    output: 'run-right.webp',
    folder: '\u8dd1-\u53f3',
    pattern: '\u8dd1-\u53f3_%05d.png',
    startNumber: 99,
    frames: 16,
    fps: 25,
  },
];

if (!fs.existsSync(sourceRoot)) {
  throw new Error(`Missing treasure motion source: ${sourceRoot}`);
}
fs.mkdirSync(outputRoot, { recursive: true });

for (const motion of motions) {
  const input = path.join(sourceRoot, motion.folder, motion.pattern);
  const output = path.join(outputRoot, motion.output);
  const temporary = `${output}.tmp.webp`;
  fs.rmSync(temporary, { force: true });
  const result = spawnSync(ffmpeg, [
    '-hide_banner',
    '-loglevel', 'error',
    '-y',
    '-framerate', String(motion.fps),
    '-start_number', String(motion.startNumber),
    '-i', input,
    '-frames:v', String(motion.frames),
    '-c:v', 'libwebp_anim',
    '-lossless', '0',
    '-q:v', '94',
    '-compression_level', '4',
    '-loop', '0',
    '-pix_fmt', 'yuva420p',
    temporary,
  ], { stdio: 'inherit', windowsHide: true });
  if (result.status !== 0 || !fs.existsSync(temporary)) {
    fs.rmSync(temporary, { force: true });
    throw new Error(`Failed to rebuild ${motion.output}`);
  }
  fs.rmSync(output, { force: true });
  fs.renameSync(temporary, output);
}

const manifestText = fs.readFileSync(manifestPath, 'utf8');
const newline = manifestText.includes('\r\n') ? '\r\n' : '\n';
const manifest = JSON.parse(manifestText);
for (const motion of motions) {
  const output = `treasure/${motion.output}`;
  const item = manifest.items.find((candidate) => candidate.output === output);
  if (!item) throw new Error(`Missing media manifest item: ${output}`);
  const data = fs.readFileSync(path.join(outputRoot, motion.output));
  Object.assign(item, {
    sourceFrames: motion.frames,
    width: 600,
    height: 670,
    fps: motion.fps,
    bytes: data.length,
    sha256: crypto.createHash('sha256').update(data).digest('hex'),
  });
}
manifest.sourceFrames = manifest.items.reduce(
  (sum, item) => sum + Number(item.sourceFrames ?? 0),
  0,
);
manifest.totalBytes = manifest.items.reduce(
  (sum, item) => sum + Number(item.bytes ?? 0),
  0,
);
fs.writeFileSync(
  manifestPath,
  `${JSON.stringify(manifest, null, 2).replace(/\n/g, newline)}${newline}`,
);

for (const motion of motions) {
  const file = path.join(outputRoot, motion.output);
  console.log(`${motion.output}: ${fs.statSync(file).size} bytes, 600x670 @ ${motion.fps}fps`);
}
