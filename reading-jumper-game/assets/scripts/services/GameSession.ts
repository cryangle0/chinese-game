import { AppConfig } from '../shared/config/AppConfig';
import { AnswerRecord, ChineseQuestion } from '../shared/types/Question';
import { FinishReason, GameId, GameResult } from '../shared/types/GameTypes';

export class GameSession {
  private stageScoreValue: number = 0;
  private totalScoreValue: number = 0;
  private livesValue: number = AppConfig.startingLives;
  private stageStartLivesValue: number = AppConfig.startingLives;
  private readonly stageRecords: AnswerRecord[] = [];
  private readonly totalRecords: AnswerRecord[] = [];
  private readonly questions = new Map<string, ChineseQuestion>();
  private questionStartedAt = 0;
  private comboValue = 0;
  private stageBestComboValue = 0;
  private totalBestComboValue = 0;

  constructor(readonly game: GameId) {}

  beginQuestion(now = Date.now()): void {
    this.questionStartedAt = now;
  }

  answer(question: ChineseQuestion, selectedIndex: number, now = Date.now()): boolean {
    const correct = selectedIndex === question.correctIndex;
    this.questions.set(question.id, question);
    if (correct) {
      this.comboValue += 1;
      this.stageBestComboValue = Math.max(this.stageBestComboValue, this.comboValue);
      this.totalBestComboValue = Math.max(this.totalBestComboValue, this.comboValue);
    } else {
      this.comboValue = 0;
      this.livesValue = Math.max(0, this.livesValue - 1);
    }
    const bonus = correct
      ? Math.min(AppConfig.maxComboBonus, Math.max(0, this.comboValue - 1) * AppConfig.comboBonus)
      : 0;
    const scoreAwarded = correct ? AppConfig.scoreCorrect + bonus : AppConfig.scoreWrong;
    this.stageScoreValue += scoreAwarded;
    this.totalScoreValue += scoreAwarded;
    const record = {
      questionId: question.id,
      selectedIndex,
      correct,
      elapsedMs: Math.max(0, now - this.questionStartedAt),
      scoreAwarded,
      combo: this.comboValue,
    };
    this.stageRecords.push(record);
    this.totalRecords.push(record);
    return correct;
  }

  shouldFinish(): boolean {
    return this.stageRecords.length >= AppConfig.maxQuestions;
  }

  score(): number {
    return this.stageScoreValue;
  }

  lives(): number {
    return this.livesValue;
  }

  combo(): number {
    return this.comboValue;
  }

  answered(): number {
    return this.stageRecords.length;
  }

  resetStage(): void {
    this.clearStage();
    this.stageStartLivesValue = this.livesValue;
  }

  restartStage(): void {
    const answered = this.stageRecords.length;
    this.totalScoreValue = Math.max(0, this.totalScoreValue - this.stageScoreValue);
    if (answered > 0) this.totalRecords.splice(-answered, answered);
    this.totalBestComboValue = this.totalRecords.reduce(
      (best, record) => Math.max(best, record.combo),
      0,
    );
    this.livesValue = this.stageStartLivesValue;
    this.clearStage();
  }

  private clearStage(): void {
    this.stageScoreValue = 0;
    this.stageRecords.length = 0;
    this.questionStartedAt = 0;
    this.comboValue = 0;
    this.stageBestComboValue = 0;
  }

  stageResult(reason: FinishReason = 'completed'): GameResult {
    return this.buildResult(
      this.stageScoreValue, this.stageRecords, this.stageBestComboValue, reason,
    );
  }

  result(reason: FinishReason = 'completed'): GameResult {
    return this.buildResult(
      this.totalScoreValue, this.totalRecords, this.totalBestComboValue, reason,
    );
  }

  private buildResult(
    score: number,
    records: readonly AnswerRecord[],
    bestCombo: number,
    reason: FinishReason,
  ): GameResult {
    const correct = records.filter((record) => record.correct).length;
    const pointsPerCampaignStar = AppConfig.scoreCorrect * AppConfig.maxQuestions;
    const stars = Math.max(0, Math.min(
      AppConfig.maxQuestions,
      records.length <= AppConfig.maxQuestions
        ? correct
        : Math.floor(score / pointsPerCampaignStar),
    )) as GameResult['stars'];
    return {
      game: this.game,
      reason,
      score,
      correct,
      wrong: records.length - correct,
      answered: records.length,
      bestCombo,
      stars,
      answers: records.map((record) => {
        const question = this.questions.get(record.questionId);
        return {
          questionId: record.questionId,
          stem: question?.stem ?? record.questionId,
          selected: question?.options[record.selectedIndex] ?? '',
          correctAnswer: question?.options[question.correctIndex] ?? '',
          correct: record.correct,
          explain: question?.explain,
          knowledgePoint: question?.knowledgePoint,
        };
      }),
    };
  }
}
