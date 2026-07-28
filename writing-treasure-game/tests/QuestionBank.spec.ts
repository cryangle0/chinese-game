import { QuestionBank } from '../assets/scripts/services/QuestionBank';
import { sampleQuestions } from '../assets/scripts/shared/config/SampleQuestions';

describe('QuestionBank', () => {
  it('creates a non-repeating cursor before wrapping', () => {
    const bank = new QuestionBank(sampleQuestions);
    const cursor = bank.createCursor(
      { game: 'writing-treasure', scene: 'treasure', grade: 'L3' },
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
      game: 'writing-treasure',
      scene: 'treasure',
      grade: 'L6',
    })).toThrow('no questions');
  });

  it('does not leak questions from another scene', () => {
    const scoped = [{ ...sampleQuestions[0], scenes: ['treasure'] }];
    const bank = new QuestionBank(scoped);
    expect(() => bank.createCursor({
      game: 'writing-treasure',
      scene: 'space',
      grade: 'L3',
    })).toThrow('no questions');
  });

  it('prefers scene-specific content over generic fallback', () => {
    const specific = { ...sampleQuestions[0], id: 'specific', scenes: ['treasure'] };
    const generic = { ...sampleQuestions[1], id: 'generic', scenes: ['*'] };
    const cursor = new QuestionBank([specific, generic]).createCursor({
      game: 'writing-treasure',
      scene: 'treasure',
      grade: 'L3',
    });
    expect(cursor.next()?.id).toBe('specific');
  });

  it('uses weight and places excluded questions after unused ones', () => {
    const questions = [
      { ...sampleQuestions[0], id: 'heavy', weight: 100 },
      { ...sampleQuestions[1], id: 'light', weight: 0 },
    ];
    const cursor = new QuestionBank(questions).createCursor(
      { game: 'writing-treasure', scene: 'treasure', grade: 'L3' },
      () => 0.5,
      new Set(['light']),
    );
    expect(cursor.next()?.id).toBe('heavy');
    expect(cursor.next()?.id).toBe('light');
  });

  it('fills a scene with previously used questions before repeating one', () => {
    const questions = Array.from({ length: 5 }, (_, index) => ({
      ...sampleQuestions[0],
      id: `scene-${index}`,
      scenes: ['treasure'],
    }));
    const cursor = new QuestionBank(questions).createCursor(
      { game: 'writing-treasure', scene: 'treasure', grade: 'L3' },
      () => 0.5,
      new Set(['scene-0', 'scene-1', 'scene-2']),
    );
    const ids = Array.from({ length: 5 }, () => cursor.next()!.id);
    expect(new Set(ids).size).toBe(5);
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
      game: 'writing-treasure',
      scene: 'treasure',
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
      scenes: ['treasure'],
    };
    const cursor = new QuestionBank([basic]).createCursor({
      game: 'writing-treasure',
      scene: 'treasure',
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
      game: 'writing-treasure',
      scene: 'treasure',
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
      game: 'writing-treasure',
      scene: 'treasure',
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
      scenes: ['treasure'],
    };
    const other = {
      ...sampleQuestions[1],
      id: 'at-l3',
      grade: 'L3' as const,
      knowledgePoint: '安徒生童话',
      scenes: ['treasure'],
    };
    const cursor = new QuestionBank([bookL5, other]).createCursor({
      game: 'writing-treasure',
      scene: 'treasure',
      grade: 'L3',
      knowledgePoint: '西游记',
    });
    expect(cursor.next()?.id).toBe('xy-l5');
  });
});
