import { GameSession } from '../assets/scripts/services/GameSession';
import { sampleQuestions } from '../assets/scripts/shared/config/SampleQuestions';

describe('GameSession', () => {
  it('scores correct answers and removes a life for wrong answers', () => {
    const session = new GameSession('writing-treasure');
    const question = sampleQuestions[0];
    session.beginQuestion(100);
    expect(session.answer(question, question.correctIndex, 300)).toBe(true);
    session.beginQuestion(400);
    expect(session.answer(question, 2, 700)).toBe(false);
    expect(session.score()).toBe(20);
    expect(session.lives()).toBe(2);
    expect(session.result()).toMatchObject({
      reason: 'completed',
      correct: 1,
      wrong: 1,
      answered: 2,
      bestCombo: 1,
      stars: 1,
    });
  });

  it('awards exactly 20 points and one star per correct scene answer', () => {
    const session = new GameSession('writing-treasure');
    const question = sampleQuestions[0];
    for (let index = 0; index < 5; index += 1) {
      session.beginQuestion(index * 100);
      session.answer(question, question.correctIndex, index * 100 + 50);
    }
    expect(session.stageResult()).toMatchObject({
      score: 100,
      correct: 5,
      stars: 5,
      bestCombo: 5,
    });
  });

  it.each([
    [0, 0, 0],
    [4, 80, 0],
    [5, 100, 1],
    [9, 180, 1],
    [10, 200, 2],
    [14, 280, 2],
    [15, 300, 3],
    [19, 380, 3],
    [20, 400, 4],
    [24, 480, 4],
    [25, 500, 5],
  ])(
    'awards all five campaign stars by completed 100-point bands: %i correct',
    (correctAnswers, score, stars) => {
      const session = new GameSession('writing-treasure');
      const question = sampleQuestions[0];
      const wrongIndex = (question.correctIndex + 1) % question.options.length;
      for (let index = 0; index < 25; index += 1) {
        session.beginQuestion(index * 100);
        session.answer(
          question,
          index < correctAnswers ? question.correctIndex : wrongIndex,
          index * 100 + 50,
        );
      }
      expect(session.result()).toMatchObject({ score, stars });
    },
  );

  it('preserves the controller finish reason in the result', () => {
    const session = new GameSession('writing-treasure');
    expect(session.result('timeout').reason).toBe('timeout');
  });

  it('requires all five scene questions even when lives reach zero', () => {
    const session = new GameSession('writing-treasure');
    const question = sampleQuestions[0];
    for (let index = 0; index < 3; index += 1) {
      session.beginQuestion(index * 100);
      session.answer(question, 2, index * 100 + 50);
    }
    expect(session.lives()).toBe(0);
    expect(session.answered()).toBe(3);
    expect(session.shouldFinish()).toBe(false);
    for (let index = 3; index < 5; index += 1) {
      session.beginQuestion(index * 100);
      session.answer(question, 2, index * 100 + 50);
    }
    expect(session.shouldFinish()).toBe(true);
    expect(session.stageResult()).toMatchObject({ wrong: 5, answered: 5 });
  });

  it('resets the scene while preserving campaign totals and lives', () => {
    const session = new GameSession('writing-treasure');
    const question = sampleQuestions[0];
    session.beginQuestion(100);
    session.answer(question, 2, 200);
    session.resetStage();
    expect(session.score()).toBe(0);
    expect(session.answered()).toBe(0);
    expect(session.combo()).toBe(0);
    expect(session.lives()).toBe(2);
    expect(session.stageResult()).toMatchObject({ correct: 0, wrong: 0, answered: 0 });
    expect(session.result()).toMatchObject({
      score: 0, correct: 0, wrong: 1, answered: 1,
    });
  });

  it('discards the current attempt when replaying the scene', () => {
    const session = new GameSession('writing-treasure');
    const question = sampleQuestions[0];
    session.beginQuestion(100);
    session.answer(question, question.correctIndex, 200);
    session.restartStage();
    expect(session.stageResult()).toMatchObject({ score: 0, answered: 0 });
    expect(session.result()).toMatchObject({ score: 0, answered: 0 });
    expect(session.lives()).toBe(3);
  });
});
