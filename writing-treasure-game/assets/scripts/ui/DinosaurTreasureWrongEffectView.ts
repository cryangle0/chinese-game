import { resolveMotionStageFrame } from '../core/media/DomMotionLayout';
import {
  DINOSAUR_TREASURE_FEEDBACK,
  dinosaurWrongChaseDurationMs,
  dinosaurWrongChasePoint,
  dinosaurWrongJumpPoint,
} from '../shared/config/DinosaurTreasureFeedback';

export interface DinosaurTreasureWrongCallbacks {
  readonly onActorEscape?: () => void;
  readonly onDinosaurJump?: () => void;
  readonly onComplete?: () => void;
}

export interface DinosaurTreasureWrongChaseCallbacks {
  readonly onComplete?: () => void;
}

export interface DinosaurTreasureWrongRuntime {
  readonly document: Document;
  readonly now: () => number;
  readonly requestFrame: (callback: FrameRequestCallback) => number;
  readonly cancelFrame: (handle: number) => void;
  readonly loadJson: (source: string) => Promise<unknown>;
  readonly loadImage: (source: string) => Promise<CanvasImageSource>;
}

interface DinosaurWrongManifestFrame {
  readonly index: number;
  readonly file: string;
}

interface DinosaurWrongManifestPhase {
  readonly start: number;
  readonly end: number;
  readonly fps: number;
  readonly loop: boolean;
}

interface DinosaurWrongManifest {
  readonly version: string;
  readonly frameWidth: number;
  readonly frameHeight: number;
  readonly fps: number;
  readonly phases: {
    readonly emerge: DinosaurWrongManifestPhase;
    readonly jump: DinosaurWrongManifestPhase;
    readonly run: DinosaurWrongManifestPhase;
  };
  readonly anchor: {
    readonly x: number;
    readonly baselineY: number;
  };
  readonly shell: {
    readonly file: string;
    readonly width: number;
    readonly height: number;
  };
  readonly frames: readonly DinosaurWrongManifestFrame[];
}

const MANIFEST_SOURCE = './media/dinosaur/wrong-hatch-frames/manifest.json'
  + `?v=${DINOSAUR_TREASURE_FEEDBACK.wrongAssetVersion}`;
const FRAME_ROOT = './media/dinosaur/wrong-hatch-frames';
const STAGE_WIDTH = 1440;
const STAGE_HEIGHT = 810;
const EFFECT_Z_INDEX = 8;

export class DinosaurTreasureWrongEffectView {
  private readonly element: HTMLCanvasElement | null;
  private readonly context: CanvasRenderingContext2D | null;
  private assetsReady: Promise<boolean> | null = null;
  private manifest: DinosaurWrongManifest | null = null;
  private frames: readonly CanvasImageSource[] = [];
  private shell: CanvasImageSource | null = null;
  private animationFrame = 0;
  private runId = 0;
  private disposed = false;
  private activeColumnX = 0;
  private readonly syncLayout = (): void => this.positionCanvas();

  constructor(
    private readonly runtime: DinosaurTreasureWrongRuntime | null =
      browserRuntime(),
  ) {
    if (!runtime) {
      this.element = null;
      this.context = null;
      return;
    }
    const element = runtime.document.createElement('canvas');
    const context = element.getContext('2d');
    if (!context) {
      this.element = null;
      this.context = null;
      return;
    }
    this.element = element;
    this.context = context;
    element.id = 'DinosaurTreasureWrongEffect';
    element.width = STAGE_WIDTH;
    element.height = STAGE_HEIGHT;
    element.dataset.dinosaurTreasureWrongCanvas = '1';
    element.setAttribute('aria-hidden', 'true');
    Object.assign(element.style, {
      position: 'fixed',
      display: 'none',
      overflow: 'visible',
      pointerEvents: 'none',
      userSelect: 'none',
      zIndex: String(EFFECT_Z_INDEX),
      maxWidth: 'none',
      maxHeight: 'none',
      imageRendering: 'auto',
    });
    this.configureContext();
    runtime.document.defaultView?.addEventListener('resize', this.syncLayout);
  }

  preload(): void {
    if (this.disposed) return;
    void this.ensureAssetsReady();
  }

