import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const output = path.join(root, 'test-results', 'performance');
const traceFile = path.join(output, 'runtime-trace.json');
const captureTrace = process.argv.includes('--trace');
const port = Number(process.env.PERF_PORT ?? 42981);
const baseUrl = `http://127.0.0.1:${port}`;
const cycleArgument = process.argv.find((argument) => argument.startsWith('--cycles='));
const cycles = Number(cycleArgument?.split('=')[1] ?? process.env.PERF_CYCLES ?? 3);
const durationArgument = process.argv.find((argument) => argument.startsWith('--duration-minutes='));
const durationMinutes = Number(durationArgument?.split('=')[1] ?? 0);
const exerciseLifecycle = process.argv.includes('--lifecycle');
const lifecycleArgument = process.argv.find((argument) => argument.startsWith('--lifecycle-interval='));
const lifecycleInterval = Number(lifecycleArgument?.split('=')[1] ?? 10);
if (!Number.isInteger(cycles) || cycles < 1 || cycles > 200) {
  throw new Error('cycles must be an integer from 1 to 200');
}
if (!Number.isFinite(durationMinutes) || durationMinutes < 0 || durationMinutes > 180) {
  throw new Error('duration-minutes must be from 0 to 180');
}
if (!Number.isInteger(lifecycleInterval) || lifecycleInterval < 1 || lifecycleInterval > 100) {
  throw new Error('lifecycle-interval must be an integer from 1 to 100');
}
const reportFile = path.join(
  output,
  durationMinutes > 0 ? 'runtime-soak.json' : 'runtime.json',
);
let priorityRaised = false;
if (process.platform === 'win32') {
  try {
    os.setPriority(0, os.constants.priority.PRIORITY_HIGH);
    priorityRaised = true;
  } catch {
    // The benchmark remains valid when the host does not allow priority changes.
  }
}
const chrome = process.env.CHROME_PATH
  ?? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

function percentile(values, ratio) {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * ratio))] ?? 0;
}

async function waitForServer() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`${baseUrl}/health`)).ok) return;
    } catch {
      // Server startup is asynchronous.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error('performance server did not start');
}

async function finishStage(page) {
  for (let index = 0; index < 7; index += 1) {
    const view = await page.getAttribute('body', 'data-game-view');
    if (view === 'stage-result' || view === 'result') return view;
    await page.mouse.click(320, 430);
    await page.waitForTimeout(1750);
  }
  await page.waitForSelector(
    'body[data-game-view="stage-result"], body[data-game-view="result"]',
    { timeout: 3000 },
  );
  return page.getAttribute('body', 'data-game-view');
}

async function useDeterministicAnswers(page) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({ ...question, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });
}

await fs.mkdir(output, { recursive: true });
const productionBankTransferBytes = (
  await fs.stat(path.join(root, 'build', 'web-mobile', 'question-bank.json.br'))
).size;
const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: root,
  env: { ...process.env, PORT: String(port) },
  stdio: 'ignore',
  windowsHide: true,
});

