import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright';

const root = path.resolve(import.meta.dirname, '../..');
const outputRoot = path.join(root, 'test-results', 'score-feedback-props');
const baseUrl = process.env.READING_URL?.trim() || 'http://127.0.0.1:44041';
const chromePath = process.env.CHROME_PATH
  || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const viewport = {
  width: Number(process.env.VIEWPORT_WIDTH ?? 1440),
  height: Number(process.env.VIEWPORT_HEIGHT ?? 810),
};
const sceneFilter = new Set(
  (process.env.READING_SCENES ?? '')
    .split(',').map((value) => value.trim()).filter(Boolean),
);

const cases = [
  { scene: 'mario', correct: true, asset: '/mario/reward.png', terminal: 'spark' },
  { scene: 'mario', correct: false, asset: '/mario/penalty.png', terminal: 'explosion' },
  { scene: 'deep-sea', correct: true, asset: '/deep-sea/reward.png', terminal: 'spark' },
  { scene: 'deep-sea', correct: false, effect: 'deep-sea-ink' },
  { scene: 'food', correct: true, asset: '/food/reward.png', terminal: 'spark' },
  { scene: 'food', correct: false, asset: '/food/penalty.png', terminal: 'explosion' },
  { scene: 'space', correct: true, asset: '/space/reward.png', terminal: 'spark' },
  { scene: 'space', correct: false, asset: '/space/penalty.png', terminal: 'vortex' },
  { scene: 'poetry', correct: true, asset: '/poetry/reward.png', terminal: 'spark' },
  { scene: 'poetry', correct: false, asset: '/poetry/penalty.png', terminal: 'ink' },
].filter((item) => sceneFilter.size === 0 || sceneFilter.has(item.scene));

function point(value) {
  const [x, y] = String(value ?? '').split(',').map(Number);
  return { x, y };
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function designPoint(x, y) {
  const scale = Math.min(viewport.width / 1440, viewport.height / 810);
  return {
    x: (viewport.width - 1440 * scale) / 2 + x * scale,
    y: (viewport.height - 810 * scale) / 2 + y * scale,
  };
}

async function forceBank(page, correctIndex) {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((question) => ({ ...question, correctIndex }));
    await route.fulfill({ response, json: pack });
  });
}

