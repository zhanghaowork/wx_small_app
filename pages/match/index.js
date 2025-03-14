Page({
  data: {
    matches: [{
      A1: '',
      A2: '',
      B1: '',
      B2: '',
      scoreA: 0,
      scoreB: 0
    }],
    showResult: false,
    stats: {}
  },

  // 添加新对局
  addNewMatch() {
    const newMatch = {
      A1: '',
      A2: '',
      B1: '',
      B2: '',
      scoreA: 0,
      scoreB: 0
    }
    this.setData({
      matches: [...this.data.matches, newMatch]
    })
  },

  // 输入处理
  handleInput(e) {
    const { index, field } = e.currentTarget.dataset
    const value = e.detail.value
    const matches = this.data.matches
    matches[index][field] = value
    this.setData({ matches })
  },

  // 结束比赛处理
  handleEndMatch() {
    const stats = this.calculateStats()
    this.setData({
      showResult: true,
      stats
    })
  },

  // 统计计算
  calculateStats() {
    const stats = {}
    
    this.data.matches.forEach(match => {
      // 统计得分
      ;[match.A1, match.A2].forEach(player => {
        if (!player) return
        stats[player] = stats[player] || { wins: 0, total: 0 }
        stats[player].total += parseInt(match.scoreA) || 0
      })
      
      ;[match.B1, match.B2].forEach(player => {
        if (!player) return
        stats[player] = stats[player] || { wins: 0, total: 0 }
        stats[player].total += parseInt(match.scoreB) || 0
      })

      // 统计胜局
      if (parseInt(match.scoreA) > parseInt(match.scoreB)) {
        [match.A1, match.A2].forEach(player => {
          if (player) stats[player].wins++
        })
      } else if (parseInt(match.scoreB) > parseInt(match.scoreA)) {
        [match.B1, match.B2].forEach(player => {
          if (player) stats[player].wins++
        })
      }
    })
    
    return stats
  },

  // 再来一局
  handleRestart() {
    this.setData({
      matches: [{
        A1: '',
        A2: '',
        B1: '',
        B2: '',
        scoreA: 0,
        scoreB: 0
      }],
      showResult: false,
      stats: {}
    })
  },

  // 退出
  handleExit() {
    wx.navigateBack()
  }
})