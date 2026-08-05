import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import {
  readingScoreFeedback,
  readingScoreFeedbackAssets,
} from '../assets/scripts/games/reading-jumper/config/ReadingScoreFeedback';
import * as ScoreCoinDom from '../assets/scripts/ui/ScoreCoinDom';

const terminalMetrics = (
  ScoreCoinDom as typeof ScoreCoinDom & {
    scoreTerminalMetrics?: (terminal: 'explosion' | 'vortex' | 'ink') => unknown;
  }
).scoreTerminalMetrics;

const CLEAN_POETRY_BRUSH_SHA256 =
  'a2df3b514938f56bbbdcee9be36ed8fa6a39524234e39b95fe90e0c2449fe86f';

function fakeStyle(): CSSStyleDeclaration {
  const values: Record<string, string> = {};
  return Object.assign(values, {
    setProperty(name: string, value: string): void {
      values[name] = value;
    },
    getPropertyValue(name: string): string {
      return values[name] ?? '';
    },
  }) as unknown as CSSStyleDeclaration;
}

class FakeElement {
  readonly children: FakeElement[] = [];
  readonly dataset: Record<string, string> = {};
  readonly style = fakeStyle();
  parent: FakeElement | null = null;
  src = '';
  alt = '';

  appendChild(child: FakeElement): FakeElement {
    child.parent = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (!this.parent) return;
    const index = this.parent.children.indexOf(this);
    if (index >= 0) this.parent.children.splice(index, 1);
    this.parent = null;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const prefix = selector.match(
      /^\[data-score-coin-spark\^="([^"]+)"\]$/,
    )?.[1];
    if (!prefix) return [];
    return this.children.filter(
      (child) => child.dataset.scoreCoinSpark?.startsWith(prefix),
    );
  }
}

function terminalContainer(): {
  readonly element: HTMLDivElement;
  readonly fake: FakeElement;
} {
  const fake = new FakeElement();
  return {
    element: fake as unknown as HTMLDivElement,
    fake,
  };
}

function childWithDataset(
  parent: FakeElement,
  key: string,
  value: string,
): FakeElement {
  const child = parent.children.find((candidate) => candidate.dataset[key] === value);
  if (!child) throw new Error(`Missing child with data-${key}="${value}"`);
  return child;
}

