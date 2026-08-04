# Reading Negative Feedback Effects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen Mario’s bomb arrival, add a precisely aligned deep-sea squid ink animation, ground the food character, and replace poetry’s composite penalty prop with the supplied clean brush plus a separate ink terminal.

**Architecture:** Keep the existing score-flight pipeline as the shared transport and split theme-specific terminal visuals from flight assets. Build the irregular squid source into a deterministic fixed-cell PNG, then play it through a dedicated fixed-position DOM view above the existing feedback WebP. Keep all scene-specific geometry in reading config and preserve the existing answer/score timing.

**Tech Stack:** TypeScript, Cocos Creator 3.8.8, DOM/CSS animations, PNGJS, Jest, Playwright, Node deployment scripts.

## Global Constraints

- Preserve the current uncommitted locomotion/startup/score-feedback work.
- Do not modify question data, scoring, settlement, sharing, camera/pose behavior, trial URL, or release URL.
- Deep-sea wrong feedback keeps the current character WebP and adds squid ink above it.
- Squid source is 1536×1024 with exactly 26 frames arranged 9/7/5/5, not a uniform source grid.
- Food idle baseline becomes `y = -235`; other scene baselines stay unchanged.
- Poetry flight asset comes only from the supplied clean brush source; ink appears only at the score target.
- Do not create a Git commit unless the user explicitly requests one.

---

### Task 1: Deterministic customer-asset build

**Files:**
- Create: `tools/assets/build-reading-negative-feedback-assets.mjs`
- Create: `tools/assets/reading-negative-feedback-assets.test.mjs`
- Modify: `package.json`
- Create: `customer-media/reward-props/deep-sea/ink-squid-sheet.png`
- Replace: `customer-media/reward-props/poetry/penalty.png`

**Interfaces:**
- Produces `ink-squid-sheet.png`: 5 columns, 6 rows, 256×256 per frame, 26 populated frames.
- Produces `penalty.png`: transparent, clean brush only, no precomposed ink splash.
- Script supports `--check`, which validates existing outputs without rewriting.

- [ ] **Step 1: Write the failing node test**

```js
test('builds 26 squid frames from the 9/7/5/5 packed source', async () => {
  const report = await buildReadingNegativeFeedbackAssets({ outputRoot: temporaryRoot });
  assert.deepEqual(report.squid.rowFrames, [9, 7, 5, 5]);
  assert.equal(report.squid.frames, 26);
  assert.equal(report.squid.frameWidth, 256);
  assert.equal(report.squid.frameHeight, 256);
});

test('builds poetry penalty from the clean brush source', async () => {
  const report = await buildReadingNegativeFeedbackAssets({ outputRoot: temporaryRoot });
  assert.equal(report.poetry.sourceName, '负反馈-金币素材.png');
  assert.equal(report.poetry.hasSeparateInkTerminal, true);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tools/assets/reading-negative-feedback-assets.test.mjs`
Expected: FAIL because the builder module and outputs do not exist.

- [ ] **Step 3: Implement exact frame extraction**

Use PNGJS alpha connected components. For each of the four source row bands:

```js
const expectedRowFrames = [9, 7, 5, 5];
const frameSize = 256;
const columns = 5;
```

Identify the largest components as squid bodies, assign nearby detached droplets to the nearest body in the same row, preserve source pixels, and anchor each body’s top/right edge consistently inside a 256×256 cell. Repack in chronological row-major order.

Use the supplied poetry PNG, alpha-crop it, and run FFmpeg once to create a compact transparent brush PNG. Do not composite any ink pixels into that file.

- [ ] **Step 4: Run builder and test GREEN**

Run:

```powershell
npm run build:reading-negative-feedback
node --test tools/assets/reading-negative-feedback-assets.test.mjs
```

Expected: PASS; generated squid sheet has 26 frames and clean brush output is under 150KB.

---

### Task 2: Theme score-flight and terminal visuals

**Files:**
- Modify: `assets/scripts/games/reading-jumper/config/ReadingScoreFeedback.ts`
- Modify: `assets/scripts/ui/ScoreCoinDom.ts`
- Modify: `tests/ReadingScoreFeedback.spec.ts`

