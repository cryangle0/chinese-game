import { GameResult } from '../../shared/types/GameTypes';
import { HostAdapter, HostEvent, HostEventType, LaunchContext } from './HostTypes';

export class HostMessenger {
  private exitSent = false;

  constructor(
    private readonly game: string,
    private readonly launch: LaunchContext,
    private readonly adapter: HostAdapter,
  ) {}

  ready(): void {
    this.send('game-ready', {
      channel: this.launch.channel,
      grade: this.launch.grade,
      host: this.launch.host,
    });
  }

  result(result: GameResult): void {
    this.send('game-result', {
      answered: result.answered,
      bestCombo: result.bestCombo,
      correct: result.correct,
      reason: result.reason,
      score: result.score,
      stars: result.stars,
      wrong: result.wrong,
    });
  }

  exit(reason: 'destroy' | 'pagehide' | 'user-close'): void {
    if (this.exitSent) return;
    this.exitSent = true;
    this.send('game-exit', { reason });
  }

  error(error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.send('game-error', { message });
  }

  private send<T>(type: HostEventType, payload: T): void {
    const event: HostEvent<T> = {
      activityId: this.launch.activityId,
      game: this.game,
      payload,
      sessionId: this.launch.sessionId,
      source: 'h5-game',
      timestamp: Date.now(),
      type,
      version: 1,
    };
    this.adapter.postToHost(event);
  }
}
