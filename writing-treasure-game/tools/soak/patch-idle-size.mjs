import fs from 'node:fs';

const f = 'build/web-mobile/assets/main/index.6270d.js';
let s = fs.readFileSync(f, 'utf8');

const reps = [
  ['idle:n(570,53,300,415)', 'idle:n(600,155,230,310)'],
  ['idle:n(560,53,320,415)', 'idle:n(580,155,250,310)'],
  ['deer:o(570,53,300,415)', 'deer:o(600,155,230,310)'],
  ['deerMotion:o(570,53,300,415)', 'deerMotion:o(570,100,300,380)'],
  ['feedbackMotion:o(570,53,300,415)', 'feedbackMotion:o(570,100,300,380)'],
  ['action:n(570,53,300,415)', 'action:n(570,100,300,380)'],
];
for (const [a, b] of reps) {
  if (s.includes(a)) {
    s = s.split(a).join(b);
    console.log('OK', a);
  } else console.log('skip', a);
}

const scalePatterns = [
  'var F=Math.max(8,D-x+1),I=Math.min(this.height/F,Math.min(this.width/n,this.height/o)*1.35),T=n*I,V=o*I',
  'var F=Math.max(8,D-x+1),I=Math.min(this.height/F,Math.min(this.width/n,this.height/o)*1.25),T=n*I,V=o*I',
  'var F=Math.max(8,D-x+1),I=Math.min(this.height/F,Math.min(this.width/n,this.height/o)*1.25);this.height>380&&(I=Math.min(I,420/o)),T=n*I,V=o*I',
];
const safe = 'var F=Math.max(8,D-x+1),I=Math.min(this.height/Math.max(F,o*0.72),Math.min(this.width/n,this.height/o)*1.08),T=n*I,V=o*I';
let hit = false;
for (const p of scalePatterns) {
  if (s.includes(p)) {
    s = s.replace(p, safe);
    console.log('scale ok');
    hit = true;
    break;
  }
}
if (!hit) {
  const i = s.indexOf('Math.min(this.width/n,this.height/o)');
  console.log('scale miss', i, JSON.stringify(s.slice(Math.max(0, i - 50), i + 100)));
}

fs.writeFileSync(f, s);
try { fs.unlinkSync(`${f}.br`); } catch { /* ignore */ }
console.log('idle', (s.match(/600,155,230,310/g) || []).length);
console.log('action', (s.match(/570,100,300,380/g) || []).length);
