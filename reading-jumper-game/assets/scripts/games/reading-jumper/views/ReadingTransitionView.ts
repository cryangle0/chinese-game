import { Node } from 'cc';
import { DomMotionSprite } from '../../../core/media/DomMotionSprite';
import { transitionHoldMs } from '../../../core/media/MotionPlayback';
import { createUiNode } from '../../../core/ui/UiFactory';
import { AppConfig } from '../../../shared/config/AppConfig';

export class ReadingTransitionView {
  private readonly anchor: Node;
  private readonly motion: DomMotionSprite;
  private timer = 0;

  constructor(parent: Node) {
    this.anchor = createUiNode(parent, 'CustomerTransition', 1440, 810);
    this.anchor.active = false;
    this.motion = new DomMotionSprite(
      this.anchor,
      null,
      1440,
      810,
      { fit: 'cover', zIndex: 40, fullscreen: true },
    );
  }

  play(source: string | undefined): void {
    if (!source || typeof window === 'undefined') return;
    if (this.timer) window.clearTimeout(this.timer);
    this.anchor.active = true;
    this.setUnderlayVisible(false);
    this.motion.show(source, true);
    this.markActive(source);
    const holdMs = Math.max(AppConfig.transitionSeconds * 1000, transitionHoldMs(source));
    this.timer = window.setTimeout(() => this.finish(), holdMs);
  }

  dispose(): void {
    if (this.timer && typeof window !== 'undefined') window.clearTimeout(this.timer);
    this.motion.dispose();
  }

  private finish(): void {
    this.motion.hide();
    this.anchor.active = false;
    this.setUnderlayVisible(false);
    this.timer = 0;
    if (typeof document !== 'undefined') {
      delete document.body.dataset.transitionActive;
      delete document.body.dataset.transitionUnderlay;
    }
  }

  private markActive(source: string): void {
    if (typeof document === 'undefined') return;
    document.body.dataset.transitionActive = 'true';
    document.body.dataset.transitionSrc = source;
    document.body.dataset.transitionUnderlay = 'theme';
  }

  private setUnderlayVisible(show: boolean): void {
    if (typeof document === 'undefined') return;
    const underlay = document.getElementById('CustomerTransitionUnderlay');
    if (!underlay) return;
    underlay.style.display = show ? 'block' : 'none';
    if (!show) {
      underlay.style.background = 'transparent';
      underlay.style.backgroundImage = '';
    }
  }
}
