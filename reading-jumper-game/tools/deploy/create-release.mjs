import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const version = process.env.RELEASE_VERSION
  ?? new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const releaseRoot = path.join(root, 'release', version);
const webSource = path.resolve(root, process.env.BUILD_OUTPUT ?? path.join('build', 'web-mobile'));
const webTarget = path.join(releaseRoot, 'web');
const shellSource = path.join(root, 'mp-shell');
const shellTarget = path.join(releaseRoot, 'mp-shell');
const bankSource = path.join(root, 'config', 'question-bank.json');
const mediaSource = path.join(root, 'customer-media');
const mediaTarget = path.join(webTarget, 'media');
const runtimeMediaSource = path.join(root, 'runtime-media');
const runtimeMediaTarget = path.join(mediaTarget, 'runtime');

async function filesBelow(directory) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  }));
  return nested.flat();
}

await fs.access(path.join(webSource, 'index.html'));
await fs.access(path.join(mediaSource, 'manifest.json'));
await fs.access(path.join(runtimeMediaSource, 'wasm', 'tfjs-backend-wasm.wasm'));

// Refuse cross-game packaging if web-mobile was overwritten by the other project.
const mainBundles = (await fs.readdir(path.join(webSource, 'assets', 'main')))
  .filter((name) => /^index\..+\.js$/.test(name))
  .map((name) => path.join(webSource, 'assets', 'main', name));
if (mainBundles.length === 0) {
  throw new Error(`No assets/main/index.*.js under ${webSource}; run npm run build:web first`);
}
const mainJs = await fs.readFile(mainBundles[0], 'utf8');
// Prefer project markers; "/writing-treasure/" may appear in shared CDN path checks.
if (!mainJs.includes('reading-jumper') || mainJs.includes('zyb-writing-treasure')) {
  throw new Error(
    `Refuse release: ${path.basename(mainBundles[0])} is not reading-jumper `
    + `(webSource=${webSource})`,
  );
}

await fs.rm(releaseRoot, { recursive: true, force: true });
await fs.mkdir(releaseRoot, { recursive: true });
await fs.cp(webSource, webTarget, { recursive: true });
await fs.cp(mediaSource, mediaTarget, { recursive: true });
await fs.cp(runtimeMediaSource, runtimeMediaTarget, { recursive: true });
await fs.cp(shellSource, shellTarget, {
  recursive: true,
  filter: (source) => !/^private\..+\.key$/i.test(path.basename(source)),
});
await fs.copyFile(bankSource, path.join(releaseRoot, 'question-bank.json'));
await fs.copyFile(bankSource, path.join(webTarget, 'question-bank.json'));
const files = await filesBelow(releaseRoot);
const manifest = await Promise.all(files.map(async (file) => ({
  path: path.relative(releaseRoot, file).replace(/\\/g, '/'),
  bytes: (await fs.stat(file)).size,
  sha256: crypto.createHash('sha256').update(await fs.readFile(file)).digest('hex'),
})));
await fs.writeFile(path.join(releaseRoot, 'manifest.json'), `${JSON.stringify({
  game: 'reading-jumper',
  version,
  createdAt: new Date().toISOString(),
  files: manifest,
}, null, 2)}\n`);
console.log(`Release created: ${releaseRoot}`);
