import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('build/web-mobile');
const compressible = new Set(['.css', '.html', '.js', '.json']);

function filesBelow(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesBelow(target) : [target];
  });
}

if (!fs.existsSync(root)) throw new Error('web build is missing');
const files = filesBelow(root);
const base = files.filter((file) => !file.endsWith('.br') && !file.endsWith('.gz'));
const sources = base.filter((file) =>
  compressible.has(path.extname(file)) && fs.statSync(file).size >= 1024);
const missing = sources.filter((file) => !fs.existsSync(`${file}.br`));
const rawBytes = sources.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const brotliBytes = sources.reduce((sum, file) => sum + fs.statSync(`${file}.br`).size, 0);
const baseBytes = base.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const poseFiles = base.filter((file) => /[\\/](vendor|models|wasm)[\\/]/i.test(file));
const poseBytes = poseFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const themeFiles = base.filter((file) => /[\\/]assets[\\/]theme-reading-[^\\/]+[\\/]/i.test(file));
const themeBytes = themeFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const motionFiles = base.filter((file) => /[\\/]media[\\/]/i.test(file));
const motionBytes = motionFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const retiredLocomotionFiles = motionFiles.filter((file) =>
  /[\\/](?:mario|deep-sea|space|food|poetry)[\\/](?:idle|run-left|run-right)\.webp$/i
    .test(file));
const perThemeBytes = new Map();
themeFiles.forEach((file) => {
  const theme = file.match(/[\\/]assets[\\/]theme-reading-([^\\/]+)[\\/]/i)?.[1] ?? 'unknown';
  perThemeBytes.set(theme, (perThemeBytes.get(theme) ?? 0) + fs.statSync(file).size);
});
const perMotionSceneBytes = new Map();
motionFiles.forEach((file) => {
  const scene = file.match(/[\\/]media[\\/](mario|deep-sea|space|food|poetry)[\\/]/i)?.[1];
  if (scene) {
    perMotionSceneBytes.set(
      scene,
      (perMotionSceneBytes.get(scene) ?? 0) + fs.statSync(file).size,
    );
  }
});
const initialBytes = baseBytes - poseBytes - themeBytes - motionBytes;
const engineBytes = base
  .filter((file) => /cocos-js[\\/].+\.js$/i.test(file))
  .reduce((sum, file) => sum + fs.statSync(file).size, 0);
