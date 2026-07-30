const ENVIRONMENTS = Object.freeze({
  develop: Object.freeze({
    h5Url: 'https://game.xyouxing.com/writing-treasure/index.html?release=20260730212827',
    bankUrl: 'https://game.xyouxing.com/writing-treasure/question-bank.json',
    trackEndpoint: 'https://agent.onnsa.cn/writing-treasure/api/track',
  }),
  trial: Object.freeze({
    h5Url: 'https://game.xyouxing.com/writing-treasure/index.html?release=20260730212827',
    bankUrl: 'https://game.xyouxing.com/writing-treasure/question-bank.json',
    trackEndpoint: 'https://agent.onnsa.cn/writing-treasure/api/track',
  }),
  release: Object.freeze({
    h5Url: 'https://game.xyouxing.com/writing-treasure/index.html?release=20260730212827',
    bankUrl: 'https://game.xyouxing.com/writing-treasure/question-bank.json',
    trackEndpoint: 'https://agent.onnsa.cn/writing-treasure/api/track',
  }),
});

function currentEnvironment() {
  try {
    return wx.getAccountInfoSync().miniProgram.envVersion || 'develop';
  } catch (error) {
    console.warn('[mp-shell] cannot read envVersion', error);
    return 'develop';
  }
}

function resolveLaunchConfig() {
  return ENVIRONMENTS[currentEnvironment()] || ENVIRONMENTS.develop;
}

module.exports = {
  ENVIRONMENTS,
  resolveLaunchConfig,
};
