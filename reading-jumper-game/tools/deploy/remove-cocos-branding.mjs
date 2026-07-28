import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

import { precompressWeb } from '../build/precompress-web.mjs';
import { removeCocosBranding } from '../build/patch-web-index.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const releaseRoot = path.join(root, 'release');

async function filesBelow(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

const releases = (await fs.readdir(releaseRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory());

for (const release of releases) {
  const directory = path.join(releaseRoot, release.name);
  const webRoot = path.join(directory, 'web');
  const manifestPath = path.join(directory, 'manifest.json');
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));

  removeCocosBranding(webRoot);
  precompressWeb(webRoot);

  const files = (await filesBelow(directory))
    .filter((file) => file !== manifestPath)
    .sort((left, right) => left.localeCompare(right))
    .map(async (file) => ({
      path: path.relative(directory, file).replace(/\\/g, '/'),
      bytes: (await fs.stat(file)).size,
      sha256: crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'),
    }));
  manifest.files = await Promise.all(files);
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Removed Cocos startup branding: ${release.name}`);
}
