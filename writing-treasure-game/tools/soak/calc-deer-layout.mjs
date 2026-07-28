import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const root = path.resolve(import.meta.dirname, '../../..');

async function opaque(page, filePath) {
  const bytes = fs.readFileSync(filePath);
  const b64 = bytes.toString('base64');
  const mime = filePath.endsWith('.png') ? 'image/png' : 'image/webp';
  return page.evaluate(async ({ b64: b, mime: m }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:${m};base64,${b}`; });
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const { data } = c.getContext('2d').getImageData(0, 0, c.width, c.height);
    let minX = c.width, minY = c.height, maxX = 0, maxY = 0, n = 0;
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
      if (data[(y * c.width + x) * 4 + 3] > 24) {
        minX = Math.min(minX, x); minY = Math.min(minY, y);
        maxX = Math.max(maxX, x); maxY = Math.max(maxY, y); n++;
      }
    }
    return {
      nat: { w: c.width, h: c.height },
      op: { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1,
        padTop: minY, padBottom: c.height - 1 - maxY },
    };
  }, { b64, mime });
}

function extractChar(htmlPath) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
  const hit = imgs.find((t) => /character-motion|deer\.png|characterIdle/i.test(t));
  const box = hit?.match(/data-qa-box="([^"]+)"/)?.[1]?.split(',').map(Number);
  return box ? { left: box[0], top: box[1], w: box[2], h: box[3], feet: box[1] + box[3] } : null;
}

/** Layout so opaque visualH hits target and opaque feet sit on feetY (HTML). */
function layoutFromOpaque(nat, op, feetY, visualH, centerX = 720) {
  const scale = visualH / op.h;
  const boxW = +(nat.w * scale).toFixed(1);
  const boxH = +(nat.h * scale).toFixed(1);
  const boxTop = +(feetY - op.maxY * scale).toFixed(1);
  const boxLeft = +(centerX - boxW / 2).toFixed(1);
  const cocosY = +(405 - (boxTop + boxH / 2)).toFixed(1);
  const cocosX = +(boxLeft + boxW / 2 - 720).toFixed(1);
  return {
    visualH, feetY, scale: +scale.toFixed(3),
    box: { left: boxLeft, top: boxTop, w: boxW, h: boxH },
    reading: { width: Math.round(boxW), height: Math.round(boxH), x: Math.round(cocosX), y: Math.round(cocosY) },
    writingBoxArgs: [boxLeft, boxTop, boxW, boxH],
    predictedFeet: +(boxTop + op.maxY * scale).toFixed(1),
    predictedHead: +(boxTop + op.minY * scale).toFixed(1),
  };
}

const readingScenes = [
  { id: 'mario', html: '独立HTML像素级UI原型/reading/pages/01-mario-idle.html', webp: 'reading-jumper-game/customer-media/mario/idle.webp', visualH: 280 },
  { id: 'deep-sea', html: '独立HTML像素级UI原型/reading/pages/07-deep-sea-idle.html', webp: 'reading-jumper-game/customer-media/deep-sea/idle.webp', visualH: 260 },
  { id: 'space', html: '独立HTML像素级UI原型/reading/pages/13-space-idle.html', webp: 'reading-jumper-game/customer-media/space/idle.webp', visualH: 260 },
  { id: 'food', html: '独立HTML像素级UI原型/reading/pages/19-food-idle.html', webp: 'reading-jumper-game/customer-media/food/idle.webp', visualH: 260 },
  { id: 'poetry', html: '独立HTML像素级UI原型/reading/pages/25-poetry-idle.html', webp: 'reading-jumper-game/customer-media/poetry/idle.webp', visualH: 260 },
];
const writingScenes = [
  { id: 'treasure', html: '独立HTML像素级UI原型/writing/pages/01-treasure-idle.html', webp: 'writing-treasure-game/customer-media/treasure/idle.webp', visualH: 300 },
  { id: 'desert', html: '独立HTML像素级UI原型/writing/pages/08-desert-idle.html', webp: 'writing-treasure-game/customer-media/desert/idle.webp', visualH: 300 },
  { id: 'dinosaur', html: '独立HTML像素级UI原型/writing/pages/15-dinosaur-idle.html', webp: 'writing-treasure-game/customer-media/dinosaur/idle.webp', visualH: 300 },
  { id: 'dunhuang', html: '独立HTML像素级UI原型/writing/pages/22-dunhuang-idle.html', webp: 'writing-treasure-game/customer-media/dunhuang/idle.webp', visualH: 300 },
  { id: 'magic', html: '独立HTML像素级UI原型/writing/pages/29-magic-idle.html', webp: 'writing-treasure-game/customer-media/magic/idle.webp', visualH: 300 },
];

const browser = await chromium.launch({ executablePath: chrome, headless: true });
const page = await browser.newPage();
await page.goto('about:blank');

const out = { reading: {}, writing: {} };
for (const s of readingScenes) {
  const html = extractChar(path.join(root, s.html));
  const asset = await opaque(page, path.join(root, s.webp));
  out.reading[s.id] = {
    html, asset,
    layout: layoutFromOpaque(asset.nat, asset.op, html.feet, s.visualH, 720),
  };
}
for (const s of writingScenes) {
  const html = extractChar(path.join(root, s.html));
  const asset = await opaque(page, path.join(root, s.webp));
  const cx = html.left + html.w / 2;
  out.writing[s.id] = {
    html, asset,
    layout: layoutFromOpaque(asset.nat, asset.op, html.feet, s.visualH, cx),
  };
}

fs.mkdirSync(path.join(root, 'test-results/pixel-audit/deer-ground'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'test-results/pixel-audit/deer-ground/LAYOUT-CALC.json'),
  `${JSON.stringify(out, null, 2)}\n`,
);
console.log(JSON.stringify(out, null, 2));
await browser.close();
