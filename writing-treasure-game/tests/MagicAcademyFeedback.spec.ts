import fs from 'node:fs';
import path from 'node:path';
import { PNG } from 'pngjs';
import {
  MAGIC_ACADEMY_FEEDBACK,
  MAGIC_ACADEMY_STONE_COLORS,
} from '../assets/scripts/shared/config/MagicAcademyFeedback';
import {
  writingActionTiming,
} from '../assets/scripts/shared/config/WritingFeedbackPolicy';

function source(relativePath: string): string {
  return fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8')
    .replace(/\r\n/g, '\n');
}

describe('magic academy live feedback', () => {
  const controller = source(
    '../assets/scripts/games/writing-treasure/controllers/TreasureInteractionController.ts',
  );
  const books = source(
    '../assets/scripts/games/writing-treasure/views/MagicBookGroupView.ts',
  );
  const breakView = source(
    '../assets/scripts/games/writing-treasure/views/MagicAcademyBreakView.ts',
  );
  const deer = source(
    '../assets/scripts/games/writing-treasure/views/WizardDeerView.ts',
  );
  const gameView = source(
    '../assets/scripts/games/writing-treasure/views/WritingGameView.ts',
  );

  it('keeps cast, cavity, actor, unlock, and landing timing explicit', () => {
    expect(writingActionTiming('magic')).toEqual({
      holdMs: MAGIC_ACADEMY_FEEDBACK.castHoldMs,
      impactAtMs: MAGIC_ACADEMY_FEEDBACK.castImpactAtMs,
    });
    expect(MAGIC_ACADEMY_FEEDBACK.fragmentCount).toBe(15);
    expect(MAGIC_ACADEMY_FEEDBACK.cavityCenterY).toBe(-194);
    expect(MAGIC_ACADEMY_FEEDBACK.rubbleFloorY).toBe(-326);
    expect(MAGIC_ACADEMY_FEEDBACK.actorStandY).toBe(18);
    expect(MAGIC_ACADEMY_FEEDBACK.actorSitY).toBe(-18);
    expect(MAGIC_ACADEMY_FEEDBACK.correctActorFrameWidth).toBe(360);
    expect(MAGIC_ACADEMY_FEEDBACK.correctActorFrameHeight).toBe(360);
    expect(MAGIC_ACADEMY_FEEDBACK.correctActorRiseY).toBe(235);
    expect(MAGIC_ACADEMY_FEEDBACK.wrongActorFrameWidth).toBe(340);
    expect(MAGIC_ACADEMY_FEEDBACK.wrongActorFrameHeight).toBe(296);
    expect(MAGIC_ACADEMY_FEEDBACK.wrongActorApexY).toBe(230);
    expect(MAGIC_ACADEMY_FEEDBACK.wrongActorSettleMs).toBe(420);
    expect(MAGIC_ACADEMY_STONE_COLORS).toContain('#726AA4');
    expect(MAGIC_ACADEMY_STONE_COLORS).toContain('#9589C2');
  });

  it('starts the selected magic target only after the casting pose begins', () => {
    expect(controller).toContain("|| theme.id === 'magic';");
    expect(controller).toContain(
      "this.correct ? 'casting-at-top-bricks' : 'wrong-casting-at-top-bricks'",
    );
    expect(controller).toContain('this.view.playMagicAcademyCast(index);');
    expect(controller).toContain(
      'startsActionEffects ? startSceneDig : undefined',
    );
    expect(books).toContain('this.magicAcademyBreak.prepare(index, this.columnX(index));');
  });

  it('opens a blue-purple cavity and drops real rubble to the bottom', () => {
    expect(breakView).toContain("'MagicAcademyBreakUnderlay'");
    expect(breakView).toContain("'MagicAcademyOpenCavity'");
    expect(breakView).toContain("'MagicAcademyBreakOverlay'");
    expect(breakView).toContain('this.drawCavity(');
    expect(breakView).toContain('this.burstFragments();');
    expect(breakView).toContain('MAGIC_ACADEMY_FEEDBACK.rubbleFloorY');
    expect(breakView).toContain("'top-open-rubble-falling'");
    expect(breakView).toContain("'rubble-settled-at-bottom'");
    const cavity = books.slice(
      books.indexOf('openMagicAcademyCavity('),
      books.indexOf('unlockMagicAcademyBook('),
    );
    expect(cavity).toContain('item.label.node.active = false;');
    expect(cavity).toContain('item.option.active = false;');
    expect(cavity).toContain('item.chest.active = true;');
    expect(cavity).toContain('this.magicAcademyBreak.breakOpen(');
  });

  it('stands on the book, opens it without chain scatter, and rises on the same beat', () => {
    const correct = controller.slice(
      controller.indexOf('private async openMagicAcademyCorrect('),
      controller.indexOf('private async openMagicAcademyWrong('),
    );
    const breakOpen = correct.indexOf(
      'this.view.openMagicAcademyCavity(selected),',
    );
    const actorDrop = correct.indexOf(
      'this.view.dropMagicAcademyActor(selected),',
    );
    const stand = correct.indexOf("'actor-standing-on-locked-book'");
    const unlock = correct.indexOf(
      'await this.view.unlockMagicAcademyBook(selected, () => {',
    );
    const openAndRise = correct.indexOf(
      "'book-open-actor-rising'",
    );
    const rise = correct.indexOf(
      'actorRise = this.view.riseMagicAcademyActor(selected);',
    );
    const final = correct.indexOf(
      "'correct-hovering-over-open-book'",
    );
    expect(breakOpen).toBeGreaterThanOrEqual(0);
    expect(actorDrop).toBeGreaterThan(breakOpen);
    expect(stand).toBeGreaterThan(actorDrop);
    expect(unlock).toBeGreaterThan(stand);
    expect(openAndRise).toBeGreaterThan(unlock);
    expect(rise).toBeGreaterThan(openAndRise);
    expect(final).toBeGreaterThan(rise);
    expect(correct).toContain("this.services.audio.play('unlock');");
    expect(correct).toContain("this.services.audio.play('reveal');");
    expect(correct).toContain("this.playScoreReward('magic-open-book');");
    expect(correct).toContain('this.showFeedback(');
    expect(breakView).toContain("'book-opened-without-chain-scatter'");
    expect(books).toContain('this.showMagicAcademyBookState(index, true);');
    expect(breakView).not.toContain('MagicAcademyLeftBrokenChain');
    expect(breakView).not.toContain('MagicAcademyRightBrokenChain');
    expect(breakView).not.toContain('releaseChains');
    expect(breakView).not.toContain('createChainGroup');
    expect(deer).toContain('riseFromMagicAcademyBook(columnX: number)');
    expect(deer).toContain('this.motionAssets?.correct');
    expect(deer).toContain("'rising-with-open-book'");
    const riseMotion = deer.slice(
      deer.indexOf('riseFromMagicAcademyBook('),
      deer.indexOf('launchFromMagicAcademyExplosion('),
    );
    expect(riseMotion).toContain('scale: Vec3.ONE');
    expect(riseMotion).not.toContain('new Vec3(1.05');
  });

  it('normalizes the casting frame before waiting for the drop sprite', () => {
    const dropMotion = deer.slice(
      deer.indexOf('async dropToMagicAcademyBook('),
      deer.indexOf('riseFromMagicAcademyBook('),
    );
    const hideMotion = dropMotion.indexOf('this.motion.hide();');
    const idleFrame = dropMotion.indexOf(
      'this.applyFrame(idle.size[0], idle.size[1]);',
    );
    const idlePosition = dropMotion.indexOf(
      'this.root.setPosition(columnX, idle.position.y, 0);',
    );
    const waitForIdle = dropMotion.indexOf(
      'await spriteLoader.applyReady(this.visual, this.idleAsset,',
    );
    expect(hideMotion).toBeGreaterThanOrEqual(0);
    expect(idleFrame).toBeGreaterThan(hideMotion);
    expect(idlePosition).toBeGreaterThan(idleFrame);
    expect(waitForIdle).toBeGreaterThan(idlePosition);
    expect(dropMotion).toContain('scale: Vec3.ONE');
  });

  it('seats the actor behind the book, explodes straight out, and holds the seated result', () => {
    const wrong = controller.slice(
      controller.indexOf('private async openMagicAcademyWrong('),
      controller.indexOf('private async openDinosaurTreasureCorrect('),
    );
    const layer = wrong.indexOf(
      'this.view.prepareMagicAcademyWrongActor(selected);',
    );
    const breakOpen = wrong.indexOf(
      'this.view.openMagicAcademyCavity(selected),',
    );
    const sit = wrong.indexOf(
      'this.view.dropMagicAcademyActor(selected, true),',
    );
    const explosion = wrong.indexOf(
      'this.view.playClassicTreasureExplosion(selected, {',
    );
    const burst = wrong.indexOf('onBurst: () => {');
    const charred = wrong.indexOf(
      'wrongBook = this.view.showMagicAcademyWrongBook(selected);',
    );
    const launch = wrong.indexOf(
      'actorLaunch = this.view.launchMagicAcademyWrongActor(selected);',
    );
    const landed = wrong.indexOf(
      "'wrong-actor-landed-seated-outside-cavity'",
    );
    expect(layer).toBeGreaterThanOrEqual(0);
    expect(breakOpen).toBeGreaterThan(layer);
    expect(sit).toBeGreaterThan(breakOpen);
    expect(explosion).toBeGreaterThan(sit);
    expect(burst).toBeGreaterThan(explosion);
    expect(charred).toBeGreaterThan(burst);
    expect(launch).toBeGreaterThan(burst);
    expect(landed).toBeGreaterThan(launch);
    expect(wrong).toContain('await Promise.all([wrongBook, actorLaunch]);');
    expect(books).toContain("'behind-selected-book'");
    expect(books).toContain("correct ? 'open-glowing' : 'exploded-charred'");
    expect(deer).toContain('launchFromMagicAcademyExplosion(columnX: number)');
    const launchMotion = deer.slice(
      deer.indexOf('launchFromMagicAcademyExplosion('),
      deer.indexOf('private async dropDesertActor('),
    );
    expect(launchMotion).toContain("'blasted-out-without-rotation'");
    expect(launchMotion).toContain(
      'MAGIC_ACADEMY_FEEDBACK.wrongActorSettleMs / 1000',
    );
    expect(launchMotion).not.toContain('angle: direction *');
    expect(launchMotion).not.toContain('new Vec3(1.04');
    expect(deer).toContain("'landed-seated-outside-cavity'");
    expect(gameView).toContain(
      "if (theme.id === 'treasure' || theme.id === 'magic')",
    );
  });

  it('uses the supplied transparent wrong actor rather than the opaque wrong motion', () => {
    const wrongActorPath = path.resolve(
      __dirname,
      '../customer-media/magic/wrong-actor.png',
    );
    const image = PNG.sync.read(fs.readFileSync(wrongActorPath));
    let transparentPixels = 0;
    for (let index = 3; index < image.data.length; index += 4) {
      if (image.data[index] === 0) transparentPixels += 1;
    }
    expect(image.width).toBe(812);
    expect(image.height).toBe(706);
    expect(transparentPixels).toBeGreaterThan(100_000);
    expect(MAGIC_ACADEMY_FEEDBACK.wrongActorAsset).toContain('wrong-actor.png');
    const launch = deer.slice(
      deer.indexOf('launchFromMagicAcademyExplosion('),
      deer.indexOf('private async dropDesertActor('),
    );
    expect(launch).toContain('MAGIC_ACADEMY_FEEDBACK.wrongActorAsset');
    expect(launch).not.toContain('this.motionAssets?.wrong');
  });
});
