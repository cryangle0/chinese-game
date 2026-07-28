const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const shellRoot = path.resolve(__dirname, '..');
const launchModule = path.join(shellRoot, 'miniprogram/utils/launch-url.js');
const messagesModule = path.join(shellRoot, 'miniprogram/utils/host-messages.js');
const environmentsModule = path.join(shellRoot, 'miniprogram/config/environments.js');
const pageModule = path.join(shellRoot, 'miniprogram/pages/game/index.js');
const sharePageModule = path.join(shellRoot, 'miniprogram/pages/share/index.js');
const sharePageStyle = path.join(shellRoot, 'miniprogram/pages/share/index.wxss');

test('launch URL forwards only supported values with a stable session', () => {
  const { buildLaunchUrl } = require(launchModule);
  const url = new URL(buildLaunchUrl('https://game.example/index.html', {
    grade: '5',
    bankUrl: 'https://bank.example/questions.json',
    sessionId: 'session-test',
    ignored: 'no',
  }));
  assert.equal(url.searchParams.get('host'), 'wechat-mp');
  assert.equal(url.searchParams.get('sessionId'), 'session-test');
  assert.equal(url.searchParams.get('grade'), '5');
  assert.equal(url.searchParams.get('bankUrl'), 'https://bank.example/questions.json');
  assert.equal(url.searchParams.has('ignored'), false);
});

test('message batches reject malformed entries without dropping valid messages', () => {
  const { messagesFrom } = require(messagesModule);
  assert.deepEqual(messagesFrom({
    detail: { data: [null, 'bad', { type: 'game-ready' }, { type: 'game-result' }] },
  }), [{ type: 'game-ready' }, { type: 'game-result' }]);
  assert.deepEqual(messagesFrom({ detail: { data: {} } }), []);
});

test('environment follows the mini-program version and falls back safely', () => {
  const previousWx = global.wx;
  try {
    global.wx = { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'trial' } }) };
    delete require.cache[require.resolve(environmentsModule)];
    const { ENVIRONMENTS, resolveLaunchConfig } = require(environmentsModule);
    assert.equal(resolveLaunchConfig(), ENVIRONMENTS.trial);
    global.wx = { getAccountInfoSync: () => { throw new Error('unavailable'); } };
    assert.equal(resolveLaunchConfig(), ENVIRONMENTS.develop);
  } finally {
    global.wx = previousWx;
  }
});

test('page opens the configured game and records host results', () => {
  const previousPage = global.Page;
  const previousGetApp = global.getApp;
  const previousWx = global.wx;
  const app = { globalData: { share: null, lastResult: null } };
  let definition;
  try {
    global.wx = { getAccountInfoSync: () => ({ miniProgram: { envVersion: 'develop' } }) };
    global.Page = (value) => { definition = value; };
    global.getApp = () => app;
    delete require.cache[require.resolve(pageModule)];
    require(pageModule);
    const state = {};
    const page = { ...definition, setData: (value) => Object.assign(state, value) };
    page.onLoad({
      grade: '4',
      activityId: 'activity-a',
      bankUrl: 'https://attacker.example/questions.json',
      trackEndpoint: 'https://attacker.example/collect',
    });
    const url = new URL(state.gameUrl);
    assert.equal(url.origin, 'https://game.xyouxing.com');
    assert.equal(url.searchParams.get('grade'), '4');
    assert.equal(url.searchParams.get('activityId'), 'activity-a');
    assert.equal(
      url.searchParams.get('bankUrl'),
      'https://game.xyouxing.com/writing-treasure/question-bank.json',
    );
    assert.equal(
      url.searchParams.get('trackEndpoint'),
      'https://agent.onnsa.cn/writing-treasure/api/track',
    );
    page.handleHostMessage({ source: 'h5-game', type: 'game-result', payload: { score: 20 } });
    assert.equal(app.globalData.lastResult.payload.score, 20);
    page.handleHostMessage({ type: 'share-config', payload: { title: '伪造结果' } });
    assert.equal(app.globalData.share, null);
    page.handleHostMessage({
      source: 'h5-game', type: 'share-config', payload: { title: '结果' },
    });
    assert.equal(app.globalData.share.title, '结果');
    assert.equal(app.globalData.share.path, '/pages/game/index');
    assert.equal(app.globalData.share.query, '');
  } finally {
    global.Page = previousPage;
    global.getApp = previousGetApp;
    global.wx = previousWx;
  }
});

test('share page turns the navigate query into a native share card', () => {
  const previousPage = global.Page;
  const previousGetApp = global.getApp;
  const previousWx = global.wx;
  const app = {
    globalData: { share: { title: '挖宝', path: '/pages/game/index', query: 'grade=4' } },
  };
  let definition;
  try {
    global.wx = { showShareMenu: () => {} };
    global.Page = (value) => { definition = value; };
    global.getApp = () => app;
    delete require.cache[require.resolve(sharePageModule)];
    require(sharePageModule);
    const state = {};
    const page = { ...definition, setData: (value) => Object.assign(state, value) };
    page.onLoad({ title: encodeURIComponent('挖宝：40 分') });
    assert.equal(state.title, '挖宝：40 分');
    assert.deepEqual(page.onShareAppMessage(), {
      title: '挖宝：40 分',
      path: '/pages/game/index?grade=4',
    });
    assert.equal(app.globalData.share.title, '挖宝：40 分');
    page.onLoad({});
    assert.equal(state.title, '挖宝：40 分');
  } finally {
    global.Page = previousPage;
    global.getApp = previousGetApp;
    global.wx = previousWx;
  }
});

test('share page uses a warm backdrop without the black overlay', () => {
  const css = fs.readFileSync(sharePageStyle, 'utf8');
  assert.match(css, /linear-gradient\(/);
  assert.doesNotMatch(css, /rgba\(\s*8\s*,\s*20\s*,\s*32/);
});
