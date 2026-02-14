const HISTORY_KEY = 'match_history_records';

function normalizeName(name) {
  let text = `${name || ''}`.trim();
  text = text.replace(/^[\[(（【]/, '').replace(/[\])）】]$/, '');
  text = text.replace(/^(本周擂主|本周|擂主|攻擂|挑战者|守擂)[:：]?\s*/g, '');
  text = text.replace(/\s+/g, '');
  if (text.includes('+')) text = text.split('+')[0] || '';
  return text.trim();
}

Page({
  data: {
    title: '',
    matchDate: '',
    defender: '',
    challengers: [
      { id: 1, name: '', scoreDef: '', scoreCha: '' }
    ],
    batchInputVisible: false,
    batchText: '',
    batchPlaceholder: '示例：\n擂主：张三\n攻擂:\n1、李四\n2、王五',
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
    this.setData({ defender: `${e.detail.value || ''}`.trim() });
  },

  onChallengerInput(e) {
    const { index } = e.currentTarget.dataset;
    this.setData({
      [`challengers[${index}].name`]: `${e.detail.value || ''}`.trim(),
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

  applyBatchInput() {
    const lines = `${this.data.batchText || ''}`
      .split('\n')
      .map((x) => x.trim())
      .filter(Boolean);
    if (!lines.length) {
      this.showError('请先输入批量内容');
      return;
    }

    let defender = '';
    let inChallenger = false;
    const challengers = [];

    for (let i = 0; i < lines.length; i++) {
      let line = lines[i];
      if (/^擂主/.test(line)) {
        defender = normalizeName(line.replace(/^擂主[:：]?/, ''));
        continue;
      }
      if (/^攻擂/.test(line)) {
        inChallenger = true;
        continue;
      }

      line = line
        .replace(/^[0-9]+\s*[、.．]\s*/, '')
        .replace(/^[（(]?[0-9]+[）)]\s*/, '')
        .trim();
      const name = normalizeName(line);
      if (!name) continue;

      if (!defender && !inChallenger) {
        defender = name;
      } else {
        challengers.push(name);
      }
    }

    if (!defender) {
      this.showError('未识别到擂主，请检查格式');
      return;
    }
    if (!challengers.length) {
      this.showError('未识别到攻擂者，请检查格式');
      return;
    }
    if (challengers.length > 10) {
      this.showError('攻擂者最多 10 人，请精简后重试');
      return;
    }
    if (new Set(challengers).size !== challengers.length) {
      this.showError('攻擂者存在重复，请检查');
      return;
    }
    if (challengers.includes(defender)) {
      this.showError('攻擂者不能与擂主同名');
      return;
    }

    this.setData({
      defender,
      challengers: challengers.map((name, idx) => ({
        id: idx + 1,
        name,
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
    const list = this.data.challengers;
    if (list.length >= 10) {
      this.showError('攻擂者最多 10 人');
      return;
    }
    const nextId = list.length ? list[list.length - 1].id + 1 : 1;
    this.setData({
      challengers: [...list, { id: nextId, name: '', scoreDef: '', scoreCha: '' }],
      resultReady: false,
      errorText: ''
    });
  },

  removeChallenger(e) {
    const index = Number(e.currentTarget.dataset.index);
    const next = this.data.challengers.filter((_, i) => i !== index);
    this.setData({
      challengers: next.length ? next : [{ id: 1, name: '', scoreDef: '', scoreCha: '' }],
      resultReady: false,
      errorText: ''
    });
  },

  showError(msg) {
    this.setData({ errorText: msg });
    wx.showToast({ title: msg, icon: 'none' });
  },

  validateSetup() {
    const defender = normalizeName(this.data.defender);
    if (!defender) return '请先填写擂主';
    if (!this.data.challengers.length) return '请至少设置 1 名攻擂者';
    if (this.data.challengers.length > 10) return '攻擂者最多 10 人';

    const seen = new Set();
    for (let i = 0; i < this.data.challengers.length; i++) {
      const name = normalizeName(this.data.challengers[i].name);
      if (!name) return `第 ${i + 1} 名攻擂者未填写`;
      if (name === defender) return `第 ${i + 1} 名攻擂者与擂主同名`;
      if (seen.has(name)) return `攻擂者重复：第 ${i + 1} 名`;
      seen.add(name);
    }
    return '';
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
    const error = this.validateSetup();
    if (error) {
      this.showError(error);
      return;
    }

    const defender = normalizeName(this.data.defender);
    const validMatches = this.data.challengers.filter((x) => x.scoreDef !== '' && x.scoreCha !== '');
    if (!validMatches.length) {
      this.showError('请先录入至少一场比分');
      return;
    }

    this.setData({ isEnding: true });
    try {
      const stats = {
        [defender]: { name: defender, wins: 0, losses: 0, matches: 0, pointsFor: 0, pointsAgainst: 0 }
      };

      validMatches.forEach((m) => {
        const challenger = normalizeName(m.name);
        if (!stats[challenger]) {
          stats[challenger] = { name: challenger, wins: 0, losses: 0, matches: 0, pointsFor: 0, pointsAgainst: 0 };
        }
        const sd = Number(m.scoreDef);
        const sc = Number(m.scoreCha);
        const dWin = sd > sc;
        const cWin = sc > sd;

        stats[defender].matches += 1;
        stats[defender].pointsFor += sd;
        stats[defender].pointsAgainst += sc;
        if (dWin) stats[defender].wins += 1;
        if (cWin) stats[defender].losses += 1;

        stats[challenger].matches += 1;
        stats[challenger].pointsFor += sc;
        stats[challenger].pointsAgainst += sd;
        if (cWin) stats[challenger].wins += 1;
        if (dWin) stats[challenger].losses += 1;
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
          defenderWins: stats[defender].wins,
          defenderLosses: stats[defender].losses
        },
        ranking,
        resultReady: true,
        errorText: ''
      });

      this.saveMatchRecord({
        mode: '单打攻擂赛',
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
