const SCHEDULE_RULES = {
  4: [{ perPlayer: 3, rounds: 3 }],
  5: [{ perPlayer: 4, rounds: 5 }],
  6: [
    { perPlayer: 4, rounds: 6 },
    { perPlayer: 6, rounds: 9 },
    { perPlayer: 10, rounds: 15 }
  ],
  7: [
    { perPlayer: 8, rounds: 14 },
    { perPlayer: 12, rounds: 21 }
  ],
  8: [{ perPlayer: 7, rounds: 14 }]
};

const TEAM_REPEAT_WEIGHT = 9;
const OPP_REPEAT_WEIGHT = 3;
const REST_STREAK_WEIGHT = 3;
const QUOTA_DISTANCE_WEIGHT = 3;

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

Page({
  data: {
    title: '',
    matchDate: '',
    players: [
      { id: 1, name: '', gender: 'M' },
      { id: 2, name: '', gender: 'M' },
      { id: 3, name: '', gender: 'M' },
      { id: 4, name: '', gender: 'M' }
    ],
    scheduleOptions: [],
    selectedOptionIndex: 0,
    batchInputVisible: false,
    batchText: '',
    schedule: [],
    summary: {
      teammateRepeats: 0,
      opponentRepeats: 0,
      rounds: 0,
      perPlayer: 0
    },
    resultReady: false,
    ranking: [],
    totalScoredMatches: 0,
    errorText: ''
  },

  onLoad() {
    const today = this.formatDate(new Date());
    this.setData({ matchDate: today });
    this.syncScheduleOptions();
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, '0');
    const d = `${date.getDate()}`.padStart(2, '0');
    return `${y}-${m}-${d}`;
  },

  onTitleInput(e) {
    this.setData({ title: e.detail.value });
  },

  onDateChange(e) {
    this.setData({ matchDate: e.detail.value });
  },

  onPlayerNameInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ [`players[${index}].name`]: e.detail.value.trim() });
  },

  toggleGender(e) {
    const index = Number(e.currentTarget.dataset.index);
    const current = this.data.players[index].gender;
    this.setData({ [`players[${index}].gender`]: current === 'M' ? 'F' : 'M' });
  },

  addPlayer() {
    const { players } = this.data;
    if (players.length >= 8) {
      this.showError('最多支持 8 名选手');
      return;
    }
    const nextId = players.length ? players[players.length - 1].id + 1 : 1;
    this.setData({
      players: [...players, { id: nextId, name: '', gender: 'M' }],
      errorText: '',
      schedule: [],
      resultReady: false,
      ranking: []
    }, this.syncScheduleOptions);
  },

  removePlayer(e) {
    const index = Number(e.currentTarget.dataset.index);
    if (this.data.players.length <= 4) {
      this.showError('至少保留 4 名选手');
      return;
    }

    const next = this.data.players.filter((_, i) => i !== index);
    this.setData({ players: next, errorText: '', schedule: [], resultReady: false, ranking: [] }, this.syncScheduleOptions);
  },

  showBatchInput() {
    this.setData({ batchInputVisible: true });
  },

  hideBatchInput() {
    this.setData({ batchInputVisible: false, batchText: '' });
  },

  onBatchTextInput(e) {
    this.setData({ batchText: e.detail.value });
  },

  applyBatchInput() {
    const names = (this.data.batchText || '')
      .split(/[\n,，、;；\s]+/)
      .map((x) => x.trim())
      .filter(Boolean);

    if (names.length < 4 || names.length > 8) {
      this.showError('批量导入后人数需在 4-8 之间');
      return;
    }

    if (new Set(names).size !== names.length) {
      this.showError('批量导入中包含重名，请检查');
      return;
    }

    const players = names.map((name, idx) => ({ id: idx + 1, name, gender: 'M' }));
    this.setData({
      players,
      batchInputVisible: false,
      batchText: '',
      errorText: '',
      schedule: [],
      resultReady: false,
      ranking: []
    }, this.syncScheduleOptions);
  },

  syncScheduleOptions() {
    const n = this.data.players.length;
    const options = (SCHEDULE_RULES[n] || []).map((item) => ({
      ...item,
      text: `每人${item.perPlayer}场，共${item.rounds}场`
    }));

    this.setData({
      scheduleOptions: options,
      selectedOptionIndex: 0
    });
  },

  selectRule(e) {
    const index = Number(e.currentTarget.dataset.index);
    this.setData({ selectedOptionIndex: index, schedule: [], resultReady: false, ranking: [] });
  },

  showError(msg) {
    this.setData({ errorText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  },

  validatePlayers() {
    const names = this.data.players.map((p) => p.name.trim());
    if (names.length < 4 || names.length > 8) {
      return '人数需在 4-8 人之间';
    }

    for (let i = 0; i < names.length; i++) {
      if (!names[i]) return `第 ${i + 1} 名选手姓名未填写`;
    }

    if (new Set(names).size !== names.length) {
      return '存在重名，请修改后再生成';
    }

    if (!this.data.scheduleOptions.length) {
      return '当前人数没有可用场次规则';
    }

    return '';
  },

  generateCompetition() {
    const error = this.validatePlayers();
    if (error) {
      this.showError(error);
      return;
    }

    const names = this.data.players.map((p) => p.name.trim());
    const rule = this.data.scheduleOptions[this.data.selectedOptionIndex];
    const result = this.createSchedule(names, rule.rounds, rule.perPlayer);

    if (!result.matches.length) {
      this.showError('本次未找到可行排阵，请重试');
      return;
    }

    this.setData({
      schedule: result.matches.map((m) => ({ ...m, score1: '', score2: '' })),
      summary: {
        teammateRepeats: result.teammateRepeats,
        opponentRepeats: result.opponentRepeats,
        rounds: rule.rounds,
        perPlayer: rule.perPlayer
      },
      resultReady: false,
      ranking: [],
      errorText: ''
    });

    wx.showToast({ title: '已生成比赛', icon: 'success' });
  },

  createSchedule(players, rounds, perPlayer) {
    const allCandidates = this.buildCandidates(players);
    if (!allCandidates.length) {
      return { matches: [], teammateRepeats: 0, opponentRepeats: 0 };
    }

    let best = null;
    const tries = 280;

    for (let i = 0; i < tries; i++) {
      const attempt = this.runGreedy(players, rounds, perPlayer, allCandidates);
      if (!attempt) continue;
      if (!best || attempt.totalPenalty < best.totalPenalty) {
        best = attempt;
      }
    }

    if (!best) return { matches: [], teammateRepeats: 0, opponentRepeats: 0 };

    return {
      matches: best.matches,
      teammateRepeats: best.teammateRepeats,
      opponentRepeats: best.opponentRepeats
    };
  },

  buildCandidates(players) {
    const candidates = [];
    for (let a = 0; a < players.length; a++) {
      for (let b = a + 1; b < players.length; b++) {
        for (let c = b + 1; c < players.length; c++) {
          for (let d = c + 1; d < players.length; d++) {
            const g = [players[a], players[b], players[c], players[d]];
            candidates.push({ p1: [g[0], g[1]], p2: [g[2], g[3]], all: g });
            candidates.push({ p1: [g[0], g[2]], p2: [g[1], g[3]], all: g });
            candidates.push({ p1: [g[0], g[3]], p2: [g[1], g[2]], all: g });
          }
        }
      }
    }
    return candidates;
  },

  runGreedy(players, rounds, perPlayer, allCandidates) {
    const playCount = {};
    const restStreak = {};
    const teammateCount = {};
    const opponentCount = {};
    const target = {};

    players.forEach((p) => {
      playCount[p] = 0;
      restStreak[p] = 0;
      target[p] = perPlayer;
    });

    const matches = [];

    for (let round = 1; round <= rounds; round++) {
      const remainingRounds = rounds - round;
      const feasible = allCandidates.filter((cand) =>
        this.isCandidateFeasible(cand, players, playCount, target, remainingRounds)
      );

      if (!feasible.length) return null;

      const scored = feasible.map((cand) => ({
        cand,
        score: this.evaluateCandidate(cand, players, playCount, restStreak, teammateCount, opponentCount, target)
      }));

      scored.sort((a, b) => a.score - b.score);
      const pool = scored.slice(0, Math.min(10, scored.length));
      const pick = pool[Math.floor(Math.random() * pool.length)].cand;

      const [t1a, t1b] = pick.p1;
      const [t2a, t2b] = pick.p2;

      this.addCount(teammateCount, pairKey(t1a, t1b));
      this.addCount(teammateCount, pairKey(t2a, t2b));

      this.addCount(opponentCount, pairKey(t1a, t2a));
      this.addCount(opponentCount, pairKey(t1a, t2b));
      this.addCount(opponentCount, pairKey(t1b, t2a));
      this.addCount(opponentCount, pairKey(t1b, t2b));

      pick.all.forEach((p) => {
        playCount[p] += 1;
        restStreak[p] = 0;
      });

      players.forEach((p) => {
        if (!pick.all.includes(p)) restStreak[p] += 1;
      });

      matches.push({
        round,
        team1: [t1a, t1b],
        team2: [t2a, t2b],
        rests: players.filter((p) => !pick.all.includes(p))
      });
    }

    const exact = players.every((p) => playCount[p] === target[p]);
    if (!exact) return null;

    const teammateRepeats = this.countRepeats(teammateCount);
    const opponentRepeats = this.countRepeats(opponentCount);
    const totalPenalty = teammateRepeats * 14 + opponentRepeats * 4;

    return { matches, teammateRepeats, opponentRepeats, totalPenalty };
  },

  isCandidateFeasible(cand, players, playCount, target, remainingRounds) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      const add = cand.all.includes(p) ? 1 : 0;
      const after = playCount[p] + add;
      const needAfter = target[p] - after;

      if (after > target[p]) return false;
      if (needAfter < 0) return false;
      if (needAfter > remainingRounds) return false;
    }
    return true;
  },

  evaluateCandidate(cand, players, playCount, restStreak, teammateCount, opponentCount, target) {
    const [t1a, t1b] = cand.p1;
    const [t2a, t2b] = cand.p2;

    const teamRepeat =
      this.readCount(teammateCount, pairKey(t1a, t1b)) +
      this.readCount(teammateCount, pairKey(t2a, t2b));

    const oppRepeat =
      this.readCount(opponentCount, pairKey(t1a, t2a)) +
      this.readCount(opponentCount, pairKey(t1a, t2b)) +
      this.readCount(opponentCount, pairKey(t1b, t2a)) +
      this.readCount(opponentCount, pairKey(t1b, t2b));

    let restPenalty = 0;
    let quotaDistance = 0;

    players.forEach((p) => {
      const playNext = playCount[p] + (cand.all.includes(p) ? 1 : 0);
      quotaDistance += Math.abs(target[p] - playNext);
      if (!cand.all.includes(p)) {
        restPenalty += restStreak[p] * restStreak[p];
      }
    });

    return (
      teamRepeat * TEAM_REPEAT_WEIGHT +
      oppRepeat * OPP_REPEAT_WEIGHT +
      restPenalty * REST_STREAK_WEIGHT +
      quotaDistance * QUOTA_DISTANCE_WEIGHT
    );
  },

  readCount(map, key) {
    return map[key] || 0;
  },

  addCount(map, key) {
    map[key] = (map[key] || 0) + 1;
  },

  countRepeats(map) {
    return Object.keys(map).reduce((sum, key) => {
      const v = map[key];
      return sum + (v > 1 ? v - 1 : 0);
    }, 0);
  },

  onScoreInput(e) {
    const index = Number(e.currentTarget.dataset.index);
    const team = Number(e.currentTarget.dataset.team);
    const raw = `${e.detail.value || ''}`.replace(/[^\d]/g, '').slice(0, 3);
    const key = team === 1 ? 'score1' : 'score2';
    this.setData({
      [`schedule[${index}].${key}`]: raw,
      resultReady: false
    });
  },

  handlePrint() {
    wx.showToast({ title: '打印功能待接入', icon: 'none' });
  },

  handleShare() {
    wx.showToast({ title: '转发功能待接入', icon: 'none' });
  },

  onPrimaryAction() {
    if (!this.data.schedule.length) {
      this.generateCompetition();
      return;
    }
    this.endCompetition();
  },

  endCompetition() {
    if (!this.data.schedule.length) {
      this.showError('请先生成赛程');
      return;
    }

    const validMatches = this.data.schedule.filter((m) => m.score1 !== '' && m.score2 !== '');
    if (!validMatches.length) {
      this.showError('请先录入至少一场比分');
      return;
    }

    const stats = {};
    const names = this.data.players.map((p) => p.name.trim()).filter(Boolean);
    names.forEach((name) => {
      stats[name] = { name, wins: 0, losses: 0, matches: 0, pointsFor: 0, pointsAgainst: 0 };
    });

    validMatches.forEach((m) => {
      const s1 = Number(m.score1);
      const s2 = Number(m.score2);
      const team1 = m.team1;
      const team2 = m.team2;
      const team1Win = s1 > s2;
      const team2Win = s2 > s1;

      team1.forEach((p) => {
        if (!stats[p]) return;
        stats[p].matches += 1;
        stats[p].pointsFor += s1;
        stats[p].pointsAgainst += s2;
        if (team1Win) stats[p].wins += 1;
        if (team2Win) stats[p].losses += 1;
      });

      team2.forEach((p) => {
        if (!stats[p]) return;
        stats[p].matches += 1;
        stats[p].pointsFor += s2;
        stats[p].pointsAgainst += s1;
        if (team2Win) stats[p].wins += 1;
        if (team1Win) stats[p].losses += 1;
      });
    });

    const ranking = Object.values(stats)
      .map((s) => ({
        ...s,
        diff: s.pointsFor - s.pointsAgainst,
        winRate: s.matches ? Math.round((s.wins / s.matches) * 100) : 0
      }))
      .sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pointsFor - a.pointsFor);

    this.setData({
      ranking,
      totalScoredMatches: validMatches.length,
      resultReady: true,
      errorText: ''
    });

    wx.showToast({ title: '结算完成', icon: 'success' });
  }
});