**Interfaces:**
- `ScoreFlightTerminal` adds no new general abstraction unless needed; existing `explosion` and `ink` remain the public values.
- Mario wrong stays `terminal: 'explosion'`.
- Poetry wrong points to the rebuilt clean brush and stays `terminal: 'ink'`.
- Deep-sea squid is not a score-flight prop.

- [ ] **Step 1: Write failing score-feedback assertions**

```ts
expect(readingScoreFeedback('mario', false)).toMatchObject({
  terminal: 'explosion',
  count: 1,
});
expect(readingScoreFeedback('poetry', false)).toMatchObject({
  asset: './media/reward-props/poetry/penalty.png',
  terminal: 'ink',
  count: 1,
});
```

Add source-image assertions proving the poetry output has the clean brush aspect ratio and no old composite hash.

- [ ] **Step 2: Write failing DOM terminal tests**

Extract testable terminal metrics:

```ts
expect(scoreTerminalMetrics('explosion')).toMatchObject({
  width: 170,
  height: 150,
  fragments: expect.any(Number),
});
expect(scoreTerminalMetrics('ink')).toMatchObject({
  mainWidth: 110,
  mainHeight: 82,
  droplets: 18,
});
```

- [ ] **Step 3: Run RED**

Run: `npx jest tests/ReadingScoreFeedback.spec.ts --runInBand`
Expected: FAIL on the new metrics and clean-brush checks.

- [ ] **Step 4: Implement stronger terminal layers**

For explosion, create a red multi-lobed cloud, central white/yellow star, expansion ring, and 12–16 fragments centered on `stageScreenPoint(point, frame)`. Peak by 180ms, remove by 760ms.

For ink, create one 110×82 main blot, 18 irregular droplets, and a faint expansion ring. Remove all nodes by 850ms. Do not alter `onFirstArrival`.

- [ ] **Step 5: Run GREEN**

Run:

```powershell
npx jest tests/ReadingScoreFeedback.spec.ts --runInBand
npm run typecheck
```

Expected: PASS.

---

### Task 3: Deep-sea squid DOM sprite player

**Files:**
- Create: `assets/scripts/ui/DeepSeaInkEffectView.ts`
- Create: `assets/scripts/ui/DeepSeaInkEffectView.ts.meta`
- Modify: `assets/scripts/games/reading-jumper/views/ReadingGameView.ts`
- Modify: `assets/scripts/games/reading-jumper/controllers/ReadingAnswerController.ts`
- Create: `tests/DeepSeaInkEffect.spec.ts`
- Modify: `tools/e2e/run-smoke.mjs`

**Interfaces:**

```ts
export interface DeepSeaInkTarget {
  readonly columnX: number;
  readonly headY: number;
}

export class DeepSeaInkEffectView {
  play(target: DeepSeaInkTarget): void;
  hide(): void;
  dispose(): void;
}
```

`ReadingGameView.playDeepSeaInk(columnX: number)` computes the head target using the deep-sea feedback layout and invokes the view. The effect starts only inside the wrong feedback motion `onReady` callback.

- [ ] **Step 1: Write failing lifecycle and geometry tests**

```ts
expect(source).toContain("ink-squid-sheet.png");
expect(source).toContain('const FRAME_COUNT = 26');
expect(source).toContain('const FPS = 15');
expect(source).toContain('zIndex:');
expect(answerController).toContain("theme.id === 'deep-sea'");
expect(answerController).toContain('playDeepSeaInk(columnX)');
```

Add pure coordinate assertions for columns `[-450, 0, 450]`: spray target remains at each selected column while squid body is offset right/up.

- [ ] **Step 2: Run RED**

Run: `npx jest tests/DeepSeaInkEffect.spec.ts --runInBand`
Expected: FAIL because the view and integration do not exist.

- [ ] **Step 3: Implement the dedicated DOM view**

Create one fixed 256×256 DOM viewport with:

```ts
const FRAME_COUNT = 26;
const FRAME_WIDTH = 256;
const FRAME_HEIGHT = 256;
const COLUMNS = 5;
const FPS = 15;
const BODY_OFFSET_X = 90;
const BODY_OFFSET_Y = -75;
```

Use `resolveMotionStageFrame()` every animation frame so resize/orientation changes remain aligned. Set a z-index above `FeedbackView`’s 36. Advance background position in row-major order with `requestAnimationFrame`; remove/hide after frame 25.

- [ ] **Step 4: Integrate only after feedback actor readiness**

