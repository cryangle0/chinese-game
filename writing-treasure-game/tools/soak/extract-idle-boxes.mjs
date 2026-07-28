import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';

const root = path.resolve(import.meta.dirname, '../../..');

function extractBoxes(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  return imgs.map((t) => {
    const box = t.match(/data-qa-box="([^"]+)"/);
    const cls = t.match(/class="([^"]+)"/);
    const src = t.match(/src="[^"]*\/([^"/]+)"/);
    const fit = t.match(/object-fit:\s*([^;"]+)/);
    return {
      cls: cls?.[1],
      src: src?.[1],
      box: box?.[1]?.split(',').map(Number),
      fit: fit?.[1]?.trim(),
    };
  }).filter((x) => x.box);
}

function opaqueBoundsFromWebpOrPng(file) {
  // Only PNG supported here; for webp return null
  if (!file.endsWith('.png')) return null;
  const png = PNG.sync.read(fs.readFileSync(file));
  let minX = png.width; let minY = png.height; let maxX = 0; let maxY = 0; let n = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const a = png.data[(y * png.width + x) * 4 + 3];
      if (a > 16) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
        n += 1;
      }
    }
  }
  if (!n) return null;
  return {
    natural: { w: png.width, h: png.height },
    opaque: { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 },
    padBottom: png.height - 1 - maxY,
    padTop: minY,
    fillRatio: +((maxX - minX + 1) * (maxY - minY + 1) / (png.width * png.height)).toFixed(3),
  };
}

const marioHtml = extractBoxes(path.join(root, '独立HTML像素级UI原型/reading/pages/01-mario-idle.html'));
const treasureHtml = extractBoxes(path.join(root, '独立HTML像素级UI原型/writing/pages/01-treasure-idle.html'));

const marioChar = marioHtml.filter((x) => /character|deer|idle|motion/i.test(`${x.cls} ${x.src}`));
const treasureChar = treasureHtml.filter((x) => /character|deer|idle|motion/i.test(`${x.cls} ${x.src}`));

// Also dump all layers briefly
console.log(JSON.stringify({
  marioChar,
  treasureChar,
  marioAll: marioHtml.map((x) => ({ cls: x.cls, src: x.src, box: x.box })),
  treasureAll: treasureHtml.map((x) => ({ cls: x.cls, src: x.src, box: x.box })),
}, null, 2));
