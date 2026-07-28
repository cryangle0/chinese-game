import { cameraFallbackLabel } from '../assets/scripts/platform/camera/CameraCapture';
import { AppConfig } from '../assets/scripts/shared/config/AppConfig';
import { GameResult } from '../assets/scripts/shared/types/GameTypes';
import { marioTheme } from '../assets/scripts/games/reading-jumper/config/ReadingTheme';
import { buildResultPosterModel } from '../assets/scripts/ui/results/ResultPoster';
import { resultReviewText } from '../assets/scripts/ui/results/ResultReviewText';

const perfectResult: GameResult = {
  game: 'reading-jumper',
  scene: 'mario',
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
    expect(buildResultPosterModel(perfectResult, marioTheme)).toEqual({
      answerSummary: '答对 5 / 5 题',
      fileName: 'reading-jumper-mario-100.png',
      gameTitle: '阅读跳跳乐成绩',
      sceneTitle: '超级玛丽',
      scoreText: '100 分',
      starsText: '★★★★★',
    });
  });

  it('keeps the full question and correct answer in the scrollable review row', () => {
    expect(resultReviewText(
      '《西游记》中，孙悟空自称什么？\n请结合原文作答',
      '齐天大圣',
    )).toBe('题目：《西游记》中，孙悟空自称什么？ 请结合原文作答  正确答案：齐天大圣');
  });

  it.each([
    ['NotAllowedError', '未获得摄像头权限', '系统设置'],
    ['NotReadableError', '其他应用占用', '重试'],
    ['NotFoundError', '未检测到可用摄像头', '检查设备'],
    ['camera-unavailable', '不支持体感摄像头', 'HTTPS'],
    ['pose-model-timeout', '模型加载超时', '检查网络'],
    ['pose-inference-failed', '识别连续失败', '保持全身入镜'],
  ])('explains camera fallback %s', (reason, problem, action) => {
    const message = cameraFallbackLabel(reason);
    expect(message).toContain(problem);
    expect(message).toContain(action);
    expect(message).toContain('点击选项作答');
  });
});