try {
  await waitForServer();
  const browser = await chromium.launch({
    executablePath: chrome,
    headless: true,
    args: ['--enable-precise-memory-info', '--js-flags=--expose-gc'],
  });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 810 } });
    const page = await context.newPage();
    await useDeterministicAnswers(page);
    const runtimeErrors = [];
    page.on('pageerror', (error) => runtimeErrors.push(`pageerror: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() === 'error') runtimeErrors.push(`console: ${message.text()}`);
    });
    page.on('requestfailed', (request) => {
      const errorText = request.failure()?.errorText ?? 'failed';
      if (errorText === 'net::ERR_ABORTED') return;
      runtimeErrors.push(`request: ${request.url()} ${errorText}`);
    });
    const session = await context.newCDPSession(page);
    if (captureTrace) {
      await session.send('Tracing.start', {
        categories: [
          'blink.user_timing',
          'devtools.timeline',
          'disabled-by-default-devtools.timeline',
          'loading',
          'toplevel',
          'v8.execute',
        ].join(','),
        options: 'sampling-frequency=10000',
        transferMode: 'ReturnAsStream',
      });
    }
    await page.addInitScript(() => {
      window.__perfFrames = [];
      window.__perfLongTasks = [];
      window.__perfRenderStats = [];
      let previous = performance.now();
      const sample = (now) => {
        window.__perfFrames.push(now - previous);
        previous = now;
        const device = globalThis.cc?.director?.root?.device;
        if (device && window.__perfFrames.length % 6 === 0) {
          let resultActive = false;
          if (device.numTris > 500 || device.numDrawCalls > 40) {
            const scene = globalThis.cc?.director?.getScene?.();
            const pending = scene ? [scene] : [];
            while (pending.length && !resultActive) {
              const node = pending.pop();
              if (node?.activeInHierarchy && /Result/i.test(node.name)) resultActive = true;
              if (node?.activeInHierarchy) pending.push(...node.children);
            }
          }
          window.__perfRenderStats.push({
            elapsedMs: now,
            view: document.body?.dataset.gameView ?? 'unknown',
            stage: document.body?.dataset.gameStage ?? 'unknown',
            resultActive,
            drawCalls: device.numDrawCalls,
            instances: device.numInstances,
            triangles: device.numTris,
          });
        }
        requestAnimationFrame(sample);
      };
      requestAnimationFrame(sample);
      new PerformanceObserver((list) => {
        window.__perfLongTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    });

    const warmupStarted = performance.now();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('body[data-game-ready="true"]');
    const warmupMs = performance.now() - warmupStarted;
    await session.send('Network.enable');
    await session.send('Network.setCacheDisabled', { cacheDisabled: true });
    await page.goto('about:blank');
    runtimeErrors.length = 0;

    const navigationStarted = performance.now();
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    const domContentLoadedMs = performance.now() - navigationStarted;
    await page.waitForSelector('body[data-game-ready="true"]');
    const readyMs = performance.now() - navigationStarted;
    const initialResources = await page.evaluate(() =>
      performance.getEntriesByType('resource').map((entry) => ({
        path: new URL(entry.name).pathname,
        transferBytes: entry.transferSize,
      })));
    const rawInitialTransferBytes = initialResources
      .reduce((sum, resource) => sum + resource.transferBytes, 0);
    const deterministicBankTransferBytes = initialResources
      .filter((resource) => resource.path.endsWith('/question-bank.json'))
      .reduce((sum, resource) => sum + resource.transferBytes, 0);
    const initialTransferBytes = rawInitialTransferBytes
      - deterministicBankTransferBytes + productionBankTransferBytes;
    const heap = [];
    const heapTimeline = [];
    const lifecycleRecoveries = [];
    const runStartedAt = Date.now();
    const durationMs = durationMinutes * 60 * 1000;
    let completedCycles = 0;

    while (completedCycles < cycles || (durationMs > 0 && Date.now() - runStartedAt < durationMs)) {
      if (completedCycles === 0) {
        await page.mouse.click(720, 365);
        await page.waitForSelector('body[data-game-view="play"]');
      }
      const view = await finishStage(page);
      await session.send('HeapProfiler.collectGarbage');
      const usedSize = (await session.send('Runtime.getHeapUsage')).usedSize;
      heap.push(usedSize);
      heapTimeline.push({
        elapsedMs: Date.now() - runStartedAt,
        cycle: completedCycles + 1,
        usedSize,
      });
      completedCycles += 1;
      const shouldContinue = completedCycles < cycles
        || (durationMs > 0 && Date.now() - runStartedAt < durationMs);
      if (shouldContinue) {
        if (view === 'stage-result') {
          const finalStage = await page.getAttribute('body', 'data-game-stage') === 'poetry';
          await page.mouse.click(720, 685);
          await page.waitForSelector(
            `body[data-game-view="${finalStage ? 'result' : 'play'}"]`,
          );
          if (finalStage) {
            await page.mouse.click(460, 685);
            await page.waitForSelector('body[data-game-view="intro"]');
            await page.mouse.click(720, 365);
            await page.waitForSelector('body[data-game-view="play"]');
          }
        } else {
          await page.mouse.click(460, 685);
          await page.waitForSelector('body[data-game-view="intro"]');
          await page.mouse.click(720, 365);
          await page.waitForSelector('body[data-game-view="play"]');
        }
        await page.waitForTimeout(1000);
        if (exerciseLifecycle && completedCycles % lifecycleInterval === 0) {
          const hiddenAt = Date.now();
          await session.send('Page.setWebLifecycleState', { state: 'frozen' });
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await session.send('Page.setWebLifecycleState', { state: 'active' });
          await page.waitForFunction(() => (
            document.visibilityState === 'visible'
            && document.body.dataset.gameView === 'play'
          ), null, { timeout: 3000 });
          lifecycleRecoveries.push(Date.now() - hiddenAt);
        }
      }
    }

    const browserMetrics = await page.evaluate(() => ({
      frames: window.__perfFrames,
      longTasks: window.__perfLongTasks,
      renderStats: window.__perfRenderStats,
      resources: performance.getEntriesByType('resource').map((entry) => ({
        path: new URL(entry.name).pathname,
        transferBytes: entry.transferSize,
        durationMs: entry.duration,
      })),
    }));
    if (captureTrace) {
      const traceComplete = new Promise((resolve) =>
        session.once('Tracing.tracingComplete', resolve));
      await session.send('Tracing.end');
      const { stream } = await traceComplete;
      const chunks = [];
      while (true) {
        const chunk = await session.send('IO.read', { handle: stream });
        chunks.push(chunk.data);
        if (chunk.eof) break;
      }
      await session.send('IO.close', { handle: stream });
      await fs.writeFile(traceFile, chunks.join(''));
      console.log(`Chrome Performance Trace: ${traceFile}`);
    }
    const frames = browserMetrics.frames.filter((duration) => duration < 1000);
    const transferBytes = browserMetrics.resources
      .reduce((sum, resource) => sum + resource.transferBytes, 0);
    const heapDeltas = heap.slice(1).map((value, index) => value - heap[index]);
    const tailStart = Math.floor(heap.length / 2);
    const campaignHeap = heap.filter((_, index) => (index + 1) % 5 === 0);
    const campaignGrowthBytes = campaignHeap.slice(1)
      .map((value, index) => value - campaignHeap[index]);
    const renderStats = browserMetrics.renderStats.filter((sample) =>
      Number.isFinite(sample.drawCalls) && Number.isFinite(sample.triangles));
    let resultGraceUntil = 0;
    for (const sample of renderStats) {
      const explicitResult = sample.resultActive
        || sample.view === 'stage-result'
        || sample.view === 'result';
      if (explicitResult) resultGraceUntil = sample.elapsedMs + 250;
      sample.resultPhase = explicitResult || sample.elapsedMs <= resultGraceUntil;
    }
    const resultRenderStats = renderStats.filter((sample) => sample.resultPhase);
    const gameplayRenderStats = renderStats.filter((sample) => !sample.resultPhase);
    const renderPeaks = [...renderStats]
      .sort((left, right) => right.triangles - left.triangles)
      .slice(0, 10);
    const report = {
      generatedAt: new Date().toISOString(),
      environment: 'local-headless-chrome',
      cycles: completedCycles,
      requested: {
        cycles, durationMinutes, exerciseLifecycle, lifecycleInterval,
      },
      host: { priorityRaised, warmupMs },
      elapsedMs: Date.now() - runStartedAt,
      startup: { domContentLoadedMs, readyMs },
      frames: {
        samples: frames.length,
        p50Ms: percentile(frames, 0.5),
        p95Ms: percentile(frames, 0.95),
        p99Ms: percentile(frames, 0.99),
        over50Ms: frames.filter((duration) => duration > 50).length,
      },
      longTasks: {
        count: browserMetrics.longTasks.length,
        maxMs: Math.max(0, ...browserMetrics.longTasks),
      },
      rendering: {
        samples: renderStats.length,
        drawCallsP95: percentile(renderStats.map((sample) => sample.drawCalls), 0.95),
        maxDrawCalls: Math.max(0, ...renderStats.map((sample) => sample.drawCalls)),
        trianglesP95: percentile(renderStats.map((sample) => sample.triangles), 0.95),
        maxTriangles: Math.max(0, ...renderStats.map((sample) => sample.triangles)),
        maxGameplayDrawCalls: Math.max(
          0,
          ...gameplayRenderStats.map((sample) => sample.drawCalls),
        ),
        maxResultDrawCalls: Math.max(
          0,
          ...resultRenderStats.map((sample) => sample.drawCalls),
        ),
        maxGameplayTriangles: Math.max(
          0,
          ...gameplayRenderStats.map((sample) => sample.triangles),
        ),
        maxResultTriangles: Math.max(
          0,
          ...resultRenderStats.map((sample) => sample.triangles),
        ),
        peaks: renderPeaks,
      },
      network: {
        initialTransferBytes,
        rawInitialTransferBytes,
        deterministicBankTransferBytes,
        productionBankTransferBytes,
        transferBytes,
        largest: browserMetrics.resources
          .sort((left, right) => right.transferBytes - left.transferBytes)
          .slice(0, 10),
      },
      heap: {
        samples: heap,
        timeline: heapTimeline,
        growthBytes: heap.at(-1) - heap[0],
        tailGrowthBytes: heap.at(-1) - heap[tailStart],
        maxStepBytes: Math.max(0, ...heapDeltas),
        campaignEndSamples: campaignHeap,
        campaignGrowthBytes,
        steadyStateCampaignGrowthBytes: campaignGrowthBytes.at(-1) ?? 0,
      },
      stability: {
        runtimeErrors,
        lifecycleRecoveries,
        lifecycleRecoveryMaxMs: Math.max(0, ...lifecycleRecoveries),
      },
    };
    await fs.writeFile(reportFile, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    const failures = [];
    if (readyMs > 4000) failures.push(`startup ${readyMs.toFixed(1)}ms exceeds 4000ms`);
    if (initialTransferBytes > 2.5 * 1024 * 1024) {
      failures.push(`initial transfer ${(initialTransferBytes / 1048576).toFixed(2)}MB exceeds 2.5MB`);
    }
    if (report.frames.p95Ms > 25) failures.push(`frame p95 ${report.frames.p95Ms}ms exceeds 25ms`);
    if (report.frames.p99Ms > 50) failures.push(`frame p99 ${report.frames.p99Ms}ms exceeds 50ms`);
    if (report.longTasks.maxMs > 250) {
      failures.push(`long task ${report.longTasks.maxMs}ms exceeds 250ms`);
    }
    if (report.rendering.samples === 0) failures.push('rendering samples unavailable');
    if (report.rendering.drawCallsP95 > 35) {
      failures.push(`draw calls p95 ${report.rendering.drawCallsP95} exceeds 35`);
    }
    if (report.rendering.maxGameplayDrawCalls > 40) {
      failures.push(`gameplay draw calls max ${report.rendering.maxGameplayDrawCalls} exceeds 40`);
    }
    if (report.rendering.maxResultDrawCalls > 70) {
      failures.push(`result draw calls max ${report.rendering.maxResultDrawCalls} exceeds 70`);
    }
    if (report.rendering.trianglesP95 > 450) {
      failures.push(`triangles p95 ${report.rendering.trianglesP95} exceeds 450`);
    }
    if (report.rendering.maxGameplayTriangles > 500) {
      failures.push(
        `gameplay triangles max ${report.rendering.maxGameplayTriangles} exceeds 500`,
      );
    }
    if (report.rendering.maxResultTriangles > 1200) {
      failures.push(`result triangles max ${report.rendering.maxResultTriangles} exceeds 1200`);
    }
    if (completedCycles < 10 && report.heap.growthBytes > 2 * 1024 * 1024) {
      failures.push(`heap growth ${report.heap.growthBytes} bytes exceeds 2MB`);
    }
    if (completedCycles >= 10 && report.heap.tailGrowthBytes > 1024 * 1024) {
      failures.push(`late heap growth ${report.heap.tailGrowthBytes} bytes exceeds 1MB`);
    }
    if (completedCycles >= 10 && report.heap.steadyStateCampaignGrowthBytes > 1024 * 1024) {
      failures.push(
        `steady-state campaign heap growth ${report.heap.steadyStateCampaignGrowthBytes}`
        + ' bytes exceeds 1MB',
      );
    }
    if (completedCycles >= 10 && report.heap.maxStepBytes > 1024 * 1024) {
      failures.push(`single-cycle heap growth ${report.heap.maxStepBytes} bytes exceeds 1MB`);
    }
    if (runtimeErrors.length) failures.push(`${runtimeErrors.length} runtime errors detected`);
    if (report.stability.lifecycleRecoveryMaxMs > 3000) {
      failures.push(`lifecycle recovery ${report.stability.lifecycleRecoveryMaxMs}ms exceeds 3000ms`);
    }
    if (failures.length) throw new Error(`runtime performance gate failed:\n${failures.join('\n')}`);
  } finally {
    await browser.close();
  }
} finally {
  server.kill();
  await Promise.race([once(server, 'exit'), new Promise((resolve) => setTimeout(resolve, 6000))]);
}
