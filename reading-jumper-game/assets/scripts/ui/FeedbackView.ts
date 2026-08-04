import {
  Label, Node, tween, Tween, UIOpacity, UITransform, Vec3,
} from 'cc';
import { spriteLoader } from '../core/assets/SpriteLoader';
import { DomMotionSprite } from '../core/media/DomMotionSprite';
import {
  createLabel, createUiNode, drawPanel, setLabelColor,
} from '../core/ui/UiFactory';

export interface FeedbackLayoutBox {
  readonly width: number;
  readonly height: number;
  readonly y: number;
}

export interface FeedbackPresentationOptions {
  readonly animateIn?: boolean;
  readonly scale?: number;
  readonly offsetY?: number;
  readonly isolateTimeline?: boolean;
}

export interface FeedbackMotionCallbacks {
  readonly onReady?: () => void;
  readonly onError?: () => void;
}

interface FeedbackMotionLayout {
  readonly scale: number;
  readonly offsetY?: number;
}

const feedbackLayout: Readonly<Record<string, {
  readonly correct: FeedbackMotionLayout;
  readonly wrong: FeedbackMotionLayout;
}>> = {
  mario: { correct: { scale: 1.28 }, wrong: { scale: 1.26 } },
  'deep-sea': { correct: { scale: 1.22 }, wrong: { scale: 1.22 } },
  food: { correct: { scale: 1.28 }, wrong: { scale: 1.2 } },
  poetry: { correct: { scale: 1.16 }, wrong: { scale: 1.3 } },
  space: {
    // Space WebPs have unusually tall transparent canvases. Pin their visible
    // bottom to the painted platform instead of the bottom of the design stage.
    correct: { scale: 1.25, offsetY: 138 },
    wrong: { scale: 1.45, offsetY: 133 },
  },
};

export class FeedbackView {
  private readonly root: Node;
  private readonly image: Node;
  private readonly messageRoot: Node;
  private readonly message: Label;
  private readonly motion: DomMotionSprite;
  private width: number;
  private height: number;
  private baseY: number;
  private sceneId = 'mario';

  constructor(parent: Node, position: Vec3, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.baseY = position.y;
    this.root = createUiNode(parent, 'Feedback', this.width, this.height, position);
    this.root.addComponent(UIOpacity);
    // Fallback sticker — only used when motion webp is missing; kept inactive while webp plays.
    this.image = createUiNode(this.root, 'FeedbackImage', width, height, Vec3.ZERO);
    this.image.active = false;
    this.motion = new DomMotionSprite(
      this.root,
      null,
      width,
      height,
      {
        zIndex: 36,
        // Feedback files keep their source aspect ratio. The old fillOpaque
        // path enlarged transparent-padding-free content and then stretched
        // it into a fixed canvas, which made tall/wide scenes visibly blur.
        fit: 'contain',
        objectPosition: 'center bottom',
        pinFeet: true,
        suppressFallback: true,
      },
    );
    this.messageRoot = createUiNode(
      this.root,
      'FeedbackMessage',
      Math.max(280, this.width - 40),
      64,
      new Vec3(0, -this.height / 2 + 48),
    );
    drawPanel(this.messageRoot, '#FFFFFF', 16, 238);
    this.message = createLabel(this.messageRoot, '', {
      size: 20,
      color: '#245A42',
      width: Math.max(240, this.width - 64),
      height: 54,
      bold: true,
    });
    // Text cue is the deer motion; keep copy for a11y/tests but off-screen impact.
    this.messageRoot.active = false;
    this.root.active = false;
  }

  /** Apply HTML-measured feedback box for the current theme (feet on ground). */
  setLayout(layout: FeedbackLayoutBox, sceneId = 'mario'): void {
    this.width = layout.width;
    this.height = layout.height;
    this.baseY = layout.y;
    this.sceneId = sceneId;
    this.root.getComponent(UITransform)?.setContentSize(this.width, this.height);
    this.root.setPosition(this.root.position.x, this.baseY);
    this.image.getComponent(UITransform)?.setContentSize(this.width, this.height);
    this.image.setPosition(0, 0);
    this.motion.resize(this.width, this.height);
    this.messageRoot.getComponent(UITransform)?.setContentSize(
      Math.max(280, this.width - 40),
      64,
    );
    this.messageRoot.setPosition(0, -this.height / 2 + 48);
    this.message.node.getComponent(UITransform)?.setContentSize(
      Math.max(240, this.width - 64),
      54,
    );
  }

