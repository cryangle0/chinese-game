import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');
const version = process.env.RELEASE_VERSION
  ?? new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const releaseRoot = path.join(root, 'release', version);
// Never honor PUBLIC_ROOT — verify servers set it to the other game and would
// cross-package reading-jumper into writing-treasure (seen 2026-07-24).
const webSource = path.resolve(root, process.env.BUILD_OUTPUT ?? path.join('build', 'web-mobile'));
const webTarget = path.join(releaseRoot, 'web');
const shellSource = path.join(root, 'mp-shell');
const shellTarget = path.join(releaseRoot, 'mp-shell');
const bankSource = path.join(root, 'config', 'question-bank.json');
const mediaSource = path.join(root, 'customer-media');
const mediaTarget = path.join(webTarget, 'media');
const EXPECT_GAME = 'writing-treasure';
const FORBID_GAME = 'reading-jumper';

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

// Refuse to package a stale web-mobile build (source newer than main bundle).
const mainBundles = (await fs.readdir(path.join(webSource, 'assets', 'main')))
  .filter((name) => /^index\..+\.js$/.test(name))
  .map((name) => path.join(webSource, 'assets', 'main', name));
if (mainBundles.length === 0) {
  throw new Error(`No assets/main/index.*.js under ${webSource}; run npm run build:web first`);
}
const bundleMtime = Math.max(...await Promise.all(mainBundles.map(async (file) =>
  (await fs.stat(file)).mtimeMs)));
const watchRoots = [
  path.join(root, 'assets', 'scripts'),
  path.join(root, 'assets', 'resources'),
];
async function newestUnder(dir) {
  let newest = 0;
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      newest = Math.max(newest, await newestUnder(target));
    } else {
      newest = Math.max(newest, (await fs.stat(target)).mtimeMs);
    }
  }
  return newest;
}
const sourceMtime = Math.max(0, ...await Promise.all(watchRoots.map(newestUnder)));
if (sourceMtime > bundleMtime + 1000) {
  throw new Error(
    `Stale web-mobile build: assets newer than ${path.basename(mainBundles[0])}. `
    + 'Run npm run build:web before release:create.',
  );
}

// Refuse cross-game packaging (wrong PUBLIC_ROOT / mixed build).
const mainJs = await fs.readFile(mainBundles[0], 'utf8');
if (!mainJs.includes(EXPECT_GAME) || mainJs.includes(FORBID_GAME)) {
  throw new Error(
    `Refuse release: ${path.basename(mainBundles[0])} is not ${EXPECT_GAME} `
    + `(has expect=${mainJs.includes(EXPECT_GAME)} forbid=${mainJs.includes(FORBID_GAME)}). `
    + `webSource=${webSource}`,
  );
}
const indexHtml = await fs.readFile(path.join(webSource, 'index.html'), 'utf8');
if (/阅读跳跳乐/.test(indexHtml)) {
  throw new Error(`Refuse release: index.html still titled 阅读跳跳乐 under ${webSource}`);
}

await fs.rm(releaseRoot, { recursive: true, force: true });
await fs.mkdir(releaseRoot, { recursive: true });
await fs.cp(webSource, webTarget, { recursive: true });
await fs.cp(mediaSource, mediaTarget, { recursive: true });
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
  game: 'writing-treasure',
  version,
  createdAt: new Date().toISOString(),
  files: manifest,
}, null, 2)}\n`);
console.log(`Release created: ${releaseRoot}`);
