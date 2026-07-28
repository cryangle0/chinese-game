import {
  Label, Node, tween, UIOpacity, UITransform, Vec3,
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

export class FeedbackView {
  private readonly root: Node;
  private readonly image: Node;
  private readonly messageRoot: Node;
  private readonly message: Label;
  private readonly motion: DomMotionSprite;
  private width: number;
  private height: number;
  private baseY: number;

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
        fit: 'fill',
        objectPosition: 'center bottom',
        // Zoom past webp transparent padding so the deer fills the impact box.
        fillOpaque: true,
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
  setLayout(layout: FeedbackLayoutBox): void {
    this.width = layout.width;
    this.height = layout.height;
    this.baseY = layout.y;
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
  ): void {
    this.root.active = true;
    this.root.setPosition(columnX, this.baseY);
    this.root.setScale(Vec3.ONE);
    this.root.getComponent(UITransform)?.setContentSize(this.width, this.height);
    this.ensureUnderlay(true);
    this.message.string = message || (correct ? '回答正确' : '再想一想');
    setLabelColor(this.message, correct ? '#18794E' : '#B4233D');
    // Hide white copy plate — it sat on the deer's feet and weakened impact.
    this.messageRoot.active = false;

    if (motionPath) {
      // Motion-only: never flash the static sticker (that was the “瞬间失真”).
      this.image.active = false;
      this.motion.show(motionPath, true);
    } else {
      this.motion.hide();
      this.image.active = true;
      this.image.getComponent(UITransform)?.setContentSize(this.width, this.height);
      spriteLoader.apply(this.image, assetPath, 'contain');
    }

    if (typeof document !== 'undefined') {
      document.body.dataset.feedbackX = String(columnX);
      document.body.dataset.feedbackY = String(this.baseY);
      document.body.dataset.feedbackW = String(this.width);
      document.body.dataset.feedbackH = String(this.height);
      document.body.dataset.feedbackCorrect = correct ? '1' : '0';
    }

    const opacity = this.root.getComponent(UIOpacity);
    if (!opacity) return;
    opacity.opacity = 0;
    // Pop-in overshoot for punch (scale from feet via DomMotionSprite origin).
    this.root.setScale(0.78, 0.78, 1);
    tween(opacity).to(0.12, { opacity: 255 }).start();
    tween(this.root)
      .to(0.22, { scale: new Vec3(1.1, 1.1, 1) }, { easing: 'backOut' })
      .to(0.1, { scale: Vec3.ONE })
      .start();
  }

  hide(): void {
    this.motion.hide();
    this.image.active = false;
    this.ensureUnderlay(false);
    this.root.active = false;
    if (typeof document !== 'undefined') {
      delete document.body.dataset.feedbackX;
      delete document.body.dataset.feedbackY;
      delete document.body.dataset.feedbackW;
      delete document.body.dataset.feedbackH;
      delete document.body.dataset.feedbackCorrect;
    }
  }

  dispose(): void {
    this.ensureUnderlay(false);
    this.motion.dispose();
  }

  /** Full-viewport dim so feedback webp edges do not leak the stage art. */
  private ensureUnderlay(show: boolean): void {
    if (typeof document === 'undefined') return;
    let underlay = document.getElementById('CustomerFeedbackUnderlay');
    if (!underlay) {
      underlay = document.createElement('div');
      underlay.id = 'CustomerFeedbackUnderlay';
      Object.assign(underlay.style, {
        position: 'fixed',
        inset: '0',
        background: 'rgba(5, 8, 11, 0.8)',
        zIndex: '34',
        display: 'none',
        pointerEvents: 'none',
      });
      document.body.appendChild(underlay);
    }
    underlay.style.background = 'rgba(5, 8, 11, 0.8)';
    underlay.style.display = show ? 'block' : 'none';
  }
}
