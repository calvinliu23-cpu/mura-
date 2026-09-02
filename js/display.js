/**
 * display.js — 婚禮大螢幕端
 *
 * 賽車位置演算法（重點）：
 *   車子在跑道上的左邊界百分比 = clicks / dynamicMax * TRACK_MAX_PERCENT
 *   其中 dynamicMax 會隨著「目前領先隊伍的點擊數」動態調整（並設一個最低基準），
 *   讓比賽在任何規模（10人玩 vs 500人玩）下，視覺上都會有「你追我趕、直到最後一刻才分出勝負」
 *   的效果，同時仍然完全依照「兩隊點擊數的相對比例」推進，符合按比例動態移動的需求。
 */

const socket = io();
socket.emit('display:join');

const TRACK_MAX_PERCENT = 88; // 車頭最多推進到跑道的 88%（保留車身寬度與終點旗）
const MIN_DYNAMIC_MAX = 30; // 比賽剛開始時避免除以很小的數字，車子亂衝

let currentStatus = 'WAITING';

const stages = {
  waiting: document.getElementById('stage-waiting'),
  countdown: document.getElementById('stage-countdown'),
  racing: document.getElementById('stage-racing'),
  finished: document.getElementById('stage-finished'),
};

function showStage(name) {
  Object.values(stages).forEach((el) => el.classList.add('hidden'));
  stages[name].classList.remove('hidden');
}

// ---------------- QR Code ----------------
function setupJoinUrl() {
  const url = `${location.origin}/`;
  document.getElementById('joinUrl').textContent = url;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(url)}`;
  document.getElementById('qrImage').src = qrSrc;
}
setupJoinUrl();

// ---------------- 狀態同步 ----------------
socket.on('state:update', (state) => {
  currentStatus = state.status;

  // 隊名/頭像/人數（等待畫面 + 比賽中皆更新，避免中途改名不同步）
  document.getElementById('waitNameA').textContent = state.teams.A.name;
  document.getElementById('waitNameB').textContent = state.teams.B.name;
  document.getElementById('waitCountA').textContent = state.teams.A.count;
  document.getElementById('waitCountB').textContent = state.teams.B.count;
  document.getElementById('raceNameA').textContent = state.teams.A.name;
  document.getElementById('raceNameB').textContent = state.teams.B.name;

  applyAvatar('A', state.teams.A.avatar);
  applyAvatar('B', state.teams.B.avatar);

  if (state.status === 'WAITING') {
    showStage('waiting');
  } else if (state.status === 'RACING') {
    showStage('racing');
    document.getElementById('raceTimer').textContent = state.timeLeft;
    document.getElementById('raceClicksA').textContent = state.teams.A.clicks;
    document.getElementById('raceClicksB').textContent = state.teams.B.clicks;
    updateKartPosition('A', state.teams.A.clicks, state.teams.B.clicks);
    updateKartPosition('B', state.teams.B.clicks, state.teams.A.clicks);
  } else if (state.status === 'FINISHED' && state.result) {
    renderFinished(state.result);
  }
});

function applyAvatar(team, avatarUrl) {
  const waitEl = document.getElementById(`waitAvatar${team}`);
  const kartImg = document.getElementById(`kartAvatar${team}`);
  const kartEmoji = document.getElementById(`kartEmoji${team}`);
  if (avatarUrl) {
    waitEl.innerHTML = `<img src="${avatarUrl}" class="w-full h-full object-cover" />`;
    kartImg.src = avatarUrl;
    kartImg.classList.remove('hidden');
    kartEmoji.classList.add('hidden');
  }
}

function updateKartPosition(team, myClicks, otherClicks) {
  const dynamicMax = Math.max(myClicks, otherClicks, MIN_DYNAMIC_MAX) * 1.15;
  const pct = Math.max(2, Math.min(TRACK_MAX_PERCENT, (myClicks / dynamicMax) * TRACK_MAX_PERCENT));
  document.getElementById(`kart${team}`).style.left = `${pct}%`;
}

// ---------------- 倒數 ----------------
socket.on('game:countdown', ({ count, go }) => {
  showStage('countdown');
  const el = document.getElementById('bigCountdown');
  el.textContent = go ? 'GO!' : count;
  el.classList.remove('countdown-number');
  void el.offsetWidth;
  el.classList.add('countdown-number');
  if (go) {
    setTimeout(() => stages.countdown.classList.add('hidden'), 700);
  }
});

socket.on('game:started', () => {
  stages.countdown.classList.add('hidden');
  showStage('racing');
  document.getElementById('kartA').style.left = '2%';
  document.getElementById('kartB').style.left = '2%';
});

// ---------------- 結算 ----------------
function renderFinished(result) {
  showStage('finished');
  document.getElementById('finalNameA').textContent = result.teamNames.A;
  document.getElementById('finalNameB').textContent = result.teamNames.B;
  document.getElementById('finalClicksA').textContent = result.teamClicks.A;
  document.getElementById('finalClicksB').textContent = result.teamClicks.B;

  const winnerEl = document.getElementById('winnerName');
  if (result.winner === 'DRAW') {
    winnerEl.textContent = '🤝 平手！雙方不分勝負！';
    winnerEl.className = 'text-6xl font-black mb-6 text-slate-200';
  } else {
    const winnerName = result.teamNames[result.winner];
    winnerEl.textContent = `🎉 ${winnerName} 獲勝！ 🎉`;
    winnerEl.className = `text-7xl font-black mb-6 ${result.winner === 'A' ? 'text-blue-300' : 'text-pink-300'}`;
  }

  if (result.mvp) {
    document.getElementById('mvpName').textContent = `${result.mvp.nickname}`;
    document.getElementById('mvpClicks').textContent = `最終點擊數：${result.mvp.clicks} 下`;
  } else {
    document.getElementById('mvpName').textContent = '（尚無資料）';
    document.getElementById('mvpClicks').textContent = '';
  }

  fireConfetti();
}

socket.on('game:finished', (result) => {
  renderFinished(result);
});

socket.on('game:reset', () => {
  document.getElementById('confettiLayer').innerHTML = '';
  showStage('waiting');
});

// ---------------- 彩帶動畫 ----------------
function fireConfetti() {
  const layer = document.getElementById('confettiLayer');
  layer.innerHTML = '';
  const colors = ['#fbbf24', '#f472b6', '#60a5fa', '#34d399', '#f87171', '#a78bfa'];
  const total = 120;
  for (let i = 0; i < total; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    const duration = 2.5 + Math.random() * 2;
    const delay = Math.random() * 1.2;
    piece.style.animationDuration = `${duration}s`;
    piece.style.animationDelay = `${delay}s`;
    piece.style.borderRadius = Math.random() > 0.5 ? '50%' : '2px';
    layer.appendChild(piece);
    setTimeout(() => piece.remove(), (duration + delay) * 1000 + 200);
  }
}
