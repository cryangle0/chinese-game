import { DifficultyTier, GameId, Grade } from '../shared/types/GameTypes';
import { ChineseQuestion } from '../shared/types/Question';

export interface QuestionPack {
  version: string;
  questions: readonly ChineseQuestion[];
}

const games: readonly GameId[] = ['writing-treasure'];
const grades: readonly Grade[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'ALL'];
const terms: readonly ChineseQuestion['term'][] = ['first', 'second', 'ALL'];
const difficulties: readonly DifficultyTier[] = ['basic', 'advanced', 'challenge'];
const stemTypes: readonly ChineseQuestion['stemType'][] = ['text', 'image-text'];

function hasStrings(value: unknown, expectedLength?: number): value is string[] {
  return Array.isArray(value)
    && (expectedLength == null || value.length === expectedLength)
    && value.every((item) => typeof item === 'string' && item.trim().length > 0);
}

function isQuestion(value: unknown): value is ChineseQuestion {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ChineseQuestion>;
  return hasIdentity(item)
    && hasScope(item)
    && hasContent(item)
    && hasAnswer(item)
    && hasControls(item);
}

function hasIdentity(item: Partial<ChineseQuestion>): boolean {
  return typeof item.id === 'string' && item.id.length > 0
    && typeof item.packId === 'string';
}

function hasScope(item: Partial<ChineseQuestion>): boolean {
  return hasStrings(item.games) && item.games.every((game) => games.includes(game as GameId))
    && hasStrings(item.scenes)
    && grades.includes(item.grade as Grade)
    && terms.includes(item.term as ChineseQuestion['term'])
    && difficulties.includes(item.difficulty as DifficultyTier);
}

function hasContent(item: Partial<ChineseQuestion>): boolean {
  const imageIsValid = item.stemType !== 'image-text'
    || (typeof item.stemImageUrl === 'string' && item.stemImageUrl.length > 0);
  return stemTypes.includes(item.stemType as ChineseQuestion['stemType'])
    && typeof item.type === 'string'
    && typeof item.knowledgePoint === 'string'
    && typeof item.stem === 'string' && item.stem.length > 0 && item.stem.length <= 80
    && imageIsValid;
}

function hasAnswer(item: Partial<ChineseQuestion>): boolean {
  return hasStrings(item.options, 3) && item.options.every((option) => option.length <= 20)
    && Number.isInteger(item.correctIndex)
    && Number(item.correctIndex) >= 0
    && Number(item.correctIndex) <= 2;
}

function hasControls(item: Partial<ChineseQuestion>): boolean {
  return typeof item.enabled === 'boolean'
    && typeof item.weight === 'number'
    && Number.isFinite(item.weight)
    && item.weight >= 0;
}

export function parseQuestionPack(value: unknown): QuestionPack | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<QuestionPack>;
  if (typeof candidate.version !== 'string' || !candidate.version.trim()) return null;
  if (!Array.isArray(candidate.questions) || !candidate.questions.every(isQuestion)) return null;
  const ids = new Set(candidate.questions.map((question) => question.id));
  return ids.size === candidate.questions.length ? candidate as QuestionPack : null;
}
