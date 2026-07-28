import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const project = path.resolve(import.meta.dirname, '../..');
const customerRoot = process.env.WRITING_CUSTOMER_ASSETS
  ?? path.resolve(project, '../客户提供素材/写作宝藏-完整切图文件');
const outputRoot = path.join(project, 'assets/theme-bundles');

const states = {
  treasure: {
    successState: '写作宝藏-基础版-切图/选项触发界面_道具/正反馈宝箱.png',
    failState: '写作宝藏-基础版-切图/选项触发界面_道具/负反馈宝箱.png',
  },
  desert: {
    successState: '写作宝藏-沙漠探险-切图/沙漠探险-选项触发界面切图/正反馈选项.png',
  },
  dunhuang: {
    successState: '写作宝藏-敦煌壁画-切图/敦煌壁画-选项触发界面切图/莲花正反馈.png',
    failState: '写作宝藏-敦煌壁画-切图/敦煌壁画-选项触发界面切图/莲花负反馈.png',
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
    throw new Error(`Cocos metadata is missing for ${path.join(directory, name)}`);
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
  for (const [name, relativeSource] of Object.entries(mapping)) {
    const source = path.join(customerRoot, ...relativeSource.split('/'));
    if (!fs.existsSync(source)) throw new Error(`Writing feedback state is missing: ${source}`);
    const data = fs.readFileSync(source);
    if (!isPng(data)) throw new Error(`Writing feedback state is not a PNG: ${source}`);

    fs.mkdirSync(directory, { recursive: true });
    const target = path.join(directory, `${name}.png`);
    fs.writeFileSync(target, data);
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
