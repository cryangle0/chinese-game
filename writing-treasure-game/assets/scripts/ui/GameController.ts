import { Node } from 'cc';
import { DifficultyTier, Grade } from '../shared/types/GameTypes';
import { ChineseQuestion } from '../shared/types/Question';

export interface GameLaunchOptions {
  grade: Grade;
  initialScene?: string;
  skipIntro?: boolean;
  term?: ChineseQuestion['term'];
  difficulties?: readonly DifficultyTier[];
  /** Selected cover book → QuestionFilter.knowledgePoint. */
  knowledgePoint?: string;
}

export interface GameController {
  readonly root: Node;
  update(deltaSeconds: number): void;
  setPaused(paused: boolean): void;
  dispose(): void;
}
