export type GameId = 'reading-jumper';

export type Grade = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6' | 'ALL';

export type DifficultyTier = 'basic' | 'advanced' | 'challenge';

export type GamePhase =
  | 'idle'
  | 'ready'
  | 'awaiting-answer'
  | 'awaiting-action'
  | 'feedback'
  | 'transition'
  | 'finished';

export type FinishReason = 'completed' | 'lives' | 'timeout' | 'empty' | 'error' | 'exit';

export interface ResultAnswer {
  questionId: string;
  stem: string;
  selected: string;
  correctAnswer: string;
  correct: boolean;
  explain?: string;
  knowledgePoint?: string;
}

export interface GameResult {
  game: GameId;
  scene?: string;
  reason: FinishReason;
  score: number;
  correct: number;
  wrong: number;
  answered: number;
  bestCombo: number;
  stars: 0 | 1 | 2 | 3 | 4 | 5;
  answers: readonly ResultAnswer[];
}
