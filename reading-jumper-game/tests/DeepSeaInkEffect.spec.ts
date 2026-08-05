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

const FRAME_COUNT = 26;
const FRAME_MS = 1000 / 24;
const POPUP_END_FRAME = 8;
const REPOSITION_FRAME = 12;
const SPRAY_START_FRAME = 13;
const REPOSITION_MS = 100;
const IMPACT_HOLD_MS = 180;
const OPTION = { width: 410, height: 124, y: -18 };
const FEEDBACK = { width: 556, height: 667, y: 37 };
const DYNAMIC_BODY_DIAGNOSTICS = [
  'deepSeaInkFrame',
  'deepSeaInkFrameSource',
  'deepSeaInkPhase',
  'deepSeaInkTarget',
  'deepSeaInkSprayHit',
  'deepSeaInkBodyTopRight',
  'deepSeaInkSprayBodyTopRight',
  'deepSeaInkOptionTopRight',
  'deepSeaInkCharacterHeadBounds',
  'deepSeaInkViewportCenter',
  'deepSeaInkViewportTopLeft',
  'deepSeaInkSprayViewportTopLeft',
  'deepSeaInkFps',
  'deepSeaInkFrameCount',
] as const;

interface FakeFrame {
  readonly source: string;
}

class FakeCanvasElement {
  id = '';
  width = 0;
  height = 0;
  readonly dataset: Record<string, string> = {};
  readonly style: Record<string, string> = {};
  readonly attributes: Record<string, string> = {};
  readonly drawSources: string[] = [];
  clearCount = 0;
  isConnected = false;
  private readonly context = {
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
    clearRect: () => {
      this.clearCount += 1;
    },
    drawImage: (frame: FakeFrame) => {
      this.drawSources.push(frame.source);
    },
  };

  constructor(private readonly detach: (element: FakeCanvasElement) => void) {}

  setAttribute(name: string, value: string): void {
    this.attributes[name] = value;
  }

  getContext(): CanvasRenderingContext2D {
    return this.context as unknown as CanvasRenderingContext2D;
  }

  remove(): void {
    this.detach(this);
  }
}

interface InkHarness {
  runtime: DeepSeaInkRuntime;
  readonly children: FakeCanvasElement[];
  readonly bodyDataset: Record<string, string>;
  readonly loadSources: string[];
  now: number;
  pending(): FrameRequestCallback[];
  step(timestamp: number): void;
  makeFramesReady(): Promise<void>;
  rejectFrames(): Promise<void>;
}