  show(
    correct: boolean,
    assetPath: string,
    message = '',
    motionPath?: string,
    columnX = 0,
    presentation: FeedbackPresentationOptions = {},
    callbacks: FeedbackMotionCallbacks = {},
  ): void {
    this.removeLegacyFeedbackShade();
    const sceneLayout = feedbackLayout[this.sceneId] ?? feedbackLayout.mario;
    const motionLayout = correct ? sceneLayout.correct : sceneLayout.wrong;
    const targetScale = presentation.scale ?? motionLayout.scale;
    const targetY = this.baseY + (presentation.offsetY ?? motionLayout.offsetY ?? 0);
    const animateIn = presentation.animateIn ?? true;
    Tween.stopAllByTarget(this.root);
    const opacity = this.root.getComponent(UIOpacity);
    if (opacity) Tween.stopAllByTarget(opacity);
    this.root.active = true;
    this.root.setPosition(columnX, targetY);
    this.root.setScale(targetScale, targetScale, 1);
    this.root.getComponent(UITransform)?.setContentSize(this.width, this.height);
    this.message.string = message || (correct ? '回答正确' : '再想一想');
    setLabelColor(this.message, correct ? '#18794E' : '#B4233D');
    // Hide white copy plate — it sat on the deer's feet and weakened impact.
    this.messageRoot.active = false;

    if (motionPath) {
      // Motion-only: never flash the static sticker (that was the “瞬间失真”).
      this.image.active = false;
      // Every feedback WebP is one-shot. Isolate it from the preloaded/previous
      // decoder timeline so repeated answers cannot open on the cached final frame.
      this.motion.show(
        motionPath,
        true,
        true,
        {
          onReady: () => {
            if (typeof document !== 'undefined') {
              document.body.dataset.feedbackMotionReady = 'true';
            }
            callbacks.onReady?.();
          },
          onError: () => {
            this.image.active = true;
            this.image.getComponent(UITransform)?.setContentSize(this.width, this.height);
            spriteLoader.apply(this.image, assetPath, 'contain');
            if (typeof document !== 'undefined') {
              document.body.dataset.feedbackMotionReady = 'error';
            }
            callbacks.onError?.();
          },
        },
      );
    } else {
      this.motion.hide();
      this.image.active = true;
      this.image.getComponent(UITransform)?.setContentSize(this.width, this.height);
      spriteLoader.apply(this.image, assetPath, 'contain');
      callbacks.onReady?.();
    }

    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackX = String(columnX);
      document.body.dataset.feedbackY = String(targetY);
      document.body.dataset.feedbackBaseY = String(this.baseY);
      document.body.dataset.feedbackW = String(this.width);
      document.body.dataset.feedbackH = String(this.height);
      document.body.dataset.feedbackCorrect = correct ? '1' : '0';
      document.body.dataset.feedbackScale = targetScale.toFixed(3);
      document.body.dataset.feedbackPresentation = animateIn ? 'pop' : 'timeline';
      document.body.dataset.feedbackUnderlay = '0';
    }

    if (!opacity) return;
    if (!animateIn) {
      opacity.opacity = 255;
      return;
    }
    opacity.opacity = 0;
    // Pop-in overshoot for punch (scale from feet via DomMotionSprite origin).
    this.root.setScale(targetScale * 0.78, targetScale * 0.78, 1);
    tween(opacity).to(0.12, { opacity: 255 }).start();
    tween(this.root)
      .to(
        0.22,
        { scale: new Vec3(targetScale * 1.06, targetScale * 1.06, 1) },
        { easing: 'backOut' },
      )
      .to(0.1, { scale: new Vec3(targetScale, targetScale, 1) })
      .start();
  }

  hide(): void {
    Tween.stopAllByTarget(this.root);
    const opacity = this.root.getComponent(UIOpacity);
    if (opacity) Tween.stopAllByTarget(opacity);
    this.motion.hide();
    this.image.active = false;
    this.removeLegacyFeedbackShade();
    this.root.active = false;
    if (typeof document !== 'undefined') {
      delete document.body.dataset.feedbackX;
      delete document.body.dataset.feedbackY;
      delete document.body.dataset.feedbackBaseY;
      delete document.body.dataset.feedbackW;
      delete document.body.dataset.feedbackH;
      delete document.body.dataset.feedbackCorrect;
      delete document.body.dataset.feedbackScale;
      delete document.body.dataset.feedbackPresentation;
      delete document.body.dataset.feedbackUnderlay;
      delete document.body.dataset.feedbackMotionReady;
    }
  }

  dispose(): void {
    this.removeLegacyFeedbackShade();
    this.motion.dispose();
  }

  private removeLegacyFeedbackShade(): void {
    if (typeof document === 'undefined') return;
    document.getElementById('CustomerFeedbackUnderlay')?.remove();
  }
}
