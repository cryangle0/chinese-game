import {
  Color, Graphics, Node, Tween, UIOpacity, UITransform, Vec3, tween,
} from 'cc';

/** Hold before leaving intro so shatter FX is visible (~reference SplashOverlay). */
export const INTRO_START_FX_HOLD_MS = 700;

export interface IntroStartTransitionTargets {
  root: Node;
  button: Node;
  character: Node;
  onDone: () => void;
}

/** Deer hop + start-button explode/sparkles, then onDone. */
export function playIntroStartTransition(targets: IntroStartTransitionTargets): void {
  const { root, button, character, onDone } = targets;
  if (!root.isValid || !button.isValid) {
    onDone();
    return;
  }
  playCharacterHop(character);
  playButtonPress(button);
  const btnPos = button.position.clone();
  const explodeAt = 180;
  const finishAt = INTRO_START_FX_HOLD_MS;
  const explodeTimer = setTimeout(() => {
    if (!root.isValid || !button.isValid) return;
    try {
      burstSparkles(root, btnPos.x, btnPos.y, 10, [
        new Color(255, 240, 110, 255),
        new Color(255, 200, 80, 255),
        new Color(255, 255, 255, 255),
      ], 360);
      burstSparkles(root, btnPos.x, btnPos.y, 6, [
        new Color(120, 220, 255, 255),
        new Color(255, 255, 255, 255),
      ], 460);
      explodeButton(root, button);
    } catch {
      // Visual FX is best-effort; timing gate below still enters play.
    }
  }, explodeAt);
  const doneTimer = setTimeout(() => {
    clearTimeout(explodeTimer);
    if (root.isValid) onDone();
  }, finishAt);
  if (typeof root.once === 'function') {
    root.once(Node.EventType.NODE_DESTROYED, () => {
      clearTimeout(explodeTimer);
      clearTimeout(doneTimer);
    });
  }
}

function playCharacterHop(character: Node): void {
  if (!character.isValid) return;
  Tween.stopAllByTarget(character);
  const base = character.position.clone();
  tween(character)
    .to(0.22, { position: new Vec3(base.x, base.y + 110, 0) }, { easing: 'cubicOut' })
    .to(0.2, { position: base }, { easing: 'cubicIn' })
    .to(0.1, { scale: new Vec3(1.15, 0.85, 1) }, { easing: 'cubicOut' })
    .to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' })
    .start();
}

function playButtonPress(button: Node): void {
  if (!button.isValid) return;
  Tween.stopAllByTarget(button);
  const s = button.scale.clone();
  tween(button)
    .to(0.07, { scale: new Vec3(s.x * 0.9, s.y * 0.9, 1) }, { easing: 'cubicOut' })
    .to(0.12, { scale: new Vec3(s.x * 1.06, s.y * 1.06, 1) }, { easing: 'backOut' })
    .start();
}

function explodeButton(root: Node, button: Node): void {
  if (!button.isValid || !root.isValid) return;
  const cx = button.position.x;
  const cy = button.position.y;
  const btnOp = button.getComponent(UIOpacity) ?? button.addComponent(UIOpacity);
  tween(button)
    .to(0.18, { scale: new Vec3(1.32, 1.32, 1) }, { easing: 'cubicOut' })
    .to(0.28, { scale: new Vec3(1.65, 1.65, 1) }, { easing: 'cubicOut' })
    .start();
  tween(btnOp).delay(0.06).to(0.32, { opacity: 0 }, { easing: 'sineIn' }).start();

  const palette = [
    new Color(255, 213, 79, 255),
    new Color(255, 138, 101, 255),
    new Color(255, 87, 87, 255),
    new Color(124, 244, 161, 255),
    new Color(110, 200, 255, 255),
  ];
  for (let i = 0; i < 10; i++) {
    const p = new Node(`IntroParticle${i}`);
    p.layer = root.layer;
    root.addChild(p);
    p.setPosition(cx, cy, 0);
    p.addComponent(UITransform).setContentSize(20, 20);
    const g = p.addComponent(Graphics);
    g.fillColor = palette[i % palette.length];
    const radius = 5 + Math.random() * 5;
    g.rect(-radius, -radius, radius * 2, radius * 2);
    g.fill();
    const angle = (i / 10) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 140 + Math.random() * 100;
    const op = p.addComponent(UIOpacity);
    tween(p)
      .to(0.6 + Math.random() * 0.2, {
        position: new Vec3(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist + 30, 0),
      }, { easing: 'cubicOut' })
      .start();
    tween(p).to(0.7, { scale: new Vec3(0.4, 0.4, 1) }, { easing: 'cubicOut' }).start();
    tween(op).delay(0.2).to(0.42, { opacity: 0 }, { easing: 'sineIn' })
      .call(() => { if (p.isValid) p.destroy(); }).start();
  }
}

function burstSparkles(
  root: Node, cx: number, cy: number, count: number, colors: Color[], spread: number,
): void {
  if (!root.isValid) return;
  for (let i = 0; i < count; i++) {
    const star = new Node('IntroSparkle');
    star.layer = root.layer;
    root.addChild(star);
    star.setPosition(cx, cy, 0);
    star.addComponent(UITransform).setContentSize(28, 28);
    const g = star.addComponent(Graphics);
    g.fillColor = colors[i % colors.length];
    const r = 4 + Math.random() * 5;
    drawSparkle(g, r);
    g.fill();
    const angle = Math.random() * Math.PI * 2;
    const dist = spread * (0.5 + Math.random() * 0.7);
    const dur = 0.7 + Math.random() * 0.4;
    const op = star.addComponent(UIOpacity);
    tween(star).to(dur, {
      position: new Vec3(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist + 20, 0),
      scale: new Vec3(0.3, 0.3, 1),
      angle: 180 + Math.random() * 180,
    }, { easing: 'cubicOut' }).start();
    tween(op).delay(dur * 0.4).to(dur * 0.6, { opacity: 0 }, { easing: 'sineIn' })
      .call(() => { if (star.isValid) star.destroy(); }).start();
  }
}

function drawSparkle(graphics: Graphics, radius: number): void {
  const inner = radius * 0.38;
  graphics.moveTo(0, radius);
  graphics.lineTo(inner, inner);
  graphics.lineTo(radius, 0);
  graphics.lineTo(inner, -inner);
  graphics.lineTo(0, -radius);
  graphics.lineTo(-inner, -inner);
  graphics.lineTo(-radius, 0);
  graphics.lineTo(-inner, inner);
  graphics.close();
}
