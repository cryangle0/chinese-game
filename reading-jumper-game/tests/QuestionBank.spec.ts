import { QuestionBank } from '../assets/scripts/services/QuestionBank';
import { sampleQuestions } from '../assets/scripts/shared/config/SampleQuestions';
import fs from 'node:fs';
import path from 'node:path';

describe('QuestionBank', () => {
  it('creates a non-repeating cursor before wrapping', () => {
    const bank = new QuestionBank(sampleQuestions);
    const cursor = bank.createCursor(
      { game: 'reading-jumper', scene: 'deep-sea', grade: 'L3' },
      () => 0.5,
    );
    const ids = new Set<string>();
    for (let index = 0; index < sampleQuestions.length; index += 1) {
      ids.add(cursor.next()!.id);
    }
    expect(ids.size).toBe(sampleQuestions.length);
  });

  it('throws when no grade pool exists', () => {
    const bank = new QuestionBank([{ ...sampleQuestions[0], grade: 'L3' }]);
    expect(() => bank.createCursor({
      game: 'reading-jumper',
      scene: 'deep-sea',
      grade: 'L6',
    })).toThrow('no questions');
  });

  it('does not leak questions from another scene', () => {
    const scoped = [{ ...sampleQuestions[0], scenes: ['deep-sea'] }];
    const bank = new QuestionBank(scoped);
    expect(() => bank.createCursor({
      game: 'reading-jumper',
      scene: 'space',
      grade: 'L3',
    })).toThrow('no questions');
  });

  it('prefers scene-specific content over generic fallback', () => {
    const specific = { ...sampleQuestions[0], id: 'specific', scenes: ['deep-sea'] };
    const generic = { ...sampleQuestions[1], id: 'generic', scenes: ['*'] };
    const cursor = new QuestionBank([specific, generic]).createCursor({
      game: 'reading-jumper',
      scene: 'deep-sea',
      grade: 'L3',
    });
    expect(cursor.next()?.id).toBe('specific');
  });

  it('uses weight without repeating a question and honors exclusions', () => {
    const questions = [
      { ...sampleQuestions[0], id: 'heavy', weight: 100 },
      { ...sampleQuestions[1], id: 'light', weight: 0 },
    ];
    const cursor = new QuestionBank(questions).createCursor(
      { game: 'reading-jumper', scene: 'deep-sea', grade: 'L3' },
      () => 0.5,
      new Set(['light']),
    );
    expect(cursor.next()?.id).toBe('heavy');
    expect(cursor.next()?.id).toBe('heavy');
  });

  it('filters term and difficulty when requested', () => {
    const questions = [
      { ...sampleQuestions[0], id: 'first-basic', term: 'first' as const },
      {
        ...sampleQuestions[1],
        id: 'second-challenge',
        term: 'second' as const,
        difficulty: 'challenge' as const,
      },
    ];
    const cursor = new QuestionBank(questions).createCursor({
      game: 'reading-jumper',
      scene: 'deep-sea',
      grade: 'L3',
      term: 'second',
      difficulties: ['challenge'],
    });
    expect(cursor.next()?.id).toBe('second-challenge');
  });

  it('falls back to another difficulty within the same scene', () => {
    const basic = {
      ...sampleQuestions[0],
      id: 'scene-basic',
      difficulty: 'basic' as const,
      scenes: ['deep-sea'],
    };
    const cursor = new QuestionBank([basic]).createCursor({
      game: 'reading-jumper',
      scene: 'deep-sea',
      grade: 'L3',
      difficulties: ['challenge'],
    });
    expect(cursor.next()?.id).toBe('scene-basic');
  });

  it('filters by knowledgePoint (cover book)', () => {
    const questions = [
      { ...sampleQuestions[0], id: 'xy', knowledgePoint: '西游记' },
      { ...sampleQuestions[1], id: 'at', knowledgePoint: '安徒生童话' },
    ];
    const cursor = new QuestionBank(questions).createCursor({
      game: 'reading-jumper',
      scene: 'deep-sea',
      grade: 'L3',
      knowledgePoint: '西游记',
    });
    expect(cursor.next()?.id).toBe('xy');
    expect(cursor.next()?.id).toBe('xy');
  });

  it('throws when knowledgePoint has no pool', () => {
    const bank = new QuestionBank([
      { ...sampleQuestions[0], knowledgePoint: '安徒生童话' },
    ]);
    expect(() => bank.createCursor({
      game: 'reading-jumper',
      scene: 'deep-sea',
      grade: 'L3',
      knowledgePoint: '西游记',
    })).toThrow(/book=西游记/);
  });

  it('widens grade when cover book only exists in another grade', () => {
    const bookL5 = {
      ...sampleQuestions[0],
      id: 'xy-l5',
      grade: 'L5' as const,
      knowledgePoint: '西游记',
      scenes: ['deep-sea'],
    };
    const other = {
      ...sampleQuestions[1],
      id: 'at-l3',
      grade: 'L3' as const,
      knowledgePoint: '安徒生童话',
      scenes: ['deep-sea'],
    };
    const cursor = new QuestionBank([bookL5, other]).createCursor({
      game: 'reading-jumper',
      scene: 'deep-sea',
      grade: 'L3',
      knowledgePoint: '西游记',
    });
    expect(cursor.next()?.id).toBe('xy-l5');
  });

  it('uses answer B for the Camel Xiangzi deep-sea nickname question', () => {
    const pack = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, '../config/question-bank.json'),
      'utf8',
    )) as {
      questions: Array<{
        knowledgePoint: string;
        scenes: string[];
        stem: string;
        options: string[];
        correctIndex: number;
      }>;
    };
    const target = pack.questions.find((question) =>
      question.knowledgePoint === '骆驼祥子'
      && question.scenes.includes('deep-sea')
      && question.stem.includes('外号是在什么事件之后得来的'));
    expect(target).toMatchObject({
      options: ['祥子买了三匹骆驼', '祥子卖掉三匹骆驼', '刘四爷送给他骆驼'],
      correctIndex: 1,
    });
  });
});
