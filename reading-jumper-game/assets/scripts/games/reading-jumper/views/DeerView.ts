import { Node, Tween, UITransform, Vec3 } from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { DomMotionSprite } from '../../../core/media/DomMotionSprite';
import { SpriteSheetPlayer } from '../../../core/assets/SpriteSheetPlayer';
import { createUiNode } from '../../../core/ui/UiFactory';
import { MotionAssets, SpriteSheetAnimation } from '../../../shared/types/Theme';
import { ReadingRect } from '../config/ReadingLayout';
import { jumpDeerAt, runDeerTo } from './DeerMotionTweens';

const HORIZONTAL_RUN_PIXELS_PER_SECOND = 300;
const POSE_RUN_MIN_SECONDS = 0.45;
const POSE_RUN_SETTLE_SECONDS = 0.08;

export class DeerView {
  readonly root: Node;
  private readonly visual: Node;
  private idleAsset: string;
  private actionAsset: string;
  private idleAnimation?: SpriteSheetAnimation;
  private actionAnimation?: SpriteSheetAnimation;
  private runLeftAnimation?: SpriteSheetAnimation;
  private runRightAnimation?: SpriteSheetAnimation;
  private readonly player: SpriteSheetPlayer;
  private readonly motion: DomMotionSprite;
  private motionAssets?: MotionAssets;
  private columnX: readonly [number, number, number] = [-400, 0, 400];
  private baseY = -250;
  private jumpHeight = 48;
  private idleSeconds = 0;
  private acting = false;

  constructor(
    parent: Node,
    idleAsset: string,
    actionAsset: string,
    idleAnimation?: SpriteSheetAnimation,
    actionAnimation?: SpriteSheetAnimation,
    runLeftAnimation?: SpriteSheetAnimation,
    runRightAnimation?: SpriteSheetAnimation,
    motionAssets?: MotionAssets,
  ) {
    this.idleAsset = idleAsset;
    this.actionAsset = actionAsset;
    this.idleAnimation = idleAnimation;
    this.actionAnimation = actionAnimation;
    this.runLeftAnimation = runLeftAnimation;
    this.runRightAnimation = runRightAnimation;
    this.motionAssets = motionAssets;
    this.root = createUiNode(parent, 'ReadingDeer', 152, 266, new Vec3(0, -147));
    this.visual = createUiNode(this.root, 'ReadingDeerVisual', 152, 266);
    this.player = new SpriteSheetPlayer(this.visual);
    this.motion = new DomMotionSprite(this.root, this.visual, 152, 266, {
      fit: 'contain',
      objectPosition: 'center bottom',
      pinFeet: true,
      fillOpaque: true,
      suppressFallback: true,
    });
    this.baseY = -147;
    this.showIdle();
  }
  update(deltaSeconds: number): void {
    this.player.update(deltaSeconds);
    if (typeof document !== 'undefined') {
      const playback = this.player.snapshot();
      if (playback) {
        document.body.dataset.deerSpritePath = playback.path;
        document.body.dataset.deerSpriteFrame = String(playback.frame);
        document.body.dataset.deerSpriteFrames = String(playback.frames);
      }
    }
    if (this.motionAssets?.idle || this.idleAnimation || this.acting) return;
    this.idleSeconds += deltaSeconds;
    const breath = Math.sin(this.idleSeconds * Math.PI * 1.25);
    this.visual.setPosition(0, 0);
    this.visual.setScale(1 + breath * 0.01, 1 - breath * 0.006, 1);
  }

  moveTo(column: number): boolean {
    const x = this.columnX[column] ?? 0;
    if (Math.abs(this.root.position.x - x) < 1) return false;
    const travelDistance = Math.abs(x - this.root.position.x);
    const travelSeconds = Math.max(
      POSE_RUN_MIN_SECONDS,
      travelDistance / HORIZONTAL_RUN_PIXELS_PER_SECOND,
    );
    Tween.stopAllByTarget(this.root);
    this.root.setPosition(this.root.position.x, this.baseY);
    this.root.setScale(Vec3.ONE);
    this.acting = true;
    this.markState('run');
    this.visual.setScale(Vec3.ONE);
    const run = this.showRun(x);
    runDeerTo(this.root, x, this.baseY, () => {
      this.acting = false;
      this.showIdle();
    }, POSE_RUN_SETTLE_SECONDS, travelSeconds, true);
    if (typeof document !== 'undefined') {
      document.body.dataset.deerRunDuration = String(travelSeconds);
      document.body.dataset.deerRunAsset = run ?? '';
    }
    return true;
  }

  jumpTo(column: number, done: () => void, onApex?: () => void): void {
    Tween.stopAllByTarget(this.root);
    this.acting = true;
    this.visual.setPosition(Vec3.ZERO);
    this.visual.setScale(Vec3.ONE);
    this.root.setScale(Vec3.ONE);
    const x = this.columnX[column] ?? 0;
    const needRun = Math.abs(this.root.position.x - x) > 12;

    const jump = () => {
      this.markState('action');
      this.player.stop();
      if (this.actionAnimation) {
        this.motion.hide();
        const duration = this.actionAnimation.frames / this.actionAnimation.fps;
        this.player.play(this.actionAnimation, false);
        jumpDeerAt(
          this.root,
          x,
          this.baseY,
          this.jumpHeight,
          Math.max(0.05, duration - 0.53),
          onApex,
          () => this.finishAction(done),
        );
        return;
      }
      this.motion.show(this.motionAssets?.action, true);
      spriteLoader.apply(this.visual, this.actionAsset, 'contain');
      // No scale pulse — avoids size pop with DomMotionSprite (#11).
      jumpDeerAt(
        this.root,
        x,
        this.baseY,
        this.jumpHeight,
        0.12,
        onApex,
        () => this.finishAction(done),
      );
    };

    if (needRun) {
      this.markState('run');
      this.showRun(x);
      const travelDistance = Math.abs(x - this.root.position.x);
      const travelSeconds = Math.max(
        POSE_RUN_MIN_SECONDS,
        travelDistance / HORIZONTAL_RUN_PIXELS_PER_SECOND,
      );
      runDeerTo(this.root, x, this.baseY, jump, 0, travelSeconds, true);
      if (typeof document !== 'undefined') {
        document.body.dataset.deerPreJumpRunDuration = String(travelSeconds);
      }
      return;
    }
    jump();
  }

