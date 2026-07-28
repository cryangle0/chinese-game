import { Node } from 'cc';
import { AppConfig } from '../../shared/config/AppConfig';
import { resolveMotionTransform } from '../../core/media/DomMotionTransform';

export interface DomResultScoreStyle {
  readonly fontSize: number;
  readonly color: string;
  readonly outline: string;
}

/** Score text above DomMotionSprite (z12) so feet never hide「总分」. */
export function mountDomResultScore(
  host: Node,
  contentRoot: Node,
  text: string,
  box: { width: number; height: number; position: { x: number; y: number } },
  style: DomResultScoreStyle,
): void {
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.dataset.resultScoreDom = '1';
  el.textContent = text;
  Object.assign(el.style, {
    position: 'fixed',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
    userSelect: 'none',
    zIndex: '22',
    fontWeight: '700',
    fontFamily: 'system-ui, "PingFang SC", "Microsoft YaHei", sans-serif',
    color: style.color,
    fontSize: `${style.fontSize}px`,
    textShadow: [
      `-2px 0 ${style.outline}`, `2px 0 ${style.outline}`,
      `0 -2px ${style.outline}`, `0 2px ${style.outline}`,
    ].join(','),
    whiteSpace: 'nowrap',
  } as CSSStyleDeclaration);
  document.body.appendChild(el);

  const layout = (): void => {
    if (!host.isValid) return;
    const canvas = document.getElementById('GameCanvas');
    if (!canvas) return;
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(bounds.width / AppConfig.designWidth, bounds.height / AppConfig.designHeight);
    const left = bounds.left + (bounds.width - AppConfig.designWidth * scale) / 2;
    const top = bounds.top + (bounds.height - AppConfig.designHeight * scale) / 2;
    const transform = resolveMotionTransform(host, { contentRoot });
    const positionScaleX = Number(document.body.dataset.resultPositionScaleX) || 1;
    const x = transform.x + box.position.x * transform.scaleX * positionScaleX;
    const y = transform.y + box.position.y * transform.scaleY;
    const w = box.width * Math.abs(transform.scaleX) * scale;
    const h = box.height * Math.abs(transform.scaleY) * scale;
    el.style.left = `${left + (AppConfig.designWidth / 2 + x) * scale - w / 2}px`;
    el.style.top = `${top + (AppConfig.designHeight / 2 - y) * scale - h / 2}px`;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    el.style.fontSize = `${style.fontSize * scale}px`;
  };

  layout();
  window.addEventListener('resize', layout);
  host.once(Node.EventType.NODE_DESTROYED, () => {
    window.removeEventListener('resize', layout);
    el.remove();
  });
}
