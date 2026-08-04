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
    scoreTerminalMetrics?: (terminal: 'explosion' | 'ink') => unknown;
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
    expect(scopedAssets()).toHaveLength(8);
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
      width: 170,
      height: 150,
      flashWidth: 92,
      flashHeight: 92,
      fragments: 14,
      peakMs: 180,
      durationMs: 700,
    });
  });

  it('defines the poetry ink terminal geometry', () => {
    expect(terminalMetrics).toBeDefined();
    expect(terminalMetrics?.('ink')).toMatchObject({
      mainWidth: 110,
      mainHeight: 82,
      droplets: 18,
      durationMs: 800,
    });
  });

  it('starts wrong-page top feedback from the captured trigger phase', () => {
    const answers = readFileSync(
      resolve(
        __dirname,
        '../assets/scripts/games/reading-jumper/controllers/ReadingAnswerController.ts',
      ),
      'utf8',
    );
    const top = readFileSync(
      resolve(__dirname, '../assets/scripts/ui/WrongFeedbackTopEffectView.ts'),
      'utf8',
    );
    expect(answers).toContain('if (!correct) this.view.showWrongFeedbackTop(theme.id)');
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

    expect(fragments).toBe(14);
    expect(scaled.fake.children).toHaveLength(17);
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
    expect(cloud.style.width).toBe('340px');
    expect(cloud.style.height).toBe('300px');
    expect(flash.style.width).toBe('184px');
    expect(flash.style.height).toBe('184px');
    expect(ring.style.width).toBe('252px');
    expect(ring.style.height).toBe('220px');
    expect(fragmentNodes).toHaveLength(14);

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

    jest.advanceTimersByTime(759);
    expect(scaled.fake.children).toHaveLength(17);
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

    expect(droplets).toBe(18);
    expect(scaled.fake.children).toHaveLength(20);
    expect(scaled.fake.children.every(
      (child) => child.style.left === expectedLeft && child.style.top === expectedTop,
    )).toBe(true);

    const main = childWithDataset(scaled.fake, 'scoreTerminalLayer', 'ink-main');
    const ring = childWithDataset(scaled.fake, 'scoreTerminalLayer', 'ink-ring');
    const dropletNodes = scaled.fake.children.filter(
      (child) => child.dataset.scoreTerminalDroplet !== undefined,
    );
    expect(main.style.width).toBe('220px');
    expect(main.style.height).toBe('164px');
    expect(ring.style.width).toBe('192px');
    expect(ring.style.height).toBe('136px');
    expect(dropletNodes).toHaveLength(18);

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

    jest.advanceTimersByTime(849);
    expect(scaled.fake.children).toHaveLength(20);
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
    expect(fake.children).toHaveLength(37);

    jest.advanceTimersByTime(360);
    expect(fake.children).toHaveLength(20);
    expect(fake.children.filter(
      (child) => child.dataset.scoreTerminalDroplet !== undefined,
    )).toHaveLength(18);

    jest.advanceTimersByTime(489);
    expect(fake.children).toHaveLength(20);
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

    expect(sparks).toBe(9);
    expect(fake.children).toHaveLength(11);
    expect(fake.children.every(
      (child) => child.style.left === expectedLeft && child.style.top === expectedTop,
    )).toBe(true);
    expect(fake.children.filter(
      (child) => child.dataset.scoreCoinSpark?.startsWith('arrival-'),
    )).toHaveLength(9);

    jest.advanceTimersByTime(716);
    expect(fake.children).toHaveLength(11);
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

    expect(vortexCount).toBe(1);
    expect(fake.children).toHaveLength(1);
    expect(fake.children[0]).toMatchObject({
      src: './media/reward-props/space/penalty.png',
      alt: '',
    });
    expect(fake.children[0].style.left).toBe(expectedLeft);
    expect(fake.children[0].style.top).toBe(expectedTop);
    expect(fake.children[0].style.width).toBe('330px');
    expect(fake.children[0].style.height).toBe('237.6px');

    jest.advanceTimersByTime(719);
    expect(fake.children).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(fake.children).toHaveLength(0);
  });
});
