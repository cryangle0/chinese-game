import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { readingThemes } from '../assets/scripts/games/reading-jumper/config/ReadingTheme';

describe('Reading locomotion quality pipeline', () => {
  const script = readFileSync(resolve(
    __dirname,
    '../tools/assets/build-reading-locomotion-sheets.mjs',
  ), 'utf8');
  const theme = readFileSync(resolve(
    __dirname,
    '../assets/scripts/games/reading-jumper/config/ReadingTheme.ts',
  ), 'utf8');

  it('copies original PNG pixels into RGBA sprite sheets without resizing', () => {
    expect(script).toContain('PNG.sync.read');
    expect(script).toContain('PNG.bitblt');
    expect(script).toContain('colorType: 6');
    expect(script).not.toContain('resize');
    expect(script).not.toContain('scale');
  });

  it('keeps every source frame in a four-column texture-safe grid', () => {
    expect(script).toContain('const columns = 4;');
    expect(script).toContain('frames.forEach(({ image }, index)');
    expect(script).toContain('Math.ceil(frames.length / columns)');
  });

  it('uses faster idle playback without changing directional travel cadence', () => {
    expect(theme).toContain('const locomotionIdleSheetFps = 20;');
    expect(theme).toContain('const locomotionTravelSheetFps = 15;');
    expect(theme).toContain(
      "fps: action === 'idle' ? locomotionIdleSheetFps : locomotionTravelSheetFps",
    );
    expect(theme).toContain("characterIdleAnimation: locomotionSheet(id, 'idle', spec.idle)");
    expect(theme).toContain(
      "characterRunLeftAnimation: locomotionSheet(id, 'run-left', spec.runLeft)",
    );
    expect(theme).toContain(
      "characterRunRightAnimation: locomotionSheet(id, 'run-right', spec.runRight)",
    );
    expect(theme).toContain(
      'width: 218, height: 340, idle: 17, runLeft: 16, runRight: 13',
    );
    expect(theme).toContain(
      "width: 397, height: 341, idle: 17, runLeft: 15, runRight: 15",
    );
  });

  it('renders cropped locomotion frames at full character-box height', () => {
    const player = readFileSync(resolve(
      __dirname,
      '../assets/scripts/core/assets/SpriteSheetPlayer.ts',
    ), 'utf8');
    expect(player).toContain(
      'const scale = hostTransform.contentSize.height / active.spec.frameHeight;',
    );
    expect(player).not.toContain("}, 'contain');");
  });

  it('does not ship retired locomotion WebP fallbacks beside sprite sheets', () => {
    readingThemes.forEach((theme) => {
      expect(theme.assets.motion?.idle).toBeUndefined();
      expect(theme.assets.motion?.runLeft).toBeUndefined();
      expect(theme.assets.motion?.runRight).toBeUndefined();
      expect(theme.assets.characterIdleAnimation).toBeDefined();
      expect(theme.assets.characterRunLeftAnimation).toBeDefined();
      expect(theme.assets.characterRunRightAnimation).toBeDefined();
    });
  });
});