  play(
    columnX: number,
    callbacks: DinosaurTreasureWrongCallbacks = {},
  ): void {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.context
    ) {
      callbacks.onActorEscape?.();
      callbacks.onDinosaurJump?.();
      callbacks.onComplete?.();
      return;
    }
    this.stopActive();
    const runId = this.runId;
    this.activeColumnX = columnX;
    void this.ensureAssetsReady().then((ready) => {
      if (runId !== this.runId || this.disposed) return;
      const manifest = this.manifest;
      if (!ready || !manifest || !this.prepare(columnX, manifest)) {
        this.markLoadFailure();
        callbacks.onActorEscape?.();
        callbacks.onDinosaurJump?.();
        callbacks.onComplete?.();
        return;
      }
      const startedAt = this.runtime!.now();
      let actorEscapeCalled = false;
      let dinosaurJumpCalled = false;
      const tick = (now: number): void => {
        if (runId !== this.runId || this.disposed) return;
        this.animationFrame = 0;
        const elapsedMs = Math.max(0, now - startedAt);
        this.drawTimeline(columnX, elapsedMs, manifest);
        this.positionCanvas();
        if (
          !actorEscapeCalled
          && elapsedMs >= DINOSAUR_TREASURE_FEEDBACK.wrongActorEscapeAtMs
        ) {
          actorEscapeCalled = true;
          this.markPhase('actor-escaping-first');
          callbacks.onActorEscape?.();
        }
        if (
          !dinosaurJumpCalled
          && elapsedMs >= DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurJumpAtMs
        ) {
          dinosaurJumpCalled = true;
          this.markPhase('hatchling-jumping-after-actor');
          callbacks.onDinosaurJump?.();
        }
        if (
          elapsedMs >= DINOSAUR_TREASURE_FEEDBACK.wrongSequenceDurationMs
        ) {
          if (!actorEscapeCalled) callbacks.onActorEscape?.();
          if (!dinosaurJumpCalled) callbacks.onDinosaurJump?.();
          this.markPhase('hatchling-landed-behind-actor');
          callbacks.onComplete?.();
          return;
        }
        this.animationFrame = this.runtime!.requestFrame(tick);
      };
      tick(startedAt);
    });
  }

  playChase(
    callbacks: DinosaurTreasureWrongChaseCallbacks = {},
  ): void {
    if (
      this.disposed
      || !this.runtime
      || !this.element
      || !this.manifest
      || this.element.style.display === 'none'
    ) {
      callbacks.onComplete?.();
      return;
    }
    if (this.animationFrame) this.runtime.cancelFrame(this.animationFrame);
    this.animationFrame = 0;
    const runId = this.runId;
    const columnX = this.activeColumnX;
    const manifest = this.manifest;
    const startedAt = this.runtime.now();
    const durationMs = dinosaurWrongChaseDurationMs(columnX);
    if (typeof document !== 'undefined') {
      document.body.dataset.dinosaurTreasureWrongChaseDurationMs =
        durationMs.toFixed(2);
    }
    const tick = (now: number): void => {
      if (runId !== this.runId || this.disposed) return;
      this.animationFrame = 0;
      const elapsedMs = Math.max(0, now - startedAt);
      const progress = Math.min(1, elapsedMs / durationMs);
      this.drawChase(columnX, elapsedMs, progress, manifest);
      this.positionCanvas();
      if (progress >= 1) {
        this.markPhase('same-hatchling-exited-right-edge');
        callbacks.onComplete?.();
        return;
      }
      this.animationFrame = this.runtime!.requestFrame(tick);
    };
    this.markPhase('same-hatchling-chasing-from-selected-pit');
    tick(startedAt);
  }

  hide(): void {
    this.stopActive();
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.runtime?.document.defaultView?.removeEventListener(
      'resize',
      this.syncLayout,
    );
    this.stopActive();
  }

  private prepare(
    columnX: number,
    manifest: DinosaurWrongManifest,
  ): boolean {
    if (
      !this.runtime
      || !this.element
      || !this.context
      || !this.stageCanvas()
    ) return false;
    if (!this.element.isConnected) this.runtime.document.body.appendChild(this.element);
    this.activeColumnX = columnX;
    this.element.style.display = 'block';
    this.positionCanvas();
    Object.assign(this.runtime.document.body.dataset, {
      dinosaurTreasureWrongEffect: 'playing',
      dinosaurTreasureWrongRenderer: 'predecoded-transparent-canvas',
      dinosaurTreasureWrongColumnX: columnX.toFixed(2),
      dinosaurTreasureWrongVersion: manifest.version,
      dinosaurTreasureWrongPhase: 'broken-shell-and-hatching',
      dinosaurTreasureWrongInterpolation: 'stepped-predecoded-raf',
    });
    return true;
  }

  private ensureAssetsReady(): Promise<boolean> {
    if (this.assetsReady) return this.assetsReady;
    if (!this.runtime || this.disposed) return Promise.resolve(false);
    const attempt = this.runtime.loadJson(MANIFEST_SOURCE)
      .then((value) => {
        if (!isDinosaurWrongManifest(value)) {
          throw new Error('Invalid dinosaur wrong frame manifest');
        }
        if (value.version !== DINOSAUR_TREASURE_FEEDBACK.wrongAssetVersion) {
          throw new Error(`Unexpected dinosaur wrong version ${value.version}`);
        }
        const frameSources = value.frames.map((frame) =>
          `${FRAME_ROOT}/${frame.file}?v=${encodeURIComponent(value.version)}`);
        const shellSource = `${FRAME_ROOT}/${value.shell.file}`
          + `?v=${encodeURIComponent(value.version)}`;
        return Promise.all([
          Promise.all(frameSources.map((source) => this.runtime!.loadImage(source))),
          this.runtime!.loadImage(shellSource),
        ]).then(([frames, shell]) => ({ manifest: value, frames, shell }));
      })
      .then(
        ({ manifest, frames, shell }) => {
          this.manifest = manifest;
          this.frames = frames;
          this.shell = shell;
          if (typeof document !== 'undefined') {
            document.body.dataset.dinosaurTreasureWrongFramesReady = 'true';
          }
          return true;
        },
        () => false,
      );
    this.assetsReady = attempt;
    void attempt.then((ready) => {
      if (!ready && this.assetsReady === attempt) this.assetsReady = null;
    });
    return attempt;
  }

  private drawTimeline(
    columnX: number,
    elapsedMs: number,
    manifest: DinosaurWrongManifest,
  ): void {
    if (!this.context) return;
    this.context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    const jumpAt = DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurJumpAtMs;
    if (elapsedMs < jumpAt) {
      const emergeProgress = Math.min(1, elapsedMs / jumpAt);
      const blend = dinosaurWrongProgressBlend(
        emergeProgress,
        manifest.phases.emerge,
      );
      const riseProgress = easeOutCubic(Math.min(
        1,
        elapsedMs / DINOSAUR_TREASURE_FEEDBACK.wrongActorEscapeAtMs,
      ));
      const feetY = lerp(
        DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurHatchStartY,
        DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurHatchFeetY,
        riseProgress,
      );
      this.drawDinosaurFrame(
        blend.mix < 0.5 ? blend.fromIndex : blend.toIndex,
        columnX,
        feetY,
        DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurScale,
        manifest,
      );
      this.drawShell(columnX, elapsedMs, manifest);
      return;
    }
    this.drawShell(columnX, elapsedMs, manifest);
    const jumpProgress = Math.min(
      1,
      (elapsedMs - jumpAt) / DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurJumpMs,
    );
    const point = dinosaurWrongJumpPoint(columnX, jumpProgress);
    const blend = dinosaurWrongProgressBlend(
      jumpProgress,
      manifest.phases.jump,
    );
    this.drawDinosaurFrame(
      blend.mix < 0.5 ? blend.fromIndex : blend.toIndex,
      point.x,
      point.y,
      DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurScale,
      manifest,
    );
  }

  private drawChase(
    columnX: number,
    elapsedMs: number,
    progress: number,
    manifest: DinosaurWrongManifest,
  ): void {
    if (!this.context) return;
    this.context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    this.drawShell(columnX, Number.POSITIVE_INFINITY, manifest);
    const point = dinosaurWrongChasePoint(columnX, progress);
    const blend = dinosaurWrongLoopBlend(
      elapsedMs,
      manifest.phases.run,
    );
    const runBobY = Math.sin(
      elapsedMs / 1000
      * Math.PI
      * 2
      * DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurRunCyclesPerSecond,
    ) * DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurRunBobY;
    this.drawDinosaurFrame(
      blend.mix < 0.5 ? blend.fromIndex : blend.toIndex,
      point.x,
      point.y + runBobY,
      DINOSAUR_TREASURE_FEEDBACK.wrongDinosaurScale,
      manifest,
    );
  }

  private drawDinosaurFrame(
    frameIndex: number,
    stageX: number,
    feetY: number,
    scale: number,
    manifest: DinosaurWrongManifest,
  ): void {
    const frame = this.frames[frameIndex];
    if (!frame) return;
    this.drawDinosaur(frame, stageX, feetY, scale, manifest);
  }

  private drawDinosaur(
    frame: CanvasImageSource,
    stageX: number,
    feetY: number,
    scale: number,
    manifest: DinosaurWrongManifest,
  ): void {
    if (!this.context) return;
    const designX = STAGE_WIDTH / 2 + stageX;
    const designY = STAGE_HEIGHT / 2 - feetY;
    this.context.drawImage(
      frame,
      designX - manifest.anchor.x * scale,
      designY - manifest.anchor.baselineY * scale,
      manifest.frameWidth * scale,
      manifest.frameHeight * scale,
    );
  }

  private drawShell(
    columnX: number,
    elapsedMs: number,
    manifest: DinosaurWrongManifest,
  ): void {
    if (!this.context || !this.shell) return;
    const scale = DINOSAUR_TREASURE_FEEDBACK.wrongShellScale;
    const width = manifest.shell.width * scale;
    const height = manifest.shell.height * scale;
    const designX = STAGE_WIDTH / 2 + columnX;
    const designY = STAGE_HEIGHT / 2
      - DINOSAUR_TREASURE_FEEDBACK.wrongShellBaselineY;
    const shake = Number.isFinite(elapsedMs) && elapsedMs < 460
      ? Math.sin(elapsedMs / 38) * 0.024 * (1 - elapsedMs / 460)
      : 0;
    this.context.save();
    this.context.translate(designX, designY);
    this.context.rotate(shake);
    this.context.drawImage(this.shell, -width / 2, -height, width, height);
    this.context.restore();
  }

  private positionCanvas(): void {
    if (!this.element) return;
    const canvas = this.stageCanvas();
    if (!canvas) return;
    const stage = resolveMotionStageFrame(canvas);
    Object.assign(this.element.style, {
      left: `${stage.left}px`,
      top: `${stage.top}px`,
      width: `${STAGE_WIDTH * stage.scale}px`,
      height: `${STAGE_HEIGHT * stage.scale}px`,
    });
  }

  private stageCanvas(): HTMLCanvasElement | null {
    return this.runtime?.document.getElementById('GameCanvas') as HTMLCanvasElement | null;
  }

  private configureContext(): void {
    if (!this.context) return;
    this.context.imageSmoothingEnabled = true;
    this.context.imageSmoothingQuality = 'high';
  }

  private markPhase(phase: string): void {
    if (!this.runtime) return;
    this.runtime.document.body.dataset.dinosaurTreasureWrongPhase = phase;
  }

  private markLoadFailure(): void {
    if (!this.runtime) return;
    Object.assign(this.runtime.document.body.dataset, {
      dinosaurTreasureWrongEffect: 'load-error',
      dinosaurTreasureWrongRenderer: 'predecoded-transparent-canvas',
    });
  }

  private stopActive(): void {
    this.runId += 1;
    if (this.animationFrame && this.runtime) this.runtime.cancelFrame(this.animationFrame);
    this.animationFrame = 0;
    if (this.context) this.context.clearRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    if (this.element) {
      this.element.style.display = 'none';
      this.element.remove();
    }
    if (this.runtime) {
      [
        'dinosaurTreasureWrongEffect',
        'dinosaurTreasureWrongRenderer',
        'dinosaurTreasureWrongColumnX',
        'dinosaurTreasureWrongVersion',
        'dinosaurTreasureWrongPhase',
        'dinosaurTreasureWrongInterpolation',
        'dinosaurTreasureWrongChaseDurationMs',
      ].forEach((field) => {
        delete this.runtime!.document.body.dataset[field];
      });
    }
  }
}

