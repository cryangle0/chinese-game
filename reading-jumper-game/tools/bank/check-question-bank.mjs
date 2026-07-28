import fs from 'node:fs';
import path from 'node:path';
import { validateQuestionBankApproval } from './question-bank-approval.mjs';

const GAME_ID = 'reading-jumper';
const SCENES = ['mario', 'deep-sea', 'space', 'food', 'poetry'];
const MINIMUM_PER_SCENE = 50;
const release = process.argv.includes('--release');
const bank = JSON.parse(fs.readFileSync(path.resolve('config/question-bank.json'), 'utf8'));
const ids = new Set();
const errors = [];

if (!bank.version || !Array.isArray(bank.questions)) errors.push('invalid bank root');
for (const question of bank.questions ?? []) {
  if (ids.has(question.id)) errors.push(`duplicate id: ${question.id}`);
  ids.add(question.id);
  const displayText = [question.stem, ...(question.options ?? []), question.explain ?? ''];
  if (displayText.some((value) => typeof value !== 'string' || value.includes('[object Object]'))) {
    errors.push(`invalid display text in ${question.id}`);
  }
  if (!question.games?.includes(GAME_ID) || question.games.length !== 1) {
    errors.push(`foreign game in ${question.id}`);
  }
  if (!question.enabled) errors.push(`disabled production question: ${question.id}`);
}
for (const scene of SCENES) {
  const count = bank.questions.filter((question) =>
    question.enabled && question.scenes?.includes(scene)).length;
  if (count < MINIMUM_PER_SCENE) errors.push(`${scene}: ${count}/${MINIMUM_PER_SCENE}`);
}
if (release) {
  const enabled = bank.questions.filter((question) => question.enabled);
  const contentKeys = new Set(enabled.map((question) =>
    JSON.stringify([question.stem, question.options, question.correctIndex])));
  const grades = new Set(enabled.flatMap((question) =>
    question.grade === 'ALL' ? [] : [question.grade]));
  if (bank.contentStatus !== 'approved') {
    errors.push('release question bank must have contentStatus "approved"');
  } else {
    errors.push(...validateQuestionBankApproval(bank));
  }
  if (contentKeys.size < enabled.length * 0.8) {
    errors.push(`release question bank content is duplicated: ${contentKeys.size}/${enabled.length} unique`);
  }
  if (grades.size < 2) {
    errors.push('release question bank must contain reviewed grade-specific content');
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
console.log(`question bank ok: ${bank.questions.length} enabled questions, 5 scenes covered`
  + (release ? ', release content approved' : ''));
