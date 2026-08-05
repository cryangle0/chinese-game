import fs from 'node:fs';
import path from 'node:path';
import {
  DINOSAUR_TREASURE_FEEDBACK,
  dinosaurCorrectFrameBlend,
  dinosaurCorrectFrameIndex,
  dinosaurCorrectSequenceDurationMs,
  dinosaurCorrectStagePoint,
  dinosaurWrongChaseDurationMs,
  dinosaurWrongChasePoint,
  dinosaurWrongFrameBlend,
  dinosaurWrongFrameIndex,
  dinosaurWrongJumpPoint,
  dinosaurWrongReturnDurationMs,
} from '../assets/scripts/shared/config/DinosaurTreasureFeedback';
import {
  feedbackUsesStageMotion,
} from '../assets/scripts/shared/config/WritingFeedbackPolicy';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8')
    .replace(/\r\n/g, '\n');
}

describe('dinosaur treasure positive feedback', () => {
  const controller = source(
    '../assets/scripts/games/writing-treasure/controllers/TreasureInteractionController.ts',
  );
  const books = source(
    '../assets/scripts/games/writing-treasure/views/MagicBookGroupView.ts',
  );
  const deer = source(
    '../assets/scripts/games/writing-treasure/views/WizardDeerView.ts',
  );
  const gameView = source(
    '../assets/scripts/games/writing-treasure/views/WritingGameView.ts',
  );
  const theme = source(
    '../assets/scripts/games/writing-treasure/config/WritingTheme.ts',
  );
  const renderer = source(
    '../assets/scripts/ui/DinosaurTreasureCorrectEffectView.ts',
  );
  const wrongRenderer = source(
    '../assets/scripts/ui/DinosaurTreasureWrongEffectView.ts',
  );
  const manifest = JSON.parse(fs.readFileSync(path.resolve(
    __dirname,
    '../customer-media/dinosaur/correct-hatch-frames/manifest.json',
  ), 'utf8')) as {
    frameWidth: number;
    frameHeight: number;
    fps: number;
    hatchFrame: number;
    finalHoldMs: number;
    anchor: { x: number; baselineY: number };
    placementAnchor: { x: number; baselineY: number };
    babyHead: { x: number; y: number };
    frames: Array<{ file: string }>;
  };
  const wrongManifest = JSON.parse(fs.readFileSync(path.resolve(
    __dirname,
    '../customer-media/dinosaur/wrong-hatch-frames/manifest.json',
  ), 'utf8')) as {
    frameWidth: number;
    frameHeight: number;
    fps: number;
    phases: {
      emerge: { start: number; end: number; fps: number; loop: boolean };
      jump: { start: number; end: number; fps: number; loop: boolean };
      run: { start: number; end: number; fps: number; loop: boolean };
    };
    shell: { file: string; width: number; height: number };
    frames: Array<{ file: string }>;
  };

  it('keeps jump, pit, playback, and final-hold timing explicit', () => {
    expect(DINOSAUR_TREASURE_FEEDBACK.actorJumpLiftY).toBe(78);
    expect(DINOSAUR_TREASURE_FEEDBACK.actorJumpUpMs).toBe(180);
    expect(DINOSAUR_TREASURE_FEEDBACK.actorDropMs).toBe(480);
    expect(DINOSAUR_TREASURE_FEEDBACK.actorPitY).toBe(-162);
    expect(DINOSAUR_TREASURE_FEEDBACK.correctActorPitOffsetX).toBe(-103);
    expect(DINOSAUR_TREASURE_FEEDBACK.correctActorPitY).toBe(-164);
    expect(DINOSAUR_TREASURE_FEEDBACK.effectScale).toBe(0.56);
    expect(DINOSAUR_TREASURE_FEEDBACK.effectBaselineY).toBe(-298);
    expect(manifest.placementAnchor).toEqual({
      x: 240,
      baselineY: 488,
    });
    expect(manifest.frames).toHaveLength(24);
    expect(manifest.fps).toBe(12);
    expect(manifest.hatchFrame).toBe(12);
    expect(manifest.finalHoldMs).toBe(700);
    expect(dinosaurCorrectFrameIndex(0, 24, 12)).toBe(0);
    expect(dinosaurCorrectFrameIndex(999, 24, 12)).toBe(11);
    expect(dinosaurCorrectFrameIndex(1000, 24, 12)).toBe(12);
    expect(dinosaurCorrectFrameIndex(10000, 24, 12)).toBe(23);
    expect(dinosaurCorrectFrameBlend(0, 24, 12)).toEqual({
      fromIndex: 0,
      toIndex: 1,
      mix: 0,
    });
    expect(dinosaurCorrectFrameBlend(1000 / 24, 24, 12)).toEqual({
      fromIndex: 0,
      toIndex: 1,
      mix: 0.5,
    });
    expect(dinosaurCorrectFrameBlend(10000, 24, 12)).toEqual({
      fromIndex: 23,
      toIndex: 23,
      mix: 0,
    });
    expect(dinosaurCorrectSequenceDurationMs(24, 12, 700)).toBe(2700);
  });

  it('derives the score origin from the hatched dinosaur head', () => {
    const point = dinosaurCorrectStagePoint(
      0,
      manifest.babyHead,
      manifest.placementAnchor,
    );
    expect(manifest.babyHead).toEqual(expect.objectContaining({
      x: 362,
      y: 289,
    }));
    expect(point.x).toBeCloseTo(68.32, 2);
    expect(point.y).toBeCloseTo(-186.56, 2);
    expect(renderer).toContain("name: 'DinosaurHatchlingHead'");
    expect(renderer).toContain(
      'callbacks.onHatch?.(this.scoreOrigin(columnX, manifest));',
    );
    expect(controller).toContain(
      "this.playScoreReward('dinosaur-hatchling-head');",
    );
  });

  it('strikes first, opens the selected cavity, drops the actor, then hatches', () => {
    expect(controller).toContain("|| theme.id === 'dinosaur'");
    expect(controller).toContain("|| theme.id === 'magic';");
    expect(controller).toContain(
      'startsActionEffects ? startSceneDig : undefined',
    );
    const correct = controller.slice(
      controller.indexOf('private async openDinosaurTreasureCorrect('),
      controller.indexOf('private async openDesertTreasureCorrect('),
    );
    const hideChoice = correct.indexOf(
      'this.view.prepareDinosaurTreasureCorrect(selected);',
    );
    const jump = correct.indexOf(
      'await this.view.jumpDinosaurTreasureActor(selected);',
    );
    const hideActor = correct.indexOf('this.view.deer.hide();');
    const animation = correct.indexOf(
      'this.view.playDinosaurTreasureCorrect(selected, {',
    );
    const hatch = correct.indexOf('onHatch: (source) => {');
    const score = correct.indexOf(
      "this.playScoreReward('dinosaur-hatchling-head');",
    );
    const final = correct.indexOf("'final-embrace-held'");
    const complete = correct.indexOf('this.showFeedback(');
    expect(hideChoice).toBeGreaterThanOrEqual(0);
    expect(jump).toBeGreaterThan(hideChoice);
    expect(hideActor).toBeGreaterThan(jump);
    expect(animation).toBeGreaterThan(hideActor);
    expect(hatch).toBeGreaterThan(animation);
    expect(score).toBeGreaterThan(hatch);
    expect(final).toBeGreaterThan(score);
    expect(complete).toBeGreaterThan(final);
    expect(correct).toContain("this.services.audio.play('correct');");
    expect(correct).not.toContain('this.revealSelectedChoice(');
  });

  it('restores the original animated digging motion for both outcomes', () => {
    expect(theme).toContain(
      'action: `${media}/action.webp${characterMotionVersion}`',
    );
    expect(theme).not.toContain('dig.png');
    expect(deer).toContain('this.applyActionPose(columnX');
    expect(deer).toContain('this.motionAssets?.action');
  });

  it('hides the selected text stone and egg before the actor drops', () => {
    const prepare = books.slice(
      books.indexOf('prepareDinosaurCorrect('),
      books.indexOf('showDesertTreasureCavity('),
    );
    expect(prepare).toContain("this.sceneId !== 'dinosaur'");
    expect(prepare).toContain('item.label.node.active = false;');
    expect(prepare).toContain('item.option.active = false;');
    expect(prepare).toContain('item.chest.active = false;');
    expect(prepare).toContain("'hidden-before-actor-drop'");
  });

  it('lands the live actor at the exact composite baseline before handoff', () => {
    const jump = deer.slice(
      deer.indexOf('jumpIntoDinosaurPit('),
      deer.indexOf('descendWithDunhuangRubble('),
    );
    expect(jump).toContain("this.sceneId !== 'dinosaur'");
    expect(jump).toContain('DINOSAUR_TREASURE_FEEDBACK.actorJumpLiftY');
    expect(jump).toContain('DINOSAUR_TREASURE_FEEDBACK.correctActorPitOffsetX');
    expect(jump).toContain('DINOSAUR_TREASURE_FEEDBACK.correctActorPitY');
    expect(jump).toContain('DINOSAUR_TREASURE_FEEDBACK.actorDropMs');
    expect(jump).toContain("'dropping-into-pit'");
    expect(jump).toContain("'at-pit-bottom'");
  });

  it('predecodes all HD frames onto one canvas and holds the final frame', () => {
    expect(renderer).toContain("element.id = 'DinosaurTreasureCorrectEffect'");
    expect(renderer).toContain("'predecoded-hd-canvas'");
    expect(renderer).toContain('this.runtime.loadJson(MANIFEST_SOURCE)');
    expect(renderer).toContain('Promise.all(sources.map(');
    expect(renderer).toContain('this.frames = frames;');
    expect(renderer).toContain('this.drawFrame(frameIndex);');
    expect(renderer).toContain("'stepped-predecoded-raf'");
    expect(renderer).not.toContain('this.context.globalAlpha');
    expect(renderer).toContain("'final-frame-held'");
    expect(renderer).toContain('callbacks.onComplete?.();');
    expect(renderer).toContain('?v=${DINOSAUR_TREASURE_FEEDBACK.assetVersion}');
    expect(gameView).toContain("if (theme.id === 'dinosaur') {");
    expect(gameView).toContain('this.dinosaurTreasureCorrectEffect.preload();');
    expect(gameView).toContain('this.dinosaurTreasureCorrectEffect.dispose();');
  });

  it('opens the wrong cavity, watches the egg, then escapes before the hatchling', () => {
    const wrong = controller.slice(
      controller.indexOf('private async openDinosaurTreasureWrong('),
      controller.indexOf('private async openDesertTreasureCorrect('),
    );
    const prepare = wrong.indexOf(
      'this.view.prepareDinosaurTreasureWrong(selected);',
    );
    const jumpIntoPit = wrong.indexOf(
      'await this.view.jumpDinosaurTreasureWrongActor(selected);',
    );
    const watchEgg = wrong.indexOf(
      'await this.view.watchDinosaurTreasureWrongEgg(selected);',
    );
    const hideEgg = wrong.indexOf(
      'this.view.hideDinosaurTreasureWrongEgg(selected);',
    );
    const hatch = wrong.indexOf(
      'this.view.playDinosaurTreasureWrong(selected, {',
    );
    const actorEscape = wrong.indexOf(
      'actorEscape = this.view.escapeDinosaurTreasureWrongActor(selected);',
    );
    const dinosaurJump = wrong.indexOf('onDinosaurJump: () => {');
    const chase = wrong.indexOf("'wrong-same-hatchling-live-chase'");
    const actorChase = wrong.indexOf(
      'this.view.chaseDinosaurTreasureWrongActor(selected)',
    );
    const dinosaurChase = wrong.indexOf(
      'this.view.playDinosaurTreasureWrongChase(selected)',
    );
    const bothExited = wrong.indexOf(
      "'wrong-actor-and-hatchling-exited-right'",
    );
    const actorReturn = wrong.indexOf(
      'await this.view.returnDinosaurTreasureWrongActor(selected);',
    );
    const actorReturned = wrong.indexOf(
      "'wrong-actor-returned-to-selected-option'",
    );
    const feedback = wrong.indexOf('this.showFeedback(');
    expect(prepare).toBeGreaterThanOrEqual(0);
    expect(jumpIntoPit).toBeGreaterThan(prepare);
    expect(watchEgg).toBeGreaterThan(jumpIntoPit);
    expect(hideEgg).toBeGreaterThan(watchEgg);
    expect(hatch).toBeGreaterThan(hideEgg);
    expect(actorEscape).toBeGreaterThan(hatch);
    expect(dinosaurJump).toBeGreaterThan(actorEscape);
    expect(chase).toBeGreaterThan(dinosaurJump);
    expect(actorChase).toBeGreaterThan(chase);
    expect(dinosaurChase).toBeGreaterThan(actorChase);
    expect(bothExited).toBeGreaterThan(dinosaurChase);
    expect(actorReturn).toBeGreaterThan(bothExited);
    expect(actorReturned).toBeGreaterThan(actorReturn);
    expect(feedback).toBeGreaterThan(actorReturned);
    expect(controller).toContain("if (theme.id === 'dinosaur') {");
    expect(wrong).toContain('true,\n      true,');
    expect(feedbackUsesStageMotion('dinosaur', false)).toBe(false);
    expect(feedbackUsesStageMotion('dinosaur', true)).toBe(false);
    expect(controller).not.toContain(
      'this.view.handoffDinosaurTreasureWrongChase();',
    );
  });

  it('keeps the selected egg visible while the actor watches it', () => {
    const prepare = books.slice(
      books.indexOf('prepareDinosaurWrong('),
      books.indexOf('shakeDinosaurWrongEgg('),
    );
    const shake = books.slice(
      books.indexOf('shakeDinosaurWrongEgg('),
      books.indexOf('hideDinosaurWrongEgg('),
    );
    const hide = books.slice(
      books.indexOf('hideDinosaurWrongEgg('),
      books.indexOf('showDesertTreasureCavity('),
    );
    expect(prepare).toContain('item.label.node.active = false;');
    expect(prepare).toContain('item.option.active = false;');
    expect(prepare).toContain('item.chest.active = true;');
    expect(prepare).toContain("'visible-for-actor-watch'");
    expect(prepare).toContain('actor.setSiblingIndex(eggSiblingIndex);');
    expect(prepare).toContain("'in-front-of-watching-actor'");
    expect(gameView).toContain(
      'this.books.placeDinosaurWrongEggInFront(index, this.deer.root);',
    );
    expect(shake).toContain('DINOSAUR_TREASURE_FEEDBACK.wrongEggWatchMs');
    expect(shake).toContain("'rocking-before-hatch'");
    expect(hide).toContain('item.chest.active = false;');
    expect(hide).toContain('this.restoreDinosaurWrongActorLayer();');
    expect(hide).toContain("'hidden-at-hatch'");
  });

  it('uses the running pose to leap from the pit before the dinosaur follows', () => {
    const jumpIn = deer.slice(
      deer.indexOf('jumpIntoDinosaurWrongPit('),
      deer.indexOf('escapeFromDinosaurWrongPit('),
    );
    const escape = deer.slice(
      deer.indexOf('escapeFromDinosaurWrongPit('),
      deer.indexOf('chaseDinosaurTreasureWrongActor('),
    );
    const chase = deer.slice(
      deer.indexOf('chaseDinosaurTreasureWrongActor('),
      deer.indexOf('returnDinosaurTreasureWrongActor('),
    );
    const actorReturn = deer.slice(
      deer.indexOf('returnDinosaurTreasureWrongActor('),
      deer.indexOf('descendWithDunhuangRubble('),
    );
    expect(jumpIn).toContain('wrongActorPitOffsetX');
    expect(jumpIn).toContain("'watching-egg-at-pit-bottom'");
    expect(jumpIn).toContain('scale: Vec3.ONE');
    expect(jumpIn).not.toContain('new Vec3(1.04, 1.04, 1)');
    expect(escape).toContain('this.motionAssets?.runRight');
    expect(escape).toContain('wrongActorEscapeUpMs');
    expect(escape).toContain('wrongActorEscapeDownMs');
    expect(escape).toContain('scale: Vec3.ONE');
    expect(escape).not.toContain('new Vec3(1.06, 1.06, 1)');
    expect(escape).toContain("'startled-jumping-out-first'");
    expect(escape).toContain("'running-on-ground-awaiting-chase'");
    expect(chase).toContain('dinosaurWrongChaseDurationMs(startX)');
    expect(chase).toContain('wrongActorChaseEndX');
    expect(chase).toContain("easing: 'linear'");
    expect(chase).toContain("'same-scene-chasing-right'");
    expect(chase).toContain("'escaped-right-edge'");
    expect(actorReturn).toContain('this.motionAssets?.runLeft');
    expect(actorReturn).toContain('dinosaurWrongReturnDurationMs(columnX)');
    expect(actorReturn).toContain("'returning-left-to-selected-option'");
    expect(actorReturn).toContain('this.applyIdle(columnX, false);');
    expect(actorReturn).toContain(
      "'returned-standing-at-selected-option'",
    );
  });

  it('predecodes and steps the same hatchling through the live chase', () => {
    expect(DINOSAUR_TREASURE_FEEDBACK.wrongAssetVersion).toBe(
      'dinosaur-wrong-hatch-20260805-gpt2-smooth-v1',
    );
    expect(DINOSAUR_TREASURE_FEEDBACK.wrongWatchEggScale).toBe(1.18);
    expect(DINOSAUR_TREASURE_FEEDBACK.wrongShellScale).toBe(0.92);
    expect(DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurScale).toBe(0.62);
    expect(DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurHatchStartY).toBe(-300);
    expect(DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurLandingOffsetX)
      .toBe(-225);
    expect(DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurChaseOffsetX)
      .toBe(-390);
    expect(DINOSAUR_TREASURE_FEEDBACK.wrongActorChaseEndX).toBe(1360);
    expect(wrongManifest.frames).toHaveLength(16);
    expect(wrongManifest.fps).toBe(12);
    expect(wrongManifest.phases).toEqual({
      emerge: { start: 0, end: 3, fps: 10, loop: false },
      jump: { start: 4, end: 7, fps: 10, loop: false },
      run: { start: 8, end: 15, fps: 12, loop: true },
    });
    expect(wrongManifest.shell.file).toBe('shell.png');
    expect(dinosaurWrongFrameIndex(0, 16, 12)).toBe(0);
    expect(dinosaurWrongFrameIndex(1250, 16, 12)).toBe(15);
    expect(dinosaurWrongFrameIndex(1334, 16, 12)).toBe(0);
    expect(dinosaurWrongFrameBlend(0, 16, 12)).toEqual({
      fromIndex: 0,
      toIndex: 1,
      mix: 0,
    });
    expect(dinosaurWrongFrameBlend(1000 / 24, 16, 12)).toEqual({
      fromIndex: 0,
      toIndex: 1,
      mix: 0.5,
    });
    expect(dinosaurWrongFrameBlend(15500 / 12, 16, 12)).toEqual({
      fromIndex: 15,
      toIndex: 0,
      mix: 0.5,
    });
    const apex = dinosaurWrongJumpPoint(0, 0.5);
    expect(apex.x).toBeCloseTo(-112.5, 2);
    expect(apex.y).toBeGreaterThan(
      DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurGroundFeetY,
    );
    expect(dinosaurWrongChaseDurationMs(0)).toBeCloseTo(2193.55, 2);
    expect(dinosaurWrongChaseDurationMs(342)).toBeCloseTo(1641.94, 2);
    expect(dinosaurWrongReturnDurationMs(0)).toBeCloseTo(1511.11, 2);
    expect(dinosaurWrongReturnDurationMs(342)).toBeCloseTo(1131.11, 2);
    expect(dinosaurWrongChasePoint(0, 0)).toEqual({
      x: -225,
      y: DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurGroundFeetY,
    });
    expect(dinosaurWrongChasePoint(0, 1)).toEqual({
      x: 970,
      y: DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurGroundFeetY,
    });
    expect(wrongRenderer).toContain(
      "element.id = 'DinosaurTreasureWrongEffect'",
    );
    expect(wrongRenderer).toContain("'predecoded-transparent-canvas'");
    expect(wrongRenderer).toContain('Promise.all(frameSources.map(');
    expect(wrongRenderer).toContain('this.drawShell(columnX');
    expect(wrongRenderer).toContain('callbacks.onActorEscape?.();');
    expect(wrongRenderer).toContain('callbacks.onDinosaurJump?.();');
    expect(wrongRenderer).toContain('manifest.phases.emerge');
    expect(wrongRenderer).toContain('manifest.phases.jump');
    expect(wrongRenderer).toContain('manifest.phases.run');
    expect(wrongRenderer).toContain('this.drawDinosaurFrame(');
    expect(wrongRenderer).toContain("'stepped-predecoded-raf'");
    expect(wrongRenderer).not.toContain('this.context.globalAlpha');
    expect(wrongRenderer).toContain(
      "'same-hatchling-chasing-from-selected-pit'",
    );
    expect(wrongRenderer).toContain("'same-hatchling-exited-right-edge'");
    expect(wrongRenderer).not.toContain('this.drawShellOnly(');
    expect(wrongRenderer).not.toContain('lerp(0.38, 1');
    expect(wrongRenderer).not.toContain('* 1.12');
    expect(wrongRenderer).not.toContain('handoffToChase');
    expect(gameView).toContain('this.dinosaurTreasureWrongEffect.preload();');
    expect(gameView).toContain('this.dinosaurTreasureWrongEffect.dispose();');
    expect(controller).toContain(
      'this.view.playDinosaurTreasureWrongChase(selected)',
    );
  });
});
