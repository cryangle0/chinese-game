import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DESERT_TREASURE_FEEDBACK } from '../assets/scripts/shared/config/DesertTreasureFeedback';
import { feedbackPresentation } from '../assets/scripts/shared/config/WritingFeedbackPolicy';

function source(path: string): string {
  return readFileSync(resolve(__dirname, path), 'utf8').replace(/\r\n/g, '\n');
}

describe('desert treasure feedback', () => {
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
    '../assets/scripts/games/writing-treasure/views/DesertTreasureHoleView.ts',
  );
  const effect = source('../assets/scripts/ui/DesertTreasureEffectView.ts');

  it('keeps the desert drop and reward timings explicit', () => {
    expect(DESERT_TREASURE_FEEDBACK.holeSurfaceY).toBe(-24);
    expect(DESERT_TREASURE_FEEDBACK.optionDropY).toBe(-118);
    expect(DESERT_TREASURE_FEEDBACK.optionDropMs).toBe(520);
    expect(DESERT_TREASURE_FEEDBACK.actorDropMs).toBe(520);
    expect(DESERT_TREASURE_FEEDBACK.actorChestHoldMs).toBe(220);
    expect(DESERT_TREASURE_FEEDBACK.wrongSarcophagusWidth).toBe(270);
    expect(DESERT_TREASURE_FEEDBACK.wrongSarcophagusHeight).toBe(200);
    expect(DESERT_TREASURE_FEEDBACK.wrongSarcophagusStartY).toBe(75);
    expect(DESERT_TREASURE_FEEDBACK.wrongSarcophagusBottomY).toBe(-22);
    expect(DESERT_TREASURE_FEEDBACK.wrongSarcophagusDropMs).toBe(520);
    expect(DESERT_TREASURE_FEEDBACK.wrongActorSarcophagusInsetY).toBe(-6);
    expect(DESERT_TREASURE_FEEDBACK.wrongChestHoldMs).toBe(180);
    expect(DESERT_TREASURE_FEEDBACK.wrongSandFallMs).toBe(1200);
    expect(DESERT_TREASURE_FEEDBACK.wrongSandHandoffProgress).toBe(0.74);
    expect(DESERT_TREASURE_FEEDBACK.correctJumpDelayMs).toBe(180);
    expect(DESERT_TREASURE_FEEDBACK.rewardDurationMs).toBe(1900);
    expect(DESERT_TREASURE_FEEDBACK.rewardGemCount).toBe(30);
    expect(DESERT_TREASURE_FEEDBACK.rewardSymbolCount).toBe(8);
  });

  it('hides the dug-hole effect before dropping the textless option and actor together', () => {
    expect(controller).toContain(
      "|| theme.id === 'desert';",
    );
    const correct = controller.slice(
      controller.indexOf('private async openDesertTreasureCorrect('),
      controller.indexOf('private async openDesertTreasureWrong('),
    );
    const hideHole = correct.indexOf('this.view.books.hideDesertTreasureHole();');
    const drop = correct.indexOf('await Promise.all([');
    const option = correct.indexOf('this.view.dropDesertTreasureOption(selected)');
    const actor = correct.indexOf('this.view.dropDesertTreasureActor(selected)');
    const reveal = correct.indexOf(
      'await this.revealSelectedChoice(theme, selected, true);',
    );
    const reward = correct.indexOf('this.view.playDesertTreasureReward(selected);');
    const jump = correct.indexOf('this.showFeedback();');
    expect(hideHole).toBeGreaterThanOrEqual(0);
    expect(drop).toBeGreaterThan(hideHole);
    expect(drop).toBeGreaterThanOrEqual(0);
    expect(option).toBeGreaterThan(drop);
    expect(actor).toBeGreaterThan(drop);
    expect(reveal).toBeGreaterThan(actor);
    expect(reward).toBeGreaterThan(reveal);
    expect(jump).toBeGreaterThan(reward);
    expect(correct).toContain("'actor-on-chest'");
    expect(correct).toContain('DESERT_TREASURE_FEEDBACK.actorChestHoldMs');
    expect(correct).toContain("'chest-open-and-reward'");
    expect(correct).toContain("'happy-jump'");
    expect(feedbackPresentation('desert', true)).toBe('motion');
  });

  it('drops the supplied sarcophagus and actor to the pit bottom before burial', () => {
    const wrong = controller.slice(
      controller.indexOf('private async openDesertTreasureWrong('),
      controller.indexOf('private async openClassicTreasureFeedback('),
    );
    const cavity = wrong.indexOf('this.view.books.showDesertTreasureCavity(selected);');
    const reveal = wrong.indexOf('await this.view.prepareDesertWrongSarcophagus(selected);');
    const drop = wrong.indexOf('await Promise.all([');
    const option = wrong.indexOf('this.view.dropDesertTreasureOption(selected)');
    const sarcophagus = wrong.indexOf('this.view.dropDesertWrongSarcophagus(selected)');
    const actor = wrong.indexOf('this.view.dropDesertWrongActor(selected)');
    const burial = wrong.indexOf('this.view.playDesertTreasureBurial(');
    const hideChoice = wrong.indexOf(
      'this.view.books.hideDesertTreasureChoice(selected);',
    );
    const hideActor = wrong.indexOf('this.view.deer.hide();');
    const feedback = wrong.indexOf('this.showFeedback();');
    expect(cavity).toBeGreaterThanOrEqual(0);
    expect(reveal).toBeGreaterThan(cavity);
    expect(drop).toBeGreaterThan(reveal);
    expect(option).toBeGreaterThan(drop);
    expect(sarcophagus).toBeGreaterThan(drop);
    expect(actor).toBeGreaterThan(drop);
    expect(burial).toBeGreaterThan(actor);
    expect(hideChoice).toBeGreaterThan(burial);
    expect(hideActor).toBeGreaterThan(hideChoice);
    expect(feedback).toBeGreaterThan(hideActor);
    expect(wrong).toContain("'wrong-sarcophagus-rendering'");
    expect(wrong).toContain("'wrong-cavity-open'");
    expect(wrong).toContain("'actor-and-sarcophagus-at-pit-bottom'");
    expect(wrong).not.toContain('this.view.books.hideDesertTreasureHole();');
    expect(wrong).toContain('DESERT_TREASURE_FEEDBACK.wrongChestHoldMs');
    expect(wrong).toContain("'sand-burial'");
    expect(wrong).toContain("'buried-feedback'");
    expect(feedbackPresentation('desert', false)).toBe('motion');
  });

  it('hides the selected label before the option falls out of the pit', () => {
    const drop = books.slice(
      books.indexOf('dropDesertTreasureOption('),
      books.indexOf('setBackdropScale('),
    );
    expect(drop).toContain("this.sceneId !== 'desert'");
    expect(drop).toContain('item.label.node.active = false;');
    expect(drop).toContain("'hidden-before-drop'");
    expect(drop).toContain('DESERT_TREASURE_FEEDBACK.optionDropY');
    expect(drop).toContain('item.option.active = false;');
    expect(drop).toContain("'hidden-at-pit-bottom'");
  });

  it('lands the live actor on the closed chest before the happy motion starts', () => {
    const drop = deer.slice(
      deer.indexOf('dropToDesertTreasureChest('),
      deer.indexOf('launchFromClassicTreasureChest('),
    );
    expect(drop).toContain("this.sceneId !== 'desert'");
    expect(drop).toContain('const chestTopY =');
    expect(drop).toContain('DESERT_TREASURE_FEEDBACK.actorChestInsetY');
    expect(drop).toContain('DESERT_TREASURE_FEEDBACK.actorDropMs');
    expect(drop).toContain("'standing-on-chest'");
  });

  it('uses the selected customer sarcophagus and keeps actor inside the cavity', () => {
    expect(books).toContain('prepareDesertWrongSarcophagus(');
    expect(books).toContain('dropDesertWrongSarcophagus(');
    expect(books).toContain("const selectedAsset = this.assets?.choices?.[index] ?? '';");
    expect(books).toContain('DESERT_TREASURE_FEEDBACK.wrongSarcophagusBottomY');
    const pitDrop = deer.slice(
      deer.indexOf('dropToDesertTreasurePit('),
      deer.indexOf('private async dropDesertActor('),
    );
    expect(pitDrop).toContain('DESERT_TREASURE_FEEDBACK.wrongSarcophagusBottomY');
    expect(pitDrop).toContain('DESERT_TREASURE_FEEDBACK.wrongActorSarcophagusInsetY');
    expect(pitDrop).toContain("'dropping-to-pit-bottom'");
    expect(pitDrop).toContain("'at-pit-bottom'");
  });

  it('uses a sand hole and supplied Egyptian symbols in the chest burst', () => {
    expect(hole).toContain("'DesertTreasureSurfaceHole'");
    expect(hole).toContain('`surface-break-${stage + 1}`');
    expect(hole).toContain("'surface-open'");
    expect(hole).toContain('showCavity(');
    expect(hole).toContain("'cavity-open'");
    expect(hole).toContain('const CAVITY_HEIGHT = 330;');
    expect(hole).toContain('private drawCavity(): void');
    expect(hole).toContain('DESERT_TREASURE_FEEDBACK.dirtChunksPerImpact');
    expect(effect).toContain(
      "const SYMBOL_SOURCE = './media/static-feedback/desert/correct-layer-1.png'",
    );
    expect(effect).toContain('const SYMBOL_CROPS: readonly SymbolCrop[]');
    expect(effect).toContain('DESERT_TREASURE_FEEDBACK.rewardSymbolCount');
    expect(effect).toContain('DESERT_TREASURE_FEEDBACK.rewardGemCount');
    expect(effect).toContain('DESERT_TREASURE_FEEDBACK.rewardRayCount');
    expect(effect).toContain("desertTreasureRenderer: 'customer-symbol-canvas'");
    expect(effect).toContain('context.drawImage(');
    expect(effect).not.toContain('context.arc(EFFECT_ORIGIN_X, EFFECT_ORIGIN_Y');
  });

  it('draws a high-layer falling-sand curtain before the supplied buried motion', () => {
    expect(effect).toContain('playBurial(');
    expect(effect).toContain('drawBurialSand(this.context!, progress);');
    expect(effect).toContain('DESERT_TREASURE_FEEDBACK.wrongSandHandoffProgress');
    expect(effect).toContain("'programmatic-sand-canvas'");
    expect(effect).toContain('const BURIAL_Z_INDEX = 9;');
    expect(effect).toContain('const BURIAL_STREAM_TOP_Y = 190;');
    expect(effect).toContain('const BURIAL_OVERALL_ALPHA = 1;');
    expect(effect).toContain('const BURIAL_STREAM_TOP_HALF_WIDTH = 156;');
    expect(effect).toContain('const BURIAL_STREAM_BOTTOM_HALF_WIDTH = 94;');
    expect(effect).toContain('const BURIAL_STREAM_TEXTURES = [');
    expect(effect).toContain('drawBurialStream(');
    expect(effect).toContain('traceBurialCurtain(');
    expect(effect).toContain('drawBurialStreamTextures(');
    expect(effect).toContain('drawBurialMound(');
    expect(effect).toContain(
      'const spread = easeOutCubic(clamp((progress - 0.15) / 0.33));',
    );
    expect(effect).toContain(
      'const rise = smoothStep(clamp((progress - 0.28) / 0.5));',
    );
    expect(effect).toContain('const narrowing = smoothStep(ratio);');
    expect(effect).not.toContain('drawBurialParticles(');
    expect(effect).not.toContain('context.fillRect(');
    expect(effect).not.toContain('context.ellipse(');
  });
});
