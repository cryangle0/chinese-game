import { Node, tween, Vec3 } from 'cc';

export function runDeerTo(
  root: Node,
  x: number,
  baseY: number,
  done: () => void,
  settleSeconds = 0,
): void {
  const sequence = tween(root)
    .to(0.42, { position: new Vec3(x, baseY) }, { easing: 'quadOut' });
  if (settleSeconds > 0) sequence.delay(settleSeconds);
  sequence.call(done).start();
}

export function jumpDeerAt(
  root: Node,
  x: number,
  baseY: number,
  landingHoldSeconds: number,
  onApex: (() => void) | undefined,
  done: () => void,
): void {
  tween(root)
    .to(0.26, { position: new Vec3(x, baseY + 95) }, { easing: 'quadOut' })
    .call(() => onApex?.())
    .to(0.2, { position: new Vec3(x, baseY) }, { easing: 'quadIn' })
    .delay(landingHoldSeconds)
    .call(done)
    .start();
}
