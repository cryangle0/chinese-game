# Voice Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add privacy-safe production diagnostics for every writing-treasure voice attempt and verify the full Web microphone → ASR → matcher → analytics path.

**Architecture:** `SpeechSelectionService` emits whitelisted diagnostic records at capture, ASR, and matching boundaries. `VoiceAnswerController` adds answer-guard outcomes and sends all records through the existing analytics queue to the trusted production `/api/track` endpoint.

**Tech Stack:** Cocos Creator 3.8.8, TypeScript, Jest, Node analytics endpoint, Playwright/Chrome DevTools.

## Global Constraints

- Never log audio, transcript text, question text, option text, OpenID, phone, or name.
- Log only session/attempt correlation IDs, timings, sizes, MIME, HTTP status, Tencent request ID, transcript presence/length, match index, and guard result.
- Diagnostics must never block gameplay.
- Production analytics endpoint is exactly `https://agent.onnsa.cn/writing-treasure/api/track`.
- No new dependency.

---

### Task 1: Trusted production analytics endpoint

**Files:**
- Modify: `tests/HostAdapter.spec.ts`
- Modify: `assets/scripts/platform/host/LaunchContext.ts`
- Modify: `mp-shell/miniprogram/config/environments.js`

**Interfaces:**
- Produces: `parseLaunchContext(...).trackEndpoint` allowing same-origin URLs and the exact trusted production endpoint.

- [ ] Add failing tests that production defaults to the trusted endpoint and rejects untrusted cross-origin values.
- [ ] Run `npx jest --runInBand tests/HostAdapter.spec.ts` and confirm expected failures.
- [ ] Implement trusted endpoint selection and update all mini-program environments.
- [ ] Re-run the test and confirm pass.

### Task 2: Privacy-safe diagnostic event model

**Files:**
- Create: `assets/scripts/services/VoiceDiagnostics.ts`
- Create: `tests/VoiceDiagnostics.spec.ts`

**Interfaces:**
- Produces: `VoiceDiagnostic`, `VoiceDiagnosticPhase`, and `voiceDiagnosticProperties(record)`.
- Output is `Readonly<Record<string, string | number | boolean>>`.

- [ ] Add failing tests asserting allowed fields survive and forbidden fields (`transcript`, `options`, `audio`) cannot appear in output.
- [ ] Run the focused test and confirm failure because module is absent.
- [ ] Implement the explicit property whitelist.
- [ ] Re-run and confirm pass.

### Task 3: Instrument capture, ASR, and matcher boundaries

**Files:**
- Modify: `assets/scripts/services/SpeechSelectionService.ts`
- Modify: `tests/SpeechSelectionService.spec.ts`

**Interfaces:**
- `new SpeechSelectionService(onDiagnostic?: (record: VoiceDiagnostic) => void)`
- Emits `started`, `microphone_ready`, `capture_empty`, `capture_ready`, `asr_response`, `asr_error`, `match_success`, or `match_failed`.

- [ ] Add failing tests for empty capture, HTTP error, and successful ASR/match diagnostics.
- [ ] Run focused tests and confirm failures.
- [ ] Implement one random attempt ID per listen call, timing/size/status collection, and safe error-name extraction.
- [ ] Re-run focused tests and confirm pass.

### Task 4: Instrument final answer guard

**Files:**
- Modify: `assets/scripts/games/writing-treasure/controllers/VoiceAnswerController.ts`
- Modify: `tests/VoiceAnswerController.spec.ts`

**Interfaces:**
- Maps records to `analytics.track({ name: 'voice_diagnostic', game: 'writing-treasure', properties })`.
- Emits `accepted` or `guard_rejected` with attempt/index/state metadata.

- [ ] Add failing tests for analytics event safety and accepted/rejected outcomes.
- [ ] Run focused test and confirm failure.
- [ ] Implement controller wiring without changing answer behavior.
- [ ] Re-run focused tests and confirm pass.

### Task 5: Web and production verification

**Files:**
- Modify: `tools/e2e/run-voice-production.mjs`
- Create: `test-results/voice-diagnostics/result.json` during verification.

- [ ] Run all focused Jest tests, typecheck, and Web build.
- [ ] Start local Web server and run Playwright with fake microphone audio.
- [ ] Confirm production `/api/asr` returns 200 and matcher accepts the response.
- [ ] Confirm `/api/track` returns 202 and inspect payload for forbidden fields.
- [ ] Open deployed Web in Chrome DevTools and confirm secure context, microphone APIs, ASR request, matcher result, and diagnostic network request.
- [ ] Deploy H5/CDN and upload a bumped mini-program development version after verification.
