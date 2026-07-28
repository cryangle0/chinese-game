import { ChineseQuestion, QuestionFilter } from '../shared/types/Question';
import { AppConfig } from '../shared/config/AppConfig';
import { QuestionCursor } from './QuestionCursor';

function weightedOrder(
  source: readonly ChineseQuestion[],
  random: () => number,
): ChineseQuestion[] {
  return source
    .map((question) => ({
      question,
      key: -Math.log(Math.max(Number.EPSILON, random())) / (question.weight + 1),
    }))
    .sort((left, right) => left.key - right.key)
    .map(({ question }) => question);
}

export class QuestionBank {
  private readonly questions: readonly ChineseQuestion[];

  constructor(questions: readonly ChineseQuestion[]) {
    this.questions = questions.filter((question) => question.enabled);
  }

  createCursor(
    filter: QuestionFilter,
    random: () => number = Math.random,
    excludedIds: ReadonlySet<string> = new Set(),
  ): QuestionCursor {
    const common = (
      question: ChineseQuestion,
      enforceDifficulty = true,
      enforceGrade = true,
    ) =>
      question.games.includes(filter.game)
      && (!enforceGrade
        || question.grade === filter.grade
        || question.grade === 'ALL')
      && (!filter.term || filter.term === 'ALL'
        || question.term === filter.term || question.term === 'ALL')
      && (!enforceDifficulty || !filter.difficulties?.length
        || filter.difficulties.includes(question.difficulty))
      && (!filter.knowledgePoint
        || question.knowledgePoint === filter.knowledgePoint);
    const selectPool = (enforceDifficulty: boolean, enforceGrade: boolean) => {
      const scoped = this.questions.filter((question) =>
        common(question, enforceDifficulty, enforceGrade)
        && question.scenes.includes(filter.scene),
      );
      const generic = this.questions.filter((question) =>
        common(question, enforceDifficulty, enforceGrade)
        && question.scenes.includes('*'),
      );
      return scoped.length ? scoped : generic;
    };
    const pick = (enforceGrade: boolean) => {
      const exact = selectPool(true, enforceGrade);
      return exact.length >= AppConfig.maxQuestions
        ? exact
        : selectPool(false, enforceGrade);
    };
    // Prefer launch grade; cover books are often single-grade (e.g. 西游记=L5),
    // so widen grade while keeping knowledgePoint when the exact pool is empty.
    let pool = pick(true);
    if (!pool.length && filter.knowledgePoint) pool = pick(false);
    if (!pool.length) {
      const book = filter.knowledgePoint ? `/book=${filter.knowledgePoint}` : '';
      throw new Error(`no questions for ${filter.game}/${filter.scene}/${filter.grade}${book}`);
    }
    const unused = pool.filter((question) => !excludedIds.has(question.id));
    return new QuestionCursor(weightedOrder(unused.length ? unused : pool, random));
  }
}