function createHarness(options: { readonly delayedReady?: boolean } = {}): InkHarness {
  const children: FakeCanvasElement[] = [];
  const bodyDataset: Record<string, string> = {};
  const loadSources: string[] = [];
  const callbacks = new Map<number, FrameRequestCallback>();
  let nextFrame = 1;
  let resolveFrames = (): void => undefined;
  let rejectFrames = (): void => undefined;
  const readiness = options.delayedReady
    ? new Promise<void>((resolvePromise, rejectPromise) => {
      resolveFrames = resolvePromise;
      rejectFrames = () => rejectPromise(new Error('controlled frame load failure'));
    })
    : Promise.resolve();
  const harness: InkHarness = {
    now: 1000,
    children,
    bodyDataset,
    loadSources,
    runtime: undefined as unknown as DeepSeaInkRuntime,
    pending: () => [...callbacks.values()],
    step: (timestamp: number) => {
      harness.now = timestamp;
      const pending = [...callbacks.entries()];
      callbacks.clear();
      pending.forEach(([, callback]) => callback(timestamp));
    },
    makeFramesReady: async () => {
      resolveFrames();
      await readiness;
      await Promise.resolve();
      await Promise.resolve();
    },
    rejectFrames: async () => {
      rejectFrames();
      await readiness.catch(() => undefined);
      await Promise.resolve();
      await Promise.resolve();
    },
  };
  const detach = (element: FakeCanvasElement): void => {
    const index = children.indexOf(element);
    if (index >= 0) children.splice(index, 1);
    element.isConnected = false;
  };
  const body = {
    dataset: bodyDataset,
    appendChild: (element: FakeCanvasElement) => {
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
      createElement: () => new FakeCanvasElement(detach),
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
    loadImage: (source: string) => {
      loadSources.push(source);
      return readiness.then(
        () => ({ source }) as unknown as CanvasImageSource,
      );
    },
  };
  return harness;
}

function expectBodyDiagnosticsCleared(harness: InkHarness): void {
  expect(harness.bodyDataset.deepSeaInkActive).toBe('false');
  DYNAMIC_BODY_DIAGNOSTICS.forEach((field) => {
    expect(harness.bodyDataset[field]).toBeUndefined();
  });
}

function frameSource(frameIndex: number): string {
  return `./media/reward-props/deep-sea/ink-squid-frames/`
    + `frame-${String(frameIndex).padStart(2, '0')}.png`;
}

describe('DeepSeaInkEffectView', () => {
  it('anchors the popup above each option and targets the enlarged feedback head', () => {
    [-450, 0, 450].forEach((columnX) => {
      const geometry = deepSeaInkGeometry(
        deepSeaInkTarget(columnX, OPTION, FEEDBACK),
      );
      expect(geometry.optionTopRight).toEqual({
        x: 720 + columnX + 205,
        y: 361,
      });
      expect(geometry.bodyTopRight).toEqual({
        x: 720 + columnX + 205,
        y: 343,
      });
      expect(geometry.target).toEqual({
        x: 720 + columnX + 5,
        y: 466,
      });
      expect(geometry.sprayHit).toEqual(geometry.target);
      expect(geometry.sprayViewportTopLeft).toEqual({
        x: 720 + columnX - 40,
        y: 231,
      });
      expect(geometry.sprayBodyTopRight).toEqual({
        x: 720 + columnX + 220,
        y: 231,
      });
      expect(geometry.bodyTopRight.y).toBeLessThan(geometry.optionTopRight.y);
      expect(geometry.sprayBodyTopRight.y).toBeLessThan(geometry.bodyTopRight.y);
      expect(geometry.sprayHit.x).toBeGreaterThanOrEqual(
        geometry.characterHeadBounds.left,
      );
      expect(geometry.sprayHit.x).toBeLessThanOrEqual(
        geometry.characterHeadBounds.right,
      );
      expect(geometry.sprayHit.y).toBeGreaterThanOrEqual(
        geometry.characterHeadBounds.top,
      );
      expect(geometry.sprayHit.y).toBeLessThanOrEqual(
        geometry.characterHeadBounds.bottom,
      );
    });
  });

  it('skips the shrinking restart frames between popup, hold, and spray', async () => {
    const harness = createHarness({ delayedReady: true });
    const effect = new DeepSeaInkEffectView(harness.runtime);
    const events: string[] = [];

    effect.preload();
    expect(harness.loadSources).toHaveLength(FRAME_COUNT);
    expect(harness.loadSources[0]).toBe(frameSource(0));
    expect(harness.loadSources[25]).toBe(frameSource(25));
    effect.playPopup(
      deepSeaInkTarget(0, OPTION, FEEDBACK),
      () => events.push('popup-complete'),
    );

    expect(harness.children).toHaveLength(0);
    expectBodyDiagnosticsCleared(harness);
    harness.now = 5000;
    await harness.makeFramesReady();

    expect(harness.children).toHaveLength(1);
    const element = harness.children[0];
    expect(element.width).toBe(261);
    expect(element.height).toBe(241);
    expect(element.style.zIndex).toBe('37');
    expect(element.style.width).toBe('130.5px');
    expect(element.style.height).toBe('120.5px');
    expect(element.style.left).toBe('342.5px');
    expect(element.style.top).toBe('191.5px');
    expect(element.style.backgroundImage).toBeUndefined();
    expect(element.drawSources).toEqual([frameSource(0)]);
    expect(harness.bodyDataset).toMatchObject({
      deepSeaInkActive: 'true',
      deepSeaInkAssetMode: 'customer-original-frames',
      deepSeaInkRenderer: 'predecoded-canvas',
      deepSeaInkPhase: 'popup',
      deepSeaInkFrame: '0',
      deepSeaInkFrameSource: frameSource(0),
      deepSeaInkTarget: '725,466',
      deepSeaInkSprayHit: '725,466',
      deepSeaInkBodyTopRight: '925,343',
      deepSeaInkSprayBodyTopRight: '940,231',
      deepSeaInkOptionTopRight: '925,361',
      deepSeaInkFrameCount: '26',
      deepSeaInkFps: '24',
    });

    const popupStartedAt = harness.now;
    for (let frameIndex = 1; frameIndex <= POPUP_END_FRAME; frameIndex += 1) {
      harness.step(popupStartedAt + FRAME_MS * frameIndex + 0.01);
      expect(element.dataset.deepSeaInkFrame).toBe(String(frameIndex));
      expect(element.drawSources[element.drawSources.length - 1])
        .toBe(frameSource(frameIndex));
    }
    expect(events).toEqual([]);

    harness.step(popupStartedAt + FRAME_MS * (POPUP_END_FRAME + 1) + 0.01);
    expect(events).toEqual(['popup-complete']);
    expect(harness.children).toHaveLength(1);
    expect(harness.bodyDataset.deepSeaInkPhase).toBe('hold');
    expect(element.dataset.deepSeaInkFrame).toBe(String(POPUP_END_FRAME));

    effect.playSpray(() => events.push('spray-complete'));
    expect(harness.bodyDataset.deepSeaInkPhase).toBe('reposition');
    harness.step(harness.now + REPOSITION_MS + 0.01);
    expect(harness.bodyDataset.deepSeaInkPhase).toBe('spray');
    expect(element.dataset.deepSeaInkFrame).toBe(String(SPRAY_START_FRAME));
    expect(element.drawSources).toContain(frameSource(REPOSITION_FRAME));
    [9, 10, 11].forEach((frameIndex) => {
      expect(element.drawSources).not.toContain(frameSource(frameIndex));
    });
    expect(element.style.left).toBe('350px');
    expect(element.style.top).toBe('135.5px');

    const sprayStartedAt = harness.now;
    for (
      let frameIndex = SPRAY_START_FRAME + 1;
      frameIndex < FRAME_COUNT;
      frameIndex += 1
    ) {
      harness.step(
        sprayStartedAt + FRAME_MS * (frameIndex - SPRAY_START_FRAME) + 0.01,
      );
      expect(element.dataset.deepSeaInkFrame).toBe(String(frameIndex));
      expect(element.drawSources[element.drawSources.length - 1])
        .toBe(frameSource(frameIndex));
    }
    expect(events).toEqual(['popup-complete']);

    harness.step(
      sprayStartedAt + FRAME_MS * (FRAME_COUNT - SPRAY_START_FRAME) + 0.01,
    );
    expect(harness.bodyDataset.deepSeaInkPhase).toBe('impact');
    expect(harness.children).toHaveLength(1);

    harness.step(harness.now + IMPACT_HOLD_MS + 0.01);
    expect(events).toEqual(['popup-complete', 'spray-complete']);
    expect(harness.children).toHaveLength(0);
    expect(Number(harness.bodyDataset.deepSeaInkCompletedAt)).toBeGreaterThan(5000);
    expectBodyDiagnosticsCleared(harness);
    expect(element.drawSources).toEqual(
      [
        ...Array.from(
          { length: POPUP_END_FRAME + 1 },
          (_, index) => frameSource(index),
        ),
        frameSource(REPOSITION_FRAME),
        ...Array.from(
          { length: FRAME_COUNT - SPRAY_START_FRAME },
          (_, index) => frameSource(index + SPRAY_START_FRAME),
        ),
      ],
    );
  });

  it('keeps only the latest delayed popup and cancels hidden playback', async () => {
    const replaced = createHarness({ delayedReady: true });
    const replacedEffect = new DeepSeaInkEffectView(replaced.runtime);
    const completions: string[] = [];
    replacedEffect.playPopup(
      deepSeaInkTarget(-450, OPTION, FEEDBACK),
      () => completions.push('old'),
    );
    replacedEffect.playPopup(
      deepSeaInkTarget(450, OPTION, FEEDBACK),
      () => completions.push('latest'),
    );
    await replaced.makeFramesReady();
    expect(replaced.children).toHaveLength(1);
    expect(replaced.bodyDataset.deepSeaInkTarget).toBe('1175,466');
    replaced.step(replaced.now + FRAME_MS * (POPUP_END_FRAME + 1) + 0.01);
    expect(completions).toEqual(['latest']);
    expect(replaced.bodyDataset.deepSeaInkPhase).toBe('hold');

    const hidden = createHarness({ delayedReady: true });
    const hiddenEffect = new DeepSeaInkEffectView(hidden.runtime);
    let hiddenCompleted = false;
    hiddenEffect.playPopup(
      deepSeaInkTarget(0, OPTION, FEEDBACK),
      () => { hiddenCompleted = true; },
    );
    hiddenEffect.hide();
    await hidden.makeFramesReady();
    expect(hidden.children).toHaveLength(0);
    expect(hidden.pending()).toHaveLength(0);
    expect(hiddenCompleted).toBe(false);
    expectBodyDiagnosticsCleared(hidden);
  });

  it('fails open when a customer frame cannot load', async () => {
    const harness = createHarness({ delayedReady: true });
    const effect = new DeepSeaInkEffectView(harness.runtime);
    let completed = false;
    effect.playPopup(
      deepSeaInkTarget(0, OPTION, FEEDBACK),
      () => { completed = true; },
    );

    await harness.rejectFrames();

    expect(completed).toBe(true);
    expect(harness.children).toHaveLength(0);
    expect(harness.bodyDataset).toMatchObject({
      deepSeaInkActive: 'load-error',
      deepSeaInkAssetMode: 'customer-original-frames',
      deepSeaInkRenderer: 'predecoded-canvas',
    });
  });

  it('fails open if spray is requested before the popup hold', () => {
    const harness = createHarness();
    const effect = new DeepSeaInkEffectView(harness.runtime);
    let completed = false;

    effect.playSpray(() => {
      completed = true;
    });

    expect(completed).toBe(true);
    expect(harness.children).toHaveLength(0);
  });

  it('preserves the opaque final ink tip from the supplied source cut', () => {
    const frame = PNG.sync.read(readFileSync(resolve(
      __dirname,
      '../customer-media/reward-props/deep-sea/ink-squid-frames/frame-25.png',
    )));
    const alpha = frame.data[(235 * frame.width + 45) * 4 + 3];

    expect({ width: frame.width, height: frame.height }).toEqual({
      width: 261,
      height: 241,
    });
    expect(alpha).toBeGreaterThan(0);
  });

  it('reveals feedback before continuing the held squid effect', () => {
    const events: string[] = [];
    const ready = createReadingFeedbackReadyHandler(
      {
        setFeedbackVisible: (visible: boolean) => events.push(`visible:${visible}`),
      },
      () => events.push('spray'),
    );

    ready();

    expect(events).toEqual(['visible:true', 'spray']);
  });
});