describe('Reading score feedback props', () => {
  it('maps customer props and terminal effects per scene', () => {
    expect(readingScoreFeedback('mario', false)).toMatchObject({
      asset: './media/reward-props/mario/penalty.png',
      width: 66,
      height: 90,
      terminal: 'explosion',
      count: 1,
    });
    expect(readingScoreFeedback('food', true)?.asset)
      .toBe('./media/reward-props/food/reward.png');
    expect(readingScoreFeedback('space', true)?.asset)
      .toBe('./media/reward-props/space/reward.png');
    expect(readingScoreFeedback('space', false)).toMatchObject({
      asset: './media/reward-props/space/penalty.png',
      width: 100,
      height: 72,
      terminal: 'vortex',
    });
    expect(readingScoreFeedback('poetry', false)).toMatchObject({
      asset: './media/reward-props/poetry/penalty.png',
      width: 94,
      height: 105,
      terminal: 'ink',
      count: 1,
    });
    expect(readingScoreFeedback('deep-sea', true)?.asset)
      .toBe('./media/reward-props/deep-sea/reward.png');
    expect(readingScoreFeedback('deep-sea', false)).toBeUndefined();
    expect(readingScoreFeedback('food', false)).toMatchObject({
      asset: './media/reward-props/food/penalty.png',
      width: 76,
      height: 92,
      terminal: 'explosion',
    });
  });

  it('scopes proactive prop loading to the current scene', () => {
    const scopedAssets = readingScoreFeedbackAssets as (sceneId?: string) => string[];
    expect(scopedAssets('mario')).toEqual([
      './media/reward-props/mario/reward.png',
      './media/reward-props/mario/penalty.png',
    ]);
    expect(scopedAssets('deep-sea')).toEqual([
      './media/reward-props/deep-sea/reward.png',
    ]);
    expect(scopedAssets('food')).toEqual([
      './media/reward-props/food/reward.png',
      './media/reward-props/food/penalty.png',
    ]);
    expect(scopedAssets()).toHaveLength(9);
  });

  it('ships every configured prop as a compact runtime PNG', () => {
    readingScoreFeedbackAssets().forEach((asset) => {
      const file = resolve(__dirname, '..', asset.replace('./media/', 'customer-media/'));
      expect(existsSync(file)).toBe(true);
      expect(statSync(file).size).toBeLessThan(150 * 1024);
    });
  });

  it('uses the deterministic rebuilt clean poetry brush', () => {
    const file = resolve(
      __dirname,
      '../customer-media/reward-props/poetry/penalty.png',
    );
    const bytes = readFileSync(file);
    const image = PNG.sync.read(bytes);

    expect({ width: image.width, height: image.height }).toEqual({
      width: 227,
      height: 256,
    });
    expect(createHash('sha256').update(bytes).digest('hex'))
      .toBe(CLEAN_POETRY_BRUSH_SHA256);
  });

  it('defines the full Mario explosion terminal geometry', () => {
    expect(terminalMetrics).toBeDefined();
    expect(terminalMetrics?.('explosion')).toMatchObject({
      width: 240,
      height: 210,
      flashWidth: 128,
      flashHeight: 128,
      fragments: 20,
      peakMs: 205,
      durationMs: 820,
    });
  });

  it('defines the poetry ink terminal geometry', () => {
    expect(terminalMetrics).toBeDefined();
    expect(terminalMetrics?.('ink')).toMatchObject({
      mainWidth: 168,
      mainHeight: 126,
      droplets: 24,
      durationMs: 920,
    });
  });

  it('exposes the full terminal hold used by the feedback sequence gate', () => {
    expect(ScoreCoinDom.scoreTerminalDurationMs({ terminal: 'spark' })).toBe(880);
    expect(ScoreCoinDom.scoreTerminalDurationMs({ terminal: 'explosion' })).toBe(900);
    expect(ScoreCoinDom.scoreTerminalDurationMs({ terminal: 'vortex' })).toBe(900);
    expect(ScoreCoinDom.scoreTerminalDurationMs({ terminal: 'ink' })).toBe(980);
  });

  it('serializes penalty terminal, wrong feedback, then page-top feedback', () => {
    const answers = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/reading-jumper/controllers/ReadingAnswerController.ts',
      ),
      'utf8',
    );
    const scoreEffect = readFileSync(
      resolve(__dirname, '../assets/scripts/ui/ScoreCoinEffectView.ts'),
      'utf8',
    );
    const top = readFileSync(
      resolve(__dirname, '../assets/scripts/ui/WrongFeedbackTopEffectView.ts'),
      'utf8',
    );
    expect(answers).toContain("'terminal-and-landing'");
    expect(answers).toContain("'scene-effect-and-landing'");
    expect(answers).toContain('correct ? undefined : onScoreEffectReady');
    expect(answers).toContain("themeId === 'deep-sea' && !correct");
    expect(answers).toContain('this.view.playDeepSeaInkPopup(index');
    expect(answers).toContain('this.showDeepSeaWrongFeedback(question)');
    expect(answers).toContain('animateIn: false');
    expect(answers).toContain('this.view.playDeepSeaInkSpray');
    expect(answers).toContain("feedbackSequencePhase = 'spray'");
    expect(answers).toContain('.delay(feedbackDurationMs(theme.id, false) / 1000)');
    expect(answers).toContain('.call(this.scope.guard(() => this.showWrongTop(theme.id)))');
    expect(answers).not.toContain('if (!correct) this.view.showWrongFeedbackTop(theme.id)');
    expect(scoreEffect).toContain('scoreTerminalDurationMs(terminalVisual)');
    expect(scoreEffect).toContain('options.onTerminalComplete?.();');
    expect(answers).toContain('scoreCoinFeedbackKind = correct ? \'reward\' : \'penalty\'');
    expect(top).toContain('const DESIGN_WIDTH = AppConfig.designWidth');
    expect(top).toContain('const BACKGROUND_SIBLING_INDEX = 1');
    expect(top).toContain('wrongTopEffectLayer: \'background\'');
    expect(top).toContain('wrongTopEffectStyle: \'vertical-lines-only\'');
    expect(top).toContain('SCENE_DRIP_COLORS');
    expect(top).not.toContain('WrongMistBand');
  });
});