  setTheme(
    idleAsset: string,
    actionAsset: string,
    idleAnimation?: SpriteSheetAnimation,
    actionAnimation?: SpriteSheetAnimation,
    runLeftAnimation?: SpriteSheetAnimation,
    runRightAnimation?: SpriteSheetAnimation,
    motionAssets?: MotionAssets,
  ): void {
    this.idleAsset = idleAsset;
    this.actionAsset = actionAsset;
    this.idleAnimation = idleAnimation;
    this.actionAnimation = actionAnimation;
    this.runLeftAnimation = runLeftAnimation;
    this.runRightAnimation = runRightAnimation;
    this.motionAssets = motionAssets;
    Tween.stopAllByTarget(this.root);
    this.root.setPosition(0, this.baseY);
    this.root.setScale(Vec3.ONE);
    this.visual.setPosition(Vec3.ZERO);
    this.visual.setScale(Vec3.ONE);
    this.acting = false;
    this.idleSeconds = 0;
    this.player.clear();
    this.showIdle();
  }

  setLayout(
    layout: ReadingRect,
    columns: readonly [number, number, number],
    jumpHeight: number,
  ): void {
    this.baseY = layout.y;
    this.columnX = columns;
    this.jumpHeight = jumpHeight;
    this.root.setPosition(layout.x, layout.y);
    this.root.getComponent(UITransform)?.setContentSize(layout.width, layout.height);
    this.visual.getComponent(UITransform)?.setContentSize(layout.width, layout.height);
    this.motion.resize(layout.width, layout.height);
    if (typeof document !== 'undefined') {
      document.body.dataset.deerBox = `${layout.width}x${layout.height}`;
      document.body.dataset.deerY = String(layout.y);
      document.body.dataset.deerJumpHeight = String(jumpHeight);
    }
  }

  private showIdle(): void {
    this.visual.active = true;
    this.markState('idle');
    if (this.idleAnimation) {
      this.motion.hide();
      this.visual.setPosition(Vec3.ZERO);
      this.visual.setScale(Vec3.ONE);
      // The compact static deer is startup-critical. Keep it visible until the
      // high-resolution idle sheet, deferred behind user intent, is decoded.
      spriteLoader.apply(this.visual, this.idleAsset, 'contain');
      this.player.play(this.idleAnimation);
      if (typeof document !== 'undefined') {
        document.body.dataset.deerIdleMotion = 'sprite-sheet-run-in-place';
        document.body.dataset.deerIdleFps = String(this.idleAnimation.fps);
        document.body.dataset.deerLocomotionRenderer = 'sprite-sheet';
      }
      return;
    }
    const runInPlace = this.motionAssets?.idle;
    if (runInPlace) {
      this.player.clear();
      this.visual.setPosition(Vec3.ZERO);
      this.visual.setScale(Vec3.ONE);
      this.motion.show(runInPlace);
      if (typeof document !== 'undefined') {
        document.body.dataset.deerIdleMotion = 'run-in-place';
        delete document.body.dataset.deerIdleFps;
      }
      return;
    }
    this.motion.hide();
    if (typeof document !== 'undefined') {
      delete document.body.dataset.deerIdleMotion;
      delete document.body.dataset.deerIdleFps;
    }
    spriteLoader.apply(this.visual, this.idleAsset, 'contain');
  }

  private finishAction(done: () => void): void {
    this.acting = false;
    this.showIdle();
    done();
  }

  private markState(state: 'idle' | 'run' | 'action'): void {
    if (typeof document !== 'undefined') document.body.dataset.deerState = state;
  }

  private showRun(targetX: number): string | undefined {
    const movingLeft = targetX < this.root.position.x;
    const animation = movingLeft ? this.runLeftAnimation : this.runRightAnimation;
    const fallback = movingLeft
      ? this.motionAssets?.runLeft ?? this.motionAssets?.action
      : this.motionAssets?.runRight ?? this.motionAssets?.action;
    this.visual.active = true;
    this.visual.setPosition(Vec3.ZERO);
    this.visual.setScale(Vec3.ONE);
    if (animation) {
      this.motion.hide();
      this.player.play(animation);
      if (typeof document !== 'undefined') {
        document.body.dataset.deerRunAsset = animation.path;
        document.body.dataset.deerLocomotionRenderer = 'sprite-sheet';
      }
      return animation.path;
    }
    this.player.stop();
    this.motion.show(fallback);
    if (typeof document !== 'undefined') {
      document.body.dataset.deerRunAsset = fallback ?? '';
      document.body.dataset.deerLocomotionRenderer = 'animated-webp';
    }
    return fallback;
  }

  dispose(): void { this.motion.dispose(); }
}
