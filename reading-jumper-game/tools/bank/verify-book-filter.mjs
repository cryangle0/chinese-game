/**
 * Verify cover-book knowledgePoint filter against production bank.
 * Usage: node tools/bank/verify-book-filter.mjs [book]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

const bank = JSON.parse(fs.readFileSync(path.join(root, 'config/question-bank.json'), 'utf8'));
const book = (process.argv[2] || '西游记').trim();
const game = bank.questions[0]?.games?.[0] ?? 'reading-jumper';
const scenes = [...new Set(bank.questions.flatMap((q) => q.scenes).filter((s) => s !== '*'))];

let ok = true;
for (const scene of scenes) {
  const pool = bank.questions.filter((q) =>
    q.enabled
    && q.games.includes(game)
    && q.knowledgePoint === book
    && (q.scenes.includes(scene) || q.scenes.includes('*'))
  );
  const scoped = pool.filter((q) => q.scenes.includes(scene));
  const use = scoped.length ? scoped : pool.filter((q) => q.scenes.includes('*'));
  const foreign = use.filter((q) => q.knowledgePoint !== book);
  console.log(`${scene}: ${use.length} Q for 「${book}」` + (foreign.length ? ` LEAK=${foreign.length}` : ''));
  if (!use.length || foreign.length) ok = false;
}

const other = bank.questions.filter((q) =>
  q.enabled && q.knowledgePoint === book
).length;
console.log(`total 「${book}」 in bank: ${other}`);
if (!ok) {
  console.error('FAIL: book filter pool empty or leaked');
  process.exit(1);
}
console.log('OK');
