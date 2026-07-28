import { Node, tween, Tween, UIOpacity, UITransform, Vec3 } from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { DomMotionSprite } from '../core/media/DomMotionSprite';
import { createUiNode } from '../core/ui/UiFactory';
import {
  feedbackStageMotionPath, FeedbackSequencePlan,
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
  ): void {
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
      this.stageMotion.show(feedbackStageMotionPath(motionPath, selectedIndex), selectedIndex);
      if (staticFeedback) this.showStatic(staticFeedback, selectedIndex, undefined, true);
      return;
    }

    if (staticFeedback && motionPath && sequencePlan) {
      this.usingStatic = true;
      this.applyFeedbackBackground(staticFeedback);
      this.showMotion(assetPath, motionPath, selectedIndex);
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
      return;
    }

    if (motionPath) {
      this.usingStatic = false;
      this.showMotion(assetPath, motionPath, selectedIndex);
      return;
    }

    this.usingStatic = false;
    this.showMotion(assetPath, undefined, selectedIndex);
  }

  hide(): void {
    Tween.stopAllByTarget(this.root);
    this.fallbackMotion.hide();
    this.layers.hide();
    this.stageMotion.hide();
    this.fallbackSprite.active = false;
    this.fallbackImage.active = false;
    if (this.usingStatic && this.restoreBackground) {
      spriteLoader.apply(this.background, this.restoreBackground, 'cover');
    }
    this.usingStatic = false;
    this.root.active = false;
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
    this.fallbackMotion.dispose();
    this.layers.dispose();
    this.stageMotion.dispose();
  }

  private showMotion(
    assetPath: string,
    motionPath: string | undefined,
    selectedIndex: number,
  ): void {
    this.layers.hide();
    this.stageMotion.hide();
    const columns = this.choiceColumns;
    const col = Math.max(0, Math.min(columns.length - 1, selectedIndex));
    const x = columns[col] ?? 0;
    const [fw, fh] = WritingPlayLayout.feedbackMotion.size;
    const y = WritingPlayLayout.feedbackMotion.position.y;
    this.fallbackImage.getComponent(UITransform)?.setContentSize(fw, fh);
    this.fallbackSprite.getComponent(UITransform)?.setContentSize(fw, fh);
    this.fallbackMotion.resize(fw, fh);
    this.fallbackImage.setPosition(x, y);
    this.fallbackImage.active = true;
    if (motionPath) {
      // Do not flash static sticker under webp (瞬间失真).
      this.fallbackSprite.active = false;
      this.fallbackMotion.show(motionPath, true);
    } else {
      this.fallbackSprite.active = true;
      spriteLoader.apply(this.fallbackSprite, assetPath, 'contain');
      this.fallbackMotion.hide();
    }
    this.fallbackImage.setScale(0.88, 0.88, 1);
    tween(this.fallbackImage).to(0.18, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
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
