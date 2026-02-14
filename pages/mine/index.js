const HISTORY_KEY = 'match_history_records';

Page({
  data: {
    records: []
  },

  onShow() {
    this.loadRecords();
  },

  loadRecords() {
    const records = wx.getStorageSync(HISTORY_KEY) || [];
    this.setData({ records });
  },

  clearRecords() {
    wx.showModal({
      title: '清空记录',
      content: '确认清空全部比赛结果记录吗？',
      success: (res) => {
        if (!res.confirm) return;
        wx.removeStorageSync(HISTORY_KEY);
        this.setData({ records: [] });
        wx.showToast({ title: '已清空', icon: 'success' });
      }
    });
  },

  onShareAppMessage() {
    return {
      title: '羽毛球助手：我的比赛记录',
      path: '/pages/mine/index'
    };
  }
});