async function readDiagnostics(page) {
  return page.evaluate(() => {
    const box = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return '';
      const rect = element.getBoundingClientRect();
      return `${rect.width.toFixed(2)},${rect.height.toFixed(2)}`;
    };
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!(element instanceof HTMLElement)) return '';
      const value = element.getBoundingClientRect();
      return [
        value.left, value.top, value.right, value.bottom,
      ].map((number) => number.toFixed(2)).join(',');
    };
    const displayed = (selector) => {
      const element = document.querySelector(selector);
      return element instanceof HTMLElement
        && getComputedStyle(element).display !== 'none';
    };
    return {
      asset: document.body.dataset.scoreCoinAsset ?? '',
      end: document.body.dataset.scoreCoinEndScreen ?? '',
      arrival: document.body.dataset.scoreCoinArrivalScreen ?? '',
      phase: document.body.dataset.scoreCoinPhase ?? '',
      sourceMode: document.body.dataset.scoreCoinSourceMode ?? '',
      terminal: document.body.dataset.scoreCoinTerminal ?? '',
      terminalCount: Number(document.body.dataset.scoreCoinTerminalCount ?? 0),
      terminalPhase: document.body.dataset.scoreCoinTerminalPhase ?? '',
      terminalCompletedAt: Number(
        document.body.dataset.feedbackSequenceTerminalCompletedAt ?? Number.NaN,
      ),
      popupCompletedAt: Number(
        document.body.dataset.deepSeaInkPopupCompletedAt ?? Number.NaN,
      ),
      sprayStartedAt: Number(
        document.body.dataset.deepSeaInkSprayStartedAt ?? Number.NaN,
      ),
      feedbackStartedAt: Number(
        document.body.dataset.feedbackSequenceFeedbackStartedAt ?? Number.NaN,
      ),
      topStartedAt: Number(
        document.body.dataset.feedbackSequenceTopStartedAt ?? Number.NaN,
      ),
      sequencePhase: document.body.dataset.feedbackSequencePhase ?? '',
      topBox: document.body.dataset.wrongTopEffectBox ?? '',
      topEffect: document.body.dataset.wrongTopEffect ?? '',
      topLayer: document.body.dataset.wrongTopEffectLayer ?? '',
      topSibling: document.body.dataset.wrongTopEffectSibling ?? '',
      topScaleX: document.body.dataset.wrongTopEffectScaleX ?? '',
      topStyle: document.body.dataset.wrongTopEffectStyle ?? '',
      topColorScene: document.body.dataset.wrongTopEffectColorScene ?? '',
      topDomOverlay: Boolean(document.getElementById('ReadingWrongTopEffect')),
      explosionBox: box('[data-score-terminal-layer="explosion-cloud"]'),
      explosionFragments: document.querySelectorAll('[data-score-terminal-fragment]').length,
      inkBox: box('[data-score-terminal-layer="ink-main"]'),
      inkDroplets: document.querySelectorAll('[data-score-terminal-droplet]').length,
      deepSeaInkActive: document.body.dataset.deepSeaInkActive ?? '',
      deepSeaInkAssetMode: document.body.dataset.deepSeaInkAssetMode ?? '',
      deepSeaInkRenderer: document.body.dataset.deepSeaInkRenderer ?? '',
      deepSeaInkPhase: document.body.dataset.deepSeaInkPhase ?? '',
      deepSeaInkFrame: document.body.dataset.deepSeaInkFrame ?? '',
      deepSeaInkFrameSource: document.body.dataset.deepSeaInkFrameSource ?? '',
      deepSeaInkFrameCount: Number(document.body.dataset.deepSeaInkFrameCount ?? 0),
      deepSeaInkTarget: document.body.dataset.deepSeaInkTarget ?? '',
      deepSeaInkSprayHit: document.body.dataset.deepSeaInkSprayHit ?? '',
      deepSeaInkBodyTopRight: document.body.dataset.deepSeaInkBodyTopRight ?? '',
      deepSeaInkSprayBodyTopRight:
        document.body.dataset.deepSeaInkSprayBodyTopRight ?? '',
      deepSeaInkOptionTopRight: document.body.dataset.deepSeaInkOptionTopRight ?? '',
      deepSeaInkCharacterHeadBounds:
        document.body.dataset.deepSeaInkCharacterHeadBounds ?? '',
      deepSeaInkTriggerPhase: document.body.dataset.deepSeaInkTriggerPhase ?? '',
      scoreCoinFeedbackKind: document.body.dataset.scoreCoinFeedbackKind ?? '',
      feedbackMotionReady: document.body.dataset.feedbackMotionReady ?? '',
      feedbackActorHandoff: document.body.dataset.feedbackActorHandoff ?? '',
      feedbackMotionVisible: displayed('img[data-customer-motion="Feedback"]'),
      deerMotionVisible: displayed('img[data-customer-motion="ReadingDeer"]'),
      feedbackMotionRect: rect('img[data-customer-motion="Feedback"]'),
      deerY: Number(document.body.dataset.deerY ?? Number.NaN),
    };
  });
}

