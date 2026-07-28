import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('独立HTML像素级UI原型/writing/pages');
const files = fs.readdirSync(root).filter((f) => /settlement|idle|final-result/.test(f));
for (const f of files) {
  const html = fs.readFileSync(path.join(root, f), 'utf8');
  const scene = (html.match(/data-scene="([^"]+)"/) || [])[1];
  const state = (html.match(/data-state="([^"]+)"/) || [])[1];
  const re = /class="layer (?:character-motion|result-character)"[^>]*style="([^"]+)"/;
  const m = html.match(re);
  if (m) {
    const style = m[1];
    const get = (k) => {
      const mm = style.match(new RegExp(`${k}:\\s*([\\d.-]+)px`));
      return mm ? Number(mm[1]) : null;
    };
    console.log('CHAR', JSON.stringify({
      f, scene, state, left: get('left'), top: get('top'), w: get('width'), h: get('height'),
    }));
  }
  if (state === 'settlement' || state === 'final-result') {
    const names = [...html.matchAll(/result-rank-name[^>]*data-qa-box="([^"]+)"/g)].map((x) => x[1]);
    const scores = [...html.matchAll(/result-rank-score[^>]*data-qa-box="([^"]+)"/g)].map((x) => x[1]);
    const icons = [...html.matchAll(/result-review-icon[^>]*data-qa-box="([^"]+)"/g)].map((x) => x[1]);
    console.log('TEXT', JSON.stringify({ f, scene, names, scores, icons: icons.slice(0, 2) }));
  }
}