function isDinosaurWrongManifest(
  value: unknown,
): value is DinosaurWrongManifest {
  if (!value || typeof value !== 'object') return false;
  const manifest = value as Partial<DinosaurWrongManifest>;
  const anchor = manifest.anchor as DinosaurWrongManifest['anchor'] | undefined;
  const shell = manifest.shell as DinosaurWrongManifest['shell'] | undefined;
  const phases = manifest.phases as DinosaurWrongManifest['phases'] | undefined;
  return typeof manifest.version === 'string'
    && Number.isFinite(manifest.frameWidth)
    && Number.isFinite(manifest.frameHeight)
    && Number.isFinite(manifest.fps)
    && !!phases
    && isDinosaurWrongPhase(phases.emerge, manifest.frames?.length ?? 0)
    && isDinosaurWrongPhase(phases.jump, manifest.frames?.length ?? 0)
    && isDinosaurWrongPhase(phases.run, manifest.frames?.length ?? 0)
    && !!anchor
    && Number.isFinite(anchor.x)
    && Number.isFinite(anchor.baselineY)
    && !!shell
    && typeof shell.file === 'string'
    && Number.isFinite(shell.width)
    && Number.isFinite(shell.height)
    && Array.isArray(manifest.frames)
    && manifest.frames.length >= 8
    && manifest.frames.every((frame, index) =>
      frame.index === index && typeof frame.file === 'string');
}

