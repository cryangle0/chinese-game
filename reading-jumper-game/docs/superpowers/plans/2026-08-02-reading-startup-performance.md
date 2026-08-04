# Reading Startup Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce reading-jumper startup transfer and decode contention without reducing visual quality or exposing black frames.

**Architecture:** Replace the current all-in-one playable-theme preload with explicit startup, play, feedback, and next-theme stages. Keep legacy WebP locomotion only as fallback and measure startup before deferred work begins.

**Tech Stack:** TypeScript, Cocos Creator 3.8.8, Jest, Playwright, Node.

## Execution Status

Completed on 2026-08-02. Final measured startup: 1272ms, 1.52MB core,
4.65MB lazy pose, frame p95 40.40ms. Development release:
`20260802134144`; mini-program version: `1.0.20`.

## Global Constraints

- Preserve all current uncommitted locomotion and negative-feedback work.
- Do not change question content, scoring, sharing, camera mapping, trial URL, or release URL.
- Do not reduce source resolution or animation frame count in the first pass.
- Do not create a Git commit.

---

### Task 1: Encode the staged preload contract

**Files:**
- Modify: `tests/StartupPreload.spec.ts`
- Modify: `assets/scripts/core/assets/ThemePreloader.ts`

**Interfaces:**
- Produces `startupThemeAssetPaths(theme)`, `playThemeAssetPaths(theme)`.
- Produces `preloadStartupTheme(theme)`, `preloadPlayTheme(theme)`.
- Legacy `motion.idle/runLeft/runRight` are excluded from proactive preload.

- [ ] Add failing tests asserting startup excludes run sheets, feedback/result and legacy locomotion WebP.
- [ ] Run `npx jest tests/StartupPreload.spec.ts --runInBand` and verify RED.
- [ ] Implement the resource selectors and staged preload functions.
- [ ] Run the test and `npm run typecheck`.

### Task 2: Move work behind user intent

**Files:**
- Modify: `assets/scripts/games/reading-jumper/controllers/ReadingIntroCoordinator.ts`
- Modify: `assets/scripts/games/reading-jumper/controllers/ReadingGameController.ts`
- Modify: `assets/scripts/games/reading-jumper/controllers/ReadingStageCoordinator.ts`
- Modify: `tests/StartupPreload.spec.ts`

**Interfaces:**
- Intro waits only for startup assets.
- `start()` waits for current play assets behind the user click.
- Stage mount prefetches only current feedback and next-theme startup assets.

- [ ] Add failing source-contract tests for the new call sites.
- [ ] Verify RED.
- [ ] Update coordinators while preserving startup cover handoff.
- [ ] Verify focused tests and five-theme E2E.

### Task 3: Scope score-prop preload

**Files:**
- Modify: `assets/scripts/games/reading-jumper/config/ReadingScoreFeedback.ts`
- Modify: `assets/scripts/boot/GameEntry.ts`
- Modify: `tests/ReadingScoreFeedback.spec.ts`

**Interfaces:**
- `readingScoreFeedbackAssets(sceneId?: string)` returns current-scene assets when specified.
- Homepage no longer preloads all five themes.

- [ ] Add a failing per-scene asset-list test.
- [ ] Verify RED.
- [ ] Implement per-scene preload and remove global homepage preload.
- [ ] Verify tests and typecheck.

### Task 4: Split runtime performance accounting

**Files:**
- Modify: `tools/e2e/run-smoke.mjs`
- Modify: `tests/StartupPreload.spec.ts`

**Interfaces:**
- Capture a resource snapshot immediately at `gameReady`.
- Enforce ≤2MB for startup critical resources.
- Report delayed current-play and pose bytes separately.

- [ ] Add source-contract assertions for critical/deferred measurements.
- [ ] Update E2E resource accounting.
- [ ] Build and run desktop/mobile/theme E2E.
- [ ] Confirm no black frame, no startup regression, and report measured bytes.

### Task 5: Build and development deployment

**Files:**
- Modify after successful deployment: `mp-shell/miniprogram/config/environments.js` develop URL only.

- [ ] Run full Jest, typecheck, asset checks, build and E2E.
- [ ] Create a timestamped release and upload to COS.
- [ ] Refresh/preheat index, main bundle and changed fixed-path assets.
- [ ] Verify CDN SHA-256.
- [ ] Upload the next reading development mini-program version.
