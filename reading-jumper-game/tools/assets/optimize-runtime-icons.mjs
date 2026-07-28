import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '../..');
const jobs = [
  ['space', 136, 128],
  ['deep-sea', 128, 136],
  ['food', 136, 89],
  ['mario', 130, 136],
];

for (const [scene, width, height] of jobs) {
  const target = path.join(root, 'assets', 'theme-bundles', scene, 'score-icon.png');
  const temporary = `${target}.optimized.png`;
  await run('ffmpeg', [
    '-y',
    '-hide_banner',
    '-loglevel', 'error',
    '-i', target,
    '-vf', `scale=${width}:${height}:flags=lanczos`,
    '-frames:v', '1',
    temporary,
  ]);
  await fs.rename(temporary, target);
  console.log(`Optimized HUD icon: ${scene} ${width}x${height}`);
}

async function run(command, argumentsList) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, argumentsList, {
      windowsHide: true,
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let errorText = '';
    child.stderr.on('data', (chunk) => { errorText += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed: ${errorText.trim()}`));
    });
  });
}
