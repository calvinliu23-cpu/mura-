/**
 * admin.js — 後台管理面板
 */

const socket = io();
socket.emit('admin:join');

// ---------------- 頭像上傳（讀成 base64，直接由 Socket 傳送）----------------
let teamAAvatarData = null;
let teamBAvatarData = null;

function readFileAsDataUrl(file, cb) {
  const reader = new FileReader();
  reader.onload = () => cb(reader.result);
  reader.readAsDataURL(file);
}

document.getElementById('teamAAvatarFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  readFileAsDataUrl(file, (dataUrl) => {
    teamAAvatarData = dataUrl;
    const img = document.getElementById('teamAAvatarPreview');
    img.src = dataUrl;
    img.classList.remove('hidden');
  });
});

document.getElementById('teamBAvatarFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  readFileAsDataUrl(file, (dataUrl) => {
    teamBAvatarData = dataUrl;
    const img = document.getElementById('teamBAvatarPreview');
    img.src = dataUrl;
    img.classList.remove('hidden');
  });
});

// ---------------- 儲存設定 ----------------
document.getElementById('saveConfigBtn').addEventListener('click', () => {
  const payload = {
    teamA: { name: document.getElementById('teamAName').value },
    teamB: { name: document.getElementById('teamBName').value },
    duration: parseInt(document.getElementById('durationInput').value, 10),
  };
  if (teamAAvatarData) payload.teamA.avatar = teamAAvatarData;
  if (teamBAvatarData) payload.teamB.avatar = teamBAvatarData;

  socket.emit('admin:configure', payload);
  const tip = document.getElementById('configSaved');
  tip.classList.remove('hidden');
  setTimeout(() => tip.classList.add('hidden'), 1800);
});

// ---------------- 流程控制按鈕 ----------------
document.getElementById('btnQR').addEventListener('click', () => {
  // 若遊戲尚未開始（WAITING），大螢幕本來就顯示 QR；
  // 這裡主要用於管理者想確認/重新導引畫面（此按鈕不改變遊戲狀態）。
  alert('大螢幕在「等待中」狀態會自動顯示 QR Code。若要回到等待畫面，請點擊「重置遊戲」。');
});

document.getElementById('btnCountdown').addEventListener('click', () => {
  socket.emit('admin:startCountdown');
});

document.getElementById('btnStart').addEventListener('click', () => {
  socket.emit('admin:startGame');
});

document.getElementById('btnForceEnd').addEventListener('click', () => {
  if (confirm('確定要強制結束遊戲並結算成績嗎？')) {
    socket.emit('admin:forceEnd');
  }
});

document.getElementById('btnReset').addEventListener('click', () => {
  if (confirm('確定要重置遊戲嗎？所有玩家分數將會清空（隊名/頭像/時長設定會保留）。')) {
    socket.emit('admin:reset');
  }
});

// ---------------- 即時狀態顯示 ----------------
socket.on('admin:state', (state) => {
  document.getElementById('statusBadge').textContent = `狀態：${state.status}`;

  document.getElementById('liveTimer').textContent = state.status === 'RACING' ? `${state.timeLeft} 秒` : '--';
  document.getElementById('liveTeamAScore').textContent = `${state.teams.A.name}: ${state.teams.A.clicks}`;
  document.getElementById('liveTeamBScore').textContent = `${state.teams.B.name}: ${state.teams.B.clicks}`;

  // 若尚未編輯過名稱輸入框，帶入目前伺服器上的隊名（方便管理者看到現況）
  const nameAInput = document.getElementById('teamAName');
  const nameBInput = document.getElementById('teamBName');
  if (document.activeElement !== nameAInput && !nameAInput.dataset.touched) {
    nameAInput.value = state.teams.A.name;
  }
  if (document.activeElement !== nameBInput && !nameBInput.dataset.touched) {
    nameBInput.value = state.teams.B.name;
  }

  const online = state.players.filter((p) => p.connected).length;
  document.getElementById('onlineCount').textContent = online;

  const sorted = [...state.players].sort((a, b) => b.clicks - a.clicks);
  const listEl = document.getElementById('playerList');
  if (sorted.length === 0) {
    listEl.innerHTML = '<div class="py-4 text-slate-500 text-center">尚無玩家加入</div>';
  } else {
    listEl.innerHTML = sorted
      .map((p, idx) => {
        const teamColor = p.team === 'A' ? 'text-blue-300' : 'text-pink-300';
        const offline = p.connected ? '' : '<span class="text-slate-500 text-xs ml-1">(離線)</span>';
        return `<div class="flex justify-between items-center py-1.5">
          <span>${idx + 1}. <span class="${teamColor} font-bold">[${p.team}]</span> ${escapeHtml(p.nickname)} ${offline}</span>
          <span class="font-black">${p.clicks}</span>
        </div>`;
      })
      .join('');
  }

  if (state.status === 'FINISHED' && state.result) {
    renderResult(state.result);
  } else {
    document.getElementById('resultSection').classList.add('hidden');
  }
});

['teamAName', 'teamBName'].forEach((id) => {
  document.getElementById(id).addEventListener('input', (e) => {
    e.target.dataset.touched = '1';
  });
});

function renderResult(result) {
  const section = document.getElementById('resultSection');
  section.classList.remove('hidden');
  const winnerText = result.winner === 'DRAW'
    ? '平手！'
    : `獲勝隊伍：${result.teamNames[result.winner]}（${result.teamClicks[result.winner]} 分）`;
  document.getElementById('resultWinner').textContent = winnerText;
  document.getElementById('resultMvp').textContent = result.mvp
    ? `MVP 冠軍：${result.mvp.nickname}（${result.mvp.clicks} 下）`
    : 'MVP：尚無資料';
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
