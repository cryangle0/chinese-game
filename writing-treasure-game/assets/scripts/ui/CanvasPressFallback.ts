import { Node } from 'cc';

/** Maps GameCanvas pointer events into design-space presses (iOS web-view safe). */
export function installCanvasPressFallback(
  root: Node,
  hitTest: (x: number, y: number) => boolean,
  onDown: () => void,
  onUp: () => void,
): void {
  if (typeof document === 'undefined') return;
  const canvas = document.getElementById('GameCanvas');
  if (!canvas) return;
  let pressed = false;
  const toDesign = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    const scale = Math.min(bounds.width / 1440, bounds.height / 810);
    const offsetX = (bounds.width - 1440 * scale) / 2;
    const offsetY = (bounds.height - 810 * scale) / 2;
    return {
      x: (event.clientX - bounds.left - offsetX) / scale - 720,
      y: 405 - (event.clientY - bounds.top - offsetY) / scale,
    };
  };
  const down = (event: PointerEvent) => {
    const point = toDesign(event);
    if (!hitTest(point.x, point.y)) return;
    pressed = true;
    onDown();
  };
  const up = () => {
    if (!pressed) return;
    pressed = false;
    onUp();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  root.once(Node.EventType.NODE_DESTROYED, () => {
    canvas.removeEventListener('pointerdown', down);
    canvas.removeEventListener('pointerup', up);
    canvas.removeEventListener('pointercancel', up);
  });
}