In the wrong `FeedbackView.show()` ready callback:

```ts
this.view.setFeedbackVisible(true);
if (!correct && theme.id === 'deep-sea') {
  this.view.playDeepSeaInk(columnX);
}
```

Ensure `setFeedbackVisible(false)`, scene changes, completion, and `dispose()` hide the squid.

- [ ] **Step 5: Run GREEN**

Run:

```powershell
npx jest tests/DeepSeaInkEffect.spec.ts tests/FeedbackReplayHandoff.spec.ts --runInBand
npm run typecheck
```

Expected: PASS.

---

### Task 4: Food ground-contact correction

**Files:**
- Modify: `assets/scripts/games/reading-jumper/config/ReadingLayout.ts`
- Modify: `tests/ReadingDeerRunState.spec.ts`
- Modify: `tools/visual/verify-locomotion-sprites.mjs`

**Interfaces:**
- `readingLayout('food').deer.y === -235`.
- Other theme deer baselines remain unchanged.

- [ ] **Step 1: Write failing baseline test**

```ts
expect(readingLayout('food').deer.y).toBe(-235);
expect(readingLayout('mario').deer.y).toBe(-226);
expect(readingLayout('deep-sea').deer.y).toBe(-236);
```

- [ ] **Step 2: Run RED**

Run: `npx jest tests/ReadingDeerRunState.spec.ts --runInBand`
Expected: FAIL with received food y `-225`.

- [ ] **Step 3: Apply the single-scene correction**

Change only:

```ts
food: {
  deer: { width: 118, height: 224, x: 0, y: -235 },
}
```

- [ ] **Step 4: Run GREEN**

Run: `npx jest tests/ReadingDeerRunState.spec.ts --runInBand`
Expected: PASS.

---

### Task 5: Visual regression, build, and development deployment

**Files:**
- Modify: `tools/visual/verify-score-feedback-props.mjs`
- Modify: `tools/e2e/run-smoke.mjs`
- Modify after successful deployment: `mp-shell/miniprogram/config/environments.js`

**Interfaces:**
- Visual report covers Mario wrong arrival, deep-sea wrong at all three columns, food idle contact, and poetry wrong flight/arrival.
- Only `develop.h5Url` changes.

- [ ] **Step 1: Extend visual diagnostics**

Record:

```js
{
  explosionBox,
  explosionFragments,
  squidFrame,
  squidTarget,
  squidSprayHit,
  foodFootGap,
  poetryFlightAsset,
  inkDroplets,
}
```

Fail if:
- Mario explosion is smaller than 160×140 design pixels;
- squid spray target differs from selected head target by more than 12 design pixels;
- food foot gap is outside ±2 screen pixels across sampled idle frames;
- poetry flight asset does not use the clean brush;
- poetry ink terminal has fewer than 18 droplets.

- [ ] **Step 2: Run focused and full verification**

Run:

```powershell
npm run build:reading-negative-feedback
npm run typecheck
npx jest tests/ReadingScoreFeedback.spec.ts tests/DeepSeaInkEffect.spec.ts tests/ReadingDeerRunState.spec.ts tests/FeedbackReplayHandoff.spec.ts --runInBand
npm run test:mp-shell
npm run build:web
npm run test:e2e
```

Expected: all commands exit 0. Inspect every generated representative screenshot.

- [ ] **Step 3: Package and deploy H5**

Create a new timestamped release, upload to COS, refresh/preheat:

- `index.html`
- hashed `assets/main/index.*.js`
- `media/reward-props/deep-sea/ink-squid-sheet.png`
- `media/reward-props/poetry/penalty.png`

Verify remote SHA-256 matches the release files.

- [ ] **Step 4: Update development shell only**

Set only:

```js
develop: {
  h5Url: `https://game.xyouxing.com/reading-jumper/index.html?release=${RELEASE_VERSION}`,
}
```

Replace the template expression with the exact timestamp printed by `release:create`; do not leave an expression in the JavaScript config.

Do not change `trial` or `release`.

- [ ] **Step 5: Upload a new reading development version**

Use `MP_VERSION=1.0.19` and description:

`强化负反馈终点特效，新增深海喷墨，修复美食人物落地与诗词毛笔素材`

Run `npm run upload:mp`, then verify upload success and report the H5 release timestamp and mini-program version.
