Page({
  data: {
    showNotice: true,
    activeModule: 'double',
    modeCards: [],
    allModeCards: [
      {
        id: 'fourToEight',
        module: 'double',
        icon: '4',
        title: '4-8人转',
        desc1: '4~8人双打轮转，自动安排每场 2v2',
        desc2: '目标：减少重复队友与重复对手',
        buttonClass: 'btn-yellow',
        url: '/pages/random/index'
      },
      {
        id: 'overEight',
        module: 'double',
        icon: '8+',
        title: '超8转',
        desc1: '适用于超过 8 人的大场活动',
        desc2: '按规则切片轮转，降低连续上场不均',
        buttonClass: 'btn-blue',
        url: '/pages/over8/index'
      },
      {
        id: 'ladder',
        module: 'double',
        icon: 'K',
        title: '固搭擂台赛',
        desc1: '擂主固定双打组合，接受最多10组攻擂',
        desc2: '支持比分录入与擂台结算排名',
        buttonClass: 'btn-red',
        url: '/pages/ladder/index'
      },
      {
        id: 'unrivaled',
        module: 'double',
        icon: '∞',
        title: '无与伦比',
        desc1: '特殊赛制：同组内多轮混编对抗',
        desc2: '适合娱乐局与趣味挑战',
        buttonClass: 'btn-green',
        url: '/pages/unrivaled/index'
      },
      {
        id: 'singleScore',
        module: 'single',
        icon: '1v1',
        title: '单打积分赛',
        desc1: '设置A/B选手和比赛局数，逐局录入比分',
        desc2: '自动统计胜局、总分与最终排名',
        buttonClass: 'btn-orange',
        url: '/pages/single_score/index'
      },
      {
        id: 'singleLadder',
        module: 'single',
        icon: 'K1',
        title: '单打攻擂赛',
        desc1: '可手动设置或批量导入擂主与攻擂者',
        desc2: '支持比分记录、擂台结算和排名',
        buttonClass: 'btn-red',
        url: '/pages/single_ladder/index'
      }
    ]
  },

  onLoad() {
    this.syncModeCards();
  },

  syncModeCards() {
    const modeCards = this.data.allModeCards.filter((item) => item.module === this.data.activeModule);
    this.setData({ modeCards });
  },

  dismissNotice() {
    this.setData({ showNotice: false });
  },

  switchModule(e) {
    const { module } = e.currentTarget.dataset;
    if (!module || module === this.data.activeModule) return;
    this.setData({ activeModule: module }, () => this.syncModeCards());
  },

  scrollToModes() {
    wx.pageScrollTo({
      selector: '#modeSection',
      duration: 260
    });
  },

  startMode(e) {
    const { url, disabled } = e.currentTarget.dataset;
    if (disabled || !url) {
      wx.showToast({ title: '该模式即将上线', icon: 'none' });
      return;
    }
    wx.navigateTo({ url });
  }
});
