const ENVIRONMENTS = Object.freeze({
  develop: Object.freeze({
    h5Url: 'https://game.xyouxing.com/reading-jumper/index.html?release=20260805145749',
    bankUrl: 'https://game.xyouxing.com/reading-jumper/question-bank.json',
    trackEndpoint: '',
  }),
  trial: Object.freeze({
    h5Url: 'https://game.xyouxing.com/reading-jumper/index.html?release=20260730210813',
    bankUrl: 'https://game.xyouxing.com/reading-jumper/question-bank.json',
    trackEndpoint: '',
  }),
  release: Object.freeze({
    h5Url: 'https://game.xyouxing.com/reading-jumper/index.html?release=20260730210813',
    bankUrl: 'https://game.xyouxing.com/reading-jumper/question-bank.json',
    trackEndpoint: '',
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
