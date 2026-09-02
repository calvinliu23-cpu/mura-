/**
 * mobile.js — 賓客手機前台
 *
 * 效能重點：
 *   pendingClicks 只是一個本地整數計數器，每次點擊立即 +1 並更新畫面（零延遲手感），
 *   但「不會」馬上發送給伺服器。真正的網路傳送由 setInterval(flushClicks, 250) 統一批次送出，
 *   避免每點一下就打一次 Socket，數百人同時玩也不會塞爆伺服器與網路。
 */

const socket = io();

let myTeam = null;
let myNickname = '';
let myClicks = 0;
let teamClicksLocal = 0;
let pendingClicks = 0; // 尚未送出的點擊數（批次緩衝）
let joined = false;
let currentStatus = 'WAITING';
let latestState = null;

const screens = {
  join: document.getElementById('screen-join'),
  waiting: document.getElementById('screen-waiting'),
  countdown: document.getElementById('screen-countdown'),
  game: document.getElementById('screen-game'),
  end: document.getElementById('screen-end'),
};

function showScreen(name) {
  Object.values(screens).forEach((el) => el.classList.add('hidden'));
  screens[name].classList.remove('hidden');
}

// ---------------- 隊伍選擇 ----------------
const teamABtn = document.getElementById('teamA-btn');
const teamBBtn = document.getElementById('teamB-btn');
const joinBtn = document.getElementById('joinBtn');
const nicknameInput = document.getElementById('nicknameInput');
const joinError = document.getElementById('joinError');

function selectTeam(team) {
  myTeam = team;
  teamABtn.classList.toggle('ring-4', team === 'A');
  teamABtn.classList.toggle('ring-yellow-300', team === 'A');
  teamBBtn.classList.toggle('ring-4', team === 'B');
  teamBBtn.classList.toggle('ring-yellow-300', team === 'B');
  updateJoinButtonState();
}
teamABtn.addEventListener('click', () => selectTeam('A'));
teamBBtn.addEventListener('click', () => selectTeam('B'));

function updateJoinButtonState() {
  const ready = myTeam && nicknameInput.value.trim().length > 0;
  joinBtn.disabled = !ready;
  joinBtn.textContent = ready ? '🚀 加入戰隊！' : (myTeam ? '請輸入暱稱' : '請先選擇隊伍');
  joinBtn.className = `w-full py-4 rounded-2xl font-black text-lg transition ${
    ready ? 'bg-yellow-400 text-slate-900' : 'bg-slate-600 text-slate-300'
  }`;
}
nicknameInput.addEventListener('input', updateJoinButtonState);

joinBtn.addEventListener('click', () => {
  if (joinBtn.disabled) return;
  myNickname = nicknameInput.value.trim().slice(0, 12);
  joinError.classList.add('hidden');
  socket.emit('guest:join', { nickname: myNickname, team: myTeam }, (res) => {
    if (!res || !res.ok) {
      joinError.textContent = res && res.reason === 'FINISHED' ? '比賽已結束，無法加入' : '加入失敗，請再試一次';
      joinError.classList.remove('hidden');
      return;
    }
    joined = true;
    renderWaitingCard();
    if (res.status === 'RACING') {
      enterGameScreen();
    } else if (res.status === 'FINISHED') {
      showScreen('end');
    } else {
      showScreen('waiting');
    }
  });
});

function renderWaitingCard() {
  const isA = myTeam === 'A';
  document.getElementById('waitingNickname').textContent = myNickname;
  const teamData = latestState ? latestState.teams[myTeam] : null;
  document.getElementById('waitingTeam').textContent = teamData ? teamData.name : (isA ? '男方親友隊' : '女方親友隊');
  document.getElementById('waitingTeam').className = `text-lg font-bold mb-6 ${isA ? 'text-blue-400' : 'text-pink-400'}`;
  const card = document.getElementById('waitingCard');
  card.className = `rounded-3xl p-8 w-full max-w-sm border-2 pulse-glow ${isA ? 'border-blue-500 bg-blue-500/10' : 'border-pink-500 bg-pink-500/10'}`;
  const avatarEl = document.getElementById('waitingAvatar');
  avatarEl.className = `w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl mb-3 overflow-hidden ${isA ? 'bg-blue-500' : 'bg-pink-500'}`;
  avatarEl.innerHTML = teamData && teamData.avatar ? `<img src="${teamData.avatar}" class="w-full h-full object-cover" />` : (isA ? '🤵' : '👰');
}

