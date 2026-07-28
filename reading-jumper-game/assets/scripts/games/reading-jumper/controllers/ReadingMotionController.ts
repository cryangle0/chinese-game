import { GameServices } from '../../../services/GameServices';
import { CameraOverlayState } from '../../../platform/camera/CameraOverlay';
import { WebPoseInput } from '../../../platform/pose/WebPoseInput';
import { ReadingGameView } from '../views/ReadingGameView';

export type PosePlayMode = 'off' | 'intro' | 'play';
const ANSWER_POSE_SETTLE_MS = 600;

export class ReadingMotionController {
  private readonly input: WebPoseInput;
  private lastState: CameraOverlayState | null = null;
  private lastRunSoundAt = 0;
  private mode: PosePlayMode = 'off';
  private onIntroJump: (() => void) | null = null;

  constructor(
    private readonly view: ReadingGameView,
    private readonly services: GameServices,
    onChoose: (index: number) => void,
  ) {
    this.input = new WebPoseInput({
      onColumn: (column) => {
        if (this.mode !== 'play') return;
        this.view.bricks.setPoseSelection(column);
        if (this.view.deer.moveTo(column)) {
          const now = Date.now();
          if (now - this.lastRunSoundAt >= 1200) {
            this.lastRunSoundAt = now;
            this.services.audio.play('run');
          }
        }
      },
      onJump: (column) => {
        if (this.mode === 'intro') {
          this.onIntroJump?.();
          return;
        }
        if (this.mode === 'play') onChoose(column);
      },
      onState: (state, details) => this.onState(state, details),
    });
  }

  start(): void {
    void this.input.start();
  }

  /** Intro: jump starts game. Play: jump selects column. Off: ignore pose actions. */
  setMode(mode: PosePlayMode, onIntroJump?: () => void): void {
    this.mode = mode;
    this.onIntroJump = onIntroJump ?? null;
    if (mode === 'intro') {
      this.input.setInputEnabled(true);
      this.view.bricks.setPoseSelection(null);
      return;
    }
    if (mode === 'play') {
      this.input.setInputEnabled(true);
      return;
    }
    this.input.setInputEnabled(false);
    this.view.bricks.setPoseSelection(null);
  }

  setAnswerEnabled(enabled: boolean): void {
    if (this.mode === 'intro') return;
    this.mode = enabled ? 'play' : 'off';
    this.input.setInputEnabled(enabled, enabled ? ANSWER_POSE_SETTLE_MS : 0);
    if (!enabled) this.view.bricks.setPoseSelection(null);
  }

  setPaused(paused: boolean): void {
    this.input.setPaused(paused);
  }

  dispose(): void {
    this.input.dispose();
  }

  private onState(
    state: CameraOverlayState,
    details?: Readonly<Record<string, string | number>>,
  ): void {
    this.view.bricks.setPoseActive(this.mode === 'play' && state === 'ready');
    if (this.lastState === state && !details) return;
    this.lastState = state;
    this.services.analytics.track({
      name: `pose_${state}`,
      game: 'reading-jumper',
      properties: details,
    });
  }
}
