import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const project = path.resolve(import.meta.dirname, '../..');
const customerRoot = process.env.WRITING_CUSTOMER_ASSETS
  ?? path.resolve(project, '../客户提供素材/写作宝藏-完整切图文件');
const outputRoot = path.join(project, 'assets/theme-bundles');

const states = {
  treasure: {
    successState: '写作宝藏-基础版-切图/选项触发界面_道具/正反馈宝箱.png',
    'successState-red': '写作宝藏-基础版-切图/选项触发界面_道具/红宝箱.png',
    'successState-green': '写作宝藏-基础版-切图/选项触发界面_道具/绿宝箱.png',
    failState: '写作宝藏-基础版-切图/选项触发界面_道具/负反馈宝箱.png',
    'failState-purple': {
      source: '写作宝藏-基础版-切图/选项触发界面_道具/负反馈宝箱-紫色.png',
      trimAlpha: true,
    },
    'failState-green': {
      source: '写作宝藏-基础版-切图/选项触发界面_道具/负反馈宝箱-绿色.png',
      trimAlpha: true,
    },
  },
  desert: {
    successState: '写作宝藏-沙漠探险-切图/沙漠探险-选项触发界面切图/正反馈选项.png',
    'successState-red': {
      source: '写作宝藏-沙漠探险-切图/沙漠探险-选项触发界面切图/正反馈选项-红.png',
      trimAlpha: true,
    },
    'successState-green': {
      source: '写作宝藏-沙漠探险-切图/沙漠探险-选项触发界面切图/正反馈选项-绿.png',
      trimAlpha: true,
    },
  },
  dunhuang: {
    successState: '写作宝藏-敦煌壁画-切图/敦煌壁画-选项触发界面切图/莲花正反馈.png',
    'successState-red': '写作宝藏-敦煌壁画-切图/敦煌壁画-选项触发界面切图/莲花红色.png',
    'successState-green': '写作宝藏-敦煌壁画-切图/敦煌壁画-选项触发界面切图/莲花绿色.png',
    failState: '写作宝藏-敦煌壁画-切图/敦煌壁画-选项触发界面切图/莲花负反馈.png',
    'failState-white': {
      source: '写作宝藏-敦煌壁画-切图/敦煌壁画-选项触发界面切图/莲花负反馈-白色.png',
      trimAlpha: true,
    },
    'failState-green': {
      source: '写作宝藏-敦煌壁画-切图/敦煌壁画-选项触发界面切图/莲花负反馈-绿色.png',
      trimAlpha: true,
    },
  },
  magic: {
    successState: '写作宝藏-魔法学院-切图/魔法学院-选项触发界面切图/魔法书正反馈.png',
    failState: '写作宝藏-魔法学院-切图/魔法学院-选项触发界面切图/书本负反馈.png',
  },
};

if (!fs.existsSync(customerRoot)) {
  throw new Error(`Writing customer assets are missing: ${customerRoot}`);
}

function isPng(buffer) {
  return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

function migrateMeta(directory, name) {
  const jpgMeta = path.join(directory, `${name}.jpg.meta`);
  const pngMeta = path.join(directory, `${name}.png.meta`);
  if (!fs.existsSync(jpgMeta) && !fs.existsSync(pngMeta)) {
    const template = JSON.parse(fs.readFileSync(
      path.join(directory, 'successState.png.meta'),
      'utf8',
    ));
    const uuid = randomUUID();
    const [subMetaId, subMeta] = Object.entries(template.subMetas)[0];
    template.uuid = uuid;
    subMeta.uuid = `${uuid}@${subMetaId}`;
    subMeta.displayName = name;
    subMeta.userData.imageUuidOrDatabaseUri = uuid;
    template.userData.redirect = `${uuid}@${subMetaId}`;
    fs.writeFileSync(pngMeta, `${JSON.stringify(template, null, 2)}\n`);
  }

  const sourceMeta = fs.existsSync(pngMeta) ? pngMeta : jpgMeta;
  const meta = JSON.parse(fs.readFileSync(sourceMeta, 'utf8'));
  meta.files = meta.files.map((file) => file === '.jpg' ? '.png' : file);
  meta.userData = {
    ...meta.userData,
    hasAlpha: true,
  };
  fs.writeFileSync(pngMeta, `${JSON.stringify(meta, null, 2)}\n`);
  if (sourceMeta !== pngMeta) fs.rmSync(sourceMeta);
}

function trimTransparentPng(data) {
  const image = PNG.sync.read(data);
  let left = image.width;
  let top = image.height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < image.height; y += 1) {
    for (let x = 0; x < image.width; x += 1) {
      if (image.data[(y * image.width + x) * 4 + 3] < 8) continue;
      left = Math.min(left, x);
      top = Math.min(top, y);
      right = Math.max(right, x);
      bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) {
    throw new Error('Writing feedback state is fully transparent');
  }
  const output = new PNG({ width: right - left + 1, height: bottom - top + 1 });
  PNG.bitblt(image, output, left, top, output.width, output.height, 0, 0);
  return PNG.sync.write(output);
}

function optimizePng(file) {
  const result = spawnSync('zopflipng', [
    '-y',
    '--iterations=3',
    '--filters=0me',
    file,
    file,
  ], { encoding: 'utf8', windowsHide: true });
  if (result.error?.code === 'ENOENT') {
    console.warn(`zopflipng is unavailable; kept the original lossless PNG: ${file}`);
    return;
  }
  if (result.status !== 0) {
    throw new Error(`zopflipng failed for ${file}: ${result.stderr || result.stdout}`);
  }
}

let sourceBytes = 0;
let outputBytes = 0;
let copied = 0;
for (const [theme, mapping] of Object.entries(states)) {
  const directory = path.join(outputRoot, theme);
  for (const [name, config] of Object.entries(mapping)) {
    const relativeSource = typeof config === 'string' ? config : config.source;
    const source = path.join(customerRoot, ...relativeSource.split('/'));
    if (!fs.existsSync(source)) throw new Error(`Writing feedback state is missing: ${source}`);
    const data = fs.readFileSync(source);
    if (!isPng(data)) throw new Error(`Writing feedback state is not a PNG: ${source}`);

    fs.mkdirSync(directory, { recursive: true });
    const target = path.join(directory, `${name}.png`);
    fs.writeFileSync(target, typeof config === 'string' || !config.trimAlpha
      ? data
      : trimTransparentPng(data));
    fs.rmSync(path.join(directory, `${name}.jpg`), { force: true });
    migrateMeta(directory, name);
    optimizePng(target);

    sourceBytes += data.length;
    outputBytes += fs.statSync(target).size;
    copied += 1;
  }
}

console.log(`Synchronized ${copied} transparent writing feedback states.`);
console.log(`Lossless PNG bytes: ${sourceBytes} -> ${outputBytes}.`);
