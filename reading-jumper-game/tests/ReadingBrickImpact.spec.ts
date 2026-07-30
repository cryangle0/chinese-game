import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Reading brick impact feedback', () => {
  const source = readFileSync(resolve(
    __dirname,
    '../assets/scripts/games/reading-jumper/views/BrickGroupView.ts',
  ), 'utf8');

  it('raises and rebounds the selected brick at the jump apex', () => {
    expect(source).toContain('base.y + READING_BRICK_IMPACT_LIFT');
    expect(source).toContain("easing: 'backOut'");
    expect(source).toContain('document.body.dataset.brickImpact');
  });

  it('shares the brick lift distance with the character impact motion', () => {
    const motionSource = readFileSync(resolve(
      __dirname,
      '../assets/scripts/games/reading-jumper/views/DeerMotionTweens.ts',
    ), 'utf8');
    expect(motionSource).toContain('jumpHeight + READING_BRICK_IMPACT_LIFT');
    expect(motionSource).toContain('.to(');
  });
});
