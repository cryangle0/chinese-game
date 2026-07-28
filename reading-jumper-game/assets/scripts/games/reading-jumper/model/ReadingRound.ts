import { GamePhase } from '../../../shared/types/GameTypes';
import { StateMachine } from '../../../core/state/StateMachine';

const transitions: Readonly<Record<GamePhase, readonly GamePhase[]>> = {
  idle: ['ready'],
  ready: ['awaiting-answer', 'finished'],
  'awaiting-answer': ['feedback', 'finished'],
  'awaiting-action': ['finished'],
  feedback: ['transition', 'finished'],
  transition: ['awaiting-answer', 'finished'],
  finished: [],
};

export class ReadingRound {
  readonly state = new StateMachine<GamePhase>('idle', transitions);

  begin(): void {
    this.state.enter('ready');
    this.state.enter('awaiting-answer');
  }

  acceptAnswer(): boolean {
    if (this.state.current() !== 'awaiting-answer') return false;
    this.state.enter('feedback');
    return true;
  }

  prepareNext(): void {
    this.state.enter('transition');
  }

  next(): void {
    this.state.enter('awaiting-answer');
  }

  restartStage(): void {
    this.state.force('awaiting-answer');
  }

  finish(): void {
    this.state.force('finished');
  }
}
