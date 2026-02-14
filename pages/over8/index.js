function edgeKey(a, b) {
  return [a, b].sort().join('|');
}

function shuffle(arr) {
  const list = [...arr];
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function normalizePlayers(list) {
  return (list || []).map((x) => `${x}`.trim()).filter(Boolean);
}
const HISTORY_KEY = 'match_history_records';

Page({
  data: {
    inputName: '',
    players: [],
    batchInputVisible: false,
    batchText: '',
    rounds: [],
    summary: {
      totalPlayers: 0,
      totalRounds: 0,
      totalMatches: 0
    },
    scoreMatches: [],
    resultReady: false,
    ranking: [],
    totalScoredMatches: 0,
    isEnding: false,
    errorText: ''
  },

  onNameInput(e) {
    this.setData({ inputName: e.detail.value.trim() });
  },

  addPlayer() {
    const name = this.data.inputName;
    if (!name) return;
    if (this.data.players.includes(name)) {
      this.showError('选手重名，请修改');
      return;
    }
    if (this.data.players.length >= 50) {
      this.showError('最多支持 50 人');
      return;
    }

    this.setData({
      players: [...this.data.players, name],
      inputName: '',
      errorText: '',
      rounds: [],
      scoreMatches: [],
      resultReady: false
    });
  },

  removePlayer(e) {
    const index = Number(e.currentTarget.dataset.index);
    const next = this.data.players.filter((_, i) => i !== index);
    this.setData({ players: next, rounds: [], scoreMatches: [], resultReady: false, errorText: '' });
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

    if (names.length < 9 || names.length > 50) {
      this.showError('超8转人数需在 9~50 人之间');
      return;
    }

    if (new Set(names).size !== names.length) {
      this.showError('批量导入存在重名');
      return;
    }

    this.setData({
      players: names,
      batchInputVisible: false,
      batchText: '',
      rounds: [],
      scoreMatches: [],
      resultReady: false,
      errorText: ''
    });
  },

  showError(msg) {
    this.setData({ errorText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  },

  generateSchedule() {
    const players = normalizePlayers(this.data.players);

    if (players.length < 9) {
      this.showError('至少 9 人才能使用超8转');
      return;
    }

    if (players.length > 50) {
      this.showError('最多支持 50 人');
      return;
    }

    if (new Set(players).size !== players.length) {
      this.showError('选手列表存在重名，请先处理');
      return;
    }

    const n = players.length;
    if (n - 1 < 8) {
      this.showError('人数不足以满足每人 8 个不同搭档');
      return;
    }

    let result = null;
    const retryTimes = n === 9 ? 1 : 6;
    for (let i = 0; i < retryTimes; i++) {
      const seedPlayers = i === 0 ? players : shuffle(players);
      result = n === 9 ? this.buildScheduleFor9(seedPlayers) : this.buildScheduleGeneral(seedPlayers, 8);
      if (result) break;
    }

    if (!result) {
      this.showError('未找到可行排阵，请重试');
      return;
    }

    this.setData({
      players,
      rounds: result.rounds,
      scoreMatches: this.buildScoreMatches(result.rounds),
      summary: {
        totalPlayers: n,
        totalRounds: result.rounds.length,
        totalMatches: result.rounds.length * 2
      },
      resultReady: false,
      ranking: [],
      errorText: ''
    });

    wx.showToast({ title: '超8转赛程已生成', icon: 'success' });
  },

  // 9人时可直接用“含轮空”的循环配对，保证每人8次搭档和8次出场
  buildScheduleFor9(players) {
    const bye = '__BYE__';
    const arr = [...players, bye];
    const rounds = [];
    const opponentCount = {};

    for (let round = 1; round <= players.length; round++) {
      const pairs = [];
      for (let i = 0; i < arr.length / 2; i++) {
        const a = arr[i];
        const b = arr[arr.length - 1 - i];
        if (a === bye || b === bye) continue;
        pairs.push([a, b]);
      }

      const games = this.pickBestGamePairing(pairs, opponentCount);
      if (!games) return null;

      rounds.push({
        round,
        court1: { team1: games[0][0], team2: games[0][1] },
        court2: { team1: games[1][0], team2: games[1][1] }
      });

      const fixed = arr[0];
      const rest = arr.slice(1);
      rest.unshift(rest.pop());
      const next = [fixed, ...rest];
      for (let i = 0; i < arr.length; i++) arr[i] = next[i];
    }

    return { rounds };
  },

  pickBestGamePairing(pairs, opponentCount) {
    if (pairs.length !== 4) return null;

    const patterns = [
      [[0, 1], [2, 3]],
      [[0, 2], [1, 3]],
      [[0, 3], [1, 2]]
    ];

    const scored = patterns.map((pt) => {
      const g1 = [pairs[pt[0][0]], pairs[pt[0][1]]];
      const g2 = [pairs[pt[1][0]], pairs[pt[1][1]]];
      const score =
        this.getOpponentPenaltyFromTeams(g1[0], g1[1], opponentCount) +
        this.getOpponentPenaltyFromTeams(g2[0], g2[1], opponentCount);
      return { games: [g1, g2], score };
    });

    scored.sort((a, b) => a.score - b.score || (Math.random() < 0.5 ? -1 : 1));
    const best = scored[0].games;

    this.addOpponentCount(opponentCount, best[0][0], best[0][1]);
    this.addOpponentCount(opponentCount, best[1][0], best[1][1]);

    return best;
  },

  buildScheduleGeneral(players, degree) {
    for (let attempt = 0; attempt < 260; attempt++) {
      const edges = this.buildRegularPartnerEdges(players, degree);
      if (!edges) continue;

      const games = this.buildGames(edges);
      if (!games) continue;

      const rounds = this.packToTwoCourts(games, players.length);
      if (!rounds) continue;

      return { rounds };
    }

    return null;
  },

  buildRegularPartnerEdges(players, degree) {
    for (let attempt = 0; attempt < 220; attempt++) {
      const rem = {};
      const adj = {};

      players.forEach((p) => {
        rem[p] = degree;
        adj[p] = new Set();
      });

      let ok = true;
      while (true) {
        const active = players
          .filter((p) => rem[p] > 0)
          .sort((a, b) => rem[b] - rem[a] || (Math.random() < 0.5 ? -1 : 1));

        if (!active.length) break;

        const v = active[0];
        const need = rem[v];
        const candidates = players
          .filter((u) => u !== v && rem[u] > 0 && !adj[v].has(u))
          .sort((a, b) => rem[b] - rem[a] || (Math.random() < 0.5 ? -1 : 1));

        if (candidates.length < need) {
          ok = false;
          break;
        }

        const chosen = shuffle(candidates.slice(0, Math.min(candidates.length, need + 4))).slice(0, need);
        chosen.forEach((u) => {
          adj[v].add(u);
          adj[u].add(v);
          rem[v] -= 1;
          rem[u] -= 1;
        });

        if (rem[v] < 0) {
          ok = false;
          break;
        }
      }

      if (!ok) continue;

      const edges = [];
      for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
          const a = players[i];
          const b = players[j];
          if (adj[a].has(b)) edges.push([a, b]);
        }
      }

      const expect = (players.length * degree) / 2;
      if (edges.length !== expect) continue;

      return edges;
    }

    return null;
  },

  buildGames(edges) {
    for (let attempt = 0; attempt < 240; attempt++) {
      const left = shuffle(edges).map((e) => ({ a: e[0], b: e[1], key: edgeKey(e[0], e[1]) }));
      const used = new Set();
      const opponentCount = {};
      const games = [];

      while (games.length * 2 < edges.length) {
        const first = left.find((x) => !used.has(x.key));
        if (!first) break;

        const cands = left.filter((x) => {
          if (used.has(x.key) || x.key === first.key) return false;
          const s = new Set([first.a, first.b, x.a, x.b]);
          return s.size === 4;
        });

        if (!cands.length) {
          games.length = 0;
          break;
        }

        cands.sort((x, y) => {
          const sx = this.getOpponentPenalty(first, x, opponentCount);
          const sy = this.getOpponentPenalty(first, y, opponentCount);
          return sx - sy || (Math.random() < 0.5 ? -1 : 1);
        });

        const second = cands[Math.floor(Math.random() * Math.min(4, cands.length))];

        used.add(first.key);
        used.add(second.key);

        const p1 = [first.a, first.b];
        const p2 = [second.a, second.b];
        this.addOpponentCount(opponentCount, p1, p2);

        games.push({ team1: p1, team2: p2 });
      }

      if (games.length * 2 === edges.length) return games;
    }

    return null;
  },

  getOpponentPenalty(e1, e2, opponentCount) {
    return this.getOpponentPenaltyFromTeams([e1.a, e1.b], [e2.a, e2.b], opponentCount);
  },

  getOpponentPenaltyFromTeams(p1, p2, opponentCount) {
    return (
      (opponentCount[edgeKey(p1[0], p2[0])] || 0) +
      (opponentCount[edgeKey(p1[0], p2[1])] || 0) +
      (opponentCount[edgeKey(p1[1], p2[0])] || 0) +
      (opponentCount[edgeKey(p1[1], p2[1])] || 0)
    );
  },

  addOpponentCount(opponentCount, p1, p2) {
    const keys = [
      edgeKey(p1[0], p2[0]),
      edgeKey(p1[0], p2[1]),
      edgeKey(p1[1], p2[0]),
      edgeKey(p1[1], p2[1])
    ];

    keys.forEach((k) => {
      opponentCount[k] = (opponentCount[k] || 0) + 1;
    });
  },

  packToTwoCourts(games, roundsCount) {
    for (let attempt = 0; attempt < 300; attempt++) {
      const left = shuffle(games).map((g) => ({ ...g }));
      const rounds = [];
      let ok = true;

      for (let r = 1; r <= roundsCount; r++) {
        if (left.length < 2) {
          ok = false;
          break;
        }

        const g1 = left[0];
        const idx = left.findIndex((g, i) => {
          if (i === 0) return false;
          const s = new Set([...g1.team1, ...g1.team2, ...g.team1, ...g.team2]);
          return s.size === 8;
        });

        if (idx < 0) {
          ok = false;
          break;
        }

        const g2 = left[idx];
        left.splice(idx, 1);
        left.splice(0, 1);

        rounds.push({
          round: r,
          court1: g1,
          court2: g2
        });
      }

      if (ok && rounds.length === roundsCount && left.length === 0) return rounds;
    }

    return null;
  },

  buildScoreMatches(rounds) {
    const list = [];
    rounds.forEach((r) => {
      list.push({
        id: `${r.round}-1`,
        round: r.round,
        court: 1,
        team1: r.court1.team1,
        team2: r.court1.team2,
        score1: '',
        score2: ''
      });
      list.push({
        id: `${r.round}-2`,
        round: r.round,
        court: 2,
        team1: r.court2.team1,
        team2: r.court2.team2,
        score1: '',
        score2: ''
      });
    });
    return list;
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
      title: '羽毛球超8转，智能排阵快速开赛',
      path: '/pages/over8/index'
    };
  },

  onPrimaryAction() {
    if (!this.data.rounds.length) {
      this.generateSchedule();
      return;
    }
    if (this.data.isEnding) return;
    this.endCompetition();
  },

  endCompetition() {
    if (this.data.isEnding) return;
    if (!this.data.scoreMatches.length) {
      this.showError('请先生成赛程');
      return;
    }

    const validMatches = this.data.scoreMatches.filter((m) => m.score1 !== '' && m.score2 !== '');
    if (!validMatches.length) {
      this.showError('请先录入至少一场比分');
      return;
    }

    this.setData({ isEnding: true });
    try {
      const stats = {};
      this.data.players.forEach((name) => {
        stats[name] = { name, wins: 0, losses: 0, matches: 0, pointsFor: 0, pointsAgainst: 0 };
      });

      validMatches.forEach((m) => {
        const s1 = Number(m.score1);
        const s2 = Number(m.score2);
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
        totalScoredMatches: validMatches.length,
        resultReady: true,
        errorText: ''
      });

      this.saveMatchRecord({
        mode: '超8转',
        title: '',
        matchDate: '',
        totalMatches: validMatches.length,
        champion: ranking[0] ? ranking[0].name : ''
      });

      wx.showToast({ title: '结算完成', icon: 'success' });
    } finally {
      this.setData({ isEnding: false });
    }
  }
});
