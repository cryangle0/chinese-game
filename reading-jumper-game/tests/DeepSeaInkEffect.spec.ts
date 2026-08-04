import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PNG } from 'pngjs';
import {
  DeepSeaInkEffectView,
  DeepSeaInkRuntime,
  createReadingFeedbackReadyHandler,
  deepSeaInkGeometry,
  deepSeaInkTarget,
} from '../assets/scripts/ui/DeepSeaInkEffectView';

const FRAME_MS = 1000 / 15;
const DYNAMIC_BODY_DIAGNOSTICS = [
  'deepSeaInkFrame',
  'deepSeaInkTarget',
  'deepSeaInkSprayHit',
  'deepSeaInkBodyTopRight',
  'deepSeaInkViewportCenter',
  'deepSeaInkFps',
  'deepSeaInkFrameCount',
] as const;
const EXPECTED_BACKGROUND_POSITIONS = [
  '0px 0px', '-128px 0px', '-256px 0px', '-384px 0px', '-512px 0px',
  '0px -128px', '-128px -128px', '-256px -128px', '-384px -128px', '-512px -128px',
  '0px -256px', '-128px -256px', '-256px -256px', '-384px -256px', '-512px -256px',
  '0px -384px', '-128px -384px', '-256px -384px', '-384px -384px', '-512px -384px',
  '0px -512px', '-128px -512px', '-256px -512px', '-384px -512px', '-512px -512px',
  '0px -640px',
] as const;

class FakeElement {
  id = '';
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly attributes: Record<string, string> = {};
  isConnected = false;

  constructor(private readonly detach: (element: FakeElement) => void) {}

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  remove(): void {
    this.detach(this);
  }
}

interface InkHarness {
  runtime: DeepSeaInkRuntime;
  readonly children: FakeElement[];
  readonly bodyDataset: Record<string, string>;
  now: number;
  pending(): FrameRequestCallback[];
  step(timestamp: number): void;
  makeSheetReady(): Promise<void>;
}

interface RetryInkHarness extends InkHarness {
  loadCount(): number;
  resolveLoad(index: number): Promise<void>;
  rejectLoad(index: number): Promise<void>;
}

function createHarness(options: { readonly delayedReady?: boolean } = {}): InkHarness {
  const children: FakeElement[] = [];
  const bodyDataset: Record<string, string> = {};
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  let resolveSheet = (): void => undefined;
  const sheetReady = options.delayedReady
    ? new Promise<void>((resolvePromise) => {
      resolveSheet = resolvePromise;
    })
    : Promise.resolve();
  const harness: InkHarness = {
    now: 1000,
    children,
    bodyDataset,
    runtime: undefined as unknown as DeepSeaInkRuntime,
    pending: () => [...callbacks.values()],
    step: (timestamp: number) => {
      const pending = [...callbacks.entries()];
      callbacks.clear();
      pending.forEach(([, callback]) => callback(timestamp));
    },
    makeSheetReady: async () => {
      resolveSheet();
      await sheetReady;
      await Promise.resolve();
    },
  };
  const detach = (element: FakeElement): void => {
    const index = children.indexOf(element);
    if (index >= 0) children.splice(index, 1);
    element.isConnected = false;
  };
  const body = {
    dataset: bodyDataset,
    appendChild: (element: FakeElement) => {
      if (!children.includes(element)) children.push(element);
      element.isConnected = true;
      return element;
    },
  };
  const canvas = {
    getBoundingClientRect: () => ({
      left: 10,
      top: 20,
      width: 720,
      height: 405,
      right: 730,
      bottom: 425,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    }),
  };
  harness.runtime = {
    document: {
      body,
      createElement: () => new FakeElement(detach),
      getElementById: (id: string) => (id === 'GameCanvas' ? canvas : null),
    } as unknown as Document,
    now: () => harness.now,
    requestFrame: (callback: FrameRequestCallback) => {
      const handle = nextFrame;
      nextFrame += 1;
      callbacks.set(handle, callback);
      return handle;
    },
    cancelFrame: (handle: number) => {
      callbacks.delete(handle);
    },
    loadImage: () => sheetReady,
  } as DeepSeaInkRuntime;
  return harness;
}

function createRetryHarness(): RetryInkHarness {
  const harness = createHarness();
  const attempts: Array<{
    readonly promise: Promise<void>;
    readonly resolve: () => void;
    readonly reject: () => void;
  }> = [];
  const runtime: DeepSeaInkRuntime = {
    ...harness.runtime,
    loadImage: () => {
      let resolveLoad = (): void => undefined;
      let rejectLoad = (): void => undefined;
      const promise = new Promise<void>((resolvePromise, rejectPromise) => {
        resolveLoad = resolvePromise;
        rejectLoad = () => rejectPromise(new Error('controlled image load failure'));
      });
      attempts.push({ promise, resolve: resolveLoad, reject: rejectLoad });
      return promise;
    },
  };
  const flushAttempt = async (index: number, settle: 'resolve' | 'reject'): Promise<void> => {
    const attempt = attempts[index];
    if (!attempt) throw new Error(`Missing load attempt ${index}`);
    attempt[settle]();
    await attempt.promise.catch(() => undefined);
    await Promise.resolve();
  };
  return {
    ...harness,
    runtime,
    loadCount: () => attempts.length,
    resolveLoad: (index) => flushAttempt(index, 'resolve'),
    rejectLoad: (index) => flushAttempt(index, 'reject'),
  };
}