// ---------------- 大廳資訊即時更新（人數 / 隊名 / 頭像）----------------
socket.on('state:update', (state) => {
  latestState = state;
  currentStatus = state.status;

  document.getElementById('teamA-name').textContent = state.teams.A.name;
  document.getElementById('teamB-name').textContent = state.teams.B.name;
  document.getElementById('teamA-count').textContent = `${state.teams.A.count} 人已加入`;
  document.getElementById('teamB-count').textContent = `${state.teams.B.count} 人已加入`;
  if (state.teams.A.avatar) {
    document.getElementById('teamA-avatar').innerHTML = `<img src="${state.teams.A.avatar}" class="w-full h-full object-cover" />`;
  }
  if (state.teams.B.avatar) {
    document.getElementById('teamB-avatar').innerHTML = `<img src="${state.teams.B.avatar}" class="w-full h-full object-cover" />`;
  }

  if (joined) {
    if (myTeam) renderWaitingCard();
    if (state.status === 'RACING' && screens.game.classList.contains('hidden') && screens.end.classList.contains('hidden')) {
      enterGameScreen();
    }
    if (state.status === 'RACING') {
      document.getElementById('gameTimer').textContent = state.timeLeft;
      document.getElementById('teamClicks').textContent = state.teams[myTeam].clicks;
    }
  }
});

// ---------------- 倒數 ----------------
socket.on('game:countdown', ({ count, go }) => {
  if (!joined) return;
  showScreen('countdown');
  const el = document.getElementById('countdownDisplay');
  if (go) {
    el.textContent = 'GO!';
    el.classList.remove('countdown-number');
    void el.offsetWidth;
    el.classList.add('countdown-number');
  } else {
    el.textContent = count;
    el.classList.remove('countdown-number');
    void el.offsetWidth;
    el.classList.add('countdown-number');
  }
});

// ---------------- 開賽 ----------------
socket.on('game:started', () => {
  if (!joined) return;
  enterGameScreen();
});

function enterGameScreen() {
  screens.countdown.classList.add('hidden');
  showScreen('game');
  myClicks = 0;
  pendingClicks = 0;
  document.getElementById('myClicks').textContent = '0';
  applyTeamColor();
}

function applyTeamColor() {
  const btn = document.getElementById('tapButton');
  if (myTeam === 'A') {
    btn.style.background = 'radial-gradient(circle at 30% 30%, #60a5fa, #1d4ed8)';
  } else {
    btn.style.background = 'radial-gradient(circle at 30% 30%, #f472b6, #be185d)';
  }
}

// ---------------- 點擊互動 ----------------
const tapButton = document.getElementById('tapButton');

function spawnFloatText(x, y) {
  const wrap = tapButton.parentElement;
  const rect = wrap.getBoundingClientRect();
  const span = document.createElement('span');
  span.className = 'float-plus';
  span.textContent = '+1';
  span.style.left = `${x - rect.left}px`;
  span.style.top = `${y - rect.top}px`;
  wrap.appendChild(span);
  setTimeout(() => span.remove(), 720);
}

function handleTap(clientX, clientY) {
  if (currentStatus !== 'RACING') return;
  myClicks += 1;
  pendingClicks += 1;
  document.getElementById('myClicks').textContent = myClicks;

  tapButton.classList.add('tapped');
  setTimeout(() => tapButton.classList.remove('tapped'), 80);

  spawnFloatText(clientX, clientY);

  if (navigator.vibrate) navigator.vibrate(15);
}

tapButton.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleTap(e.clientX, e.clientY);
});
// 避免部分裝置同時觸發 pointerdown + click 造成雙倍計數
tapButton.addEventListener('click', (e) => e.preventDefault());

// ---------------- 批次上傳（節流核心） ----------------
setInterval(() => {
  if (pendingClicks > 0 && currentStatus === 'RACING') {
    socket.emit('guest:clickBatch', { count: pendingClicks });
    pendingClicks = 0;
  }
}, 250);

// 離開頁面前盡量把剩餘點擊送出
window.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && pendingClicks > 0) {
    socket.emit('guest:clickBatch', { count: pendingClicks });
    pendingClicks = 0;
  }
});

// ---------------- 結束 ----------------
socket.on('game:finished', () => {
  if (!joined) return;
  document.getElementById('finalMyClicks').textContent = myClicks;
  showScreen('end');
});

// ---------------- 主持人重置 ----------------
socket.on('game:reset', () => {
  joined = false;
  myTeam = null;
  myClicks = 0;
  pendingClicks = 0;
  nicknameInput.value = '';
  teamABtn.classList.remove('ring-4', 'ring-yellow-300');
  teamBBtn.classList.remove('ring-4', 'ring-yellow-300');
  updateJoinButtonState();
  showScreen('join');
});
