import fs from 'node:fs';
const html = fs.readFileSync('独立HTML像素级UI原型/writing/pages/01-treasure-idle.html', 'utf8');
const imgs = [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0]);
for (const t of imgs) {
  const cls = t.match(/class="([^"]+)"/)?.[1];
  const box = t.match(/data-qa-box="([^"]+)"/)?.[1];
  const src = t.match(/src="[^"]*\/([^"/]+)"/)?.[1];
  console.log(JSON.stringify({ cls, src, box }));
}
const divs = [...html.matchAll(/<div\b[^>]*>/g)].map((m) => m[0]);
for (const t of divs) {
  const cls = t.match(/class="([^"]+)"/)?.[1];
  const box = t.match(/data-qa-box="([^"]+)"/)?.[1];
  if (box) console.log(JSON.stringify({ type: 'div', cls, box }));
}
