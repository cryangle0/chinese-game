import { Node, Tween, UITransform, Vec3 } from 'cc';
import { spriteLoader } from '../../../core/assets/SpriteLoader';
import { DomMotionSprite } from '../../../core/media/DomMotionSprite';
import { SpriteSheetPlayer } from '../../../core/assets/SpriteSheetPlayer';
import { createUiNode } from '../../../core/ui/UiFactory';
import { MotionAssets, SpriteSheetAnimation } from '../../../shared/types/Theme';
import { ReadingRect } from '../config/ReadingLayout';
import { jumpDeerAt, runDeerTo } from './DeerMotionTweens';

export class DeerView {
  readonly root: Node;
  private readonly visual: Node;
  private idleAsset: string;
  private actionAsset: string;
  private idleAnimation?: SpriteSheetAnimation;
  private actionAnimation?: SpriteSheetAnimation;
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
    motionAssets?: MotionAssets,
  ) {
    this.idleAsset = idleAsset;
    this.actionAsset = actionAsset;
    this.idleAnimation = idleAnimation;
    this.actionAnimation = actionAnimation;
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
    if (this.idleAnimation || this.acting) return;
    this.idleSeconds += deltaSeconds;
    const breath = Math.sin(this.idleSeconds * Math.PI * 1.25);
    this.visual.setPosition(0, 0);
    this.visual.setScale(1 + breath * 0.01, 1 - breath * 0.006, 1);
  }

  moveTo(column: number): boolean {
    const x = this.columnX[column] ?? 0;
    if (Math.abs(this.root.position.x - x) < 1) return false;
    Tween.stopAllByTarget(this.root);
    this.acting = true;
    this.markState('run');
    this.visual.setScale(Vec3.ONE);
    const run = x < this.root.position.x
      ? this.motionAssets?.runLeft ?? this.motionAssets?.action
      : this.motionAssets?.runRight ?? this.motionAssets?.action;
    // Prefer immediate visibility over frame-0 restart (restart clears src and races the move).
    this.motion.show(run);
    // Hold long enough for run webp to be seen (was 0.28s → often only static PNG).
    runDeerTo(this.root, x, this.baseY, () => {
      this.acting = false;
      this.showIdle();
    }, 0.08);
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
      this.motion.show(this.motionAssets?.action, true);
      if (this.actionAnimation) {
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
      this.motion.show(
        x < this.root.position.x
          ? this.motionAssets?.runLeft ?? this.motionAssets?.action
          : this.motionAssets?.runRight ?? this.motionAssets?.action,
      );
      runDeerTo(this.root, x, this.baseY, jump);
      return;
    }
    jump();
  }

  setTheme(
    idleAsset: string,
    actionAsset: string,
    idleAnimation?: SpriteSheetAnimation,
    actionAnimation?: SpriteSheetAnimation,
    motionAssets?: MotionAssets,
  ): void {
    this.idleAsset = idleAsset;
    this.actionAsset = actionAsset;
    this.idleAnimation = idleAnimation;
    this.actionAnimation = actionAnimation;
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
    this.motion.hide();
    this.visual.active = true;
    this.markState('idle');
    if (this.idleAnimation) this.player.play(this.idleAnimation);
    else spriteLoader.apply(this.visual, this.idleAsset, 'contain');
  }

  private finishAction(done: () => void): void {
    this.acting = false;
    this.showIdle();
    done();
  }

  private markState(state: 'idle' | 'run' | 'action'): void {
    if (typeof document !== 'undefined') document.body.dataset.deerState = state;
  }
  dispose(): void { this.motion.dispose(); }
}
