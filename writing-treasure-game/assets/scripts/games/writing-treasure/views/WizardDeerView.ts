import { Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { DomMotionSprite } from '../../../core/media/DomMotionSprite';
import { createUiNode } from '../../../core/ui/UiFactory';
import { sceneCharacter } from '../../../shared/config/WritingSceneCharacter';
import { MotionAssets } from '../../../shared/types/Theme';

const InitialEntry = {
  startPadding: 24,
  durationSeconds: 1.18,
} as const;
const HORIZONTAL_RUN_PIXELS_PER_SECOND = 330;
const HORIZONTAL_RUN_MIN_SECONDS = 0.18;
const IDLE_BREATH_AMPLITUDE = 4;
const IDLE_BREATH_CYCLES_PER_SECOND = 0.42;

export class WizardDeerView {
  readonly root: Node;
  private readonly visual: Node;
  private readonly motion: DomMotionSprite;
  private idleAsset: string;
  private motionAssets?: MotionAssets;
  private actionColumnX = 0;
  private sceneId = 'treasure';
  private idleSeconds = 0;
  private breathing = false;

  constructor(
    parent: Node,
    idleAsset: string,
    private actionAsset: string,
    motionAssets?: MotionAssets,
    sceneId = 'treasure',
  ) {
    this.idleAsset = idleAsset;
    this.motionAssets = motionAssets;
    this.sceneId = sceneId;
    const idle = sceneCharacter(sceneId).idle;
    const [w, h] = idle.size;
    this.root = createUiNode(parent, 'WizardDeer', w, h, idle.position.clone());
    this.visual = createUiNode(this.root, 'WizardDeerFallback', w, h);
    this.motion = new DomMotionSprite(this.root, this.visual, w, h, {
      fit: 'contain',
      objectPosition: 'center bottom',
      pinFeet: true,
    });
    spriteLoader.apply(this.visual, idleAsset, 'contain');
    this.applyIdle(idle.position.x);
  }

  update(deltaSeconds: number): void {
    if (!this.breathing || !this.root.activeInHierarchy) return;
    this.idleSeconds += deltaSeconds;
    const offsetY = Math.sin(
      this.idleSeconds * Math.PI * 2 * IDLE_BREATH_CYCLES_PER_SECOND,
    ) * IDLE_BREATH_AMPLITUDE;
    this.visual.setPosition(0, offsetY, 0);
    if (typeof document !== 'undefined') {
      document.body.dataset.deerIdleBreathOffset = offsetY.toFixed(2);
    }
  }

  /**
   * Run to a chest column. `digHold` keeps the dig pose (`action.webp`) before `done`.
   * Both correct and wrong answers dig, then open/break the chest.
   */
  castAt(columnX: number, done: () => void, digHold = 0.9): void {
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    this.actionColumnX = columnX;
    const character = sceneCharacter(this.sceneId);
    const run = character.run;
    const startX = this.root.position.x;
    const travelDistance = Math.abs(columnX - startX);
    const travelSeconds = Math.max(
      HORIZONTAL_RUN_MIN_SECONDS,
      travelDistance / HORIZONTAL_RUN_PIXELS_PER_SECOND,
    );
    const runAsset = columnX < startX
      ? this.motionAssets?.runLeft ?? this.motionAssets?.action
      : this.motionAssets?.runRight ?? this.motionAssets?.action;
    let runStarted = false;
    this.motion.setPinFeet(true);
    this.motion.setFit('contain');
    if (typeof document !== 'undefined') {
      document.body.dataset.deerActionW = String(character.action.size[0]);
      document.body.dataset.deerActionH = String(character.action.size[1]);
      document.body.dataset.deerRunW = String(run.size[0]);
      document.body.dataset.deerRunH = String(run.size[1]);
      document.body.dataset.deerScene = this.sceneId;
      document.body.dataset.deerHorizontalRunDuration = travelSeconds.toFixed(3);
      document.body.dataset.deerHorizontalRunDistance = travelDistance.toFixed(1);
    }
    const startRun = (): void => {
      if (runStarted) return;
      runStarted = true;
      // Keep the correctly sized idle sprite visible until the run WebP is
      // decoded, then switch the box and motion in one browser frame.
      this.applyFrame(run.size[0], run.size[1]);
      this.root.setPosition(startX, run.position.y, 0);
      const move = tween(this.root)
        .to(travelSeconds, {
          position: new Vec3(columnX, run.position.y, 0),
          scale: Vec3.ONE,
        }, { easing: 'quadInOut' });
      if (digHold > 0) {
        move
          .call(() => this.applyActionPose(columnX))
          .delay(digHold)
          .call(done)
          .start();
      } else {
        move.call(done).start();
      }
    };
    if (!runAsset) {
      startRun();
      return;
    }
    this.motion.show(runAsset, true, false, {
      onReady: startRun,
      onError: () => {
        this.motion.hide();
        startRun();
      },
    });
  }

  idle(preserveColumn = false): void {
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const idle = sceneCharacter(this.sceneId).idle;
    const x = preserveColumn ? this.root.position.x : idle.position.x;
    this.applyIdle(x);
  }

  enterFromLeft(): Promise<void> {
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const character = sceneCharacter(this.sceneId);
    const idle = character.idle;
    const run = character.run;
    const runAsset = this.motionAssets?.runRight ?? this.motionAssets?.idle;
    const startX = -720 - run.size[0] / 2 - InitialEntry.startPadding;
    this.motion.setFit('contain');
    this.motion.setPinFeet(true);
    this.applyFrame(run.size[0], run.size[1]);
    this.root.active = true;
    this.root.setPosition(startX, run.position.y, 0);
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.visual.setPosition(Vec3.ZERO);
    spriteLoader.apply(this.visual, this.idleAsset, 'contain');
    if (typeof document !== 'undefined') {
      document.body.dataset.stageEntryActive = 'true';
      document.body.dataset.stageEntryStartX = String(startX);
      document.body.dataset.stageEntryTargetX = String(idle.position.x);
      document.body.dataset.stageEntryRunW = String(run.size[0]);
      document.body.dataset.stageEntryRunH = String(run.size[1]);
    }
    return new Promise((resolve) => {
      let entryStarted = false;
      const startEntry = (): void => {
        if (entryStarted) return;
        entryStarted = true;
        tween(this.root)
          .to(InitialEntry.durationSeconds, {
            position: new Vec3(idle.position.x, run.position.y, 0),
          }, { easing: 'quadOut' })
          .call(() => {
            this.applyIdle(idle.position.x);
            if (typeof document !== 'undefined') {
              delete document.body.dataset.stageEntryActive;
              document.body.dataset.stageEntryCompleted = 'true';
            }
            resolve();
          })
          .start();
      };
      if (!runAsset) {
        startEntry();
        return;
      }
      this.motion.show(runAsset, true, false, {
        onReady: startEntry,
        onError: () => {
          this.motion.hide();
          startEntry();
        },
      });
    });
  }

  hide(): void {
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    this.motion.hide();
    this.root.active = false;
  }

  setTheme(
    idleAsset: string,
    actionAsset: string,
    motionAssets?: MotionAssets,
    sceneId = 'treasure',
  ): void {
    this.idleAsset = idleAsset;
    this.actionAsset = actionAsset;
    this.motionAssets = motionAssets;
    this.sceneId = sceneId;
    this.idle();
  }

  strike(done: () => void): void {
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    this.applyActionPose(this.actionColumnX);
    tween(this.root)
      .by(0.1, { angle: -6 })
      .by(0.12, { angle: 12 })
      .by(0.1, { angle: -6 })
      .call(done)
      .start();
  }

  dispose(): void {
    this.motion.dispose();
  }

  private applyFrame(width: number, height: number): void {
    this.root.getComponent(UITransform)?.setContentSize(width, height);
    this.visual.getComponent(UITransform)?.setContentSize(width, height);
    this.motion.resize(width, height);
  }

  private applyIdle(x: number): void {
    const idle = sceneCharacter(this.sceneId).idle;
    this.motion.hide();
    this.motion.setFit('contain');
    this.motion.setPinFeet(true);
    this.applyFrame(idle.size[0], idle.size[1]);
    this.root.active = true;
    this.root.setPosition(x, idle.position.y, 0);
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    spriteLoader.apply(this.visual, this.idleAsset, 'contain');
    this.idleSeconds = 0;
    this.breathing = true;
    if (typeof document !== 'undefined') {
      document.body.dataset.deerIdleMode = 'breathing-static';
      document.body.dataset.deerIdleBreathOffset = '0.00';
    }
  }

  private stopBreathing(): void {
    this.breathing = false;
    this.visual.setPosition(Vec3.ZERO);
    if (typeof document !== 'undefined') {
      delete document.body.dataset.deerIdleMode;
      delete document.body.dataset.deerIdleBreathOffset;
    }
  }

  private applyActionPose(columnX: number): void {
    const action = sceneCharacter(this.sceneId).action;
    this.motion.setPinFeet(false);
    this.motion.setFit('contain');
    this.applyFrame(action.size[0], action.size[1]);
    this.root.setPosition(columnX, action.position.y);
    spriteLoader.apply(this.visual, this.actionAsset, 'contain');
    this.motion.show(this.motionAssets?.action, true);
  }
}
