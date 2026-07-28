import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = path.resolve('mp-shell');
const required = [
  'project.config.json',
  'miniprogram/app.js',
  'miniprogram/app.json',
  'miniprogram/app.wxss',
  'miniprogram/config/environments.js',
  'miniprogram/pages/game/index.js',
  'miniprogram/pages/game/index.json',
  'miniprogram/pages/game/index.wxml',
  'miniprogram/pages/game/index.wxss',
  'miniprogram/pages/share/index.js',
  'miniprogram/pages/share/index.json',
  'miniprogram/pages/share/index.wxml',
  'miniprogram/pages/share/index.wxss',
  'miniprogram/utils/host-messages.js',
  'miniprogram/utils/launch-url.js',
  'miniprogram/utils/share-card.js',
];
const errors = required
  .filter((file) => !fs.existsSync(path.join(root, file)))
  .map((file) => `missing ${file}`);
const releaseMode = process.argv.includes('--release');

for (const file of ['project.config.json', 'miniprogram/app.json',
  'miniprogram/pages/game/index.json', 'miniprogram/pages/share/index.json']) {
  try {
    JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch (error) {
    errors.push(`${file}: ${error.message}`);
  }
}

const wxml = fs.readFileSync(path.join(root, 'miniprogram/pages/game/index.wxml'), 'utf8');
if (!wxml.includes('<web-view') || !wxml.includes('bindmessage=')) {
  errors.push('game page must use web-view with bindmessage');
}

// A web-view cannot open the WeChat share sheet; only open-type="share" can.
const shareWxml = fs.readFileSync(path.join(root, 'miniprogram/pages/share/index.wxml'), 'utf8');
if (!shareWxml.includes('open-type="share"')) {
  errors.push('share page must expose a button with open-type="share"');
}
const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
if (!appJson.pages?.includes('pages/share/index')) {
  errors.push('app.json must register pages/share/index');
}

const require = createRequire(import.meta.url);
const { buildLaunchUrl } = require(path.join(root, 'miniprogram/utils/launch-url.js'));
const { messagesFrom } = require(path.join(root, 'miniprogram/utils/host-messages.js'));
const url = buildLaunchUrl('https://example.com/game/', {
  bankUrl: 'https://api.example.com/bank',
  grade: '5',
  trackEndpoint: 'https://api.example.com/track',
});
if (!url.includes('host=wechat-mp') || !url.includes('grade=5')
  || !url.includes('bankUrl=') || !url.includes('trackEndpoint=')) {
  errors.push('launch URL does not enforce the mini-program host context');
}
const messages = messagesFrom({ detail: { data: [{ type: 'a' }, { type: 'b' }] } });
if (messages.length !== 2) errors.push('web-view message batches must preserve every message');

const bytes = required.reduce((sum, file) =>
  sum + fs.statSync(path.join(root, file)).size, 0);
if (bytes > 200 * 1024) errors.push(`shell source exceeds 200 KB: ${bytes}`);
if (releaseMode) {
  const project = JSON.parse(fs.readFileSync(path.join(root, 'project.config.json'), 'utf8'));
  const environments = fs.readFileSync(
    path.join(root, 'miniprogram/config/environments.js'),
    'utf8',
  );
  if (!project.appid || project.appid === 'touristappid') {
    errors.push('release requires the official WeChat mini-program AppID');
  }
  if (/example\.com/i.test(environments)) {
    errors.push('release environment still contains example.com placeholders');
  }
}

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`mp-shell ok: ${required.length} files, ${(bytes / 1024).toFixed(1)} KB`);
