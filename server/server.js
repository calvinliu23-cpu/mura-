/**
 * server.js
 * 婚禮現場互動賽車大戰 - 主伺服器
 *
 * 三種前端角色透過 Socket.io 連上同一個房間：
 *   - admin   (後台管理)
 *   - display (婚禮大螢幕)
 *   - guest   (賓客手機)
 *
 * 效能設計：
 *   - 手機端「不是每點一下就發封包」，而是每 250ms 批次送出累積點擊數
 *     (見 public/js/mobile.js 的 flushClicks())。
 *   - 伺服器收到批次後「立即」加總進 GameState（記憶體操作、極快），
 *     但「廣播」給大螢幕/後台是用獨立的 10Hz (100ms) 定時器統一推播，
 *     這樣不管同時有幾百人在點擊，大螢幕收到的更新頻率永遠固定、不會被灌爆。
 */

const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { GameState } = require('./gameState');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  maxHttpBufferSize: 2 * 1024 * 1024, // 放寬一點，允許頭像 base64 上傳
});

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

app.use(express.static(PUBLIC_DIR));

// 健康檢查路由：Render / Railway 部署時用來確認服務是否存活
app.get('/healthz', (req, res) => res.status(200).send('ok'));

app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
app.get('/display', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'display.html')));
app.get('/', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'mobile.html')));

const game = new GameState();

const BROADCAST_HZ_MS = 100; // 大螢幕/後台的即時更新頻率 (10Hz)
let broadcastTimer = null;

function broadcastState() {
  io.emit('state:update', game.getPublicState());
}

function broadcastAdminState() {
  io.to('admins').emit('admin:state', game.getAdminState());
}

function startBroadcastLoop() {
  if (broadcastTimer) return;
  broadcastTimer = setInterval(() => {
    if (game.status === 'RACING') {
      game.tick();
      if (game.isTimeUp()) {
        const result = game.finish();
        io.emit('game:finished', result);
      }
    }
    broadcastState();
    broadcastAdminState();
  }, BROADCAST_HZ_MS);
}
startBroadcastLoop();

io.on('connection', (socket) => {
  // 每個新連線先送一次目前狀態，讓頁面（含重新整理）能立即同步
  socket.emit('state:update', game.getPublicState());

  // ---------------- Admin ----------------
  socket.on('admin:join', () => {
    socket.join('admins');
    socket.emit('admin:state', game.getAdminState());
  });

  socket.on('admin:configure', (payload) => {
    game.configure(payload || {});
    broadcastState();
    broadcastAdminState();
  });

  socket.on('admin:startCountdown', () => {
    if (!game.canStartCountdown()) return;
    game.beginCountdown();
    broadcastState();
    broadcastAdminState();

    let count = 3;
    io.emit('game:countdown', { count });
    const countdownTimer = setInterval(() => {
      count -= 1;
      if (count > 0) {
        io.emit('game:countdown', { count });
      } else {
        clearInterval(countdownTimer);
        io.emit('game:countdown', { count: 0, go: true });
      }
    }, 1000);
  });

  socket.on('admin:startGame', () => {
    if (game.status !== 'COUNTDOWN' && game.status !== 'WAITING') return;
    game.beginRace();
    io.emit('game:started', { duration: game.duration, endAt: game.endAt });
    broadcastState();
    broadcastAdminState();
  });

  socket.on('admin:forceEnd', () => {
    if (game.status === 'WAITING') return;
    const result = game.finish();
    io.emit('game:finished', result);
    broadcastState();
    broadcastAdminState();
  });

  socket.on('admin:reset', () => {
    game.forceReset();
    io.emit('game:reset');
    broadcastState();
    broadcastAdminState();
  });

  // ---------------- Display ----------------
  socket.on('display:join', () => {
    socket.join('displays');
    socket.emit('state:update', game.getPublicState());
  });

  // ---------------- Guest (手機) ----------------
  socket.on('guest:join', ({ nickname, team } = {}, ack) => {
    if (game.status === 'FINISHED') {
      if (typeof ack === 'function') ack({ ok: false, reason: 'FINISHED' });
      return;
    }
    const ok = game.addPlayer(socket.id, nickname, team);
    if (!ok) {
      if (typeof ack === 'function') ack({ ok: false, reason: 'INVALID_TEAM' });
      return;
    }
    socket.join('guests');
    socket.data.role = 'guest';
    if (typeof ack === 'function') {
      ack({
        ok: true,
        team,
        nickname,
        status: game.status,
        endAt: game.endAt,
        duration: game.duration,
      });
    }
    broadcastState();
    broadcastAdminState();
  });

  socket.on('guest:clickBatch', ({ count } = {}) => {
    const added = game.addClicks(socket.id, count);
    if (added > 0 && Math.random() < 0.15) {
      // 不用每次批次都全量推播（已有 10Hz loop 負責），這裡只是保底不特別處理
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.role === 'guest') {
      game.markDisconnected(socket.id);
      broadcastState();
      broadcastAdminState();
    }
  });
});

server.listen(PORT, () => {
  console.log(`🏎️  婚禮現場互動賽車大戰 伺服器啟動於 http://localhost:${PORT}`);
  console.log(`   賓客端: http://localhost:${PORT}/`);
  console.log(`   大螢幕: http://localhost:${PORT}/display`);
  console.log(`   後台:   http://localhost:${PORT}/admin`);
});
