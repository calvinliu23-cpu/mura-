/**
 * gameState.js
 * 單一房間的婚禮賽車遊戲狀態機。
 * 狀態流程：WAITING -> COUNTDOWN -> RACING -> FINISHED -> (reset) -> WAITING
 *
 * 設計重點：
 * - Server 是「唯一真相來源」：所有分數加總、時間計算都在後端完成，
 *   前端（大螢幕/手機）只負責顯示，避免多端不同步或作弊。
 * - players 用 Map<socketId, PlayerInfo> 儲存，離線也不刪除分數
 *   （只標記 connected=false），避免手機斷線重連分數歸零。
 */

const DEFAULT_DURATION = 90;

const DEFAULT_TEAMS = {
  A: { name: '男方親友隊', avatar: null },
  B: { name: '女方親友隊', avatar: null },
};

class GameState {
  constructor() {
    this.hardReset();
  }

  /** 完全重置，包含隊名/頭像/時長設定（伺服器剛啟動時使用） */
  hardReset() {
    this.duration = DEFAULT_DURATION;
    this.teamsConfig = JSON.parse(JSON.stringify(DEFAULT_TEAMS));
    this.softReset();
  }

  /** 局內重置：保留隊名/頭像/時長設定，只清空分數與玩家、狀態機 */
  softReset() {
    this.status = 'WAITING'; // WAITING | COUNTDOWN | RACING | FINISHED
    this.timeLeft = this.duration;
    this.startAt = null;
    this.endAt = null;
    this.players = new Map(); // socketId -> { nickname, team, clicks, connected }
    this.teamClicks = { A: 0, B: 0 };
    this.result = null;
    this._countdownTimer = null;
    this._raceTimer = null;
  }

  // ---------- 設定 ----------

  configure({ teamA, teamB, duration } = {}) {
    if (teamA) {
      if (typeof teamA.name === 'string' && teamA.name.trim()) {
        this.teamsConfig.A.name = teamA.name.trim().slice(0, 20);
      }
      if (typeof teamA.avatar === 'string') {
        this.teamsConfig.A.avatar = teamA.avatar;
      }
    }
    if (teamB) {
      if (typeof teamB.name === 'string' && teamB.name.trim()) {
        this.teamsConfig.B.name = teamB.name.trim().slice(0, 20);
      }
      if (typeof teamB.avatar === 'string') {
        this.teamsConfig.B.avatar = teamB.avatar;
      }
    }
    if (duration && Number.isFinite(duration) && duration > 0) {
      this.duration = Math.min(600, Math.max(10, Math.round(duration)));
      if (this.status === 'WAITING') {
        this.timeLeft = this.duration;
      }
    }
  }

  // ---------- 玩家加入 / 點擊 ----------

  addPlayer(socketId, nickname, team) {
    if (!['A', 'B'].includes(team)) return false;
    const clean = (nickname || '').toString().trim().slice(0, 12) || '匿名賓客';
    this.players.set(socketId, {
      nickname: clean,
      team,
      clicks: 0,
      connected: true,
    });
    return true;
  }

  markDisconnected(socketId) {
    const p = this.players.get(socketId);
    if (p) p.connected = false;
  }

  markReconnected(socketId, nickname, team) {
    // 若同一裝置重整頁面，前端會帶回 socketId? 實務上 socket.io 重連會換新 id，
    // 這裡保留介面以便未來擴充（例如用 localStorage token 對應舊分數）。
    return this.addPlayer(socketId, nickname, team);
  }

  addClicks(socketId, rawCount) {
    if (this.status !== 'RACING') return 0;
    const p = this.players.get(socketId);
    if (!p) return 0;
    // 防呆：單一批次最多接受 100 下（250ms 內狂點極限），避免異常封包灌爆
    const count = Math.max(0, Math.min(100, Math.floor(Number(rawCount) || 0)));
    if (count <= 0) return 0;
    p.clicks += count;
    this.teamClicks[p.team] += count;
    return count;
  }

  // ---------- 狀態機控制 ----------

  canStartCountdown() {
    return this.status === 'WAITING';
  }

  beginCountdown() {
    this.status = 'COUNTDOWN';
  }

  beginRace() {
    this.status = 'RACING';
    this.startAt = Date.now();
    this.endAt = this.startAt + this.duration * 1000;
    this.timeLeft = this.duration;
  }

  tick() {
    if (this.status !== 'RACING') return this.timeLeft;
    const remainMs = this.endAt - Date.now();
    this.timeLeft = Math.max(0, Math.ceil(remainMs / 1000));
    return this.timeLeft;
  }

  isTimeUp() {
    return this.status === 'RACING' && Date.now() >= this.endAt;
  }

  finish() {
    this.status = 'FINISHED';
    this.result = this.computeResult();
    return this.result;
  }

  forceReset() {
    this.softReset();
  }

  // ---------- 結算 ----------

  computeResult() {
    const a = this.teamClicks.A;
    const b = this.teamClicks.B;
    let winner = 'DRAW';
    if (a > b) winner = 'A';
    else if (b > a) winner = 'B';

    let mvp = null;
    const mvpPool = winner === 'DRAW' ? [...this.players.values()] : [...this.players.values()].filter((p) => p.team === winner);
    for (const p of mvpPool) {
      if (!mvp || p.clicks > mvp.clicks) {
        mvp = { nickname: p.nickname, team: p.team, clicks: p.clicks };
      }
    }

    return {
      winner,
      teamClicks: { ...this.teamClicks },
      teamNames: { A: this.teamsConfig.A.name, B: this.teamsConfig.B.name },
      mvp,
    };
  }

  // ---------- 輸出給前端的公開狀態 ----------

  getPublicState() {
    const counts = { A: 0, B: 0 };
    for (const p of this.players.values()) {
      if (p.connected) counts[p.team] += 1;
    }
    return {
      status: this.status,
      duration: this.duration,
      timeLeft: this.timeLeft,
      teams: {
        A: { name: this.teamsConfig.A.name, avatar: this.teamsConfig.A.avatar, clicks: this.teamClicks.A, count: counts.A },
        B: { name: this.teamsConfig.B.name, avatar: this.teamsConfig.B.avatar, clicks: this.teamClicks.B, count: counts.B },
      },
      result: this.result,
    };
  }

  getAdminState() {
    const base = this.getPublicState();
    const players = [...this.players.entries()].map(([id, p]) => ({
      id,
      nickname: p.nickname,
      team: p.team,
      clicks: p.clicks,
      connected: p.connected,
    }));
    return { ...base, players };
  }
}

module.exports = { GameState };