const errors = [];
const appScripts = base.filter((file) => /assets[\\/]main[\\/].+\.js$/i.test(file));
if (appScripts.some((file) => fs.readFileSync(file, 'utf8').includes('.concat(new Set('))) {
  errors.push('application bundle contains a broken iterable Set spread');
}
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const runtimeConfigPath = path.join(root, 'runtime-config.json');
const settingsFile = base.find((file) => /src[\\/]settings\..+\.json$/i.test(file));
if (!/<title>阅读跳跳乐<\/title>/i.test(indexHtml)) {
  errors.push('index.html lacks the reading game product title');
}
if (/vendor\/tf-core\.js/i.test(indexHtml)) {
  errors.push('pose runtime must remain lazy and must not be loaded by index.html');
}
if (/Cocos Creator|Made with Cocos|cocos[-_ ]logo/i.test(indexHtml)) {
  errors.push('index.html still contains Cocos branding');
}
if (/<link\b[^>]*\brel=["'][^"']*(?:icon|apple-touch-icon)/i.test(indexHtml)) {
  errors.push('index.html still references a generated startup icon');
}
for (const name of ['favicon.ico', 'favicon.png', 'apple-touch-icon.png', 'splash.png',
  'splash-screen.png']) {
  if (fs.existsSync(path.join(root, name))) {
    errors.push(`generated startup asset still exists: ${name}`);
  }
}
if (!indexHtml.includes('data-host-bridge="wechat-mp"')) {
  errors.push('index.html lacks the WeChat mini-program bridge');
}
if (!/<script\b[^>]*data-host-bridge=["']wechat-mp["'][^>]*\basync\b/i.test(indexHtml)) {
  errors.push('WeChat mini-program bridge must load asynchronously');
}
if (/<script\b[^>]*data-host-bridge=["']wechat-mp["'][^>]*\bdefer\b/i.test(indexHtml)) {
  errors.push('WeChat mini-program bridge must not delay DOMContentLoaded');
}
if (!indexHtml.includes('viewport-fit=cover')) {
  errors.push('index.html lacks safe-area viewport support');
}
if (!fs.existsSync(runtimeConfigPath)) {
  errors.push('runtime-config.json is missing');
} else {
  const runtimeConfig = JSON.parse(fs.readFileSync(runtimeConfigPath, 'utf8'));
  const sensitivity = runtimeConfig?.pose?.movementSensitivity;
  if (!Number.isFinite(sensitivity) || sensitivity < 0.5 || sensitivity > 2) {
    errors.push('pose movement sensitivity must be from 0.5 to 2');
  }
}
if (!settingsFile) {
  errors.push('generated settings file is missing');
} else {
  const settings = JSON.parse(fs.readFileSync(settingsFile, 'utf8'));
  if (settings?.splashScreen?.totalTime !== 0 || settings?.splashScreen?.displayRatio !== 0) {
    errors.push('Cocos splash screen is not disabled');
  }
  if (Object.hasOwn(settings?.splashScreen ?? {}, 'logo')) {
    errors.push('generated settings still contains a splash logo');
  }
  if (Object.hasOwn(settings?.splashScreen ?? {}, 'background')
      || Object.hasOwn(settings?.splashScreen ?? {}, 'watermarkLocation')) {
    errors.push('generated settings still contains splash-page presentation data');
  }
  const themeBundles = settings?.assets?.projectBundles
    ?.filter((name) => name.startsWith('theme-reading-')) ?? [];
  if (themeBundles.length !== 5) errors.push(`expected 5 reading theme bundles, found ${themeBundles.length}`);
}
if (missing.length) errors.push(`${missing.length} files lack precompressed variants`);
if (rawBytes && brotliBytes / rawBytes > 0.3) errors.push('Brotli ratio exceeds 30%');
const requiredPoseFiles = [
  'vendor/tf-core.js',
  'vendor/tf-converter.js',
  'vendor/tf-backend-webgl.js',
  'vendor/tf-backend-wasm.js',
  'vendor/pose-detection.js',
  'models/movenet/singlepose-lightning-v4/model.json',
  'models/movenet/singlepose-lightning-v4/group1-shard1of2.bin',
  'models/movenet/singlepose-lightning-v4/group1-shard2of2.bin',
  'wasm/tfjs-backend-wasm-simd.wasm',
];
requiredPoseFiles.forEach((file) => {
  if (!fs.existsSync(path.join(root, file))) errors.push(`missing lazy pose asset ${file}`);
});
if (fs.existsSync(path.join(root, 'wasm', 'tfjs-backend-wasm-threaded-simd.wasm'))) {
  errors.push('unused threaded WASM variant must not be shipped');
}
if (retiredLocomotionFiles.length) {
  errors.push(`${retiredLocomotionFiles.length} retired locomotion WebPs are still shipped`);
}
for (const [theme, bytes] of perThemeBytes) {
  if (bytes > 6.5 * 1024 * 1024) {
    errors.push(`lazy theme ${theme} exceeds 6.5 MB`);
  }
}
for (const [scene, bytes] of perMotionSceneBytes) {
  if (bytes > 3.5 * 1024 * 1024) {
    errors.push(`lazy motion scene ${scene} exceeds 3.5 MB`);
  }
}
if (initialBytes > 8.2 * 1024 * 1024) errors.push('initial build exceeds 8.2 MB');
if (motionBytes > 13 * 1024 * 1024) errors.push('all lazy motion media exceeds 13 MB');
if (baseBytes > 45 * 1024 * 1024) errors.push('five-theme build exceeds 45 MB');
if (engineBytes > 1.8 * 1024 * 1024) errors.push('engine script exceeds 1.8 MB');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`web performance ok: ${(initialBytes / 1048576).toFixed(2)} MB initial, `
  + `${(poseBytes / 1048576).toFixed(2)} MB lazy pose, `
  + `${(themeBytes / 1048576).toFixed(2)} MB lazy themes, `
  + `${(motionBytes / 1048576).toFixed(2)} MB lazy motion, `
  + `${(Math.max(...perThemeBytes.values()) / 1048576).toFixed(2)} MB max theme, `
  + `${(baseBytes / 1048576).toFixed(2)} MB total, `
  + `${(brotliBytes / 1048576).toFixed(2)} MB Brotli text`);
