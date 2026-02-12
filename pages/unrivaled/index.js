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

Page({
  data: {
    teamSize: 5,
    scoreStep: 10,
    teamAInput: '',
    teamBInput: '',
    segments: [],
    swaps: [],
    summary: {
      targetScore: 50,
      teamSize: 5,
      scoreStep: 10
    },
    errorText: ''
  },

  increaseTeamSize() {
    if (this.data.teamSize >= 20) return;
    this.setData({ teamSize: this.data.teamSize + 1, segments: [], swaps: [], errorText: '' });
  },

  decreaseTeamSize() {
    if (this.data.teamSize <= 3) return;
    this.setData({ teamSize: this.data.teamSize - 1, segments: [], swaps: [], errorText: '' });
  },

  selectScoreStep(e) {
    const value = Number(e.currentTarget.dataset.value);
    this.setData({ scoreStep: value, segments: [], swaps: [], errorText: '' });
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
      segments,
      swaps,
      summary: {
        targetScore,
        teamSize: n,
        scoreStep: step
      },
      errorText: ''
    });

    wx.showToast({ title: '接力表已生成', icon: 'success' });
  }
});
