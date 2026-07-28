import { Node, UITransform, view } from 'cc';
import { AppConfig } from '../../shared/config/AppConfig';

export class ResponsiveRoot {
  constructor(private readonly root: Node) {}

  apply(): void {
    // Letterbox the 1440×810 stage into the full visible canvas (not safe-area).
    // Side gaps are filled by stretch-X scene backgrounds + HTML sky color.
    const visible = view.getVisibleSize();
    const width = Math.max(1, visible.width);
    const height = Math.max(1, visible.height);
    const baseAspect = AppConfig.designWidth / AppConfig.designHeight;
    const actualAspect = width / height;
    const scale = actualAspect > baseAspect
      ? height / AppConfig.designHeight
      : width / AppConfig.designWidth;
    this.root.setScale(scale, scale, 1);
    this.root.setPosition(0, 0);
    this.root.getComponent(UITransform)?.setContentSize(
      AppConfig.designWidth,
      AppConfig.designHeight,
    );
    if (typeof document !== 'undefined') {
      Object.assign(document.body.dataset, {
        stageScale: scale.toFixed(6),
        stageVisible: `${Math.round(width)}x${Math.round(height)}`,
        stageAspect: actualAspect.toFixed(4),
      });
    }
  }
}

export function responsiveBackdropWidth(): number {
  const visible = view.getVisibleSize();
  const aspect = visible.width / Math.max(1, visible.height);
  return Math.min(
    AppConfig.backdropWidth,
    Math.max(AppConfig.designWidth, AppConfig.designHeight * aspect),
  );
}

export function responsiveBackdropScale(): number {
  return responsiveBackdropWidth() / AppConfig.designWidth;
}

/** Cover-center Y offset for settlement/backdrop layers scaled beyond the design frame. */
export function responsiveBackdropOffsetY(): number {
  return 0;
}

/**
 * Full-bleed scene backgrounds: stretch width to fill ultrawide, keep height at 1
 * so the full 1440×810 art stays visible (no cover crop, no letterbox bars).
 */
export function applyStretchXBackdrop(node: Node): number {
  const sx = responsiveBackdropScale();
  node.setScale(sx, 1, 1);
  node.setPosition(0, 0);
  return sx;
}

export function setResultLayoutDiagnostics(
  backdropScale: number,
  boardScale = backdropScale,
  artworkScale = backdropScale,
  artworkOffsetY = 0,
): void {
  if (typeof document === 'undefined') return;
  Object.assign(document.body.dataset, {
    resultArtworkScale: artworkScale.toFixed(6),
    resultArtworkOffsetY: String(artworkOffsetY),
    resultBackgroundScale: boardScale.toFixed(6),
    resultBackdropScale: backdropScale.toFixed(6),
  });
}

export function clearResultLayoutDiagnostics(): void {
  if (typeof document === 'undefined') return;
  delete document.body.dataset.resultArtworkScale;
  delete document.body.dataset.resultArtworkOffsetY;
  delete document.body.dataset.resultBackgroundScale;
  delete document.body.dataset.resultBackdropScale;
  delete document.body.dataset.resultBleedMode;
  delete document.body.dataset.resultPositionScaleX;
}
