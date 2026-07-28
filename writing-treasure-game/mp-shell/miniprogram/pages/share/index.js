const { buildShareCard } = require('../../utils/share-card');

Page({
  data: {
    title: '',
  },

  onLoad(options) {
    const app = getApp();
    const globalData = (app && app.globalData) || {};
    this.card = buildShareCard(options, globalData.share, '挖宝');
    globalData.share = this.card;
    this.setData({ title: this.card.title });
    if (wx.showShareMenu) {
      wx.showShareMenu({
        withShareTicket: false,
        menus: ['shareAppMessage', 'shareTimeline'],
      });
    }
  },

  back() {
    wx.navigateBack({ delta: 1 });
  },

  /** Keeps taps inside the card from dismissing it. */
  noop() {},

  onShareAppMessage() {
    return { title: this.card.title, path: this.card.path };
  },

  onShareTimeline() {
    return { title: this.card.title, query: this.card.query };
  },
});
