Page({
  data: {
    modeCards: [
      {
        id: 'fourToEight',
        title: '4-8人转',
        desc1: '4~8人双打轮转，自动安排每场 2v2',
        desc2: '目标：减少重复队友与重复对手',
        buttonClass: 'btn-yellow',
        url: '/pages/random/index'
      },
      {
        id: 'overEight',
        title: '超8转',
        desc1: '适用于超过 8 人的大场活动',
        desc2: '按规则切片轮转，降低连续上场不均',
        buttonClass: 'btn-blue',
        url: '/pages/over8/index'
      },
      {
        id: 'unrivaled',
        title: '无与伦比',
        desc1: '特殊赛制：同组内多轮混编对抗',
        desc2: '适合娱乐局与趣味挑战',
        buttonClass: 'btn-green',
        url: '/pages/unrivaled/index'
      }
    ]
  },

  startMode(e) {
    const { url } = e.currentTarget.dataset;
    wx.navigateTo({ url });
  }
});
