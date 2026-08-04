import { Node, tween, Vec3 } from 'cc';
import { READING_BRICK_IMPACT_LIFT } from '../config/ReadingLayout';

export function runDeerTo(
  root: Node,
  x: number,
  baseY: number,
  done: () => void,
  settleSeconds = 0,
  travelSeconds = 0.42,
  smoothTravel = false,
): void {
  const sequence = tween(root)
    .to(
      travelSeconds,
      { position: new Vec3(x, baseY) },
      { easing: smoothTravel ? 'quadInOut' : 'quadOut' },
    );
  if (settleSeconds > 0) sequence.delay(settleSeconds);
  sequence.call(done).start();
}

export function jumpDeerAt(
  root: Node,
  x: number,
  baseY: number,
  jumpHeight: number,
  landingHoldSeconds: number,
  onApex: (() => void) | undefined,
  done: () => void,
): void {
  tween(root)
    .to(0.26, { position: new Vec3(x, baseY + jumpHeight) }, { easing: 'quadOut' })
    .call(() => onApex?.())
    .to(
      0.07,
      { position: new Vec3(x, baseY + jumpHeight + READING_BRICK_IMPACT_LIFT) },
      { easing: 'quadOut' },
    )
    .to(0.2, { position: new Vec3(x, baseY) }, { easing: 'quadIn' })
    .delay(landingHoldSeconds)
    .call(done)
    .start();
}
