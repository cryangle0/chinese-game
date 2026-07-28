import fs from 'node:fs/promises';
import path from 'node:path';
import { questionSeeds } from './question-content.mjs';

const GAME_ID = 'reading-jumper';
const PREFIX = 'TTYL';
const VERSION = '20260712_v3';
const SCENES = ['mario', 'deep-sea', 'space', 'food', 'poetry'];
const weights = { basic: 10, advanced: 4, challenge: 2 };

function createQuestion(seed, scene, index) {
  const [stem, options, correctIndex, type, knowledgePoint, difficulty] = seed;
  return {
    id: `${PREFIX}_${scene.replace('-', '_').toUpperCase()}_${String(index + 1).padStart(3, '0')}`,
    packId: VERSION,
    games: [GAME_ID],
    scenes: [scene],
    grade: 'ALL',
    term: 'ALL',
    difficulty,
    type,
    knowledgePoint,
    stemType: 'text',
    stem,
    options,
    correctIndex,
    explain: `正确答案是“${options[correctIndex]}”。`,
    correctFeedback: '答对了，继续向下一关前进！',
    wrongFeedback: '别着急，看看正确答案再继续。',
    source: '小学语文通用知识',
    enabled: true,
    weight: weights[difficulty],
  };
}

const questions = SCENES.flatMap((scene) =>
  questionSeeds.map((seed, index) => createQuestion(seed, scene, index)));
const output = path.resolve('config/question-bank.json');
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.writeFile(output, `${JSON.stringify({
  version: VERSION,
  contentStatus: 'placeholder',
  generatedAt: new Date().toISOString(),
  questions,
}, null, 2)}\n`, 'utf8');
console.log(`Generated ${questions.length} ${GAME_ID} questions at ${output}`);
