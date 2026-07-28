import { parseQuestionPack } from '../assets/scripts/services/QuestionSchema';
import { sampleQuestions } from '../assets/scripts/shared/config/SampleQuestions';
import fs from 'node:fs';
import path from 'node:path';

describe('QuestionSchema', () => {
  it('accepts a complete unique question pack', () => {
    const pack = { version: 'v1', questions: sampleQuestions };
    expect(parseQuestionPack(pack)).toBe(pack);
  });

  it('validates the checked-in production question bank', () => {
    const file = path.resolve(process.cwd(), 'config/question-bank.json');
    expect(parseQuestionPack(JSON.parse(fs.readFileSync(file, 'utf8')))).not.toBeNull();
  });

  it('rejects duplicate IDs and malformed image questions', () => {
    expect(parseQuestionPack({
      version: 'v1',
      questions: [sampleQuestions[0], sampleQuestions[0]],
    })).toBeNull();
    expect(parseQuestionPack({
      version: 'v1',
      questions: [{ ...sampleQuestions[0], stemType: 'image-text', stemImageUrl: '' }],
    })).toBeNull();
  });

  it('rejects invalid enums, options and weights', () => {
    expect(parseQuestionPack({
      version: 'v1',
      questions: [{ ...sampleQuestions[0], games: ['unknown'] }],
    })).toBeNull();
    expect(parseQuestionPack({
      version: 'v1',
      questions: [{ ...sampleQuestions[0], options: ['', 'B', 'C'], weight: -1 }],
    })).toBeNull();
  });
});
