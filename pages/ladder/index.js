const HISTORY_KEY = 'match_history_records';

function pairKey(a, b) {
  return [a, b].sort().join('|');
}

function normalizePlayerName(name) {
  let text = `${name || ''}`.trim();
  text = text.replace(/^[\[(（【]/, '').replace(/[\])）】]$/, '');
  text = text.replace(/^(本周擂主|本周|擂主|攻擂|挑战者|守擂)[:：]?\s*/g, '');
  text = text.replace(/\s+/g, '');
  return text;
}

Page({
  data: {
    title: '',
    matchDate: '',
    defender: { p1: '', p2: '' },
    challengers: [
      { id: 1, p1: '', p2: '', scoreDef: '', scoreCha: '' }
    ],
    batchInputVisible: false,
    batchText: '',
    batchPlaceholder: '示例：\n擂主：张三+李四\n攻擂:\n1、王五+赵六\n2、孙七+周八',
    resultReady: false,
    settlement: {
      totalMatches: 0,
      defenderWins: 0,
      defenderLosses: 0
    },
    ranking: [],
    isEnding: false,
    errorText: ''
  },

  onLoad() {
    this.setData({ matchDate: this.formatDate(new Date()) });
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

  onDefenderInput(e) {
    const { field } = e.currentTarget.dataset;
    this.setData({ [`defender.${field}`]: `${e.detail.value || ''}`.trim() });
  },

  onChallengerInput(e) {
    const { index, field } = e.currentTarget.dataset;
    this.setData({
      [`challengers[${index}].${field}`]: `${e.detail.value || ''}`.trim(),
      resultReady: false,
      errorText: ''
    });
  },

  onScoreInput(e) {
    const { index, field } = e.currentTarget.dataset;
    const value = `${e.detail.value || ''}`.replace(/[^\d]/g, '').slice(0, 3);
    this.setData({
      [`challengers[${index}].${field}`]: value,
      resultReady: false
    });
  },

  showBatchInput() {
    this.setData({ batchInputVisible: true });
  },

  hideBatchInput() {
    this.setData({ batchInputVisible: false, batchText: '' });
  },

  onBatchTextInput(e) {
    this.setData({ batchText: e.detail.value || '' });
  },

  splitPair(text) {
    const normalized = `${text || ''}`
      .replace(/[：:]/g, '')
      .replace(/[，、]/g, ',')
      .replace(/\s+/g, '')
      .trim();
    if (!normalized) return null;
    const m = normalized.match(/^([^+,]+)\+([^+,]+)$/);
    if (!m) return null;
    const p1 = normalizePlayerName(m[1]);
    const p2 = normalizePlayerName(m[2]);
    if (!p1 || !p2) return null;
    if (p1 === p2) return null;
    return { p1, p2 };
  },

  applyBatchInput() {
    const raw = `${this.data.batchText || ''}`;
    const lines = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    if (!lines.length) {
      this.showError('请先输入批量内容');
      return;
    }

    let defenderPair = null;
    const challengerPairs = [];
    let inChallenger = false;

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (!line) continue;

      if (/^攻擂/.test(line)) {
        inChallenger = true;
        continue;
      }

      line = line
        .replace(/^[0-9]+\s*[、.．]\s*/, '')
        .replace(/^[（(]?[0-9]+[）)]\s*/, '')
        .trim();

      const pair = this.splitPair(line);
      if (!pair) continue;

      if (!defenderPair && !inChallenger) {
        defenderPair = pair;
      } else {
        challengerPairs.push(pair);
      }
    }

    if (!defenderPair) {
      this.showError('未识别到擂主组合，请检查格式');
      return;
    }
    if (!challengerPairs.length) {
      this.showError('未识别到攻擂组合，请检查格式');
      return;
    }
    if (challengerPairs.length > 10) {
      this.showError('攻擂组合最多 10 组，请精简后重试');
      return;
    }

    const defenderKey = pairKey(defenderPair.p1, defenderPair.p2);
    const seen = new Set();
    for (let i = 0; i < challengerPairs.length; i++) {
      const p = challengerPairs[i];
      const key = pairKey(p.p1, p.p2);
      if (key === defenderKey) {
        this.showError(`第 ${i + 1} 组攻擂与擂主组合重复`);
        return;
      }
      if (seen.has(key)) {
        this.showError(`攻擂组合重复：第 ${i + 1} 组`);
        return;
      }
      seen.add(key);
    }

    this.setData({
      defender: defenderPair,
      challengers: challengerPairs.map((p, idx) => ({
        id: idx + 1,
        p1: p.p1,
        p2: p.p2,
        scoreDef: '',
        scoreCha: ''
      })),
      batchInputVisible: false,
      batchText: '',
      resultReady: false,
      errorText: ''
    });

    wx.showToast({ title: '批量导入成功', icon: 'success' });
  },

  addChallenger() {
    const { challengers } = this.data;
    if (challengers.length >= 10) {
      this.showError('攻擂组合最多 10 组');
      return;
    }
    const nextId = challengers.length ? challengers[challengers.length - 1].id + 1 : 1;
    this.setData({
      challengers: [...challengers, { id: nextId, p1: '', p2: '', scoreDef: '', scoreCha: '' }],
      resultReady: false,
      errorText: ''
    });
  },

  removeChallenger(e) {
    const index = Number(e.currentTarget.dataset.index);
    const next = this.data.challengers.filter((_, i) => i !== index);
    this.setData({
      challengers: next.length ? next : [{ id: 1, p1: '', p2: '', scoreDef: '', scoreCha: '' }],
      resultReady: false,
      errorText: ''
    });
  },

  showError(msg) {
    this.setData({ errorText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  },

  validateSetup() {
    const { defender, challengers } = this.data;
    const d1 = defender.p1.trim();
    const d2 = defender.p2.trim();
    if (!d1 || !d2) return '请先填写擂主组合两位选手';
    if (d1 === d2) return '擂主组合不能是同一人';

    if (!challengers.length) return '请至少设置 1 组攻擂组合';
    if (challengers.length > 10) return '攻擂组合最多 10 组';

    const seen = new Set();
    const defenderKey = pairKey(d1, d2);

    for (let i = 0; i < challengers.length; i++) {
      const row = challengers[i];
      const c1 = normalizePlayerName(row.p1);
      const c2 = normalizePlayerName(row.p2);
      if (!c1 || !c2) return `第 ${i + 1} 组攻擂组合未填写完整`;
      if (c1 === c2) return `第 ${i + 1} 组攻擂组合不能是同一人`;
      const key = pairKey(c1, c2);
      if (key === defenderKey) return `第 ${i + 1} 组与擂主组合重复`;
      if (seen.has(key)) return `攻擂组合存在重复：第 ${i + 1} 组`;
      seen.add(key);
    }
    return '';
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

  onPrimaryAction() {
    if (this.data.isEnding) return;
    this.endCompetition();
  },

  endCompetition() {
    if (this.data.isEnding) return;
    const error = this.validateSetup();
    if (error) {
      this.showError(error);
      return;
    }

    const validMatches = this.data.challengers.filter((x) => x.scoreDef !== '' && x.scoreCha !== '');
    if (!validMatches.length) {
      this.showError('请先录入至少一场比分');
      return;
    }

    this.setData({ isEnding: true });
    try {
      const d1 = this.data.defender.p1.trim();
      const d2 = this.data.defender.p2.trim();
      const defenderKey = pairKey(d1, d2);
      const stats = {
        [defenderKey]: {
          name: `${d1}/${d2}`,
          wins: 0,
          losses: 0,
          matches: 0,
          pointsFor: 0,
          pointsAgainst: 0
        }
      };

      validMatches.forEach((m) => {
        const c1 = m.p1.trim();
        const c2 = m.p2.trim();
        const cKey = pairKey(c1, c2);
        if (!stats[cKey]) {
          stats[cKey] = {
            name: `${c1}/${c2}`,
            wins: 0,
            losses: 0,
            matches: 0,
            pointsFor: 0,
            pointsAgainst: 0
          };
        }

        const sDef = Number(m.scoreDef);
        const sCha = Number(m.scoreCha);
        const defenderWin = sDef > sCha;
        const challengerWin = sCha > sDef;

        stats[defenderKey].matches += 1;
        stats[defenderKey].pointsFor += sDef;
        stats[defenderKey].pointsAgainst += sCha;
        if (defenderWin) stats[defenderKey].wins += 1;
        if (challengerWin) stats[defenderKey].losses += 1;

        stats[cKey].matches += 1;
        stats[cKey].pointsFor += sCha;
        stats[cKey].pointsAgainst += sDef;
        if (challengerWin) stats[cKey].wins += 1;
        if (defenderWin) stats[cKey].losses += 1;
      });

      const ranking = Object.values(stats)
        .map((s) => ({
          ...s,
          diff: s.pointsFor - s.pointsAgainst,
          winRate: s.matches ? Math.round((s.wins / s.matches) * 100) : 0
        }))
        .sort((a, b) => b.wins - a.wins || b.diff - a.diff || b.pointsFor - a.pointsFor);

      const defenderStats = stats[defenderKey];
      this.setData({
        settlement: {
          totalMatches: validMatches.length,
          defenderWins: defenderStats.wins,
          defenderLosses: defenderStats.losses
        },
        ranking,
        resultReady: true,
        errorText: ''
      });

      this.saveMatchRecord({
        mode: '固搭擂台赛',
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
