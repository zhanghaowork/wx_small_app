const MATCH_DRAFT_KEY = 'match_page_draft_v1';

const createEmptyMatch = () => ({
  A1: '',
  A2: '',
  B1: '',
  B2: '',
  scoreA: 0,
  scoreB: 0
});

Page({
  data: {
    matches: [createEmptyMatch()],
    showResult: false,
    stats: {}
  },

  onLoad(options) {
    wx.showShareMenu({
      menus: ['shareAppMessage', 'shareTimeline']
    });
    if (options && options.data) {
      const restored = this.restoreFromShare(options.data);
      if (restored) return;
    }
    this.restoreDraft();
  },

  onUnload() {
    this.persistDraft();
  },

  restoreFromShare(encoded) {
    try {
      const text = decodeURIComponent(encoded);
      const payload = JSON.parse(text);
      if (!payload || !Array.isArray(payload.matches) || !payload.matches.length) return false;
      this.setData({
        matches: payload.matches.map((m) => this.normalizeMatch(m)),
        showResult: false,
        stats: {}
      });
      this.persistDraft();
      return true;
    } catch (err) {
      return false;
    }
  },

  restoreDraft() {
    const draft = wx.getStorageSync(MATCH_DRAFT_KEY);
    if (!draft || !Array.isArray(draft.matches) || !draft.matches.length) return;
    this.setData({
      matches: draft.matches.map((m) => this.normalizeMatch(m)),
      showResult: !!draft.showResult,
      stats: draft.stats || {}
    });
  },

  persistDraft() {
    wx.setStorageSync(MATCH_DRAFT_KEY, {
      matches: this.data.matches.map((m) => this.normalizeMatch(m)),
      showResult: this.data.showResult,
      stats: this.data.stats
    });
  },

  normalizeMatch(match = {}) {
    return {
      A1: `${match.A1 || ''}`.trim(),
      A2: `${match.A2 || ''}`.trim(),
      B1: `${match.B1 || ''}`.trim(),
      B2: `${match.B2 || ''}`.trim(),
      scoreA: Number.isFinite(Number(match.scoreA)) ? Number(match.scoreA) : 0,
      scoreB: Number.isFinite(Number(match.scoreB)) ? Number(match.scoreB) : 0
    };
  },

  // 添加新对局
  addNewMatch() {
    const newMatch = createEmptyMatch();
    this.setData({
      matches: [...this.data.matches, newMatch]
    });
    this.persistDraft();
  },

  // 输入处理
  handleInput(e) {
    const { index, field } = e.currentTarget.dataset;
    const value = e.detail.value;
    const matches = this.data.matches.map((item) => ({ ...item }));
    if (!matches[index]) return;
    matches[index][field] = field === 'scoreA' || field === 'scoreB'
      ? `${value || ''}`.replace(/[^\d]/g, '').slice(0, 3)
      : value;
    this.setData({ matches, showResult: false });
    this.persistDraft();
  },

  // 结束比赛处理
  handleEndMatch() {
    const stats = this.calculateStats();
    this.setData({
      showResult: true,
      stats
    });
    this.persistDraft();
  },

  // 统计计算
  calculateStats() {
    const stats = {};
    
    this.data.matches.forEach(match => {
      // 统计得分
      [match.A1, match.A2].forEach((player) => {
        if (!player) return;
        stats[player] = stats[player] || { wins: 0, total: 0 };
        stats[player].total += Number(match.scoreA) || 0;
      });
      
      [match.B1, match.B2].forEach((player) => {
        if (!player) return;
        stats[player] = stats[player] || { wins: 0, total: 0 };
        stats[player].total += Number(match.scoreB) || 0;
      });

      // 统计胜局
      if (Number(match.scoreA) > Number(match.scoreB)) {
        [match.A1, match.A2].forEach((player) => {
          if (player) stats[player].wins++;
        });
      } else if (Number(match.scoreB) > Number(match.scoreA)) {
        [match.B1, match.B2].forEach((player) => {
          if (player) stats[player].wins++;
        });
      }
    });
    
    return stats;
  },

  // 再来一局
  handleRestart() {
    this.setData({
      matches: [createEmptyMatch()],
      showResult: false,
      stats: {}
    });
    this.persistDraft();
  },

  // 退出
  handleExit() {
    this.persistDraft();
    wx.navigateBack();
  },

  onShareAppMessage() {
    const payload = {
      matches: this.data.matches.map((m) => this.normalizeMatch(m))
    };
    const encoded = encodeURIComponent(JSON.stringify(payload));
    const basePath = '/pages/match/index';
    const path = `${basePath}?data=${encoded}`;
    const tooLong = path.length > 1800;
    return {
      title: tooLong ? '羽毛球对战表（打开后可继续编辑）' : '我分享了一份羽毛球对战表',
      path: tooLong ? basePath : path
    };
  },

  onShareTimeline() {
    return {
      title: '羽毛球对战表',
      query: ''
    };
  }
});
