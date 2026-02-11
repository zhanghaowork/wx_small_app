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

function pickRandom(list, count) {
  return shuffle(list).slice(0, count);
}

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
      rounds: []
    });
  },

  removePlayer(e) {
    const index = Number(e.currentTarget.dataset.index);
    const next = this.data.players.filter((_, i) => i !== index);
    this.setData({ players: next, rounds: [], errorText: '' });
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
      errorText: ''
    });
  },

  showError(msg) {
    this.setData({ errorText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  },

  generateSchedule() {
    const players = this.data.players;
    if (players.length < 9) {
      this.showError('至少 9 人才能使用超8转');
      return;
    }

    const n = players.length;
    if (n - 1 < 8) {
      this.showError('人数不足以满足每人 8 个不同搭档');
      return;
    }

    const result = this.buildSchedule(players, 8);
    if (!result) {
      this.showError('未找到可行排阵，请重试');
      return;
    }

    this.setData({
      rounds: result.rounds,
      summary: {
        totalPlayers: n,
        totalRounds: result.rounds.length,
        totalMatches: result.rounds.length * 2
      },
      errorText: ''
    });

    wx.showToast({ title: '超8转赛程已生成', icon: 'success' });
  },

  buildSchedule(players, degree) {
    for (let attempt = 0; attempt < 220; attempt++) {
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
    for (let attempt = 0; attempt < 180; attempt++) {
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

        const chosen = pickRandom(candidates.slice(0, Math.min(candidates.length, need + 3)), need);
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
    for (let attempt = 0; attempt < 200; attempt++) {
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
    const p1 = [e1.a, e1.b];
    const p2 = [e2.a, e2.b];
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
    for (let attempt = 0; attempt < 240; attempt++) {
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
  }
});
