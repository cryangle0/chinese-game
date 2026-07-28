import fs from 'node:fs';
import { chromium } from 'playwright';

const logPath = 'e:/angsa/angsa_data/项目/作业帮游戏/debug-ffb02e.log';
const write = (e) => fs.appendFileSync(logPath, `${JSON.stringify({
  sessionId: 'ffb02e', timestamp: Date.now(), ...e,
})}\n`);

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH,
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 810 } });
const results = [];

try {
  await page.route('**/question-bank.json', async (route) => {
    const response = await route.fetch();
    const pack = await response.json();
    pack.questions = pack.questions.map((q) => ({ ...q, correctIndex: 0 }));
    await route.fulfill({ response, json: pack });
  });

  await page.goto('http://127.0.0.1:43886/', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForSelector('body[data-game-ready="true"]', { timeout: 45000 });
  let box = await page.locator('#GameCanvas').boundingBox();
  let scale = Math.min(box.width / 1440, box.height / 810);
  let ox = box.x + (box.width - 1440 * scale) / 2;
  let oy = box.y + (box.height - 810 * scale) / 2;
  const click = async (dx, dy) => {
    box = await page.locator('#GameCanvas').boundingBox();
    scale = Math.min(box.width / 1440, box.height / 810);
    ox = box.x + (box.width - 1440 * scale) / 2;
    oy = box.y + (box.height - 810 * scale) / 2;
    await page.mouse.click(ox + dx * scale, oy + dy * scale);
  };

  for (const [dx, dy] of [[937.5, 466], [980, 550], [720, 520]]) {
    await click(dx, dy);
    await page.waitForTimeout(300);
    if (await page.evaluate(() => document.body.dataset.gameView) === 'play') break;
  }
  await page.waitForFunction(() => document.body.dataset.gameView === 'play', null, {
    timeout: 20000,
  });

  // Q1: choose A, expect direct feedback (no actionReady)
  await click(361, 610);
  await page.waitForSelector('body[data-answer-correct="true"]', { timeout: 5000 });
  const q1 = await page.evaluate(() => ({
    actionReady: document.body.dataset.actionReady,
    answerCorrect: document.body.dataset.answerCorrect,
    speech: document.body.dataset.speechState,
  }));
  const directOk = q1.answerCorrect === 'true' && q1.actionReady !== 'true';
  results.push({ id: 'direct-feedback', pass: directOk, q1 });
  write({ runId: 'fb0720', hypothesisId: 'H-direct', message: directOk ? 'PASS' : 'FAIL', data: q1 });

  await page.waitForFunction(() => document.body.dataset.answerCorrect === undefined, null, {
    timeout: 5000,
  });
  await page.waitForTimeout(400);

  // Q2: voice should be enabled again
  const q2 = await page.evaluate(() => ({
    speech: document.body.dataset.speechState,
    voiceEnabled: document.body.dataset.speechState === 'idle'
      || document.body.dataset.speechState === 'unsupported',
  }));
  const voiceOk = q2.speech === 'idle' || q2.speech === 'unsupported';
  results.push({ id: 'voice-reenable', pass: voiceOk, q2 });
  write({ runId: 'fb0720', hypothesisId: 'H-voice', message: voiceOk ? 'PASS' : 'FAIL', data: q2 });

  const pass = results.every((r) => r.pass);
  write({ runId: 'fb0720', hypothesisId: 'ALL', message: pass ? 'PASS' : 'FAIL', data: { results } });
  console.log(JSON.stringify({ pass, results }, null, 2));
  if (!pass) process.exitCode = 1;
} catch (error) {
  console.error(error);
  write({ runId: 'fb0720', hypothesisId: 'E', message: String(error.message || error) });
  process.exitCode = 1;
} finally {
  await browser.close();
}
