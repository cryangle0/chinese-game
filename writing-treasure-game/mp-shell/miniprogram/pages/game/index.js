const { resolveLaunchConfig } = require('../../config/environments');
const { messagesFrom } = require('../../utils/host-messages');
const { buildLaunchUrl } = require('../../utils/launch-url');

Page({
  data: {
    errorMessage: '',
    gameUrl: '',
  },

  onLoad(options) {
    this.launchOptions = options;
    this.openGame();
  },

  onShow() {
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: false,
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }
  },

  openGame() {
    const environment = resolveLaunchConfig();
    this.setData({
      errorMessage: '',
      gameUrl: buildLaunchUrl(environment.h5Url, {
        ...this.launchOptions,
        bankUrl: environment.bankUrl,
        trackEndpoint: environment.trackEndpoint,
      }),
    });
  },

  handleMessage(event) {
    messagesFrom(event).forEach((message) => this.handleHostMessage(message));
  },

  handleHostMessage(message) {
    if (message.source !== 'h5-game') return;
    if (message.type === 'share-config' && message.payload) {
      const payload = message.payload;
      const title = typeof payload.title === 'string' && payload.title.trim()
        ? payload.title.trim().slice(0, 60)
        : '挖宝';
      const path = typeof payload.path === 'string' && payload.path.startsWith('/')
        ? payload.path
        : '/pages/game/index';
      const query = typeof payload.query === 'string' ? payload.query : '';
      getApp().globalData.share = { title, path, query };
      return;
    }
    if (message.type === 'game-result') {
      getApp().globalData.lastResult = message;
    }
  },

  handleError(event) {
    console.error('[writing-treasure-shell] web-view failed', event.detail);
    this.setData({
      errorMessage: '游戏加载失败，请检查网络后重试',
      gameUrl: '',
    });
  },

  retry() {
    this.openGame();
  },

  onShareAppMessage() {
    return getApp().globalData.share;
  },

  onShareTimeline() {
    const share = getApp().globalData.share || {};
    return { title: share.title, query: share.query || '' };
  },
});