function expectBodyDiagnosticsCleared(harness: InkHarness): void {
  expect(harness.bodyDataset.deepSeaInkActive).toBe('false');
  DYNAMIC_BODY_DIAGNOSTICS.forEach((field) => {
    expect(harness.bodyDataset[field]).toBeUndefined();
  });
}

describe('DeepSeaInkEffectView', () => {
  it('converts all answer columns to one head target and keeps the squid upper-right', () => {
    const cases = [
      {
        columnX: -450,
        target: { x: 270, y: 375 },
        center: { x: 360, y: 300 },
        bodyAnchor: { x: 480, y: 180 },
      },
      {
        columnX: 0,
        target: { x: 720, y: 375 },
        center: { x: 810, y: 300 },
        bodyAnchor: { x: 930, y: 180 },
      },
      {
        columnX: 450,
        target: { x: 1170, y: 375 },
        center: { x: 1260, y: 300 },
        bodyAnchor: { x: 1380, y: 180 },
      },
    ] as const;

    cases.forEach(({ columnX, target, center, bodyAnchor }) => {
      const geometry = deepSeaInkGeometry(deepSeaInkTarget(columnX, 37));
      expect(geometry.target).toEqual(target);
      expect(geometry.viewportCenter).toEqual(center);
      expect(geometry.bodyTopRight).toEqual(bodyAnchor);
      expect(geometry.sprayHit).toEqual(target);
    });
  });

  it('waits for image readiness, then shows all 26 row-major frames from frame zero', async () => {
    const harness = createHarness({ delayedReady: true });
    const effect = new DeepSeaInkEffectView(harness.runtime);

    effect.play({ columnX: 0, headY: 375 });

    expect(harness.children).toHaveLength(0);
    expect(harness.pending()).toHaveLength(0);
    expectBodyDiagnosticsCleared(harness);
    harness.step(harness.now + FRAME_MS * 20);
    expect(harness.children).toHaveLength(0);

    harness.now = 5000;
    await harness.makeSheetReady();

    expect(harness.children).toHaveLength(1);
    const element = harness.children[0];
    expect(element.style.backgroundImage).toContain(
      './media/reward-props/deep-sea/ink-squid-sheet.png',
    );
    expect(element.style.zIndex).toBe('37');
    expect(element.style.width).toBe('128px');
    expect(element.style.height).toBe('128px');
    expect(element.style.left).toBe('351px');
    expect(element.style.top).toBe('106px');
    expect(element.dataset.deepSeaInkFrame).toBe('0');
    expect(element.style.backgroundPosition).toBe('0px 0px');
    expect(harness.bodyDataset).toMatchObject({
      deepSeaInkActive: 'true',
      deepSeaInkFrame: '0',
      deepSeaInkTarget: '720,375',
      deepSeaInkSprayHit: '720,375',
      deepSeaInkFrameCount: '26',
      deepSeaInkFps: '15',
    });

    EXPECTED_BACKGROUND_POSITIONS.forEach((backgroundPosition, frameIndex) => {
      if (frameIndex > 0) {
        harness.step(harness.now + FRAME_MS * frameIndex + 0.01);
      }
      expect(element.dataset.deepSeaInkFrame).toBe(String(frameIndex));
      expect(element.style.backgroundPosition).toBe(backgroundPosition);
    });
    expect(harness.bodyDataset.deepSeaInkActive).toBe('true');

    harness.step(harness.now + FRAME_MS * 26 + 0.01);
    expect(harness.children).toHaveLength(0);
    expectBodyDiagnosticsCleared(harness);
  });

  it('discards delayed readiness after replacement, hide, and dispose', async () => {
    const replaced = createHarness({ delayedReady: true });
    const replacedEffect = new DeepSeaInkEffectView(replaced.runtime);
    replacedEffect.play({ columnX: -450, headY: 375 });
    replacedEffect.play({ columnX: 450, headY: 375 });
    expect(replaced.children).toHaveLength(0);
    await replaced.makeSheetReady();
    expect(replaced.children).toHaveLength(1);
    expect(replaced.bodyDataset.deepSeaInkTarget).toBe('1170,375');

    const hidden = createHarness({ delayedReady: true });
    const hiddenEffect = new DeepSeaInkEffectView(hidden.runtime);
    hiddenEffect.play({ columnX: 0, headY: 375 });
    hiddenEffect.hide();
    await hidden.makeSheetReady();
    expect(hidden.children).toHaveLength(0);
    expect(hidden.pending()).toHaveLength(0);
    expectBodyDiagnosticsCleared(hidden);

    const disposed = createHarness({ delayedReady: true });
    const disposedEffect = new DeepSeaInkEffectView(disposed.runtime);
    disposedEffect.play({ columnX: 0, headY: 375 });
    disposedEffect.dispose();
    await disposed.makeSheetReady();
    expect(disposed.children).toHaveLength(0);
    expect(disposed.pending()).toHaveLength(0);
    expectBodyDiagnosticsCleared(disposed);
  });

  it('retries a rejected image load and caches the later successful readiness', async () => {
    const harness = createRetryHarness();
    const effect = new DeepSeaInkEffectView(harness.runtime);
    expect(harness.loadCount()).toBe(0);

    effect.play({ columnX: -450, headY: 375 });
    expect(harness.loadCount()).toBe(1);
    await harness.rejectLoad(0);
    expect(harness.children).toHaveLength(0);
    expect(harness.pending()).toHaveLength(0);
    expectBodyDiagnosticsCleared(harness);

    effect.play({ columnX: 0, headY: 375 });
    expect(harness.loadCount()).toBe(2);
    effect.play({ columnX: 450, headY: 375 });
    expect(harness.loadCount()).toBe(2);

    harness.now = 7000;
    await harness.resolveLoad(1);
    expect(harness.children).toHaveLength(1);
    expect(harness.children[0].dataset.deepSeaInkFrame).toBe('0');
    expect(harness.bodyDataset.deepSeaInkTarget).toBe('1170,375');
    expect(harness.pending()).toHaveLength(1);

    effect.hide();
    effect.play({ columnX: 0, headY: 375 });
    await Promise.resolve();
    expect(harness.loadCount()).toBe(2);
    expect(harness.children).toHaveLength(1);
    expect(harness.children[0].dataset.deepSeaInkFrame).toBe('0');
    expect(harness.bodyDataset.deepSeaInkTarget).toBe('720,375');
  });

  it('isolates stale animation callbacks and cleans and rebuilds diagnostics', async () => {
    const harness = createHarness();
    const effect = new DeepSeaInkEffectView(harness.runtime);

    effect.play({ columnX: -450, headY: 375 });
    await harness.makeSheetReady();
    const staleTick = harness.pending()[0];
    expect(staleTick).toBeDefined();

    effect.play({ columnX: 450, headY: 375 });
    await harness.makeSheetReady();
    const currentElement = harness.children[0];
    expect(harness.bodyDataset.deepSeaInkActive).toBe('true');
    expect(currentElement.dataset.deepSeaInkTarget).toBe('1170,375');

    staleTick(harness.now + FRAME_MS * 10);
    expect(currentElement.dataset.deepSeaInkFrame).toBe('0');
    expect(currentElement.dataset.deepSeaInkTarget).toBe('1170,375');

    harness.step(harness.now + FRAME_MS * 2 + 0.01);
    expect(currentElement.dataset.deepSeaInkFrame).toBe('2');

    effect.hide();
    expect(harness.children).toHaveLength(0);
    expect(harness.pending()).toHaveLength(0);
    expectBodyDiagnosticsCleared(harness);

    effect.play({ columnX: 0, headY: 375 });
    await harness.makeSheetReady();
    expect(harness.children).toHaveLength(1);
    expect(harness.bodyDataset).toMatchObject({
      deepSeaInkActive: 'true',
      deepSeaInkFrame: '0',
      deepSeaInkTarget: '720,375',
      deepSeaInkSprayHit: '720,375',
      deepSeaInkBodyTopRight: '930,180',
      deepSeaInkViewportCenter: '810,300',
      deepSeaInkFps: '15',
      deepSeaInkFrameCount: '26',
    });
    effect.dispose();
    expect(harness.children).toHaveLength(0);
    expectBodyDiagnosticsCleared(harness);
    effect.play({ columnX: 0, headY: 375 });
    await harness.makeSheetReady();
    expect(harness.children).toHaveLength(0);
  });

  it('uses an opaque pixel from the real final-frame ink stream as the spray hit', () => {
    const sheet = PNG.sync.read(readFileSync(resolve(
      __dirname,
      '../customer-media/reward-props/deep-sea/ink-squid-sheet.png',
    )));
    const frame25X = 38;
    const frame25Y = 5 * 256 + 203;
    const alpha = sheet.data[(frame25Y * sheet.width + frame25X) * 4 + 3];

    expect({ width: sheet.width, height: sheet.height }).toEqual({
      width: 1280,
      height: 1536,
    });
    expect(alpha).toBeGreaterThan(0);
  });

  it('starts only for a deep-sea wrong answer after revealing feedback', () => {
    const events: string[] = [];
    const view = {
      setFeedbackVisible: (visible: boolean) => events.push(`visible:${visible}`),
      playDeepSeaInk: (columnX: number) => events.push(`ink:${columnX}`),
    };

    const marioWrongReady = createReadingFeedbackReadyHandler(view, 'mario', false, -450);
    const deepSeaCorrectReady = createReadingFeedbackReadyHandler(view, 'deep-sea', true, 0);
    const deepSeaWrongReady = createReadingFeedbackReadyHandler(view, 'deep-sea', false, 450);

    expect(events).toEqual([]);
    marioWrongReady();
    deepSeaCorrectReady();
    deepSeaWrongReady();

    expect(events).toEqual([
      'visible:true',
      'visible:true',
      'visible:true',
      'ink:450',
    ]);
  });
});
