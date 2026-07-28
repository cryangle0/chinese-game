import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const releaseDir = path.resolve(process.env.RELEASE_DIR ?? '');
const destination = process.env.OSS_DESTINATION ?? '';
const executable = process.env.OSSUTIL_PATH ?? 'ossutil';
const source = path.resolve(process.env.OSS_SOURCE ?? path.join(releaseDir, 'web'));
if (!process.env.RELEASE_DIR || !fs.existsSync(releaseDir) || !destination) {
  throw new Error('Set RELEASE_DIR and OSS_DESTINATION before uploading');
}
if ((!source.startsWith(`${releaseDir}${path.sep}`) && source !== releaseDir)
  || !fs.existsSync(path.join(source, 'index.html'))) {
  throw new Error('OSS source must be a web release directory containing index.html');
}
const result = spawnSync(executable, ['cp', '-r', '-f', `${source}${path.sep}`, destination], {
  stdio: 'inherit',
  windowsHide: true,
});
if (result.status !== 0) process.exit(result.status ?? 1);
