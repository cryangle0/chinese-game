import { treasureTheme } from '../assets/scripts/games/writing-treasure/config/WritingTheme';
import { AppConfig } from '../assets/scripts/shared/config/AppConfig';
import { GameResult } from '../assets/scripts/shared/types/GameTypes';
import { buildResultPosterModel } from '../assets/scripts/ui/results/ResultPoster';
import { resultReviewText } from '../assets/scripts/ui/results/ResultReviewText';

const perfectResult: GameResult = {
  game: 'writing-treasure',
  scene: 'treasure',
  reason: 'completed',
  score: 100,
  correct: 5,
  wrong: 0,
  answered: 5,
  bestCombo: 5,
  stars: 5,
  answers: [],
};

describe('product feedback 2026-07-27', () => {
  it('uses five questions, 20 points each and a 180-second scene timer', () => {
    expect(AppConfig.maxQuestions).toBe(5);
    expect(AppConfig.scoreCorrect).toBe(20);
    expect(AppConfig.scoreWrong).toBe(0);
    expect(AppConfig.roundSeconds).toBe(180);
  });

  it('builds a complete local result poster model', () => {
    expect(buildResultPosterModel(perfectResult, treasureTheme)).toEqual({
      answerSummary: '答对 5 / 5 题',
      fileName: 'writing-treasure-treasure-100.png',
      gameTitle: '写作宝藏成绩',
      sceneTitle: '经典挖宝',
      scoreText: '100 分',
      starsText: '★★★★★',
    });
  });

  it('keeps the full question and correct answer in the scrollable review row', () => {
    expect(resultReviewText(
      '下面哪一项最适合作为人物动作描写？\n请选择完整答案',
      '他握紧拳头，快步冲向终点',
    )).toBe(
      '题目：下面哪一项最适合作为人物动作描写？ 请选择完整答案  '
      + '正确答案：他握紧拳头，快步冲向终点',
    );
  });
});
