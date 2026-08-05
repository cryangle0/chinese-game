import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DUNHUANG_STONE_COLORS,
  DUNHUANG_TREASURE_FEEDBACK,
} from '../assets/scripts/shared/config/DunhuangTreasureFeedback';
import {
  feedbackPresentation,
  writingActionTiming,
} from '../assets/scripts/shared/config/WritingFeedbackPolicy';
import { writingThemes } from '../assets/scripts/games/writing-treasure/config/WritingTheme';

function source(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf8').replace(/\r\n/g, '\n');
}

describe('dunhuang treasure positive feedback', () => {
  const controller = source(
    '../assets/scripts/games/writing-treasure/controllers/TreasureInteractionController.ts',
  );
  const books = source(
    '../assets/scripts/games/writing-treasure/views/MagicBookGroupView.ts',
  );
  const breakView = source(
    '../assets/scripts/games/writing-treasure/views/DunhuangTreasureBreakView.ts',
  );
  const deer = source(
    '../assets/scripts/games/writing-treasure/views/WizardDeerView.ts',
  );
  const gameView = source(
    '../assets/scripts/games/writing-treasure/views/WritingGameView.ts',
  );
  const feedbackView = source('../assets/scripts/ui/FeedbackView.ts');

  it('keeps the open lintel, rubble, and rise timing explicit', () => {
    expect(DUNHUANG_TREASURE_FEEDBACK.castImpactMs).toBe(3300);
    expect(DUNHUANG_TREASURE_FEEDBACK.impactY).toBe(-32);
    expect(DUNHUANG_TREASURE_FEEDBACK.rubbleFloorY).toBe(-310);
    expect(DUNHUANG_TREASURE_FEEDBACK.rubbleFirstDropY).toBe(56);
    expect(DUNHUANG_TREASURE_FEEDBACK.fragmentCount).toBe(16);
    expect(DUNHUANG_TREASURE_FEEDBACK.actorLotusY).toBe(-145);
    expect(DUNHUANG_TREASURE_FEEDBACK.lotusLeadMs).toBe(180);
    expect(DUNHUANG_TREASURE_FEEDBACK.riseDistanceY).toBe(270);
    expect(DUNHUANG_TREASURE_FEEDBACK.riseFinalLiftY).toBe(80);
    expect(DUNHUANG_TREASURE_FEEDBACK.riseDurationMs).toBe(1080);
    expect(DUNHUANG_TREASURE_FEEDBACK.riseBeamBottomY).toBe(-260);
    expect(DUNHUANG_TREASURE_FEEDBACK.riseBeamHeight).toBe(415);
    expect(DUNHUANG_STONE_COLORS).toContain('#DB8D3A');
    expect(DUNHUANG_STONE_COLORS).toContain('#EDB875');
    expect(writingActionTiming('dunhuang')).toEqual({
      holdMs: DUNHUANG_TREASURE_FEEDBACK.castImpactMs,
      impactAtMs: [900, 2100, DUNHUANG_TREASURE_FEEDBACK.castImpactMs],
    });
    expect(
      writingThemes.find((theme) => theme.id === 'dunhuang')?.assets.dunhuangOpenTop,
    ).toBe('themes/writing/dunhuang/openTop');
  });

  it('targets the selected lintel without drawing a simulated top-break effect', () => {
    expect(controller).toContain("|| theme.id === 'dunhuang'");
    expect(controller).toContain("|| theme.id === 'dinosaur'");
    expect(controller).toContain("|| theme.id === 'magic';");
    expect(controller).toContain(
      'startsActionEffects ? startSceneDig : undefined',
    );
    expect(controller).toContain(
      'this.view.playDunhuangTreasureCast(index, actionTiming.impactAtMs);',
    );
    const cast = books.slice(
      books.indexOf('playDunhuangTreasureCast('),
      books.indexOf('breakDunhuangTreasureWall('),
    );
    expect(cast).toContain('this.dunhuangBreak.prepare(');
    expect(cast).not.toContain('Tween.stopAllByTarget(item.option)');
    expect(cast).not.toContain('tween(item.option)');
    expect(breakView).not.toContain('DunhuangTreasureImpactFlash');
    expect(breakView).not.toContain('DunhuangTreasureCrack');
    expect(breakView).not.toContain('DunhuangTreasureBreakDust');
    expect(breakView).not.toContain('showImpact');
    expect(breakView).not.toContain('burstDust');
  });

  it('breaks the selected wall before revealing the lotus and rising actor', () => {
    const correct = controller.slice(
      controller.indexOf('private async openDunhuangTreasureCorrect('),
      controller.indexOf('private async openDesertTreasureCorrect('),
    );
    const wallBreak = correct.indexOf(
      'this.view.breakDunhuangTreasureWall(selected),',
    );
    const actorDrop = correct.indexOf(
      'this.view.dropDunhuangTreasureActor(selected),',
    );
    const rubble = correct.indexOf("'rubble-at-cavity-bottom'");
    const lotus = correct.indexOf(
      'await this.revealSelectedChoice(theme, selected, true);',
    );
    const rise = correct.indexOf("'character-rising'");
    const feedback = correct.indexOf('this.showFeedback();');
    expect(wallBreak).toBeGreaterThanOrEqual(0);
    expect(actorDrop).toBeGreaterThan(wallBreak);
    expect(rubble).toBeGreaterThan(wallBreak);
    expect(lotus).toBeGreaterThan(rubble);
    expect(rise).toBeGreaterThan(lotus);
    expect(feedback).toBeGreaterThan(rise);
    expect(correct).toContain('DUNHUANG_TREASURE_FEEDBACK.lotusLeadMs');
    expect(correct).toContain('await Promise.all([');
    expect(correct).toContain(
      "this.playScoreReward('independent-dunhuang-feedback');",
    );
    expect(feedbackPresentation('dunhuang', true)).toBe('motion');
  });

  it('moves the casting actor down with rubble and stops it at the lotus', () => {
    expect(gameView).toContain('dropDunhuangTreasureActor(index: number)');
    expect(gameView).toContain('this.deer.descendWithDunhuangRubble(');
    const descent = deer.slice(
      deer.indexOf('descendWithDunhuangRubble('),
      deer.indexOf('private async dropDesertActor('),
    );
    expect(descent).toContain("this.sceneId !== 'dunhuang'");
    expect(descent).toContain('DUNHUANG_TREASURE_FEEDBACK.actorLotusY');
    expect(descent).toContain('DUNHUANG_TREASURE_FEEDBACK.breakBurstMs');
    expect(descent).toContain('DUNHUANG_TREASURE_FEEDBACK.rubbleFallMs');
    expect(descent).toContain('DUNHUANG_TREASURE_FEEDBACK.rubbleSettleMs');
    expect(descent).toContain("'descending-with-rubble'");
    expect(descent).toContain("'at-lotus-rubble-at-bottom'");
  });

  it('hides the selected text stone while retaining the lotus base in front of the cavity', () => {
    const wall = books.slice(
      books.indexOf('breakDunhuangTreasureWall('),
      books.indexOf('dropDesertTreasureOption('),
    );
    expect(wall).toContain("this.sceneId !== 'dunhuang'");
    expect(wall).toContain('item.label.node.active = false;');
    expect(wall).toContain('item.option.active = false;');
    expect(wall).toContain('item.chest.active = true;');
    expect(wall).toContain("'hidden-before-break'");
    expect(wall).toContain('this.dunhuangBreak.breakOpen(');
  });

  it('opens the supplied lintel without drawing a synthetic cavity frame', () => {
    expect(breakView).toContain("'DunhuangTreasureBreakUnderlay'");
    expect(breakView).toContain("'DunhuangTreasureBreakOverlay'");
    expect(breakView).toContain("'DunhuangTreasureOpenTopPatch'");
    expect(breakView).toContain('spriteLoader.apply(this.openTopPatch');
    expect(breakView).toContain('this.openTopPatch.active = true;');
    expect(breakView).not.toContain("'DunhuangTreasureCavity'");
    expect(breakView).not.toContain('drawCavity');
    expect(breakView).toContain('this.burstFragments();');
    expect(breakView).toContain('DUNHUANG_TREASURE_FEEDBACK.fragmentCount');
    expect(breakView).toContain('DUNHUANG_TREASURE_FEEDBACK.rubbleFloorY');
    expect(breakView).toContain(
      'start.y\n        - DUNHUANG_TREASURE_FEEDBACK.rubbleFirstDropY',
    );
    expect(breakView).toContain("'wall-open-rubble-falling'");
    expect(breakView).toContain("'rubble-settled-at-bottom'");
    expect(breakView).toContain('const large = index < 5;');
  });

  it('raises the correct character while a light beam stays connected to the lotus', () => {
    expect(feedbackView).toContain("'DunhuangTreasureRiseBeam'");
    expect(feedbackView).toContain("sceneId === 'dunhuang' && correct");
    expect(feedbackView).toContain('this.playDunhuangRise(finalX, finalY, targetScale);');
    expect(feedbackView).toContain('DUNHUANG_TREASURE_FEEDBACK.riseDistanceY');
    expect(feedbackView).toContain('DUNHUANG_TREASURE_FEEDBACK.riseFinalLiftY');
    expect(feedbackView).toContain('DUNHUANG_TREASURE_FEEDBACK.riseDurationMs');
    expect(feedbackView).toContain('DUNHUANG_TREASURE_FEEDBACK.riseBeamBottomY');
    expect(feedbackView).toContain("dunhuangTreasureRiseBeam = 'lotus-to-character'");
  });
});

