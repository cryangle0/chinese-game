import { AppConfig } from '../shared/config/AppConfig';

export type StageOutcome =
  | 'next-question'
  | 'stage-result';

export function stageOutcome(answered: number): StageOutcome {
  if (answered < AppConfig.maxQuestions) return 'next-question';
  return 'stage-result';
}

export function stageResultActions(isFinal: boolean): {
  readonly replay: string;
  readonly proceed: string;
} {
  return {
    replay: '再玩一次',
    proceed: isFinal ? '查看总成绩' : '进入下一关',
  };
}
