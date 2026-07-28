import fs from 'node:fs';

const files = [
  ['mario', '独立HTML像素级UI原型/reading/pages/01-mario-idle.html'],
  ['deep-sea', '独立HTML像素级UI原型/reading/pages/07-deep-sea-idle.html'],
  ['space', '独立HTML像素级UI原型/reading/pages/13-space-idle.html'],
  ['food', '独立HTML像素级UI原型/reading/pages/19-food-idle.html'],
  ['poetry', '独立HTML像素级UI原型/reading/pages/25-poetry-idle.html'],
  ['treasure', '独立HTML像素级UI原型/writing/pages/01-treasure-idle.html'],
];

const game = {
  mario: [190, 300],
  'deep-sea': [178, 252],
  space: [180, 248],
  food: [148, 250],
  poetry: [158, 240],
  treasure: [173, 253],
};

for (const [id, f] of files) {
  const html = fs.readFileSync(f, 'utf8');
  const imgs = [...html.matchAll(/<img[^>]+>/g)].map((x) => x[0])
    .filter((t) => /character|deer|idle\.webp|class="[^"]*idle/i.test(t));
  const parsed = imgs.slice(0, 3).map((t) => {
    const b = t.match(/data-qa-box="([\d.]+),([\d.]+),([\d.]+),([\d.]+)"/);
    const s = t.match(/src="[^"]*\/([^"/]+)"/);
    return {
      src: s?.[1],
      w: b ? Number(b[3]) : null,
      h: b ? Number(b[4]) : null,
    };
  });
  const proto = parsed.find((p) => p.w && p.h) || parsed[0];
  const g = game[id];
  console.log(JSON.stringify({
    id,
    html: proto,
    game: { w: g[0], h: g[1] },
    vsHtml: proto?.w ? {
      dw: +(g[0] - proto.w).toFixed(1),
      dh: +(g[1] - proto.h).toFixed(1),
      scale: +((g[0] / proto.w)).toFixed(2),
    } : null,
  }));
}
