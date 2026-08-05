import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  CLASSIC_TREASURE_FEEDBACK,
  classicTreasureExplosionDurationMs,
  classicTreasureExplosionFrame,
} from '../assets/scripts/shared/config/ClassicTreasureFeedback';

function source(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf8').replace(/\r\n/g, '\n');
}

describe('classic treasure feedback', () => {
  const controller = source(
    '../assets/scripts/games/writing-treasure/controllers/TreasureInteractionController.ts',
  );
  const books = source(
    '../assets/scripts/games/writing-treasure/views/MagicBookGroupView.ts',
  );
  const deer = source(
    '../assets/scripts/games/writing-treasure/views/WizardDeerView.ts',
  );
  const hole = source(
    '../assets/scripts/games/writing-treasure/views/ClassicTreasureHoleView.ts',
  );
  const renderer = source('../assets/scripts/ui/ClassicTreasureEffectView.ts');

  it('plays every supplied explosion frame once at 24 FPS', () => {
    expect(CLASSIC_TREASURE_FEEDBACK.explosionFrameCount).toBe(29);
    expect(CLASSIC_TREASURE_FEEDBACK.explosionFps).toBe(24);
    expect(CLASSIC_TREASURE_FEEDBACK.explosionBurstFrame).toBe(10);
    expect(CLASSIC_TREASURE_FEEDBACK.correctRewardDelayMs).toBe(360);
    expect(CLASSIC_TREASURE_FEEDBACK.rewardDurationMs).toBe(1600);
    expect(CLASSIC_TREASURE_FEEDBACK.rewardCompletionTailMs).toBe(160);
    expect(CLASSIC_TREASURE_FEEDBACK.scoreCoinDelayMs).toBe(560);
    expect(CLASSIC_TREASURE_FEEDBACK.rewardGemCount).toBe(60);
    expect(CLASSIC_TREASURE_FEEDBACK.rewardGemMinDistance).toBe(72);
    expect(CLASSIC_TREASURE_FEEDBACK.rewardGemDistanceBands).toBe(12);
    expect(CLASSIC_TREASURE_FEEDBACK.rewardGemWaveCount).toBe(3);
    expect(CLASSIC_TREASURE_FEEDBACK.rewardRayCount).toBe(18);
    expect(CLASSIC_TREASURE_FEEDBACK.rewardRayMinLength).toBe(380);
    expect(CLASSIC_TREASURE_FEEDBACK.dirtChunksPerImpact).toBe(18);
    expect(CLASSIC_TREASURE_FEEDBACK.dirtDustPuffsPerImpact).toBe(8);
    expect(CLASSIC_TREASURE_FEEDBACK.actorChestInsetY).toBe(-8);
    expect(CLASSIC_TREASURE_FEEDBACK.holeSurfaceY).toBe(-24);
    expect(CLASSIC_TREASURE_FEEDBACK.actorDigGroundOffsetY).toBe(91);
    expect(CLASSIC_TREASURE_FEEDBACK.actorDigScale).toBe(0.9);
    expect(classicTreasureExplosionFrame(0)).toBe(0);
    expect(classicTreasureExplosionFrame(10 * 1000 / 24 + 0.01)).toBe(10);
    expect(classicTreasureExplosionFrame(10000)).toBe(28);
    expect(classicTreasureExplosionDurationMs()).toBeCloseTo(1208.33, 1);
  });

  it('predecodes the explosion and real reward gems on one canvas', () => {
    expect(renderer).toContain("element.dataset.classicTreasureEffectCanvas = '1'");
    expect(renderer).toContain('Promise.all(');
    expect(renderer).toContain('this.frames = frames;');
    expect(renderer).toContain('this.rewardImages = images;');
    expect(renderer).toContain("const REWARD_GEM_ROOT = './media/treasure/classic-reward-gems'");
    expect(renderer).toContain('this.drawExplosion(frameIndex);');
    expect(renderer).toContain('drawLight(context, progress);');
    expect(renderer).toContain('drawGems(context, this.rewardImages, progress);');
    expect(renderer).toContain('context.drawImage(image, -size / 2');
    expect(renderer).toContain('CLASSIC_TREASURE_FEEDBACK.rewardGemCount');
    expect(renderer).toContain('CLASSIC_TREASURE_FEEDBACK.rewardGemWaveCount');
    expect(renderer).toContain('const GEM_SIZE_VARIANTS = [30, 38, 46, 56, 68, 82, 98, 118]');
    expect(renderer).toContain('(progress - particle.delay) / particle.duration');
    expect(renderer).toContain('CLASSIC_TREASURE_FEEDBACK.rewardRayCount');
    expect(renderer).toContain('const CANVAS_WIDTH = 1200;');
    expect(renderer).not.toContain("globalCompositeOperation = 'destination-out'");
    expect(renderer).not.toContain('drawRewardBurst(');
    expect(renderer).toContain("classicTreasureRenderer: 'predecoded-canvas'");
  });

  it('bobs only the selected classic option and resets it for the next question', () => {
    const dig = books.slice(
      books.indexOf('playClassicTreasureDig('),
      books.indexOf('sinkClassicTreasureOption('),
    );
    expect(dig).toContain("this.sceneId !== 'treasure'");
    expect(dig).toContain("this.markClassicOption(index, 'bob-up'");
    expect(dig).toContain("this.markClassicOption(index, 'bob-down'");
    expect(dig).toContain('CLASSIC_TREASURE_FEEDBACK.optionBobLift');
    expect(dig).toContain('CLASSIC_TREASURE_FEEDBACK.optionBobDip');
    expect(books).toContain('this.resetOptionMotion(item);');
    expect(books).toContain('Tween.stopAllByTarget(item.option);');
    expect(books).toContain('item.label.node.active = false;');
    expect(books).toContain('item.option.active = false;');
    expect(books).toContain("'hidden-at-hole-bottom'");
    expect(hole).toContain("'ClassicTreasureSurfaceHole'");
    expect(hole).toContain('`surface-break-${stage + 1}`');
    expect(hole).toContain("'surface-open'");
    expect(hole).toContain('CLASSIC_TREASURE_FEEDBACK.holeSurfaceY');
    expect(hole).toContain("const HOLE_CENTER_COLOR = '#D65905';");
    expect(hole).toContain('this.burstDirt(stage);');
    expect(hole).toContain('CLASSIC_TREASURE_FEEDBACK.dirtChunksPerImpact');
    expect(hole).toContain('CLASSIC_TREASURE_FEEDBACK.dirtDustPuffsPerImpact');
  });

  it('sinks the wrong actor and starts the supplied wrong motion with the explosion', () => {
    const wrong = controller.slice(
      controller.indexOf('private async openClassicTreasureFeedback('),
      controller.indexOf('private async openClassicTreasureCorrect('),
    );
    const hideHole = wrong.indexOf('this.view.books.hideClassicTreasureHole();');
    const optionSink = wrong.indexOf('await this.view.sinkClassicTreasureOption(selected);');
    const actorSink = wrong.indexOf('await this.view.sinkClassicTreasureActor(selected);');
    const explosion = wrong.indexOf('this.view.playClassicTreasureExplosion(selected, {');
    const start = wrong.indexOf('onStart: this.scope.guard(() => {');
    const actorLaunch = wrong.indexOf(
      'actorLaunch = this.view.launchClassicTreasureActor(selected);',
    );
    const burst = wrong.indexOf('onBurst: this.scope.guard(() => {');
    const reveal = wrong.indexOf(
      'void this.revealClassicTreasureWrong(theme, selected, launch);',
    );
    expect(hideHole).toBeGreaterThanOrEqual(0);
    expect(optionSink).toBeGreaterThan(hideHole);
    expect(optionSink).toBeGreaterThanOrEqual(0);
    expect(actorSink).toBeGreaterThan(optionSink);
    expect(explosion).toBeGreaterThan(actorSink);
    expect(start).toBeGreaterThan(explosion);
    expect(actorLaunch).toBeGreaterThan(start);
    expect(burst).toBeGreaterThan(actorLaunch);
    expect(reveal).toBeGreaterThan(burst);
    expect(deer).toContain('CLASSIC_TREASURE_FEEDBACK.actorSinkOffsetY');
    expect(deer).toContain('CLASSIC_TREASURE_FEEDBACK.actorChestInsetY');
    expect(deer).toContain('this.motion.hide();');
    expect(deer).toContain('const wrongMotion = this.motionAssets?.wrong;');
    expect(deer).toContain("onReady: () => playTravel('wrong.webp')");
    expect(deer).toContain('feedbackDurationMs(this.sceneId, false)');

    const launch = controller.slice(
      controller.indexOf('private async revealClassicTreasureWrong('),
      controller.indexOf('private revealSelectedChoice('),
    );
    expect(launch).toContain('await Promise.all([reveal, launch]);');
    expect(launch).toContain('this.showFeedback(true);');
    expect(deer).toContain('CLASSIC_TREASURE_FEEDBACK.actorLandingOffsetX');
    expect(deer).toContain('CLASSIC_TREASURE_FEEDBACK.actorWrongLastBottomY');
    expect(deer).toContain('CLASSIC_TREASURE_FEEDBACK.actorDigGroundOffsetY');
    expect(deer).toContain('CLASSIC_TREASURE_FEEDBACK.actorDigScale');
    expect(deer).toContain("'landed-seated-on-ground'");
  });

  it('aligns the reward burst with the supplied character jump frames', () => {
    const correct = controller.slice(
      controller.indexOf('private async openClassicTreasureCorrect('),
      controller.indexOf('private async revealClassicTreasureWrong('),
    );
    const reveal = correct.indexOf(
      'await this.revealSelectedChoice(theme, selected, true, false);',
    );
    const jump = correct.indexOf('this.showFeedback();');
    const delay = correct.indexOf(
      'CLASSIC_TREASURE_FEEDBACK.correctRewardDelayMs / 1000',
    );
    const reward = correct.indexOf('this.view.playClassicTreasureReward(selected);');
    expect(reveal).toBeGreaterThanOrEqual(0);
    expect(jump).toBeGreaterThan(reveal);
    expect(delay).toBeGreaterThan(jump);
    expect(reward).toBeGreaterThan(delay);
    expect(correct).toContain("this.markClassicSequence('reward-and-jump');");
    expect(correct).toContain('CLASSIC_TREASURE_FEEDBACK.scoreCoinDelayMs');
    expect(controller).toContain(
      'CLASSIC_TREASURE_FEEDBACK.rewardCompletionTailMs',
    );
    expect(controller).toContain(
      'Math.max(feedbackHold, classicRewardHold)',
    );
    expect(correct).toContain(
      "this.playScoreReward('independent-classic-feedback');",
    );
    expect(controller).toContain(
      'perChoiceState ? theme.assets.successStates : undefined',
    );
  });

  it('keeps non-treasure scenes gated while both desert outcomes use scene digging', () => {
    const standard = controller.slice(
      controller.indexOf('private async openChestThenFeedback()'),
      controller.indexOf('private async openClassicTreasureFeedback('),
    );
    expect(standard).toContain("if (theme.id === 'treasure')");
    expect(standard).toContain("if (theme.id === 'desert')");
    expect(standard).toContain(
      'await this.revealSelectedChoice(theme, selected, this.correct);',
    );
    expect(standard).toContain(
      "this.playScoreReward('arrival-and-chest-open', onRewardArrival);",
    );
    expect(standard).toContain('showFeedbackWhenReady();');
    expect(controller).toContain(
      "const usesSceneDig = theme.id === 'treasure'",
    );
    expect(controller).toContain(
      "|| theme.id === 'desert';",
    );
    expect(controller).toContain(
      'if (!startsActionEffects) this.scheduleActionImpacts(actionTiming.impactAtMs);',
    );
  });
});
