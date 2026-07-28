import { Node } from 'cc';
import { TaskScope } from '../../../core/lifecycle/TaskScope';
import { stopTweensRecursively } from '../../../core/lifecycle/TweenCleanup';
import { GameSession } from '../../../services/GameSession';
import { GameServices } from '../../../services/GameServices';
import { RoundTimer } from '../../../services/RoundTimer';
import { FinishReason, GameResult } from '../../../shared/types/GameTypes';
import { ReadingRound } from '../model/ReadingRound';

export class ReadingCompletionController {
  constructor(
    private readonly root: Node,
    private readonly scope: TaskScope,
    private readonly round: ReadingRound,
    private readonly timer: RoundTimer,
    private readonly session: GameSession,
    private readonly services: GameServices,
    private readonly currentScene: () => string,
    private readonly onFinish: (result: GameResult) => void,
  ) {}

  finish(reason: FinishReason): void {
    if (!this.scope.isActive() || this.round.state.current() === 'finished') return;
    this.scope.cancelPending();
    stopTweensRecursively(this.root);
    this.round.finish();
    this.timer.stop();
    if (reason === 'completed') this.services.audio.play('firework');
    const result = { ...this.session.result(reason), scene: this.currentScene() };
    this.services.analytics.track({
      name: 'game_end',
      game: 'reading-jumper',
      properties: { reason, score: result.score },
    });
    this.onFinish(result);
  }

  fail(error: unknown): void {
    console.error('[reading-jumper] game failed', error);
    this.services.analytics.track({
      name: 'game_error',
      game: 'reading-jumper',
      properties: { message: error instanceof Error ? error.message : String(error) },
    });
    this.finish('error');
  }
}
