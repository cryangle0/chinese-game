import { Node, Tween, tween, UITransform, Vec3 } from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { feedbackDurationMs } from '../../../core/media/MotionPlayback';
import {
  DomMotionSprite,
  prefetchMotion,
} from '../../../core/media/DomMotionSprite';
import { createUiNode } from '../../../core/ui/UiFactory';
import { CLASSIC_TREASURE_FEEDBACK } from '../../../shared/config/ClassicTreasureFeedback';
import { DESERT_TREASURE_FEEDBACK } from '../../../shared/config/DesertTreasureFeedback';
import {
  DINOSAUR_TREASURE_FEEDBACK,
  dinosaurWrongChaseDurationMs,
  dinosaurWrongReturnDurationMs,
} from '../../../shared/config/DinosaurTreasureFeedback';
import { DUNHUANG_TREASURE_FEEDBACK } from '../../../shared/config/DunhuangTreasureFeedback';
import { MAGIC_ACADEMY_FEEDBACK } from '../../../shared/config/MagicAcademyFeedback';
import { writingPlaySceneLayout } from '../../../shared/config/WritingPlaySceneLayout';
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

function waitForVisualCommit(): Promise<void> {
  if (typeof requestAnimationFrame !== 'function') return Promise.resolve();
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

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
    private wrongFeedbackAsset = '',
  ) {
    this.idleAsset = idleAsset;
    this.motionAssets = motionAssets;
    this.sceneId = sceneId;
    if (sceneId === 'magic') {
      prefetchMotion(MAGIC_ACADEMY_FEEDBACK.wrongActorAsset);
    }
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
  castAt(
    columnX: number,
    done: () => void,
    digHold = 0.9,
    onDigStart?: () => void,
  ): void {
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
        let digStarted = false;
        const beginDigHold = (): void => {
          if (digStarted) return;
          digStarted = true;
          onDigStart?.();
          tween(this.root)
            .delay(digHold)
            .call(done)
            .start();
        };
        move
          .call(() => {
            if (this.sceneId === 'treasure') {
              this.applyActionPose(columnX, beginDigHold);
              return;
            }
            this.applyActionPose(columnX);
            beginDigHold();
          })
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

  async sinkToClassicTreasureChest(columnX: number): Promise<void> {
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const idle = sceneCharacter(this.sceneId).idle;
    const layout = writingPlaySceneLayout(this.sceneId);
    const chestTopY = layout.choice.y + layout.chest.localY + layout.chest.height / 2;
    const targetY = chestTopY
      + idle.size[1] / 2
      + CLASSIC_TREASURE_FEEDBACK.actorChestInsetY;
    const startY = targetY - CLASSIC_TREASURE_FEEDBACK.actorSinkOffsetY;
    this.applyFrame(idle.size[0], idle.size[1]);
    this.root.active = true;
    this.root.setPosition(columnX, startY, 0);
    this.root.setScale(1.08, 1.08, 1);
    this.root.angle = 0;
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    await spriteLoader.applyReady(this.visual, this.idleAsset, 'contain');
    if (!this.root.isValid) return;
    await waitForVisualCommit();
    if (!this.root.isValid) return;
    this.motion.hide();
    this.motion.setPinFeet(false);
    if (typeof document !== 'undefined') {
      document.body.dataset.classicTreasureActorPhase = 'sinking-to-chest';
      document.body.dataset.classicTreasureActorStartY = startY.toFixed(2);
      document.body.dataset.classicTreasureActorTargetY = targetY.toFixed(2);
    }
    return new Promise((resolve) => {
      tween(this.root)
        .to(CLASSIC_TREASURE_FEEDBACK.actorSinkMs / 1000, {
          position: new Vec3(columnX, targetY, 0),
          scale: Vec3.ONE,
        }, { easing: 'quadInOut' })
        .call(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.classicTreasureActorPhase = 'on-chest';
          }
          resolve();
        })
        .start();
    });
  }

  async dropToDesertTreasureChest(columnX: number): Promise<void> {
    if (this.sceneId !== 'desert') return;
    const idle = sceneCharacter(this.sceneId).idle;
    const layout = writingPlaySceneLayout(this.sceneId);
    const chestTopY = layout.choice.y + layout.chest.localY + layout.chest.height / 2;
    const targetY = chestTopY
      + idle.size[1] / 2
      + DESERT_TREASURE_FEEDBACK.actorChestInsetY;
    return this.dropDesertActor(
      columnX,
      targetY,
      'dropping-to-chest',
      'standing-on-chest',
    );
  }

  async dropToDesertTreasurePit(columnX: number): Promise<void> {
    if (this.sceneId !== 'desert') return;
    const idle = sceneCharacter(this.sceneId).idle;
    const layout = writingPlaySceneLayout(this.sceneId);
    const sarcophagusCenterY =
      layout.choice.y + DESERT_TREASURE_FEEDBACK.wrongSarcophagusBottomY;
    const targetY = sarcophagusCenterY
      + idle.size[1] / 2
      + DESERT_TREASURE_FEEDBACK.wrongActorSarcophagusInsetY;
    return this.dropDesertActor(
      columnX,
      targetY,
      'dropping-to-pit-bottom',
      'at-pit-bottom',
    );
  }

  async jumpIntoDinosaurPit(columnX: number): Promise<void> {
    if (this.sceneId !== 'dinosaur') return;
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const idle = sceneCharacter(this.sceneId).idle;
    const startY = idle.position.y;
    const apexY = startY + DINOSAUR_TREASURE_FEEDBACK.actorJumpLiftY;
    const targetX =
      columnX + DINOSAUR_TREASURE_FEEDBACK.correctActorPitOffsetX;
    const targetY = DINOSAUR_TREASURE_FEEDBACK.correctActorPitY;
    this.applyFrame(idle.size[0], idle.size[1]);
    this.root.active = true;
    this.root.setPosition(columnX, startY, 0);
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    await spriteLoader.applyReady(this.visual, this.idleAsset, 'contain');
    if (!this.root.isValid) return;
    await waitForVisualCommit();
    if (!this.root.isValid) return;
    this.motion.hide();
    this.motion.setPinFeet(false);
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureActorPhase = 'jumping-up';
      document.body.dataset.dinosaurTreasureActorStartY = startY.toFixed(2);
      document.body.dataset.dinosaurTreasureActorApexY = apexY.toFixed(2);
      document.body.dataset.dinosaurTreasureActorTargetY = targetY.toFixed(2);
    }
    return new Promise((resolve) => {
      tween(this.root)
        .to(DINOSAUR_TREASURE_FEEDBACK.actorJumpUpMs / 1000, {
          position: new Vec3(columnX, apexY, 0),
          scale: new Vec3(1.04, 1.04, 1),
        }, { easing: 'quadOut' })
        .call(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureActorPhase =
              'dropping-into-pit';
          }
        })
        .to(DINOSAUR_TREASURE_FEEDBACK.actorDropMs / 1000, {
          position: new Vec3(targetX, targetY, 0),
          scale: Vec3.ONE,
        }, { easing: 'quadIn' })
        .call(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureActorPhase =
              'at-pit-bottom';
          }
          resolve();
        })
        .start();
    });
  }

  async jumpIntoDinosaurWrongPit(columnX: number): Promise<void> {
    if (this.sceneId !== 'dinosaur') return;
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const idle = sceneCharacter(this.sceneId).idle;
    const startY = idle.position.y;
    const apexY = startY + DINOSAUR_TREASURE_FEEDBACK.actorJumpLiftY;
    const targetX =
      columnX + DINOSAUR_TREASURE_FEEDBACK.wrongActorPitOffsetX;
    const targetY = DINOSAUR_TREASURE_FEEDBACK.actorPitY;
    this.applyFrame(idle.size[0], idle.size[1]);
    this.root.active = true;
    this.root.setPosition(columnX, startY, 0);
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    await spriteLoader.applyReady(this.visual, this.idleAsset, 'contain');
    if (!this.root.isValid) return;
    await waitForVisualCommit();
    if (!this.root.isValid) return;
    this.motion.hide();
    this.motion.setPinFeet(false);
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureActorPhase =
        'wrong-jumping-up-before-pit';
      document.body.dataset.dinosaurTreasureActorStartY = startY.toFixed(2);
      document.body.dataset.dinosaurTreasureActorApexY = apexY.toFixed(2);
      document.body.dataset.dinosaurTreasureActorTargetY = targetY.toFixed(2);
    }
    return new Promise((resolve) => {
      tween(this.root)
        .to(DINOSAUR_TREASURE_FEEDBACK.actorJumpUpMs / 1000, {
          position: new Vec3(columnX, apexY, 0),
          scale: Vec3.ONE,
        }, { easing: 'quadOut' })
        .call(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureActorPhase =
              'wrong-dropping-beside-egg';
          }
        })
        .to(DINOSAUR_TREASURE_FEEDBACK.actorDropMs / 1000, {
          position: new Vec3(targetX, targetY, 0),
          scale: Vec3.ONE,
        }, { easing: 'quadIn' })
        .call(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureActorPhase =
              'watching-egg-at-pit-bottom';
          }
          resolve();
        })
        .start();
    });
  }

  escapeFromDinosaurWrongPit(columnX: number): Promise<void> {
    if (this.sceneId !== 'dinosaur') return Promise.resolve();
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const character = sceneCharacter(this.sceneId);
    const idle = character.idle;
    const run = character.run;
    const runAsset = this.motionAssets?.runRight;
    const pitFloorY =
      DINOSAUR_TREASURE_FEEDBACK.actorPitY - idle.size[1] / 2;
    const startX = this.root.position.x;
    this.motion.setFit('contain');
    this.motion.setPinFeet(true);
    this.root.active = true;
    this.root.angle = 0;
    this.root.setScale(Vec3.ONE);
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureActorPhase =
        'startled-loading-run-pose';
    }
    return new Promise((resolve) => {
      let started = false;
      const startEscape = (useRunMotion: boolean): void => {
        if (started || !this.root.isValid) return;
        started = true;
        const frame = useRunMotion ? run : idle;
        const startY = pitFloorY + frame.size[1] / 2;
        const targetY = frame.position.y;
        const apexY = targetY
          + DINOSAUR_TREASURE_FEEDBACK.wrongActorEscapeApexLiftY;
        this.applyFrame(frame.size[0], frame.size[1]);
        this.root.setPosition(startX, startY, 0);
        if (typeof document !== 'undefined') {
          document.body.dataset.dinosaurTreasureActorPhase =
            'startled-jumping-out-first';
          document.body.dataset.dinosaurTreasureActorStartY =
            startY.toFixed(2);
          document.body.dataset.dinosaurTreasureActorApexY =
            apexY.toFixed(2);
          document.body.dataset.dinosaurTreasureActorTargetY =
            targetY.toFixed(2);
        }
        tween(this.root)
          .to(DINOSAUR_TREASURE_FEEDBACK.wrongActorEscapeUpMs / 1000, {
            position: new Vec3(columnX + 24, apexY, 0),
            scale: Vec3.ONE,
            angle: -3,
          }, { easing: 'quadOut' })
          .call(() => {
            if (typeof document !== 'undefined') {
              document.body.dataset.dinosaurTreasureActorPhase =
                'escaping-down-to-ground';
            }
          })
          .to(DINOSAUR_TREASURE_FEEDBACK.wrongActorEscapeDownMs / 1000, {
            position: new Vec3(columnX, targetY, 0),
            scale: Vec3.ONE,
            angle: 0,
          }, { easing: 'quadIn' })
          .call(() => {
            if (typeof document !== 'undefined') {
              document.body.dataset.dinosaurTreasureActorPhase =
                'running-on-ground-awaiting-chase';
            }
            resolve();
          })
          .start();
      };
      if (!runAsset) {
        this.motion.hide();
        startEscape(false);
        return;
      }
      this.motion.show(runAsset, true, false, {
        onReady: () => startEscape(true),
        onError: () => {
          this.motion.hide();
          this.visual.active = true;
          spriteLoader.apply(this.visual, this.idleAsset, 'contain');
          startEscape(false);
        },
      });
    });
  }

  chaseDinosaurTreasureWrongActor(columnX: number): Promise<void> {
    if (this.sceneId !== 'dinosaur') return Promise.resolve();
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const startX = this.root.position.x;
    const groundY = this.root.position.y;
    const durationMs = dinosaurWrongChaseDurationMs(startX);
    this.root.active = true;
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureActorPhase =
        'same-scene-chasing-right';
      document.body.dataset.dinosaurTreasureActorStartX = startX.toFixed(2);
      document.body.dataset.dinosaurTreasureActorTargetX =
        DINOSAUR_TREASURE_FEEDBACK.wrongActorChaseEndX.toFixed(2);
      document.body.dataset.dinosaurTreasureActorChaseDurationMs =
        durationMs.toFixed(2);
      document.body.dataset.dinosaurTreasureActorChaseColumnX =
        columnX.toFixed(2);
    }
    return new Promise((resolve) => {
      tween(this.root)
        .to(durationMs / 1000, {
          position: new Vec3(
            DINOSAUR_TREASURE_FEEDBACK.wrongActorChaseEndX,
            groundY,
            0,
          ),
          scale: Vec3.ONE,
          angle: 0,
        }, { easing: 'linear' })
        .call(() => {
          this.root.setScale(Vec3.ONE);
          this.root.angle = 0;
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureActorPhase =
              'escaped-right-edge';
          }
          resolve();
        })
        .start();
    });
  }

  returnDinosaurTreasureWrongActor(columnX: number): Promise<void> {
    if (this.sceneId !== 'dinosaur') return Promise.resolve();
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const character = sceneCharacter(this.sceneId);
    const idle = character.idle;
    const run = character.run;
    const runAsset = this.motionAssets?.runLeft;
    const startX = this.root.position.x;
    const durationMs = dinosaurWrongReturnDurationMs(columnX);
    this.motion.setFit('contain');
    this.motion.setPinFeet(true);
    this.root.active = true;
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureActorPhase =
        'loading-return-run-pose';
      document.body.dataset.dinosaurTreasureActorReturnStartX =
        startX.toFixed(2);
      document.body.dataset.dinosaurTreasureActorReturnTargetX =
        columnX.toFixed(2);
      document.body.dataset.dinosaurTreasureActorReturnDurationMs =
        durationMs.toFixed(2);
    }
    return new Promise((resolve) => {
      let started = false;
      const startReturn = (useRunMotion: boolean): void => {
        if (started || !this.root.isValid) return;
        started = true;
        const frame = useRunMotion ? run : idle;
        this.applyFrame(frame.size[0], frame.size[1]);
        this.root.setPosition(startX, frame.position.y, 0);
        this.root.setScale(Vec3.ONE);
        this.root.angle = 0;
        if (typeof document !== 'undefined') {
          document.body.dataset.dinosaurTreasureActorPhase =
            'returning-left-to-selected-option';
        }
        tween(this.root)
          .to(durationMs / 1000, {
            position: new Vec3(columnX, frame.position.y, 0),
            scale: Vec3.ONE,
            angle: 0,
          }, { easing: 'linear' })
          .call(() => {
            this.applyIdle(columnX, false);
            if (typeof document !== 'undefined') {
              document.body.dataset.dinosaurTreasureActorPhase =
                'returned-standing-at-selected-option';
            }
            resolve();
          })
          .start();
      };
      if (!runAsset) {
        this.motion.hide();
        this.visual.active = true;
        spriteLoader.apply(this.visual, this.idleAsset, 'contain');
        startReturn(false);
        return;
      }
      this.motion.show(runAsset, true, false, {
        onReady: () => startReturn(true),
        onError: () => {
          this.motion.hide();
          this.visual.active = true;
          spriteLoader.apply(this.visual, this.idleAsset, 'contain');
          startReturn(false);
        },
      });
    });
  }

  descendWithDunhuangRubble(columnX: number): Promise<void> {
    if (this.sceneId !== 'dunhuang') return Promise.resolve();
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const startY = this.root.position.y;
    const targetY = DUNHUANG_TREASURE_FEEDBACK.actorLotusY;
    const durationSeconds = (
      DUNHUANG_TREASURE_FEEDBACK.breakBurstMs
      + DUNHUANG_TREASURE_FEEDBACK.rubbleFallMs
      + DUNHUANG_TREASURE_FEEDBACK.rubbleSettleMs
    ) / 1000;
    this.root.active = true;
    if (typeof document !== 'undefined') {
      document.body.dataset.dunhuangTreasureActorPhase =
        'descending-with-rubble';
      document.body.dataset.dunhuangTreasureActorStartY = startY.toFixed(2);
      document.body.dataset.dunhuangTreasureActorTargetY = targetY.toFixed(2);
    }
    return new Promise((resolve) => {
      tween(this.root)
        .to(durationSeconds, {
          position: new Vec3(columnX, targetY, 0),
        }, { easing: 'quadIn' })
        .call(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.dunhuangTreasureActorPhase =
              'at-lotus-rubble-at-bottom';
          }
          resolve();
        })
        .start();
    });
  }

  dropToDunhuangFloor(columnX: number): Promise<void> {
    if (this.sceneId !== 'dunhuang') return Promise.resolve();
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const startY = this.root.position.y;
    const targetY = DUNHUANG_TREASURE_FEEDBACK.wrongActorContactY;
    this.root.active = true;
    this.root.setPosition(columnX, startY, 0);
    if (typeof document !== 'undefined') {
      document.body.dataset.dunhuangTreasureWrongActorPhase =
        'dropping-to-cavity-floor';
      document.body.dataset.dunhuangTreasureWrongActorStartY =
        startY.toFixed(2);
      document.body.dataset.dunhuangTreasureWrongActorTargetY =
        targetY.toFixed(2);
    }
    return new Promise((resolve) => {
      tween(this.root)
        .to(DUNHUANG_TREASURE_FEEDBACK.wrongActorDropMs / 1000, {
          position: new Vec3(columnX, targetY, 0),
        }, { easing: 'quadIn' })
        .call(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.dunhuangTreasureWrongActorPhase =
              'touching-cavity-floor';
          }
          resolve();
        })
        .start();
    });
  }

  liftWithDunhuangTornado(columnX: number): Promise<void> {
    if (this.sceneId !== 'dunhuang') return Promise.resolve();
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const startY = this.root.position.y;
    const targetY = DUNHUANG_TREASURE_FEEDBACK.wrongActorFinalY;
    const targetScale = DUNHUANG_TREASURE_FEEDBACK.wrongActorFinalScale;
    const wrongMotion = this.motionAssets?.wrong;
    this.motion.setPinFeet(false);
    this.motion.setFit('contain');
    this.applyFrame(
      DUNHUANG_TREASURE_FEEDBACK.wrongActorFrameWidth,
      DUNHUANG_TREASURE_FEEDBACK.wrongActorFrameHeight,
    );
    this.root.active = true;
    this.root.setPosition(columnX, startY, 0);
    this.root.setScale(targetScale * 0.88, targetScale * 0.88, 1);
    this.root.angle = 0;
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    spriteLoader.apply(this.visual, this.idleAsset, 'contain');
    if (typeof document !== 'undefined') {
      document.body.dataset.dunhuangTreasureWrongActorPhase =
        'loading-tornado-lift';
      document.body.dataset.dunhuangTreasureWrongActorFinalY =
        targetY.toFixed(2);
    }
    return new Promise((resolve) => {
      let started = false;
      const startLift = (asset: string): void => {
        if (started || !this.root.isValid) return;
        started = true;
        if (typeof document !== 'undefined') {
          document.body.dataset.dunhuangTreasureWrongActorPhase =
            'rising-with-tornado';
          document.body.dataset.dunhuangTreasureWrongActorAsset = asset;
        }
        tween(this.root)
          .to(DUNHUANG_TREASURE_FEEDBACK.wrongActorLiftMs / 1000, {
            position: new Vec3(columnX, targetY, 0),
            scale: new Vec3(targetScale, targetScale, 1),
          }, { easing: 'quadOut' })
          .call(() => {
            if (typeof document !== 'undefined') {
              document.body.dataset.dunhuangTreasureWrongActorPhase =
                'sad-above-open-cavity';
            }
            resolve();
          })
          .start();
      };
      if (!wrongMotion) {
        this.motion.hide();
        startLift('idle-fallback');
        return;
      }
      this.motion.show(wrongMotion, true, true, {
        onReady: () => startLift('wrong.webp'),
        onError: () => {
          this.motion.hide();
          this.visual.active = true;
          spriteLoader.apply(this.visual, this.idleAsset, 'contain');
          startLift('idle-fallback');
        },
      });
    });
  }

  async dropToMagicAcademyBook(
    columnX: number,
    sitting = false,
  ): Promise<void> {
    if (this.sceneId !== 'magic') return;
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const idle = sceneCharacter(this.sceneId).idle;
    this.motion.hide();
    this.motion.setPinFeet(false);
    this.motion.setFit('contain');
    this.applyFrame(idle.size[0], idle.size[1]);
    this.root.active = true;
    this.root.setPosition(columnX, idle.position.y, 0);
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    await spriteLoader.applyReady(this.visual, this.idleAsset, 'contain');
    if (!this.root.isValid) return;
    await waitForVisualCommit();
    if (!this.root.isValid) return;
    const targetY = sitting
      ? MAGIC_ACADEMY_FEEDBACK.actorSitY
      : MAGIC_ACADEMY_FEEDBACK.actorStandY;
    if (typeof document !== 'undefined') {
      document.body.dataset.magicAcademyActorPhase = sitting
        ? 'descending-to-sit-on-book'
        : 'descending-to-stand-on-book';
      document.body.dataset.magicAcademyActorStartY =
        idle.position.y.toFixed(2);
      document.body.dataset.magicAcademyActorTargetY = targetY.toFixed(2);
    }
    return new Promise((resolve) => {
      tween(this.root)
        .to(MAGIC_ACADEMY_FEEDBACK.actorDropMs / 1000, {
          position: new Vec3(columnX, targetY, 0),
          scale: Vec3.ONE,
        }, { easing: 'quadIn' })
        .call(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.magicAcademyActorPhase = sitting
              ? 'seated-on-locked-book'
              : 'standing-on-locked-book';
          }
          resolve();
        })
        .start();
    });
  }

  riseFromMagicAcademyBook(columnX: number): Promise<void> {
    if (this.sceneId !== 'magic') return Promise.resolve();
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const correctMotion = this.motionAssets?.correct;
    this.motion.setPinFeet(false);
    this.motion.setFit('contain');
    this.root.active = true;
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    if (typeof document !== 'undefined') {
      document.body.dataset.magicAcademyActorPhase =
        'loading-correct-flight-pose';
    }
    return new Promise((resolve) => {
      let started = false;
      const startRise = (usingMotion: boolean): void => {
        if (started || !this.root.isValid) return;
        started = true;
        if (usingMotion) {
          this.applyFrame(
            MAGIC_ACADEMY_FEEDBACK.correctActorFrameWidth,
            MAGIC_ACADEMY_FEEDBACK.correctActorFrameHeight,
          );
          this.root.setPosition(
            columnX,
            MAGIC_ACADEMY_FEEDBACK.correctActorStartY,
            0,
          );
        } else {
          const idle = sceneCharacter(this.sceneId).idle;
          this.motion.hide();
          this.visual.active = true;
          spriteLoader.apply(this.visual, this.idleAsset, 'contain');
          this.applyFrame(idle.size[0], idle.size[1]);
          this.root.setPosition(columnX, MAGIC_ACADEMY_FEEDBACK.actorStandY, 0);
        }
        if (typeof document !== 'undefined') {
          document.body.dataset.magicAcademyActorPhase =
            'rising-with-open-book';
          document.body.dataset.magicAcademyActorAsset =
            usingMotion ? 'correct.webp' : 'idle-fallback';
        }
        tween(this.root)
          .to(MAGIC_ACADEMY_FEEDBACK.correctActorRiseMs / 1000, {
            position: new Vec3(
              columnX,
              MAGIC_ACADEMY_FEEDBACK.correctActorRiseY,
              0,
            ),
            scale: Vec3.ONE,
          }, { easing: 'quadOut' })
          .call(() => {
            if (typeof document !== 'undefined') {
              document.body.dataset.magicAcademyActorPhase =
                'hovering-above-open-book';
            }
            resolve();
          })
          .start();
      };
      if (!correctMotion) {
        startRise(false);
        return;
      }
      this.motion.show(correctMotion, true, true, {
        onReady: () => startRise(true),
        onError: () => startRise(false),
      });
    });
  }

  launchFromMagicAcademyExplosion(columnX: number): Promise<void> {
    if (this.sceneId !== 'magic') return Promise.resolve();
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const direction = columnX > 120 ? -1 : 1;
    const landingX = Math.max(
      -500,
      Math.min(
        500,
        columnX + direction * MAGIC_ACADEMY_FEEDBACK.wrongActorLandingDistance,
      ),
    );
    this.motion.setPinFeet(false);
    this.motion.setFit('contain');
    this.root.active = true;
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    if (typeof document !== 'undefined') {
      document.body.dataset.magicAcademyActorPhase =
        'loading-exploded-actor';
      document.body.dataset.magicAcademyActorLandingX = landingX.toFixed(2);
    }
    return new Promise((resolve) => {
      let started = false;
      const startLaunch = (usingWrongActor: boolean): void => {
        if (started || !this.root.isValid) return;
        started = true;
        let startY: number = MAGIC_ACADEMY_FEEDBACK.wrongActorStartY;
        let landingY: number = MAGIC_ACADEMY_FEEDBACK.wrongActorGroundY;
        if (usingWrongActor) {
          this.applyFrame(
            MAGIC_ACADEMY_FEEDBACK.wrongActorFrameWidth,
            MAGIC_ACADEMY_FEEDBACK.wrongActorFrameHeight,
          );
        } else {
          const idle = sceneCharacter(this.sceneId).idle;
          this.motion.hide();
          this.visual.active = true;
          spriteLoader.apply(this.visual, this.idleAsset, 'contain');
          this.applyFrame(idle.size[0], idle.size[1]);
          startY = MAGIC_ACADEMY_FEEDBACK.actorSitY;
          landingY = idle.position.y;
        }
        this.root.setPosition(columnX, startY, 0);
        this.root.setScale(Vec3.ONE);
        this.root.angle = 0;
        if (typeof document !== 'undefined') {
          document.body.dataset.magicAcademyActorPhase =
            'blasted-out-without-rotation';
          document.body.dataset.magicAcademyActorAsset = usingWrongActor
            ? 'wrong-actor.png'
            : 'idle-fallback';
        }
        tween(this.root)
          .to(MAGIC_ACADEMY_FEEDBACK.wrongActorLaunchMs / 1000, {
            position: new Vec3(
              columnX + direction * 88,
              MAGIC_ACADEMY_FEEDBACK.wrongActorApexY,
              0,
            ),
            angle: 0,
            scale: Vec3.ONE,
          }, { easing: 'quadOut' })
          .to(MAGIC_ACADEMY_FEEDBACK.wrongActorFallMs / 1000, {
            position: new Vec3(
              landingX - direction * 58,
              landingY + 42,
              0,
            ),
            angle: 0,
            scale: Vec3.ONE,
          }, { easing: 'quadIn' })
          .to(MAGIC_ACADEMY_FEEDBACK.wrongActorSettleMs / 1000, {
            position: new Vec3(landingX, landingY, 0),
            angle: 0,
            scale: Vec3.ONE,
          }, { easing: 'quadOut' })
          .call(() => {
            this.root.setPosition(landingX, landingY, 0);
            this.root.setScale(Vec3.ONE);
            this.root.angle = 0;
            if (typeof document !== 'undefined') {
              document.body.dataset.magicAcademyActorPhase =
                'landed-seated-outside-cavity';
            }
            resolve();
          })
          .start();
      };
      this.motion.show(
        MAGIC_ACADEMY_FEEDBACK.wrongActorAsset,
        true,
        true,
        {
          onReady: () => startLaunch(true),
          onError: () => startLaunch(false),
        },
      );
    });
  }

  private async dropDesertActor(
    columnX: number,
    targetY: number,
    dropPhase: string,
    landedPhase: string,
  ): Promise<void> {
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const idle = sceneCharacter(this.sceneId).idle;
    const startY = idle.position.y;
    this.applyFrame(idle.size[0], idle.size[1]);
    this.root.active = true;
    this.root.setPosition(columnX, startY, 0);
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    await spriteLoader.applyReady(this.visual, this.idleAsset, 'contain');
    if (!this.root.isValid) return;
    await waitForVisualCommit();
    if (!this.root.isValid) return;
    this.motion.hide();
    this.motion.setPinFeet(false);
    if (typeof document !== 'undefined') {
      document.body.dataset.desertTreasureActorPhase = dropPhase;
      document.body.dataset.desertTreasureActorStartY = startY.toFixed(2);
      document.body.dataset.desertTreasureActorTargetY = targetY.toFixed(2);
    }
    return new Promise((resolve) => {
      tween(this.root)
        .to(DESERT_TREASURE_FEEDBACK.actorDropMs / 1000, {
          position: new Vec3(columnX, targetY, 0),
          scale: Vec3.ONE,
        }, { easing: 'quadIn' })
        .call(() => {
          if (typeof document !== 'undefined') {
            document.body.dataset.desertTreasureActorPhase = landedPhase;
          }
          resolve();
        })
        .start();
    });
  }

  launchFromClassicTreasureChest(columnX: number): Promise<void> {
    Tween.stopAllByTarget(this.root);
    this.stopBreathing();
    const idle = sceneCharacter(this.sceneId).idle;
    const direction = columnX > 100 ? -1 : 1;
    const visualLandingX = columnX
      + direction * CLASSIC_TREASURE_FEEDBACK.actorLandingOffsetX;
    const layout = writingPlaySceneLayout(this.sceneId);
    const chestTopY = layout.choice.y + layout.chest.localY + layout.chest.height / 2;
    const groundY = idle.position.y - idle.size[1] / 2;
    const frameWidth = CLASSIC_TREASURE_FEEDBACK.actorWrongFrameWidth;
    const frameHeight = CLASSIC_TREASURE_FEEDBACK.actorWrongFrameHeight;
    const startX = columnX - (
      CLASSIC_TREASURE_FEEDBACK.actorWrongFirstCenterX - frameWidth / 2
    );
    const landingX = visualLandingX - (
      CLASSIC_TREASURE_FEEDBACK.actorWrongLastCenterX - frameWidth / 2
    );
    const startY = chestTopY - (
      frameHeight / 2 - CLASSIC_TREASURE_FEEDBACK.actorWrongFirstBottomY
    );
    const landingY = groundY - (
      frameHeight / 2 - CLASSIC_TREASURE_FEEDBACK.actorWrongLastBottomY
    );
    const apexX = startX + (landingX - startX) * 0.62;
    const apexY = landingY + CLASSIC_TREASURE_FEEDBACK.actorWrongTravelApexLiftY;
    const motionDurationSeconds = feedbackDurationMs(this.sceneId, false) / 1000;
    const wrongMotion = this.motionAssets?.wrong;
    this.motion.setPinFeet(false);
    this.motion.setFit('contain');
    this.root.active = true;
    this.root.setScale(Vec3.ONE);
    this.root.angle = 0;
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    if (typeof document !== 'undefined') {
      document.body.dataset.classicTreasureActorPhase = 'loading-wrong-motion';
      document.body.dataset.classicTreasureActorLaunchApexY =
        apexY.toFixed(2);
      document.body.dataset.classicTreasureActorLandingX = visualLandingX.toFixed(2);
      document.body.dataset.classicTreasureActorLandingY = groundY.toFixed(2);
    }
    return new Promise((resolve) => {
      let started = false;
      const markLanded = (asset: string): void => {
        this.root.setPosition(landingX, landingY, 0);
        this.root.setScale(Vec3.ONE);
        this.root.angle = 0;
        if (typeof document !== 'undefined') {
          document.body.dataset.classicTreasureActorPhase = 'landed-seated-on-ground';
          document.body.dataset.classicTreasureActorAsset = asset;
        }
        resolve();
      };
      const playTravel = (asset: string): void => {
        if (started || !this.root.isValid) return;
        started = true;
        this.applyFrame(frameWidth, frameHeight);
        this.root.setPosition(startX, startY, 0);
        this.root.setScale(Vec3.ONE);
        this.root.angle = 0;
        if (typeof document !== 'undefined') {
          document.body.dataset.classicTreasureActorPhase =
            'wrong-motion-launched-by-explosion';
          document.body.dataset.classicTreasureActorAsset = asset;
        }
        tween(this.root)
          .to(motionDurationSeconds * 0.58, {
            position: new Vec3(apexX, apexY, 0),
          }, { easing: 'quadOut' })
          .call(() => {
            if (typeof document !== 'undefined') {
              document.body.dataset.classicTreasureActorPhase =
                'wrong-motion-falling-to-ground';
            }
          })
          .to(motionDurationSeconds * 0.42, {
            position: new Vec3(landingX, landingY, 0),
          }, { easing: 'quadIn' })
          .call(() => markLanded(asset))
          .start();
      };
      const playFallback = async (): Promise<void> => {
        if (started || !this.root.isValid) return;
        started = true;
        this.motion.hide();
        const width = CLASSIC_TREASURE_FEEDBACK.actorWrongFallbackWidth;
        const height = CLASSIC_TREASURE_FEEDBACK.actorWrongFallbackHeight;
        const bottomOffset = (
          height / 2 - CLASSIC_TREASURE_FEEDBACK.actorWrongFallbackBottomY
        );
        const fallbackStartY = chestTopY - bottomOffset;
        const fallbackLandingY = groundY - bottomOffset;
        this.applyFrame(width, height);
        this.root.setPosition(columnX, fallbackStartY, 0);
        this.root.setScale(Vec3.ONE);
        this.root.angle = 0;
        this.visual.active = false;
        const applied = await spriteLoader.applyReady(
          this.visual,
          this.wrongFeedbackAsset,
          'contain',
        );
        if (!this.root.isValid) {
          resolve();
          return;
        }
        this.visual.active = applied;
        if (typeof document !== 'undefined') {
          document.body.dataset.classicTreasureActorPhase =
            'wrong-static-launched-by-explosion';
          document.body.dataset.classicTreasureActorAsset =
            applied ? 'feedbackWrong' : 'missing-wrong-feedback';
        }
        tween(this.root)
          .to(motionDurationSeconds * 0.58, {
            position: new Vec3(
              columnX + direction * 102,
              fallbackLandingY + CLASSIC_TREASURE_FEEDBACK.actorWrongTravelApexLiftY,
              0,
            ),
            angle: -14 * direction,
          }, { easing: 'quadOut' })
          .to(motionDurationSeconds * 0.42, {
            position: new Vec3(visualLandingX, fallbackLandingY, 0),
            angle: 0,
          }, { easing: 'quadIn' })
          .call(() => {
            if (typeof document !== 'undefined') {
              document.body.dataset.classicTreasureActorPhase =
                'landed-seated-on-ground';
            }
            resolve();
          })
          .start();
      };
      if (!wrongMotion) {
        void playFallback();
        return;
      }
      this.motion.show(wrongMotion, true, true, {
        onReady: () => playTravel('wrong.webp'),
        onError: () => {
          void playFallback();
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
    wrongFeedbackAsset = '',
  ): void {
    this.idleAsset = idleAsset;
    this.actionAsset = actionAsset;
    this.motionAssets = motionAssets;
    this.sceneId = sceneId;
    this.wrongFeedbackAsset = wrongFeedbackAsset;
    if (sceneId === 'magic') {
      prefetchMotion(MAGIC_ACADEMY_FEEDBACK.wrongActorAsset);
    }
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

  private applyIdle(x: number, stopTweens = true): void {
    const idle = sceneCharacter(this.sceneId).idle;
    if (stopTweens) Tween.stopAllByTarget(this.root);
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

  private applyActionPose(columnX: number, onMotionReady?: () => void): void {
    const action = sceneCharacter(this.sceneId).action;
    const classicTreasure = this.sceneId === 'treasure';
    this.motion.setPinFeet(false);
    this.motion.setFit('contain');
    this.applyFrame(action.size[0], action.size[1]);
    this.root.setPosition(
      columnX,
      action.position.y + (
        classicTreasure ? CLASSIC_TREASURE_FEEDBACK.actorDigGroundOffsetY : 0
      ),
    );
    this.root.setScale(
      classicTreasure ? CLASSIC_TREASURE_FEEDBACK.actorDigScale : 1,
      classicTreasure ? CLASSIC_TREASURE_FEEDBACK.actorDigScale : 1,
      1,
    );
    spriteLoader.apply(this.visual, this.actionAsset, 'contain');
    const actionMotion = this.motionAssets?.action;
    if (!actionMotion) {
      this.motion.hide();
      this.visual.active = true;
      onMotionReady?.();
      return;
    }
    if (!onMotionReady) {
      this.motion.show(actionMotion, true);
      return;
    }
    this.motion.show(actionMotion, true, false, {
      onReady: onMotionReady,
      onError: onMotionReady,
    });
  }
}
