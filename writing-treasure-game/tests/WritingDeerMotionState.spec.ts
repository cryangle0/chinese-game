import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Writing deer motion states', () => {
  const view = readFileSync(resolve(
    __dirname,
    '../assets/scripts/games/writing-treasure/views/WizardDeerView.ts',
  ), 'utf8');
  const controller = readFileSync(resolve(
    __dirname,
    '../assets/scripts/games/writing-treasure/controllers/WritingGameController.ts',
  ), 'utf8');
  const sceneLayout = readFileSync(resolve(
    __dirname,
    '../assets/scripts/shared/config/WritingSceneCharacter.ts',
  ), 'utf8');
  const theme = readFileSync(resolve(
    __dirname,
    '../assets/scripts/games/writing-treasure/config/WritingTheme.ts',
  ), 'utf8');

  it('uses a static sprite with a subtle breathing offset while idle', () => {
    expect(view).toContain('const IDLE_BREATH_AMPLITUDE = 4;');
    expect(view).toContain('this.motion.hide();');
    expect(view).toContain("document.body.dataset.deerIdleMode = 'breathing-static';");
    expect(view).not.toContain('this.motion.show(this.motionAssets?.idle);');
    expect(controller).toContain('this.view.deer.update(deltaSeconds);');
  });

  it('moves horizontally slightly faster than Reading Jumper', () => {
    expect(view).toContain('const HORIZONTAL_RUN_PIXELS_PER_SECOND = 330;');
    expect(view).toContain('travelDistance / HORIZONTAL_RUN_PIXELS_PER_SECOND');
    expect(view).toContain('columnX < startX');
    expect(view).toContain("document.body.dataset.deerHorizontalRunDuration");
    expect(view).not.toContain('.to(0.28, {');
  });

  it('keeps idle characters at the customer prototype sizes', () => {
    expect(sceneLayout).toContain('idle: box(614, 168, 173, 253)');
    expect(sceneLayout).toContain('idle: box(609, 175, 179, 256)');
    expect(sceneLayout).toContain('idle: box(627, 161, 187, 259)');
    expect(sceneLayout).toContain('idle: box(595, 172, 250, 250)');
    expect(sceneLayout).toContain('idle: box(614, 125, 200, 297)');
  });

  it('uses independent road-aligned boxes while running', () => {
    expect(sceneLayout).toContain('run: box(477.26, -77.56, 446.47, 498.56)');
    expect(sceneLayout).toContain('run: box(480.98, -171.35, 435.03, 602.35)');
    expect(sceneLayout).toContain('run: box(515.2, -148.54, 410.61, 568.54)');
    expect(sceneLayout).toContain('run: box(595, 75.85, 250, 346.15)');
    expect(sceneLayout).toContain('run: box(521.91, -109.94, 384.18, 531.94)');
    expect(view).toContain('this.motion.setPinFeet(true);');
    expect(view).toContain('this.applyActionPose(columnX)');
  });

  it('preserves the source aspect ratio for run and action motion', () => {
    expect(view.match(/this\.motion\.setFit\('contain'\);/g)).toHaveLength(4);
    expect(view).not.toContain("this.motion.setFit('fill');");
    expect(theme).toContain("const characterMotionVersion = id === 'treasure'");
    expect(theme).toContain('action: `${media}/action.webp${characterMotionVersion}`');
    expect(theme).toContain('runLeft: `${media}/run-left.webp${characterMotionVersion}`');
    expect(theme).toContain('runRight: `${media}/run-right.webp${characterMotionVersion}`');
  });

  it('keeps the existing first-stage entrance timing', () => {
    expect(view).toContain('durationSeconds: 1.18');
    expect(view).toContain('.to(InitialEntry.durationSeconds, {');
  });

  it('uses the road-aligned run box throughout the first-stage entrance', () => {
    expect(view).toContain('const startX = -720 - run.size[0] / 2');
    expect(view).toContain('this.applyFrame(run.size[0], run.size[1]);');
    expect(view).toContain('this.root.setPosition(startX, run.position.y, 0);');
    expect(view).toContain('position: new Vec3(idle.position.x, run.position.y, 0)');
    expect(view).not.toContain('const startX = -720 - idle.size[0] / 2');
  });

  it('waits for running motion before atomically changing the movement frame', () => {
    const showIndex = view.indexOf('this.motion.show(runAsset, true, false, {');
    const readyIndex = view.indexOf('onReady: startRun');
    expect(showIndex).toBeGreaterThanOrEqual(0);
    expect(readyIndex).toBeGreaterThan(showIndex);
    expect(view).toContain('if (runStarted) return;');
    expect(view).not.toContain(
      "this.applyFrame(run.size[0], run.size[1]);\n    this.root.setPosition(startX",
    );
    const castSection = view.slice(
      view.indexOf('castAt(columnX'),
      view.indexOf('idle(preserveColumn'),
    );
    expect(castSection).not.toContain(
      "spriteLoader.apply(this.visual, this.actionAsset, 'contain');",
    );
  });
});
