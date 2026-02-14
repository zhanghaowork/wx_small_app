const HISTORY_KEY = 'match_history_records';

Page({
  data: {
    title: '',
    matchDate: '',
    playerA: '',
    playerB: '',
    roundsCount: 3,
    matches: [],
    resultReady: false,
    settlement: {
      totalMatches: 0,
      winsA: 0,
      winsB: 0,
      pointsA: 0,
      pointsB: 0
    },
    ranking: [],
    isEnding: false,
    errorText: ''
  },

  onLoad() {
    this.setData({ matchDate: this.formatDate(new Date()) }, () => this.syncMatchesByRounds());
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  formatDateTime(date) {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    const hh = `${date.getHours()}`.padStart(2, '0');
    const mm = `${date.getMinutes()}`.padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
  },

  onTitleInput(e) {
    this.setData({ title: `${e.detail.value || ''}`.trim() });
  },

  onDateChange(e) {
    this.setData({ matchDate: e.detail.value });
  },

  onPlayerInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [field]: `${e.detail.value || ''}`.trim() });
  },

  increaseRounds() {
    if (this.data.roundsCount >= 15) return;
    this.setData({ roundsCount: this.data.roundsCount + 1 }, () => this.syncMatchesByRounds());
  },

  decreaseRounds() {
    if (this.data.roundsCount <= 1) return;
    this.setData({ roundsCount: this.data.roundsCount - 1 }, () => this.syncMatchesByRounds());
  },

  syncMatchesByRounds() {
    const old = this.data.matches || [];
    const next = Array.from({ length: this.data.roundsCount }, (_, idx) => {
      const prev = old[idx] || {};
      return {
        round: idx + 1,
        scoreA: prev.scoreA || '',
        scoreB: prev.scoreB || ''
      };
    });
    this.setData({ matches: next, resultReady: false });
  },

  onScoreInput(e) {
    const { index, field } = e.currentTarget.dataset;
    const value = `${e.detail.value || ''}`.replace(/[^\d]/g, '').slice(0, 3);
    this.setData({
      [`matches[${index}].${field}`]: value,
      resultReady: false,
      errorText: ''
    });
  },

  showError(msg) {
    this.setData({ errorText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  },

  saveMatchRecord(payload) {
    const list = wx.getStorageSync(HISTORY_KEY) || [];
    const now = new Date();
    const nowTs = now.getTime();
    const fingerprint = JSON.stringify(payload);
    const latest = list[0];
    if (latest && latest.fingerprint === fingerprint && nowTs - (latest.createdTs || 0) < 8000) return;
    const next = [{
      id: `${nowTs}_${Math.floor(Math.random() * 100000)}`,
      createdAt: this.formatDateTime(now),
      createdTs: nowTs,
      fingerprint,
      ...payload
    }, ...list].slice(0, 200);
    wx.setStorageSync(HISTORY_KEY, next);
  },

  onPrimaryAction() {
    if (this.data.isEnding) return;
    this.endCompetition();
  },

  endCompetition() {
    if (this.data.isEnding) return;
    const a = this.data.playerA.trim();
    const b = this.data.playerB.trim();
    if (!a || !b) {
      this.showError('请先填写A/B比赛人员');
      return;
    }
    if (a === b) {
      this.showError('A与B不能是同一人');
      return;
    }

    const validMatches = this.data.matches.filter((m) => m.scoreA !== '' && m.scoreB !== '');
    if (!validMatches.length) {
      this.showError('请先录入至少一局比分');
      return;
    }

    this.setData({ isEnding: true });
    try {
      const stats = {
        [a]: { name: a, wins: 0, losses: 0, matches: 0, pointsFor: 0, pointsAgainst: 0 },
        [b]: { name: b, wins: 0, losses: 0, matches: 0, pointsFor: 0, pointsAgainst: 0 }
      };

      validMatches.forEach((m) => {
        const sa = Number(m.scoreA);
        const sb = Number(m.scoreB);
        const aWin = sa > sb;
        const bWin = sb > sa;

        stats[a].matches += 1;
        stats[a].pointsFor += sa;
        stats[a].pointsAgainst += sb;
        if (aWin) stats[a].wins += 1;
        if (bWin) stats[a].losses += 1;

        stats[b].matches += 1;
        stats[b].pointsFor += sb;
        stats[b].pointsAgainst += sa;
        if (bWin) stats[b].wins += 1;
        if (aWin) stats[b].losses += 1;
      });

      const ranking = Object.values(stats)
        .map((s) => ({
          ...s,
          diff: s.pointsFor - s.pointsAgainst,
          winRate: s.matches ? Math.round((s.wins / s.matches) * 100) : 0
        }))
        .sort((x, y) => y.wins - x.wins || y.diff - x.diff || y.pointsFor - x.pointsFor);

      this.setData({
        settlement: {
          totalMatches: validMatches.length,
          winsA: stats[a].wins,
          winsB: stats[b].wins,
          pointsA: stats[a].pointsFor,
          pointsB: stats[b].pointsFor
        },
        ranking,
        resultReady: true,
        errorText: ''
      });

      this.saveMatchRecord({
        mode: '单打积分赛',
        title: this.data.title || '',
        matchDate: this.data.matchDate || '',
        totalMatches: validMatches.length,
        champion: ranking[0] ? ranking[0].name : ''
      });

      wx.showToast({ title: '结算完成', icon: 'success' });
    } finally {
      this.setData({ isEnding: false });
    }
  }
});