function isDinosaurWrongPhase(
  value: DinosaurWrongManifestPhase | undefined,
  frameCount: number,
): value is DinosaurWrongManifestPhase {
  return !!value
    && Number.isInteger(value.start)
    && Number.isInteger(value.end)
    && value.start >= 0
    && value.end >= value.start
    && value.end < frameCount
    && Number.isFinite(value.fps)
    && value.fps > 0
    && typeof value.loop === 'boolean';
}

function dinosaurWrongProgressBlend(
  progress: number,
  phase: DinosaurWrongManifestPhase,
): {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly mix: number;
} {
  const p = Math.max(0, Math.min(1, progress));
  const framePosition = phase.start + (phase.end - phase.start) * p;
  const fromIndex = Math.min(phase.end, Math.floor(framePosition));
  const toIndex = Math.min(phase.end, fromIndex + 1);
  const rawMix = fromIndex === toIndex ? 0 : framePosition - fromIndex;
  return {
    fromIndex,
    toIndex,
    mix: rawMix * rawMix * (3 - 2 * rawMix),
  };
}

function dinosaurWrongLoopBlend(
  elapsedMs: number,
  phase: DinosaurWrongManifestPhase,
): {
  readonly fromIndex: number;
  readonly toIndex: number;
  readonly mix: number;
} {
  const frameCount = phase.end - phase.start + 1;
  const framePosition = Math.max(0, elapsedMs) * phase.fps / 1000;
  const wrapped = phase.loop
    ? framePosition % frameCount
    : Math.min(frameCount - 1, framePosition);
  const localFrom = Math.floor(wrapped);
  const localTo = phase.loop
    ? (localFrom + 1) % frameCount
    : Math.min(frameCount - 1, localFrom + 1);
  const rawMix = localFrom === localTo ? 0 : wrapped - localFrom;
  return {
    fromIndex: phase.start + localFrom,
    toIndex: phase.start + localTo,
    mix: rawMix * rawMix * (3 - 2 * rawMix),
  };
}

function browserRuntime(): DinosaurTreasureWrongRuntime | null {
  if (
    typeof document === 'undefined'
    || typeof requestAnimationFrame !== 'function'
    || typeof cancelAnimationFrame !== 'function'
    || typeof fetch !== 'function'
  ) return null;
  return {
    document,
    now: () => performance.now(),
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    loadJson: (source) => fetch(source, { cache: 'no-store' }).then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to load dinosaur wrong manifest: ${source}`);
      }
      return response.json() as Promise<unknown>;
    }),
    loadImage: (source) => loadDecodedImage(source),
  };
}

function loadDecodedImage(source: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.src = source;
  if (typeof image.decode === 'function') {
    return image.decode().then(() => image);
  }
  return new Promise((resolve, reject) => {
    image.addEventListener('load', () => resolve(image), { once: true });
    image.addEventListener('error', () => reject(
      new Error(`Failed to load dinosaur wrong frame: ${source}`),
    ), { once: true });
  });
}

function lerp(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}

function easeOutCubic(progress: number): number {
  return 1 - (1 - progress) ** 3;
}
