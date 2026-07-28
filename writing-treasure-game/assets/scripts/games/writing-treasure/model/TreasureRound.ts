import { GamePhase } from '../../../shared/types/GameTypes';
import { StateMachine } from '../../../core/state/StateMachine';

const transitions: Readonly<Record<GamePhase, readonly GamePhase[]>> = {
  idle: ['ready'],
  ready: ['awaiting-answer', 'finished'],
  'awaiting-answer': ['awaiting-action', 'finished'],
  'awaiting-action': ['feedback', 'finished'],
  feedback: ['transition', 'finished'],
  transition: ['awaiting-answer', 'finished'],
  finished: [],
};

export class TreasureRound {
  readonly state = new StateMachine<GamePhase>('idle', transitions);

  begin(): void {
    this.state.enter('ready');
    this.state.enter('awaiting-answer');
  }

  acceptAnswer(): boolean {
    if (this.state.current() !== 'awaiting-answer') return false;
    this.state.enter('awaiting-action');
    return true;
  }

  acceptAction(): boolean {
    return this.state.current() === 'awaiting-action';
  }

  completeAction(): void {
    this.state.enter('feedback');
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
