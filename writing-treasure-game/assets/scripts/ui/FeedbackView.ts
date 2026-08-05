import {
  Graphics, Node, tween, Tween, UIOpacity, UITransform, Vec3,
} from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { DomMotionSprite } from '../core/media/DomMotionSprite';
import type { MotionPlaybackCallbacks } from '../core/media/DomMotionSprite';
import { createUiNode } from '../core/ui/UiFactory';
import { color } from '../core/ui/colors';
import { DUNHUANG_TREASURE_FEEDBACK } from '../shared/config/DunhuangTreasureFeedback';
import {
  feedbackStageMotionPath, FeedbackSequencePlan, writingFeedbackMotionLayout,
} from '../shared/config/WritingFeedbackPolicy';
import { WritingPlayLayout } from '../shared/config/WritingPlayLayout';
import { StaticFeedbackVariant } from '../shared/config/WritingStaticFeedback';
import { FeedbackLayerView } from './FeedbackLayerView';
import { FeedbackStageMotionView } from './FeedbackStageMotionView';

function toAbsoluteUrl(path: string): string {
  if (typeof location === 'undefined') return path;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path.replace(/^\.\//, ''), location.href).href;
}

export class FeedbackView {
  private readonly root: Node;
  private readonly dunhuangRiseBeam: Node;
  private readonly dunhuangRiseBeamOpacity: UIOpacity;
  private readonly fallbackImage: Node;
  private readonly fallbackSprite: Node;
  private readonly fallbackMotion: DomMotionSprite;
  private readonly layers: FeedbackLayerView;
  private readonly stageMotion: FeedbackStageMotionView;
  private restoreBackground = '';
  private usingStatic = false;
  private choiceColumns: readonly [number, number, number] = WritingPlayLayout.choiceColumns;
  private backdropScaleX = 1;
  constructor(parent: Node, private readonly background: Node) {
    this.root = createUiNode(parent, 'Feedback', 1440, 810, Vec3.ZERO);
    this.root.addComponent(UIOpacity);
    this.dunhuangRiseBeam = createUiNode(
      this.root,
      'DunhuangTreasureRiseBeam',
      DUNHUANG_TREASURE_FEEDBACK.riseBeamWidth,
      DUNHUANG_TREASURE_FEEDBACK.riseBeamHeight,
      new Vec3(0, DUNHUANG_TREASURE_FEEDBACK.riseBeamBottomY),
    );
    this.dunhuangRiseBeam.getComponent(UITransform)?.setAnchorPoint(0.5, 0);
    this.dunhuangRiseBeamOpacity = this.dunhuangRiseBeam.addComponent(UIOpacity);
    this.drawDunhuangRiseBeam(this.dunhuangRiseBeam.addComponent(Graphics));
    this.dunhuangRiseBeam.active = false;
    const [fw, fh] = WritingPlayLayout.feedbackMotion.size;
    // Layout node stays active for DomMotionSprite transform; sprite child is the
    // Cocos fallback that can be deactivated when webp loads (same pattern as reading).
    this.fallbackImage = createUiNode(this.root, 'FeedbackFallback', fw, fh, new Vec3(0, 85));
    this.fallbackSprite = createUiNode(this.fallbackImage, 'FeedbackSprite', fw, fh, Vec3.ZERO);
    this.fallbackMotion = new DomMotionSprite(
      this.fallbackImage, this.fallbackSprite, fw, fh,
      { fit: 'contain', objectPosition: 'center bottom', zIndex: 8, suppressFallback: true },
    );
    this.layers = new FeedbackLayerView(this.root);
    this.stageMotion = new FeedbackStageMotionView(this.root);
    this.fallbackSprite.active = false;
    this.fallbackImage.active = false;
    this.root.active = false;
  }

  show(
    _correct: boolean,
    assetPath: string,
    _message = '',
    motionPath?: string,
    staticFeedback?: StaticFeedbackVariant,
    restoreBackground = '',
    selectedIndex = 1,
    sequencePlan?: FeedbackSequencePlan,
    useStageMotion = false,
    sceneId = 'treasure',
    callbacks: MotionPlaybackCallbacks = {},
  ): void {
    this.removeLegacyFeedbackShade();
    this.hideDunhuangRiseBeam();
    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackUnderlay = '0';
    }
    Tween.stopAllByTarget(this.root);
    this.root.active = true;
    this.restoreBackground = restoreBackground;
    const opacity = this.root.getComponent(UIOpacity);
    if (opacity) {
      opacity.opacity = 0;
      tween(opacity).to(0.14, { opacity: 255 }).start();
    }

    if (useStageMotion && motionPath) {
      this.usingStatic = Boolean(staticFeedback);
      this.fallbackMotion.hide();
      this.fallbackImage.active = false;
      this.layers.hide();
      this.stageMotion.show(
        feedbackStageMotionPath(motionPath, selectedIndex),
        selectedIndex,
        callbacks,
      );
      if (staticFeedback) {
        this.showStatic(staticFeedback, selectedIndex, undefined, true);
      }
      return;
    }

    if (staticFeedback && motionPath && sequencePlan) {
      this.usingStatic = true;
      this.applyFeedbackBackground(staticFeedback);
      this.showMotion(
        assetPath, motionPath, selectedIndex, sceneId, _correct, callbacks,
      );
      tween(this.root)
        .delay(sequencePlan.revealAfterMs / 1000)
        .call(() => this.showStatic(
          staticFeedback, selectedIndex, sequencePlan.chase,
        ))
        .start();
      return;
    }

    if (staticFeedback) {
      this.usingStatic = true;
      this.showStatic(staticFeedback, selectedIndex);
      callbacks.onReady?.();
      return;
    }

    if (motionPath) {
      this.usingStatic = false;
      this.showMotion(
        assetPath, motionPath, selectedIndex, sceneId, _correct, callbacks,
      );
      return;
    }

    this.usingStatic = false;
    this.showMotion(
      assetPath, undefined, selectedIndex, sceneId, _correct, callbacks,
    );
  }

  hide(): void {
    Tween.stopAllByTarget(this.root);
    Tween.stopAllByTarget(this.fallbackImage);
    this.fallbackMotion.hide();
    this.layers.hide();
    this.stageMotion.hide();
    this.hideDunhuangRiseBeam();
    this.fallbackSprite.active = false;
    this.fallbackImage.active = false;
    if (this.usingStatic && this.restoreBackground) {
      spriteLoader.apply(this.background, this.restoreBackground, 'cover');
    }
    this.usingStatic = false;
    this.root.active = false;
    this.removeLegacyFeedbackShade();
    if (typeof document !== 'undefined') {
      delete document.body.dataset.feedbackUnderlay;
      delete document.body.dataset.feedbackMotionReady;
      delete document.body.dataset.dunhuangTreasureRisePhase;
      delete document.body.dataset.dunhuangTreasureRiseBeam;
    }
  }

  setChoiceColumns(
    columns: readonly [number, number, number],
    backdropScaleX = 1,
  ): void {
    this.choiceColumns = columns;
    this.backdropScaleX = backdropScaleX;
  }

  dispose(): void {
    Tween.stopAllByTarget(this.root);
    this.removeLegacyFeedbackShade();
    this.fallbackMotion.dispose();
    this.layers.dispose();
    this.stageMotion.dispose();
  }

  private removeLegacyFeedbackShade(): void {
    if (typeof document === 'undefined') return;
    document.getElementById('CustomerFeedbackUnderlay')?.remove();
  }

  private showMotion(
    assetPath: string,
    motionPath: string | undefined,
    selectedIndex: number,
    sceneId: string,
    correct: boolean,
    callbacks: MotionPlaybackCallbacks,
  ): void {
    this.layers.hide();
    this.stageMotion.hide();
    const columns = this.choiceColumns;
    const col = Math.max(0, Math.min(columns.length - 1, selectedIndex));
    const x = columns[col] ?? 0;
    const [fw, fh] = WritingPlayLayout.feedbackMotion.size;
    const layout = writingFeedbackMotionLayout(sceneId, correct);
    const baseY = WritingPlayLayout.feedbackMotion.position.y + (layout.offsetY ?? 0);
    const finalX = x + (layout.offsetX ?? 0);
    const targetScale = layout.scale;
    const dunhuangRise = sceneId === 'dunhuang' && correct;
    const finalY = baseY + (
      dunhuangRise ? DUNHUANG_TREASURE_FEEDBACK.riseFinalLiftY : 0
    );
    this.fallbackImage.getComponent(UITransform)?.setContentSize(fw, fh);
    this.fallbackSprite.getComponent(UITransform)?.setContentSize(fw, fh);
    this.fallbackMotion.resize(fw, fh);
    Tween.stopAllByTarget(this.fallbackImage);
    if (dunhuangRise) {
      this.fallbackImage.setPosition(
        finalX,
        finalY - DUNHUANG_TREASURE_FEEDBACK.riseDistanceY,
      );
      this.fallbackImage.setScale(
        targetScale * 0.86,
        targetScale * 0.86,
        1,
      );
    } else {
      this.hideDunhuangRiseBeam();
      this.fallbackImage.setPosition(finalX, finalY);
      this.fallbackImage.setScale(targetScale * 0.88, targetScale * 0.88, 1);
    }
    this.fallbackImage.active = true;
    if (motionPath) {
      // Do not flash static sticker under webp (瞬间失真).
      this.fallbackSprite.active = false;
      this.fallbackMotion.show(motionPath, true, true, {
        onReady: () => {
          if (dunhuangRise) {
            this.playDunhuangRise(finalX, finalY, targetScale);
          }
          if (typeof document !== 'undefined') {
            document.body.dataset.feedbackMotionReady = 'true';
          }
          callbacks.onReady?.();
        },
        onError: () => {
          this.fallbackSprite.active = true;
          spriteLoader.apply(this.fallbackSprite, assetPath, 'contain');
          if (typeof document !== 'undefined') {
            document.body.dataset.feedbackMotionReady = 'error';
          }
          callbacks.onError?.();
        },
      });
    } else {
      this.fallbackSprite.active = true;
      spriteLoader.apply(this.fallbackSprite, assetPath, 'contain');
      this.fallbackMotion.hide();
      if (dunhuangRise) {
        this.playDunhuangRise(finalX, finalY, targetScale);
      }
      callbacks.onReady?.();
    }
    if (!dunhuangRise) {
      tween(this.fallbackImage)
        .to(
          0.18,
          { scale: new Vec3(targetScale, targetScale, 1) },
          { easing: 'backOut' },
        )
        .start();
    }
    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackMotionScale = targetScale.toFixed(3);
    }
  }

  private playDunhuangRise(x: number, finalY: number, targetScale: number): void {
    const durationSeconds = DUNHUANG_TREASURE_FEEDBACK.riseDurationMs / 1000;
    const startY = finalY - DUNHUANG_TREASURE_FEEDBACK.riseDistanceY;
    Tween.stopAllByTarget(this.fallbackImage);
    Tween.stopAllByTarget(this.dunhuangRiseBeam);
    Tween.stopAllByTarget(this.dunhuangRiseBeamOpacity);
    this.fallbackImage.setPosition(x, startY);
    this.fallbackImage.setScale(
      targetScale * 0.86,
      targetScale * 0.86,
      1,
    );
    this.dunhuangRiseBeam.active = true;
    this.dunhuangRiseBeam.setPosition(
      x,
      DUNHUANG_TREASURE_FEEDBACK.riseBeamBottomY,
    );
    this.dunhuangRiseBeam.setScale(0.72, 0.42, 1);
    this.dunhuangRiseBeamOpacity.opacity = 0;
    tween(this.dunhuangRiseBeam)
      .to(durationSeconds, { scale: Vec3.ONE }, { easing: 'quadOut' })
      .start();
    tween(this.dunhuangRiseBeamOpacity)
      .to(0.14, { opacity: 255 })
      .delay(Math.max(0, durationSeconds - 0.34))
      .to(0.2, { opacity: 218 })
      .start();
    tween(this.fallbackImage)
      .to(durationSeconds, {
        position: new Vec3(x, finalY, 0),
        scale: new Vec3(targetScale, targetScale, 1),
      }, { easing: 'quadOut' })
      .call(() => {
        if (typeof document !== 'undefined') {
          document.body.dataset.dunhuangTreasureRisePhase = 'risen';
        }
      })
      .start();
    if (typeof document !== 'undefined') {
      document.body.dataset.dunhuangTreasureRisePhase = 'rising';
      document.body.dataset.dunhuangTreasureRiseBeam = 'lotus-to-character';
    }
  }

  private hideDunhuangRiseBeam(): void {
    Tween.stopAllByTarget(this.dunhuangRiseBeam);
    Tween.stopAllByTarget(this.dunhuangRiseBeamOpacity);
    this.dunhuangRiseBeam.active = false;
    this.dunhuangRiseBeam.setScale(Vec3.ONE);
    this.dunhuangRiseBeamOpacity.opacity = 0;
  }

  private drawDunhuangRiseBeam(graphics: Graphics): void {
    const width = DUNHUANG_TREASURE_FEEDBACK.riseBeamWidth;
    const height = DUNHUANG_TREASURE_FEEDBACK.riseBeamHeight;
    graphics.fillColor = color('#FFD85A', 52);
    graphics.moveTo(-width * 0.48, 0);
    graphics.lineTo(-width * 0.2, height);
    graphics.lineTo(width * 0.2, height);
    graphics.lineTo(width * 0.48, 0);
    graphics.close();
    graphics.fill();
    graphics.fillColor = color('#FFE98A', 108);
    graphics.moveTo(-width * 0.25, 0);
    graphics.lineTo(-width * 0.11, height);
    graphics.lineTo(width * 0.11, height);
    graphics.lineTo(width * 0.25, 0);
    graphics.close();
    graphics.fill();
    graphics.fillColor = color('#FFF7C7', 190);
    graphics.roundRect(-10, 0, 20, height, 10);
    graphics.fill();
    graphics.fillColor = color('#FFFFFF', 245);
    graphics.roundRect(-4, 0, 8, height, 4);
    graphics.fill();
    graphics.fillColor = color('#FFE76C', 92);
    graphics.circle(0, 0, width * 0.42);
    graphics.fill();
    graphics.fillColor = color('#FFF8C8', 148);
    graphics.circle(0, 0, width * 0.22);
    graphics.fill();
  }

  private showStatic(
    staticFeedback: StaticFeedbackVariant, selectedIndex: number,
    chase?: FeedbackSequencePlan['chase'],
    keepStageMotion = false,
  ): void {
    this.fallbackMotion.hide();
    this.fallbackImage.active = false;
    if (!keepStageMotion) this.stageMotion.hide();
    this.applyFeedbackBackground(staticFeedback);
    this.layers.show(
      staticFeedback,
      selectedIndex,
      chase,
      this.choiceColumns,
      this.backdropScaleX,
    );
    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackLayers = String(staticFeedback.layers.length);
      document.body.dataset.feedbackLayer0 = staticFeedback.layers[0]?.path ?? '';
      document.body.dataset.feedbackSelected = String(selectedIndex);
    }
  }

  private applyFeedbackBackground(feedback: StaticFeedbackVariant): void {
    if (!feedback.background) return;
    spriteLoader.applyRemote(this.background, toAbsoluteUrl(feedback.background), 'cover');
  }
}
