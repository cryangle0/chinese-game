import { normalizeChineseTypography } from '../../shared/config/ChineseTextWrap';

export function resultReviewText(stem: string, correctAnswer: string): string {
  const question = normalizeChineseTypography(stem.replace(/\s+/g, ' ').trim());
  const answer = normalizeChineseTypography(correctAnswer.replace(/\s+/g, ' ').trim());
  return `题目：${question}  正确答案：${answer}`;
}