async function runCase(browser, item) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await forceBank(page, item.correct ? 1 : 0);
  await page.goto(`${baseUrl}/?scene=${item.scene}&skipIntro=1&qa=score-props-0801`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 60000 });
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 30000,
  });
  await page.waitForTimeout(350);
  if (item.scene === 'food') {
    await page.screenshot({
      path: path.join(outputRoot, `${item.scene}-idle-grounded.png`),
    });
  }
  const click = designPoint(item.correct ? 720 : 1100, 405);
  await page.mouse.click(click.x, click.y);
  await page.waitForFunction(
    (correct) => document.body.dataset.answerCorrect === String(correct),
    item.correct,
    { timeout: 20000 },
  );

  const label = `${item.scene}-${item.correct ? 'correct' : 'wrong'}`;
  let terminalDiagnostics = null;
  let activeEffectDiagnostics = null;
  let feedbackReadyDiagnostics = null;
  let topDiagnostics = null;
  if (item.asset) {
    await page.waitForFunction(
      () => document.body.dataset.scoreCoinPhase === 'flight',
      null,
      { timeout: 20000 },
    );
    await page.screenshot({
      path: path.join(outputRoot, `${label}-flight.png`),
    });
    await page.waitForFunction(
      () => document.body.dataset.scoreCoinPhase === 'arrival',
      null,
      { timeout: 20000 },
    );
    await page.waitForTimeout(220);
    await page.screenshot({
      path: path.join(outputRoot, `${label}-arrival.png`),
    });
    terminalDiagnostics = await readDiagnostics(page);
  }

  if (item.effect === 'deep-sea-ink') {
    await page.waitForFunction(
      () => document.body.dataset.deepSeaInkActive === 'true',
      null,
      { timeout: 20000 },
    );
    await page.waitForFunction(
      () => Number(document.body.dataset.deepSeaInkFrame ?? -1) >= 2,
      null,
      { timeout: 3000 },
    );
    await page.screenshot({
      path: path.join(outputRoot, `${label}-ink-popup.png`),
    });
    await page.waitForFunction(
      () => document.body.dataset.feedbackMotionReady === 'true',
      null,
      { timeout: 5000 },
    );
    feedbackReadyDiagnostics = await readDiagnostics(page);
    await page.screenshot({
      path: path.join(outputRoot, `${label}-feedback-ready.png`),
    });
    await page.waitForFunction(
      () => (
        document.body.dataset.deepSeaInkPhase === 'spray'
        && Number(document.body.dataset.deepSeaInkFrame ?? -1) >= 24
      ),
      null,
      { timeout: 5000 },
    );
    activeEffectDiagnostics = await readDiagnostics(page);
    await page.screenshot({
      path: path.join(outputRoot, `${label}-ink-spray.png`),
    });
    await page.waitForFunction(
      () => document.body.dataset.deepSeaInkActive === 'false',
      null,
      { timeout: 5000 },
    );
    await page.screenshot({
      path: path.join(outputRoot, `${label}-feedback.png`),
    });
  } else if (!item.correct) {
    await page.waitForFunction(
      () => document.body.dataset.feedbackSequencePhase === 'feedback',
      null,
      { timeout: 20000 },
    );
    await page.screenshot({
      path: path.join(outputRoot, `${label}-feedback.png`),
    });
  }
  if (!item.correct) {
    await page.waitForFunction(
      () => document.body.dataset.wrongTopEffect === 'active',
      null,
      { timeout: 20000 },
    );
    topDiagnostics = await readDiagnostics(page);
    await page.screenshot({
      path: path.join(outputRoot, `${label}-top.png`),
    });
  }

  const diagnostics = {
    ...await readDiagnostics(page),
    ...(topDiagnostics ?? {}),
  };
  if (terminalDiagnostics) {
    [
      'asset', 'end', 'arrival', 'sourceMode', 'terminal', 'terminalCount',
      'explosionBox', 'explosionFragments', 'inkBox', 'inkDroplets',
    ].forEach((key) => {
      diagnostics[key] = terminalDiagnostics[key];
    });
  }
  if (activeEffectDiagnostics) {
    [
      'deepSeaInkActive', 'deepSeaInkFrame', 'deepSeaInkFrameCount',
      'deepSeaInkAssetMode', 'deepSeaInkRenderer', 'deepSeaInkPhase',
      'deepSeaInkFrameSource',
      'deepSeaInkTarget', 'deepSeaInkSprayHit', 'deepSeaInkBodyTopRight',
      'deepSeaInkSprayBodyTopRight', 'deepSeaInkOptionTopRight',
      'deepSeaInkCharacterHeadBounds',
      'deepSeaInkTriggerPhase', 'scoreCoinFeedbackKind',
    ].forEach((key) => {
      diagnostics[key] = activeEffectDiagnostics[key];
    });
  }
  if (feedbackReadyDiagnostics) {
    [
      'feedbackMotionReady', 'feedbackActorHandoff', 'feedbackMotionVisible',
      'deerMotionVisible', 'feedbackMotionRect',
    ].forEach((key) => {
      diagnostics[key] = feedbackReadyDiagnostics[key];
    });
  }
  await context.close();
  const issues = [];
  if (item.asset && !diagnostics.asset.endsWith(item.asset)) {
    issues.push(`asset=${diagnostics.asset}`);
  }
  if (item.asset && diagnostics.terminal !== item.terminal) {
    issues.push(`terminal=${diagnostics.terminal}`);
  }
  if (item.asset && diagnostics.sourceMode !== 'snapshot') {
    issues.push(`sourceMode=${diagnostics.sourceMode}`);
  }
  if (item.asset && diagnostics.terminalCount < 1) {
    issues.push(`terminalCount=${diagnostics.terminalCount}`);
  }
  if (item.asset && distance(point(diagnostics.end), point(diagnostics.arrival)) > 3) {
    issues.push(`arrival=${diagnostics.arrival},end=${diagnostics.end}`);
  }
  if (!item.correct) {
    const ordered = item.scene === 'deep-sea'
      ? (
        Number.isFinite(diagnostics.popupCompletedAt)
        && Number.isFinite(diagnostics.feedbackStartedAt)
        && Number.isFinite(diagnostics.sprayStartedAt)
        && Number.isFinite(diagnostics.terminalCompletedAt)
        && Number.isFinite(diagnostics.topStartedAt)
        && diagnostics.popupCompletedAt <= diagnostics.feedbackStartedAt
        && diagnostics.feedbackStartedAt <= diagnostics.sprayStartedAt
        && diagnostics.sprayStartedAt < diagnostics.terminalCompletedAt
        && diagnostics.terminalCompletedAt < diagnostics.topStartedAt
      )
      : (
        Number.isFinite(diagnostics.terminalCompletedAt)
        && Number.isFinite(diagnostics.feedbackStartedAt)
        && Number.isFinite(diagnostics.topStartedAt)
        && diagnostics.terminalCompletedAt <= diagnostics.feedbackStartedAt
        && diagnostics.feedbackStartedAt < diagnostics.topStartedAt
      );
    if (!ordered) {
      issues.push(
        `sequence=${diagnostics.popupCompletedAt}/`
        + `${diagnostics.feedbackStartedAt}/${diagnostics.sprayStartedAt}/`
        + `${diagnostics.terminalCompletedAt}/${diagnostics.topStartedAt}`,
      );
    }
    if (diagnostics.sequencePhase !== 'top') {
      issues.push(`sequencePhase=${diagnostics.sequencePhase}`);
    }
    if (diagnostics.topBox !== '0,0,1440,178') issues.push(`topBox=${diagnostics.topBox}`);
    if (diagnostics.topLayer !== 'background') issues.push(`topLayer=${diagnostics.topLayer}`);
    if (diagnostics.topSibling !== '1') issues.push(`topSibling=${diagnostics.topSibling}`);
    if (!(Number(diagnostics.topScaleX) >= 1)) issues.push(`topScaleX=${diagnostics.topScaleX}`);
    if (diagnostics.topStyle !== 'vertical-lines-only') {
      issues.push(`topStyle=${diagnostics.topStyle}`);
    }
    if (diagnostics.topColorScene !== item.scene) {
      issues.push(`topColorScene=${diagnostics.topColorScene}`);
    }
    if (diagnostics.topDomOverlay) issues.push('topDomOverlay=true');
  }
  if ((item.scene === 'mario' || item.scene === 'food') && !item.correct) {
    const [width, height] = diagnostics.explosionBox.split(',').map(Number);
    if (!(width >= 220 && height >= 190)) {
      issues.push(`explosionBox=${diagnostics.explosionBox}`);
    }
    if (diagnostics.explosionFragments < 20) {
      issues.push(`explosionFragments=${diagnostics.explosionFragments}`);
    }
  }
  if (item.scene === 'deep-sea' && !item.correct) {
    if (diagnostics.deepSeaInkActive !== 'true') {
      issues.push(`deepSeaInkActive=${diagnostics.deepSeaInkActive}`);
    }
    if (diagnostics.deepSeaInkAssetMode !== 'customer-original-frames') {
      issues.push(`deepSeaInkAssetMode=${diagnostics.deepSeaInkAssetMode}`);
    }
    if (diagnostics.deepSeaInkRenderer !== 'predecoded-canvas') {
      issues.push(`deepSeaInkRenderer=${diagnostics.deepSeaInkRenderer}`);
    }
    if (diagnostics.deepSeaInkPhase !== 'spray') {
      issues.push(`deepSeaInkPhase=${diagnostics.deepSeaInkPhase}`);
    }
    if (!/\/ink-squid-frames\/frame-(?:24|25)\.png$/.test(
      diagnostics.deepSeaInkFrameSource,
    )) {
      issues.push(`deepSeaInkFrameSource=${diagnostics.deepSeaInkFrameSource}`);
    }
    if (diagnostics.deepSeaInkFrameCount !== 26) {
      issues.push(`deepSeaInkFrameCount=${diagnostics.deepSeaInkFrameCount}`);
    }
    if (distance(point(diagnostics.deepSeaInkTarget), point(diagnostics.deepSeaInkSprayHit)) > 12) {
      issues.push(
        `deepSeaInkTarget=${diagnostics.deepSeaInkTarget},`
        + `spray=${diagnostics.deepSeaInkSprayHit}`,
      );
    }
    const spray = point(diagnostics.deepSeaInkSprayHit);
    const [headLeft, headTop, headRight, headBottom] =
      diagnostics.deepSeaInkCharacterHeadBounds.split(',').map(Number);
    if (
      !Number.isFinite(headLeft)
      || spray.x < headLeft
      || spray.x > headRight
      || spray.y < headTop
      || spray.y > headBottom
    ) {
      issues.push(
        `headBounds=${diagnostics.deepSeaInkCharacterHeadBounds},`
        + `spray=${diagnostics.deepSeaInkSprayHit}`,
      );
    }
    const body = point(diagnostics.deepSeaInkBodyTopRight);
    const sprayBody = point(diagnostics.deepSeaInkSprayBodyTopRight);
    const option = point(diagnostics.deepSeaInkOptionTopRight);
    if (!(body.y < option.y)) {
      issues.push(
        `body=${diagnostics.deepSeaInkBodyTopRight},`
        + `option=${diagnostics.deepSeaInkOptionTopRight}`,
      );
    }
    if (!(sprayBody.y < body.y)) {
      issues.push(
        `sprayBody=${diagnostics.deepSeaInkSprayBodyTopRight},`
        + `popupBody=${diagnostics.deepSeaInkBodyTopRight}`,
      );
    }
    if (
      diagnostics.feedbackMotionReady !== 'true'
      || diagnostics.feedbackActorHandoff !== 'feedback-ready'
      || !diagnostics.feedbackMotionVisible
      || diagnostics.deerMotionVisible
    ) {
      issues.push(
        `handoff=${diagnostics.feedbackMotionReady}/`
        + `${diagnostics.feedbackActorHandoff}/`
        + `${diagnostics.feedbackMotionVisible}/${diagnostics.deerMotionVisible}`,
      );
    }
    if (diagnostics.deepSeaInkTriggerPhase !== 'brick-apex') {
      issues.push(`deepSeaInkTriggerPhase=${diagnostics.deepSeaInkTriggerPhase}`);
    }
    if (diagnostics.scoreCoinFeedbackKind !== 'scene-effect') {
      issues.push(`scoreCoinFeedbackKind=${diagnostics.scoreCoinFeedbackKind}`);
    }
    if (diagnostics.asset.includes('/deep-sea/penalty.png')) {
      issues.push(`legacyAsset=${diagnostics.asset}`);
    }
  }
  if (item.scene === 'food' && diagnostics.deerY !== -235) {
    issues.push(`deerY=${diagnostics.deerY}`);
  }
  if (item.scene === 'poetry' && !item.correct) {
    if (diagnostics.inkDroplets < 24) issues.push(`inkDroplets=${diagnostics.inkDroplets}`);
    const [width, height] = diagnostics.inkBox.split(',').map(Number);
    if (!(width >= 160 && height >= 120)) issues.push(`inkBox=${diagnostics.inkBox}`);
  }
  return { label, diagnostics, issues };
}

fs.mkdirSync(outputRoot, { recursive: true });
const browser = await chromium.launch({ executablePath: chromePath, headless: true });
const report = [];
try {
  for (const item of cases) {
    const result = await runCase(browser, item);
    report.push(result);
    console.log(result.issues.length ? 'FAIL' : 'PASS', result.label,
      JSON.stringify(result.diagnostics));
  }
} finally {
  await browser.close();
}
fs.writeFileSync(
  path.join(outputRoot, 'report.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);
const failures = report.filter((item) => item.issues.length);
if (failures.length) {
  throw new Error(failures.map((item) => `${item.label}: ${item.issues.join('; ')}`).join('\n'));
}
console.log(`ALL PASS ${outputRoot}`);
