import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.env.PUBLIC_ROOT ?? 'build/web-mobile');
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
const themeFiles = base.filter((file) => /[\\/]assets[\\/]theme-writing-[^\\/]+[\\/]/i.test(file));
const themeBytes = themeFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const motionFiles = base.filter((file) => /[\\/]media[\\/]/i.test(file));
const motionBytes = motionFiles.reduce((sum, file) => sum + fs.statSync(file).size, 0);
const initialBytes = baseBytes - themeBytes - motionBytes;
const engineBytes = base
  .filter((file) => /cocos-js[\\/].+\.js$/i.test(file))
  .reduce((sum, file) => sum + fs.statSync(file).size, 0);
const errors = [];
const appScripts = base.filter((file) => /assets[\\/]main[\\/].+\.js$/i.test(file));
if (appScripts.some((file) => fs.readFileSync(file, 'utf8').includes('.concat(new Set('))) {
  errors.push('application bundle contains a broken iterable Set spread');
}
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const settingsFile = base.find((file) => /src[\\/]settings\..+\.json$/i.test(file));
const expectedThemeBundles = new Set([
  'theme-writing-treasure',
  'theme-writing-desert',
  'theme-writing-dinosaur',
  'theme-writing-dunhuang',
  'theme-writing-magic',
  'theme-writing-shared',
]);
if (!/<title>挖宝<\/title>/i.test(indexHtml)) {
  errors.push('index.html lacks the writing game product title');
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
    ?.filter((name) => name.startsWith('theme-writing-')) ?? [];
  const missingThemes = [...expectedThemeBundles].filter((name) => !themeBundles.includes(name));
  const unexpectedThemes = themeBundles.filter((name) => !expectedThemeBundles.has(name));
  if (missingThemes.length || unexpectedThemes.length) {
    errors.push(`writing theme bundle mismatch: missing=${missingThemes.join(',') || 'none'} `
      + `unexpected=${unexpectedThemes.join(',') || 'none'}`);
  }
}
const sharedBundleRoot = path.join(root, 'assets', 'theme-writing-shared');
const sharedBundleBytes = fs.existsSync(sharedBundleRoot)
  ? filesBelow(sharedBundleRoot).reduce((sum, file) => sum + fs.statSync(file).size, 0)
  : 0;
if (!sharedBundleBytes) errors.push('shared writing theme bundle is missing');
if (sharedBundleBytes > 160 * 1024) errors.push('shared writing theme bundle exceeds 160 KB');
if (fs.existsSync(path.join(root, 'media', 'static-feedback'))) {
  errors.push('unused static feedback source assets must not ship');
}
if (missing.length) errors.push(`${missing.length} files lack precompressed variants`);
if (rawBytes && brotliBytes / rawBytes > 0.3) errors.push('Brotli ratio exceeds 30%');
if (initialBytes > 8.2 * 1024 * 1024) errors.push('initial build exceeds 8.2 MB');
if (motionBytes > 10.5 * 1024 * 1024) errors.push('lazy motion media exceeds 10.5 MB');
if (themeBytes > 9 * 1024 * 1024) errors.push('lazy theme bundles exceed 9 MB');
if (baseBytes > 25 * 1024 * 1024) errors.push('total build exceeds 25 MB');
if (engineBytes > 1.8 * 1024 * 1024) errors.push('engine script exceeds 1.8 MB');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`web performance ok: ${(initialBytes / 1048576).toFixed(2)} MB initial, `
  + `${(themeBytes / 1048576).toFixed(2)} MB lazy themes, `
  + `${(motionBytes / 1048576).toFixed(2)} MB lazy motion, `
  + `${(baseBytes / 1048576).toFixed(2)} MB total, `
  + `${(brotliBytes / 1048576).toFixed(2)} MB Brotli text`);