describe('Score terminal DOM behavior', () => {
  const frame = { left: 100, top: 50, scale: 2 };
  const point = { x: 10, y: 20 };
  const expectedLeft = '1560px';
  const expectedTop = '820px';
  let originalDocument: PropertyDescriptor | undefined;
  let originalWindow: PropertyDescriptor | undefined;

  beforeEach(() => {
    jest.useFakeTimers();
    originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: () => new FakeElement(),
      },
    });
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: globalThis,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    if (originalDocument) {
      Object.defineProperty(globalThis, 'document', originalDocument);
    } else {
      Reflect.deleteProperty(globalThis, 'document');
    }
    if (originalWindow) {
      Object.defineProperty(globalThis, 'window', originalWindow);
    } else {
      Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('renders and cleans the scaled Mario explosion topology', () => {
    const scaled = terminalContainer();
    const fragments = ScoreCoinDom.spawnScoreTerminalEffect(
      scaled.element,
      frame,
      point,
      {
        asset: './media/reward-props/mario/penalty.png',
        terminal: 'explosion',
      },
    );

    expect(fragments).toBe(20);
    expect(scaled.fake.children).toHaveLength(23);
    expect(scaled.fake.children.every(
      (child) => child.style.left === expectedLeft && child.style.top === expectedTop,
    )).toBe(true);

    const cloud = childWithDataset(
      scaled.fake,
      'scoreTerminalLayer',
      'explosion-cloud',
    );
    const flash = childWithDataset(
      scaled.fake,
      'scoreTerminalLayer',
      'explosion-flash',
    );
    const ring = childWithDataset(
      scaled.fake,
      'scoreTerminalLayer',
      'explosion-ring',
    );
    const fragmentNodes = scaled.fake.children.filter(
      (child) => child.dataset.scoreTerminalFragment !== undefined,
    );
    expect(cloud.style.width).toBe('480px');
    expect(cloud.style.height).toBe('420px');
    expect(flash.style.width).toBe('256px');
    expect(flash.style.height).toBe('256px');
    expect(ring.style.width).toBe('352px');
    expect(ring.style.height).toBe('308px');
    expect(fragmentNodes).toHaveLength(20);

    const unscaled = terminalContainer();
    ScoreCoinDom.spawnScoreTerminalEffect(
      unscaled.element,
      { left: 100, top: 50, scale: 1 },
      point,
      {
        asset: './media/reward-props/mario/penalty.png',
        terminal: 'explosion',
      },
    );
    const scaledFirstFragment = fragmentNodes[0];
    const unscaledFirstFragment = childWithDataset(
      unscaled.fake,
      'scoreTerminalFragment',
      '0',
    );
    expect(parseFloat(scaledFirstFragment.style.width)).toBeCloseTo(
      parseFloat(unscaledFirstFragment.style.width) * 2,
    );
    expect(parseFloat(scaledFirstFragment.style.getPropertyValue('--fragment-dx')))
      .toBeCloseTo(
        parseFloat(unscaledFirstFragment.style.getPropertyValue('--fragment-dx')) * 2,
      );

    jest.advanceTimersByTime(899);
    expect(scaled.fake.children).toHaveLength(23);
    jest.advanceTimersByTime(1);
    expect(scaled.fake.children).toHaveLength(0);
  });

  it('renders and cleans the scaled poetry ink topology', () => {
    const scaled = terminalContainer();
    const droplets = ScoreCoinDom.spawnScoreTerminalEffect(
      scaled.element,
      frame,
      point,
      {
        asset: './media/reward-props/poetry/penalty.png',
        terminal: 'ink',
      },
    );

    expect(droplets).toBe(24);
    expect(scaled.fake.children).toHaveLength(26);
    expect(scaled.fake.children.every(
      (child) => child.style.left === expectedLeft && child.style.top === expectedTop,
    )).toBe(true);

    const main = childWithDataset(scaled.fake, 'scoreTerminalLayer', 'ink-main');
    const ring = childWithDataset(scaled.fake, 'scoreTerminalLayer', 'ink-ring');
    const dropletNodes = scaled.fake.children.filter(
      (child) => child.dataset.scoreTerminalDroplet !== undefined,
    );
    expect(main.style.width).toBe('336px');
    expect(main.style.height).toBe('252px');
    expect(ring.style.width).toBe('300px');
    expect(ring.style.height).toBe('220px');
    expect(dropletNodes).toHaveLength(24);

    const unscaled = terminalContainer();
    ScoreCoinDom.spawnScoreTerminalEffect(
      unscaled.element,
      { left: 100, top: 50, scale: 1 },
      point,
      {
        asset: './media/reward-props/poetry/penalty.png',
        terminal: 'ink',
      },
    );
    const scaledFirstDroplet = dropletNodes[0];
    const unscaledFirstDroplet = childWithDataset(
      unscaled.fake,
      'scoreTerminalDroplet',
      '0',
    );
    expect(parseFloat(scaledFirstDroplet.style.width)).toBeCloseTo(
      parseFloat(unscaledFirstDroplet.style.width) * 2,
    );
    expect(parseFloat(scaledFirstDroplet.style.getPropertyValue('--ink-dx')))
      .toBeCloseTo(
        parseFloat(unscaledFirstDroplet.style.getPropertyValue('--ink-dx')) * 2,
      );

    jest.advanceTimersByTime(979);
    expect(scaled.fake.children).toHaveLength(26);
    jest.advanceTimersByTime(1);
    expect(scaled.fake.children).toHaveLength(0);
  });

  it('keeps a newer terminal when an older terminal cleanup fires', () => {
    const { element, fake } = terminalContainer();
    ScoreCoinDom.spawnScoreTerminalEffect(element, frame, point, {
      asset: './media/reward-props/mario/penalty.png',
      terminal: 'explosion',
    });
    jest.advanceTimersByTime(400);
    ScoreCoinDom.spawnScoreTerminalEffect(element, frame, point, {
      asset: './media/reward-props/poetry/penalty.png',
      terminal: 'ink',
    });
    expect(fake.children).toHaveLength(49);

    jest.advanceTimersByTime(500);
    expect(fake.children).toHaveLength(26);
    expect(fake.children.filter(
      (child) => child.dataset.scoreTerminalDroplet !== undefined,
    )).toHaveLength(24);

    jest.advanceTimersByTime(479);
    expect(fake.children).toHaveLength(26);
    jest.advanceTimersByTime(1);
    expect(fake.children).toHaveLength(0);
  });

  it('preserves the spark terminal branch and cleanup timing', () => {
    const { element, fake } = terminalContainer();
    const sparks = ScoreCoinDom.spawnScoreTerminalEffect(
      element,
      frame,
      point,
      {
        asset: './media/reward-props/mario/reward.png',
        terminal: 'spark',
        trail: 'gold',
      },
    );

    expect(sparks).toBe(16);
    expect(fake.children).toHaveLength(18);
    expect(fake.children.every(
      (child) => child.style.left === expectedLeft && child.style.top === expectedTop,
    )).toBe(true);
    expect(fake.children.filter(
      (child) => child.dataset.scoreCoinSpark?.startsWith('arrival-'),
    )).toHaveLength(16);

    jest.advanceTimersByTime(879);
    expect(fake.children).toHaveLength(18);
    jest.advanceTimersByTime(1);
    expect(fake.children).toHaveLength(0);
  });

  it('preserves the vortex terminal branch and cleanup timing', () => {
    const { element, fake } = terminalContainer();
    const vortexCount = ScoreCoinDom.spawnScoreTerminalEffect(
      element,
      frame,
      point,
      {
        asset: './media/reward-props/space/penalty.png',
        width: 100,
        height: 72,
        terminal: 'vortex',
      },
    );

    expect(vortexCount).toBe(16);
    expect(fake.children).toHaveLength(19);
    const image = childWithDataset(fake, 'scoreTerminalLayer', 'vortex-image');
    expect(image).toMatchObject({
      src: './media/reward-props/space/penalty.png',
      alt: '',
    });
    expect(image.style.left).toBe(expectedLeft);
    expect(image.style.top).toBe(expectedTop);
    expect(image.style.width).toBe('480px');
    expect(image.style.height).toBe('345.6px');
    expect(childWithDataset(fake, 'scoreTerminalLayer', 'vortex-ring').style.width)
      .toBe('396px');
    expect(fake.children.filter(
      (child) => child.dataset.scoreTerminalFragment?.startsWith('vortex-'),
    )).toHaveLength(16);

    jest.advanceTimersByTime(899);
    expect(fake.children).toHaveLength(19);
    jest.advanceTimersByTime(1);
    expect(fake.children).toHaveLength(0);
  });
});
