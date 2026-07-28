import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const crops = [
  {
    name: 'mario',
    file: 'e:/angsa/angsa_data/项目/作业帮游戏/reading-jumper-game/assets/theme-bundles/mario/question.png',
    also: [
      'e:/angsa/angsa_data/项目/作业帮游戏/独立HTML像素级UI原型/reading/assets/mario/question.png',
    ],
    bottom: 22,
  },
  {
    name: 'deep-sea',
    file: 'e:/angsa/angsa_data/项目/作业帮游戏/reading-jumper-game/assets/theme-bundles/deep-sea/question-board.png',
    also: [
      'e:/angsa/angsa_data/项目/作业帮游戏/独立HTML像素级UI原型/reading/assets/deep-sea/question-board.png',
    ],
    bottom: 17,
  },
  {
    name: 'food',
    file: 'e:/angsa/angsa_data/项目/作业帮游戏/reading-jumper-game/assets/theme-bundles/food/question-board.png',
    also: [
      'e:/angsa/angsa_data/项目/作业帮游戏/独立HTML像素级UI原型/reading/assets/food/question-board.png',
    ],
    bottom: 11,
  },
  {
    name: 'poetry',
    file: 'e:/angsa/angsa_data/项目/作业帮游戏/reading-jumper-game/assets/theme-bundles/poetry/question-board.png',
    also: [
      'e:/angsa/angsa_data/项目/作业帮游戏/独立HTML像素级UI原型/reading/assets/poetry/question-board.png',
    ],
    bottom: 17,
  },
];

function cropBottom(srcPath, bottom) {
  const png = PNG.sync.read(fs.readFileSync(srcPath));
  const newH = png.height - bottom;
  if (newH < 40) throw new Error(`crop too aggressive: ${srcPath}`);
  const out = new PNG({ width: png.width, height: newH });
  for (let y = 0; y < newH; y++) {
    for (let x = 0; x < png.width; x++) {
      const si = (png.width * y + x) << 2;
      const di = (png.width * y + x) << 2;
      out.data[di] = png.data[si];
      out.data[di + 1] = png.data[si + 1];
      out.data[di + 2] = png.data[si + 2];
      out.data[di + 3] = png.data[si + 3];
    }
  }
  fs.writeFileSync(srcPath, PNG.sync.write(out));
  return { w: png.width, h: png.height, newH };
}

for (const c of crops) {
  const r = cropBottom(c.file, c.bottom);
  console.log(c.name, `${r.w}x${r.h}`, '->', `${r.w}x${r.newH}`);
  for (const alt of c.also || []) {
    if (fs.existsSync(alt)) {
      fs.copyFileSync(c.file, alt);
      console.log('  synced', path.basename(path.dirname(alt)) + '/' + path.basename(alt));
    }
  }
}
console.log('CROP_OK');
