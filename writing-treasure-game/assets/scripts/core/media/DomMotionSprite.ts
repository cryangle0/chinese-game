import { Node } from 'cc';
import { DomMotionImage } from './DomMotionImage';
import {
  applyFullscreenMotion, applyStageMotion, resolveMotionStageFrame,
} from './DomMotionLayout';
import { DomMotionOpaqueLayout } from './DomMotionOpaqueLayout';
import { resolveMotionTransform } from './DomMotionTransform';

export { prefetchMotion } from './DomMotionPrefetch';
export interface MotionSpriteOptions {
  readonly offsetX?: number;
  readonly offsetY?: number;
  readonly zIndex?: number;
  readonly fit?: 'contain' | 'cover' | 'fill';
  readonly objectPosition?: string;
  readonly contentRoot?: Node;
  readonly fullscreen?: boolean;
  readonly pinFeet?: boolean;
  readonly suppressFallback?: boolean;
}
export class DomMotionSprite {
  private readonly image: DomMotionImage | null;
  private readonly opaqueLayout: DomMotionOpaqueLayout | null;
  private frame = 0;
  private requestedVisible = false;
  private disposed = false;
  private pinFeet: boolean;
  private fitOverride: 'contain' | 'cover' | 'fill' | undefined;

  constructor(
    private readonly node: Node,
    private readonly fallback: Node | null,
    private width: number,
    private height: number,
    private readonly options: MotionSpriteOptions = {},
  ) {
    this.pinFeet = Boolean(options.pinFeet);
    if (typeof document === 'undefined') {
      this.image = null;
      this.opaqueLayout = null;
      return;
    }
    this.image = new DomMotionImage(options, () => this.onImageReady(), () => this.onImageError());
    this.image.element.dataset.customerMotion = node.name;
    this.opaqueLayout = new DomMotionOpaqueLayout();
  }

  show(source: string | undefined, restart = false): void {
    if (!source) {
      this.hide();
      return;
    }
    this.requestedVisible = true;
    if (!this.image) {
      if (this.fallback?.isValid) this.fallback.active = true;
      return;
    }
    const state = this.image.show(source, restart);
    if (state.changed || restart) this.opaqueLayout?.reset();
    const showFallback = !this.options.suppressFallback && !state.hadMotion;
    if (this.fallback?.isValid) this.fallback.active = showFallback && !this.image.ready();
    this.updateElement();
    this.ensureTicking();
  }

  hide(): void {
    this.requestedVisible = false;
    this.stopTicking();
    this.updateElement();
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.updateElement();
  }

  setPinFeet(enabled: boolean): void {
    this.pinFeet = enabled;
    this.updateElement();
  }

  setFit(fit: 'contain' | 'cover' | 'fill'): void {
    this.fitOverride = fit;
    if (this.image) this.image.element.style.objectFit = fit;
    this.updateElement();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopTicking();
    this.image?.dispose();
    if (this.fallback?.isValid) this.fallback.active = true;
  }

  private onImageReady(): void {
    if (this.fallback?.isValid) this.fallback.active = false;
    this.updateElement();
    this.ensureTicking();
  }

  private onImageError(): void {
    if (this.fallback?.isValid && !this.options.suppressFallback) this.fallback.active = true;
    this.updateElement();
    this.stopTicking();
  }

  private ensureTicking(): void {
    if (this.disposed || !this.image || !this.requestedVisible || this.frame) return;
    this.frame = requestAnimationFrame(() => this.tick());
  }

  private stopTicking(): void {
    if (!this.frame) return;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
  }

  private tick(): void {
    this.frame = 0;
    if (this.disposed || !this.requestedVisible) return;
    this.updateElement();
    this.frame = requestAnimationFrame(() => this.tick());
  }

  private updateElement(): void {
    if (!this.image) return;
    const canvas = document.getElementById('GameCanvas');
    const visible = this.requestedVisible
      && this.image.ready()
      && this.node.isValid
      && this.node.activeInHierarchy
      && canvas instanceof HTMLCanvasElement;
    this.image.setVisible(visible);
    if (!visible || !(canvas instanceof HTMLCanvasElement)) return;
    if (this.options.fullscreen) {
      this.layoutFullscreen(canvas);
      return;
    }
    this.layoutInStage(canvas);
  }

  private layoutFullscreen(canvas: HTMLCanvasElement): void {
    if (!this.image) return;
    applyFullscreenMotion(this.image.element, canvas);
  }

  private layoutInStage(canvas: HTMLCanvasElement): void {
    if (!this.image) return;
    const frame = resolveMotionStageFrame(canvas);
    const transform = resolveMotionTransform(this.node, this.options);
    if (this.pinFeet && this.opaqueLayout?.apply({
      image: this.image.element,
      source: this.image.source(),
      width: this.width,
      height: this.height,
      canvasScale: frame.scale,
      contentLeft: frame.left,
      contentTop: frame.top,
      transform,
      angle: this.node.angle,
      nodeScaleX: this.node.scale.x,
      nodeScaleY: this.node.scale.y,
    })) return;
    applyStageMotion({
      image: this.image.element,
      transform,
      ...frame,
      width: this.width,
      height: this.height,
      fit: this.fitOverride ?? this.options.fit ?? 'contain',
      objectPosition: this.options.objectPosition ?? 'center',
      angle: this.node.angle,
      nodeScaleX: this.node.scale.x,
      nodeScaleY: this.node.scale.y,
    });
  }
}
