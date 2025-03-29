// index.js
Page({
  data: {
    inputName: "",
    players: [],
    matches: [],
    generating: false,
    statusMessage: "",
    lastGenerated: 0,
    showStats: false,
    playerStats: []
  },

  onLoad() {
    const saved = wx.getStorageSync('matchData');
    if (saved) {
      this.setData({
        players: saved.players || [],
        matches: saved.matches || []
      });
    }
  },

  onNameInput(e) {
    this.setData({ inputName: e.detail.value.trim() });
  },

  addPlayer() {
    const name = this.data.inputName;
    if (!name) {
      this.setData({ statusMessage: "请输入选手姓名" });
      return;
    }
    if (name.length < 2 || name.length > 4) {
      this.setData({ statusMessage: "姓名需2-4个字符" });
      return;
    }
    if (this.data.players.length >= 9) {
      this.setData({ statusMessage: "最多9位选手" });
      return;
    }
    if (this.data.players.includes(name)) {
      this.setData({ statusMessage: "选手已存在" });
      return;
    }

    this.setData({
      players: [...this.data.players, name],
      inputName: "",
      matches: [],
      statusMessage: `已添加选手：${name}`,
      showStats: false
    }, this.saveData);
  },

  deletePlayer(e) {
    const index = e.currentTarget.dataset.index;
    const newPlayers = this.data.players.filter((_, i) => i !== index);
    const deletedName = this.data.players[index];
    
    this.setData({
      players: newPlayers,
      matches: [],
      statusMessage: `已删除选手：${deletedName}`,
      showStats: false
    }, this.saveData);
  },

  onScoreInput(e) {
    const { index } = e.currentTarget.dataset;
    let value = e.detail.value;
    
    // 比分格式验证
    if (value && !/^\d+-\d+$/.test(value)) {
      wx.showToast({ title: '请输入正确比分格式', icon: 'none' });
      return;
    }

    this.setData({
      [`matches[${index}].score`]: value
    }, this.saveData);
  },

  async generateMatches() {
    const n = this.data.players.length;
    if (n < 5 || n > 9) {
      this.setData({ statusMessage: "选手人数需在5-9人之间" });
      return;
    }
    if (Date.now() - this.data.lastGenerated < 1000) return;

    this.setData({ 
      generating: true,
      statusMessage: "比赛生成中...",
      lastGenerated: Date.now(),
      showStats: false
    });

    try {
      const config = this.getMatchConfig(n);
      const matches = n === 9 ? this.generate9PlayerMatches() : this.generateStandardMatches(n, config);
      
      this.setData({
        matches: matches,
        statusMessage: `成功生成${matches.length}场比赛`
      });
    } catch (e) {
      console.error("生成失败:", e);
      this.setData({ 
        matches: [],
        statusMessage: `生成失败：${e.message}`
      });
    } finally {
      this.setData({ generating: false });
      this.saveData();
    }
  },

  // 9人专用生成算法
  generate9PlayerMatches() {
    const players = this.data.players;
    if (players.length !== 9) throw new Error("必须正好9位选手");
    
    const allPairs = this.generateAllPairs(players);
    const matches = [];
    const usedPairs = new Set();

    // 固定生成18场比赛
    for (let i = 0; i < 18; i++) {
      // 获取所有未使用的有效配对组合
      const available = allPairs.filter(pair => !usedPairs.has(pair.join(',')));
      
      if (available.length < 2) {
        throw new Error(`无法生成第${i+1}场比赛，可用配对不足`);
      }

      // 随机选择第一个配对
      const pair1 = available[Math.floor(Math.random() * available.length)];
      
      // 寻找能与pair1配对的第二个配对
      const pair2 = available.find(p => 
        p !== pair1 && 
        new Set([...pair1, ...p]).size === 4
      );

      if (!pair2) {
        throw new Error(`无法为${pair1.join('+')}找到合适对手`);
      }

      usedPairs.add(pair1.join(','));
      usedPairs.add(pair2.join(','));
      
      matches.push({
        number: i + 1,
        team1: pair1.join(' & '),
        team2: pair2.join(' & '),
        remark: `第${i+1}场`,
        score: ""
      });
    }

    return matches;
  },

  // 标准生成算法（5-8人）
  generateStandardMatches(n, config) {
    const players = this.data.players;
    const allPairs = this.generateAllPairs(players);
    const pairPool = allPairs.map(pair => ({
      key: pair.join('&'),
      players: pair,
      used: 0,
      maxUsage: config.repeats
    }));

    const matches = [];
    let totalAttempts = 0;
    const MAX_ATTEMPTS = 10000;

    while (matches.length < config.totalMatches && totalAttempts < MAX_ATTEMPTS) {
      // 优先选择使用次数最少的配对
      pairPool.sort((a, b) => a.used - b.used);
      
      // 尝试前5个最少使用的配对
      const candidatePairs = pairPool.slice(0, 5).filter(p => p.used < p.maxUsage);
      
      let found = false;
      for (let i = 0; i < candidatePairs.length && !found; i++) {
        const pair1 = candidatePairs[i];
        
        // 寻找能与pair1配对的pair2
        const pair2 = pairPool.find(p => 
          p !== pair1 &&
          p.used < p.maxUsage &&
          new Set([...pair1.players, ...p.players]).size === 4
        );

        if (pair2) {
          pair1.used++;
          pair2.used++;
          matches.push(this.createMatchItem(
            [pair1.players, pair2.players],
            matches.length + 1
          ));
          found = true;
        }
      }
      
      if (!found) break;
      totalAttempts++;
    }

    if (matches.length < config.totalMatches) {
      throw new Error(`仅生成${matches.length}/${config.totalMatches}场比赛`);
    }

    return matches;
  },

  // 结束比赛并统计
  endTournament() {
    if (this.data.matches.length === 0) {
      wx.showToast({ title: '没有可统计的比赛', icon: 'none' });
      return;
    }

    // 统计有比分的比赛场次
    const validMatches = this.data.matches.filter(m => m.score);
    if (validMatches.length === 0) {
      wx.showToast({ title: '请先录入比赛比分', icon: 'none' });
      return;
    }

    const stats = {};
    this.data.players.forEach(player => {
      stats[player] = {
        wins: 0,
        totalPoints: 0,
        matches: 0
      };
    });

    // 统计每场比赛
    validMatches.forEach(match => {
      const [score1, score2] = match.score.split('-').map(Number);
      const team1Players = match.team1.split(' & ');
      const team2Players = match.team2.split(' & ');

      // 更新选手数据
      team1Players.forEach(player => {
        stats[player].matches++;
        stats[player].totalPoints += score1;
        if (score1 > score2) stats[player].wins++;
      });

      team2Players.forEach(player => {
        stats[player].matches++;
        stats[player].totalPoints += score2;
        if (score2 > score1) stats[player].wins++;
      });
    });

    // 转换为数组并排序
    const sortedStats = Object.keys(stats).map(name => ({
      name,
      wins: stats[name].wins,
      totalPoints: stats[name].totalPoints,
      winRate: stats[name].matches > 0 
        ? (stats[name].wins / stats[name].matches * 100).toFixed(1) 
        : '0.0'
    })).sort((a, b) => {
      // 先按胜场数，再按总得分
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.totalPoints - a.totalPoints;
    });

    this.setData({
      showStats: true,
      playerStats: sortedStats,
      statusMessage: `已统计${validMatches.length}场有效比赛`
    });
  },

  // 返回比赛界面
  backToMatches() {
    this.setData({ showStats: false });
  },

  // 辅助方法
  getMatchConfig(n) {
    return {
      5: { totalMatches: 15, repeats: 3 },
      6: { totalMatches: 15, repeats: 2 },
      7: { totalMatches: 21, repeats: 2 },
      8: { totalMatches: 14, repeats: 1 },
      9: { totalMatches: 18, repeats: 1 }
    }[n];
  },

  generateAllPairs(players) {
    const pairs = [];
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        pairs.push([players[i], players[j]]);
      }
    }
    return pairs;
  },

  createMatchItem([pair1, pair2], number) {
    return {
      number,
      team1: pair1.join(' & '),
      team2: pair2.join(' & '),
      remark: `第${number}场`,
      score: ""
    };
  },

  saveData() {
    wx.setStorageSync('matchData', {
      players: this.data.players,
      matches: this.data.matches
    });
  },

  resetAll() {
    this.setData({
      players: [],
      matches: [],
      inputName: "",
      statusMessage: "已重置所有数据",
      showStats: false,
      playerStats: []
    });
    wx.removeStorageSync('matchData');
  }
});