import { DifficultyTier, GameId, Grade } from './GameTypes';

export interface ChineseQuestion {
  id: string;
  packId: string;
  games: readonly GameId[];
  scenes: readonly string[];
  grade: Grade;
  term: 'first' | 'second' | 'ALL';
  difficulty: DifficultyTier;
  type: string;
  knowledgePoint: string;
  stemType: 'text' | 'image-text';
  stem: string;
  stemImageUrl?: string;
  options: readonly [string, string, string];
  correctIndex: 0 | 1 | 2;
  explain?: string;
  correctFeedback?: string;
  wrongFeedback?: string;
  source?: string;
  enabled: boolean;
  weight: number;
}

export interface QuestionFilter {
  game: GameId;
  scene: string;
  grade: Grade;
  term?: ChineseQuestion['term'];
  difficulties?: readonly DifficultyTier[];
  /** Cover book selection — matches question.knowledgePoint. */
  knowledgePoint?: string;
}

export interface AnswerRecord {
  questionId: string;
  selectedIndex: number;
  correct: boolean;
  elapsedMs: number;
  scoreAwarded: number;
  combo: number;
}
