import { ChineseQuestion } from '../shared/types/Question';

export class QuestionCursor {
  private index = 0;

  constructor(private readonly questions: readonly ChineseQuestion[]) {}

  next(): ChineseQuestion | null {
    if (!this.questions.length) return null;
    const question = this.questions[this.index % this.questions.length];
    this.index += 1;
    return question;
  }

  consumed(): number {
    return this.index;
  }
}

