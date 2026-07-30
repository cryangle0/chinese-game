import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../../..');
const sourceRoot = path.join(root, '客户提供素材', '动效音乐素材');
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg';
const maxSide = Number(process.env.FEEDBACK_MAX_SIDE ?? 720);
const quality = Number(process.env.FEEDBACK_QUALITY ?? 84);
const concurrency = Math.max(
  1,
  Math.min(3, Number(process.env.MEDIA_CONCURRENCY ?? 2)),
);

const games = {
  reading: {
    mediaRoot: path.join(root, 'reading-jumper-game', 'customer-media'),
    sourceRoot: path.join(sourceRoot, '阅读跳跳乐-动效文件'),
    scenes: new Map([
      ['mario', '阅读跳跳乐-马里奥-动效'],
      ['deep-sea', '阅读跳跳乐-深海龙宫-动效'],
      ['space', '阅读跳跳乐-星际穿越-动效'],
      ['food', '阅读跳跳乐-美食大冒险-动效'],
      ['poetry', '阅读跳跳乐-诗词山水-动效'],
    ]),
  },
  writing: {
    mediaRoot: path.join(root, 'writing-treasure-game', 'customer-media'),
    sourceRoot: path.join(sourceRoot, '写作宝藏-动效文件'),
    scenes: new Map([
      ['treasure', '写作宝藏-基础版-动效'],
      ['desert', '写作宝藏-沙漠探险-动效'],
      ['dinosaur', '写作宝藏-恐龙世界-动效'],
      ['dunhuang', '写作宝藏-敦煌壁画-动效'],
      ['magic', '写作宝藏-魔法学院-动效'],
    ]),
  },
};

const actionDirectories = new Map([
  ['correct', '正反馈'],
  ['wrong', '负反馈'],
]);

const jobs = [];
for (const [game, config] of Object.entries(games)) {
  for (const [scene, sourceScene] of config.scenes) {
    for (const [action, sourceAction] of actionDirectories) {
      // Dinosaur wrong is a responsive full-stage composite. It is built by
      // build-dinosaur-chase.mjs and must not be replaced by the square source.
      if (game === 'writing' && scene === 'dinosaur' && action === 'wrong') continue;
      jobs.push({
        game,
        scene,
        action,
        fps: game === 'reading' && scene === 'space' && action === 'wrong' ? 30 : 24,
        source: path.join(config.sourceRoot, sourceScene, sourceAction),
        output: path.join(config.mediaRoot, scene, `${action}.webp`),
      });
    }
  }
}

let cursor = 0;
const completed = [];
await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, async () => {
  while (cursor < jobs.length) {
    const job = jobs[cursor];
    cursor += 1;
    const sequence = await sequenceInfo(job.source);
    const dimensions = outputDimensions(sequence.width, sequence.height);
    await encode({ ...job, ...sequence, ...dimensions });
    const bytes = (await fs.stat(job.output)).size;
    completed.push({
      ...job,
      source: path.relative(root, job.source).replaceAll('\\', '/'),
      output: path.relative(games[job.game].mediaRoot, job.output).replaceAll('\\', '/'),
      width: dimensions.width,
      height: dimensions.height,
      fps: job.fps,
      sourceFrames: sequence.frames,
      bytes,
      sha256: crypto.createHash('sha256')
        .update(await fs.readFile(job.output))
        .digest('hex'),
      loop: 1,
    });
    console.log(
      `Feedback ${completed.length}/${jobs.length}: `
      + `${job.game}/${job.scene}/${job.action} `
      + `${sequence.width}x${sequence.height} -> `
      + `${dimensions.width}x${dimensions.height} (${bytes} bytes)`,
    );
  }
}));

for (const [game, config] of Object.entries(games)) {
  const manifestPath = path.join(config.mediaRoot, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  for (const item of completed.filter((entry) => entry.game === game)) {
    const existing = manifest.items.find((entry) =>
      entry.scene === item.scene && entry.action === item.action);
    const next = {
      game,
      scene: item.scene,
      action: item.action,
      source: item.source,
      sourceFrames: item.sourceFrames,
      output: item.output,
      width: item.width,
      height: item.height,
      fps: item.fps,
      bytes: item.bytes,
      sha256: item.sha256,
      loop: item.loop,
    };
    if (existing) Object.assign(existing, next);
    else manifest.items.push(next);
  }
  manifest.version = 'customer-motion-20260729-aspect-preserving';
  manifest.generatedAt = new Date().toISOString();
  manifest.totalBytes = manifest.items.reduce((sum, item) => sum + item.bytes, 0);
  manifest.sourceFrames = manifest.items.reduce(
    (sum, item) => sum + item.sourceFrames,
    0,
  );
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

console.log(
  `Rebuilt ${completed.length} feedback animations at source aspect ratio `
  + `(${maxSide}px max side, scene-specific fps, q=${quality}).`,
);

function outputDimensions(width, height) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  const even = (value) => Math.max(2, Math.round(value * scale / 2) * 2);
  return { width: even(width), height: even(height) };
}

async function sequenceInfo(directory) {
  const files = (await fs.readdir(directory))
    .filter((file) => file.toLowerCase().endsWith('.png'))
    .sort((left, right) => left.localeCompare(right, 'zh-CN', { numeric: true }));
  if (!files.length) throw new Error(`Animation directory is empty: ${directory}`);
  const parsed = files.map((file) => {
    const match = file.match(/^(.*?)(\d+)\.png$/i);
    if (!match) throw new Error(`Animation frame does not end in a number: ${file}`);
    return {
      file,
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
  const firstFrame = await fs.readFile(path.join(directory, first.file));
  return {
    frames: parsed.length,
    startNumber: first.number,
    inputPattern: path.join(
      directory,
      `${first.prefix}%0${first.digits}d.png`,
    ),
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
    String(job.fps),
    '-start_number',
    String(job.startNumber),
    '-i',
    job.inputPattern,
    '-frames:v',
    String(job.frames),
    '-vf',
    `scale=${job.width}:${job.height}:flags=lanczos,format=bgra`,
    '-an',
    '-c:v',
    'libwebp_anim',
    '-lossless',
    '0',
    '-q:v',
    String(quality),
    '-compression_level',
    '4',
    '-loop',
    '1',
    job.output,
  ];
  return new Promise((resolve, reject) => {
    fs.mkdir(path.dirname(job.output), { recursive: true })
      .then(() => {
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
      })
      .catch(reject);
  });
}
