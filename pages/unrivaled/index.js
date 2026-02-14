function normalizeNames(text) {
  return (text || '')
    .split(/[\n,，、;；\s]+/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function pairAt(order, startIndex) {
  const n = order.length;
  const a = order[startIndex % n];
  const b = order[(startIndex + 1) % n];
  return [a, b];
}
const HISTORY_KEY = 'match_history_records';

Page({
  data: {
    teamSize: 5,
    scoreStep: 10,
    teamAInput: '',
    teamBInput: '',
    teamAOrder: [],
    teamBOrder: [],
    segments: [],
    swaps: [],
    scoreMatches: [],
    summary: {
      targetScore: 50,
      teamSize: 5,
      scoreStep: 10
    },
    resultReady: false,
    ranking: [],
    teamScoreSummary: { teamA: 0, teamB: 0 },
    totalScoredMatches: 0,
    isEnding: false,
    errorText: ''
  },

  increaseTeamSize() {
    if (this.data.teamSize >= 20) return;
    this.setData({ teamSize: this.data.teamSize + 1, segments: [], swaps: [], scoreMatches: [], resultReady: false, ranking: [], errorText: '' });
  },

  decreaseTeamSize() {
    if (this.data.teamSize <= 3) return;
    this.setData({ teamSize: this.data.teamSize - 1, segments: [], swaps: [], scoreMatches: [], resultReady: false, ranking: [], errorText: '' });
  },

  selectScoreStep(e) {
    const value = Number(e.currentTarget.dataset.value);
    this.setData({ scoreStep: value, segments: [], swaps: [], scoreMatches: [], resultReady: false, ranking: [], errorText: '' });
  },

  onTeamAInput(e) {
    this.setData({ teamAInput: e.detail.value });
  },

  onTeamBInput(e) {
    this.setData({ teamBInput: e.detail.value });
  },

  showError(msg) {
    this.setData({ errorText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  },

  buildOrder(prefix, inputText, teamSize) {
    const list = normalizeNames(inputText);
    if (!list.length) {
      return Array.from({ length: teamSize }, (_, i) => `${prefix}${i + 1}`);
    }

    if (list.length !== teamSize) return null;
    if (new Set(list).size !== list.length) return 'DUP';
    return list;
  },

  generate() {
    const n = this.data.teamSize;
    const step = this.data.scoreStep;

    const orderA = this.buildOrder('A', this.data.teamAInput, n);
    if (!orderA) {
      this.showError(`A队名单人数必须等于 ${n}`);
      return;
    }
    if (orderA === 'DUP') {
      this.showError('A队名单存在重名');
      return;
    }

    const orderB = this.buildOrder('B', this.data.teamBInput, n);
    if (!orderB) {
      this.showError(`B队名单人数必须等于 ${n}`);
      return;
    }
    if (orderB === 'DUP') {
      this.showError('B队名单存在重名');
      return;
    }

    const targetScore = n * step;
    const segments = [];
    const swaps = [];

    for (let seg = 0; seg < n; seg++) {
      const from = seg * step;
      const to = (seg + 1) * step;
      const pairA = pairAt(orderA, seg);
      const pairB = pairAt(orderB, seg);

      segments.push({
        id: seg + 1,
        from,
        to,
        pairA,
        pairB
      });

      if (seg < n - 1) {
        swaps.push({
          score: to,
          outA: pairA[0],
          inA: pairAt(orderA, seg + 1)[1],
          outB: pairB[0],
          inB: pairAt(orderB, seg + 1)[1],
          nextA: pairAt(orderA, seg + 1),
          nextB: pairAt(orderB, seg + 1)
        });
      }
    }

    this.setData({
      teamAOrder: orderA,
      teamBOrder: orderB,
      segments,
      swaps,
      scoreMatches: segments.map((seg) => ({
        id: seg.id,
        title: `第${seg.id}段`,
        team1: seg.pairA,
        team2: seg.pairB,
        score1: '',
        score2: ''
      })),
      summary: {
        targetScore,
        teamSize: n,
        scoreStep: step
      },
      resultReady: false,
      ranking: [],
      errorText: ''
    });

    wx.showToast({ title: '接力表已生成', icon: 'success' });
  },

  onScoreInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const team = Number(e.currentTarget.dataset.team);
    const value = `${e.detail.value || ''}`.replace(/[^\d]/g, '').slice(0, 3);
    const key = team === 1 ? 'score1' : 'score2';
    this.setData({
      [`scoreMatches[${index}].${key}`]: value,
      resultReady: false
    });
  },

  formatDateTime(date) {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    const hh = `${date.getHours()}`.padStart(2, '0');
    const mm = `${date.getMinutes()}`.padStart(2, '0');
    return `${y}-${m}-${d} ${hh}:${mm}`;
  },

  saveMatchRecord(payload) {
    const list = wx.getStorageSync(HISTORY_KEY) || [];
    const now = new Date();
    const nowTs = now.getTime();
    const fingerprint = JSON.stringify(payload);
    const latest = list[0];
    if (latest && latest.fingerprint === fingerprint && nowTs - (latest.createdTs || 0) < 8000) {
      return;
    }
    const next = [{
      id: `${nowTs}_${Math.floor(Math.random() * 100000)}`,
      createdAt: this.formatDateTime(now),
      createdTs: nowTs,
      fingerprint,
      ...payload
    }, ...list].slice(0, 200);
    wx.setStorageSync(HISTORY_KEY, next);
  },

  handlePrint() {
    wx.showToast({ title: '打印功能待接入', icon: 'none' });
  },

  onShareAppMessage() {
    return {
      title: '羽毛球无与伦比接力赛，来一局吗？',
      path: '/pages/unrivaled/index'
    };
  },

  onPrimaryAction() {
    if (!this.data.segments.length) {
      this.generate();
      return;
    }
    if (this.data.isEnding) return;
    this.endCompetition();
  },

  endCompetition() {
    if (this.data.isEnding) return;
    if (!this.data.scoreMatches.length) {
      this.showError('请先生成接力表');
      return;
    }

    const validMatches = this.data.scoreMatches.filter((m) => m.score1 !== '' && m.score2 !== '');
    if (!validMatches.length) {
      this.showError('请先录入至少一段比分');
      return;
    }

    this.setData({ isEnding: true });
    try {
      const stats = {};
      [...this.data.teamAOrder, ...this.data.teamBOrder].forEach((name) => {
        stats[name] = { name, wins: 0, losses: 0, matches: 0, pointsFor: 0, pointsAgainst: 0 };
      });

      let teamA = 0;
      let teamB = 0;

      validMatches.forEach((m) => {
        const s1 = Number(m.score1);
        const s2 = Number(m.score2);
        teamA += s1;
        teamB += s2;
        const team1Win = s1 > s2;
        const team2Win = s2 > s1;

        m.team1.forEach((p) => {
          if (!stats[p]) return;
          stats[p].matches += 1;
          stats[p].pointsFor += s1;
          stats[p].pointsAgainst += s2;
          if (team1Win) stats[p].wins += 1;
          if (team2Win) stats[p].losses += 1;
        });
        m.team2.forEach((p) => {
          if (!stats[p]) return;
          stats[p].matches += 1;
          stats[p].pointsFor += s2;
          stats[p].pointsAgainst += s1;
          if (team2Win) stats[p].wins += 1;
          if (team1Win) stats[p].losses += 1;
        });
      });

      const ranking = Object.values(stats)
        .map((s) => ({ ...s, diff: s.pointsFor - s.pointsAgainst, winRate: s.matches ? Math.round((s.wins / s.matches) * 100) : 0 }))
        .sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pointsFor - a.pointsFor);

      this.setData({
        ranking,
        teamScoreSummary: { teamA, teamB },
        totalScoredMatches: validMatches.length,
        resultReady: true,
        errorText: ''
      });

      this.saveMatchRecord({
        mode: '无与伦比',
        title: '',
        matchDate: '',
        totalMatches: validMatches.length,
        champion: teamA > teamB ? 'A队' : (teamB > teamA ? 'B队' : '平局')
      });

      wx.showToast({ title: '结算完成', icon: 'success' });
    } finally {
      this.setData({ isEnding: false });
    }
  }
});