describe('dunhuang treasure negative feedback', () => {
  const controller = source(
    '../assets/scripts/games/writing-treasure/controllers/TreasureInteractionController.ts',
  );
  const books = source(
    '../assets/scripts/games/writing-treasure/views/MagicBookGroupView.ts',
  );
  const breakView = source(
    '../assets/scripts/games/writing-treasure/views/DunhuangTreasureBreakView.ts',
  );
  const deer = source(
    '../assets/scripts/games/writing-treasure/views/WizardDeerView.ts',
  );
  const gameView = source(
    '../assets/scripts/games/writing-treasure/views/WritingGameView.ts',
  );
  const wrongEffect = source(
    '../assets/scripts/ui/DunhuangTreasureWrongEffectView.ts',
  );

  it('keeps the impact, bottom-up tornado, reveal, and lift timing explicit', () => {
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongActorContactY).toBe(-145);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongActorDropMs).toBe(520);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongImpactY).toBe(-292);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongTornadoStartMs).toBe(180);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongActorLiftStartMs).toBe(300);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongRevealMs).toBe(980);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongTornadoFadeStartMs).toBe(1260);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongEffectDurationMs).toBe(1660);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongActorFinalY).toBe(70);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongTornadoHeight).toBe(610);
    expect(DUNHUANG_TREASURE_FEEDBACK.wrongTornadoTopWidth).toBe(500);
  });

  it('opens the cavity, drops the actor, then lifts it before the final state', () => {
    expect(controller).toContain(
      "this.correct ? 'casting-at-wall' : 'wrong-casting-at-wall'",
    );
    const wrong = controller.slice(
      controller.indexOf('private async openDunhuangTreasureWrong('),
      controller.indexOf('private async openDesertTreasureCorrect('),
    );
    const cavity = wrong.indexOf(
      'await this.view.openDunhuangTreasureWrongCavity(selected);',
    );
    const drop = wrong.indexOf(
      'await this.view.dropDunhuangTreasureWrongActor(selected);',
    );
    const impact = wrong.indexOf("'wrong-floor-impact'");
    const effect = wrong.indexOf(
      'this.view.playDunhuangTreasureWrongEffect(selected, {',
    );
    const lift = wrong.indexOf(
      'actorLift = this.view.liftDunhuangTreasureWrongActor(selected);',
    );
    const reveal = wrong.indexOf(
      'choiceReveal = this.revealSelectedChoice(theme, selected, false);',
    );
    const finalState = wrong.indexOf("'wrong-final-state'");
    expect(cavity).toBeGreaterThanOrEqual(0);
    expect(drop).toBeGreaterThan(cavity);
    expect(impact).toBeGreaterThan(drop);
    expect(effect).toBeGreaterThan(impact);
    expect(lift).toBeGreaterThan(effect);
    expect(reveal).toBeGreaterThan(effect);
    expect(finalState).toBeGreaterThan(lift);
    expect(wrong).toContain('await Promise.all([actorLift, choiceReveal]);');
    expect(wrong).toContain('this.showFeedback(true, true);');
  });

  it('renders a tall programmatic tornado over the moving wrong actor', () => {
    expect(books).toContain('openDunhuangTreasureWrongCavity(index: number)');
    expect(books).toContain('item.label.node.active = false;');
    expect(books).toContain('item.option.active = false;');
    expect(books).toContain('item.chest.active = false;');
    expect(breakView).toContain('openWrongCavity(index: number, columnX: number)');
    expect(breakView).toContain("'wrong-cavity-opening'");
    expect(gameView).toContain('new DunhuangTreasureWrongEffectView()');
    expect(gameView).toContain('playDunhuangTreasureWrongEffect(');
    expect(deer).toContain('dropToDunhuangFloor(columnX: number)');
    expect(deer).toContain('liftWithDunhuangTornado(columnX: number)');
    expect(deer).toContain('this.motionAssets?.wrong');
    expect(deer).toContain("'rising-with-tornado'");
    expect(deer).toContain("'sad-above-open-cavity'");
    expect(wrongEffect).toContain("'DunhuangTreasureWrongEffect'");
    expect(wrongEffect).toContain("'programmatic-tornado-canvas'");
    expect(wrongEffect).toContain('drawFloorImpact(context, impactProgress);');
    expect(wrongEffect).toContain('drawTornado(context, elapsedMs / 1000, grow, fade);');
    expect(wrongEffect).toContain('wrongTornadoHeight');
    expect(wrongEffect).toContain('wrongTornadoTopWidth');
    expect(wrongEffect).toContain('callbacks.onLiftStart?.();');
    expect(wrongEffect).toContain('callbacks.onReveal?.();');
    expect(wrongEffect).toContain("'rgba(246,202,112,0.9)'");
    expect(wrongEffect).toContain("'#F6CB7D'");
    expect(wrongEffect).not.toContain("'rgba(103,58,23,0.28)'");
    expect(wrongEffect).not.toContain("'#8E5125'");
  });
});
