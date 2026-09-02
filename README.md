# 🏎️ 婚禮現場互動賽車大戰 (Wedding Racing Game)

利用手機瀏覽器作為控制器、大螢幕呈現賽車動畫、後台掌控流程的即時互動網頁遊戲。

## 專案結構

```
wedding-racing-game/
├── package.json      # 根目錄部署入口（Render / Railway 用這個）
├── render.yaml        # Render 一鍵部署設定
├── railway.json        # Railway 部署設定
├── Procfile              # 通用啟動指令（web: npm start）
├── .gitignore
├── server/
│   ├── server.js       # Express + Socket.io 主程式
│   ├── gameState.js    # 隊伍/玩家/分數/MVP 狀態管理
│   └── package.json    # 本機開發用（cd server 單獨跑也可以）
└── public/
    ├── admin.html       # 後台管理面板   → /admin
    ├── display.html      # 婚禮大螢幕     → /display
    ├── mobile.html        # 賓客手機前台   → /
    ├── css/style.css
    └── js/
        ├── admin.js
        ├── display.js
        └── mobile.js
```

## 快速啟動（本機測試）

在專案根目錄執行（推薦，路徑與雲端部署一致）：

```bash
npm install
npm start
```

或維持原本方式，進 `server/` 資料夾跑也可以：

```bash
cd server
npm install
npm start
```

伺服器預設跑在 `http://localhost:3000`：

| 角色 | 網址 | 使用裝置 |
|---|---|---|
| 賓客加入頁 | `http://<你的IP>:3000/` | 賓客手機（掃 QR） |
| 大螢幕 | `http://<你的IP>:3000/display` | 投影/電視，接筆電 |
| 後台管理 | `http://<你的IP>:3000/admin` | 主持人/工作人員的手機或筆電 |

> **⚠️ 婚禮現場注意事項**：手機和大螢幕都必須連上「同一個網路」（同一台 Wi-Fi
> 分享器/路由器）才能互相通訊。建議提前用場地 Wi-Fi 或自備分享器（4G 隨身
> WiFi）測試，並找出電腦的區網 IP（Windows: `ipconfig`／Mac: `ifconfig` 或
> 系統設定的 Wi-Fi 詳細資訊），把 `<你的IP>` 換成該 IP。
>
> 若場地沒有穩定 Wi-Fi，強烈建議改用下面的雲端部署方式，賓客用 4G 上網即可，
> 是婚禮現場最穩定的做法（不受場地 Wi-Fi 品質、人數上限影響）。

## ☁️ 部署到雲端（Render / Railway）

部署到雲端後，你會得到一個公開網址（例如
`https://wedding-racing-game.onrender.com`），大螢幕、後台、賓客手機都改用
這個網址即可，**不再需要同一個 Wi-Fi**，賓客用自己的行動網路（4G/5G）就能玩。

專案已內建部署設定檔（`render.yaml`、`railway.json`、`Procfile`、根目錄
`package.json`），兩個平台都能直接一鍵部署，不需要額外設定 Build/Start
Command。

### 前置作業：把專案推上 GitHub

```bash
cd wedding-racing-game
git init
git add .
git commit -m "wedding racing game"
# 到 GitHub 建立一個新的空 repo，然後：
git remote add origin https://github.com/<你的帳號>/wedding-racing-game.git
git branch -M main
git push -u origin main
```

### 方案 A：部署到 Render

1. 到 [render.com](https://render.com) 註冊/登入，點選 **New +** →
   **Blueprint**。
2. 選擇你剛剛推上去的 GitHub repo，Render 會自動讀取專案內的
   `render.yaml` 並帶入設定（Build Command: `npm install`；Start Command:
   `npm start`；方案選 Free）。
3. 確認後點 **Apply**，等待幾分鐘完成部署。
4. 部署完成後會得到一個網址，例如
   `https://wedding-racing-game.onrender.com`：
   - 賓客：`https://wedding-racing-game.onrender.com/`
   - 大螢幕：`https://wedding-racing-game.onrender.com/display`
   - 後台：`https://wedding-racing-game.onrender.com/admin`
5. **注意**：Render 免費方案在無人連線一段時間後會「休眠」，下次有人連進來
   時需要約 30–60 秒喚醒。**婚禮當天強烈建議提前 10–15 分鐘先打開大螢幕
   網址暖機**，或升級成付費方案（Starter）避免現場尷尬的等待。

### 方案 B：部署到 Railway

1. 到 [railway.app](https://railway.app) 註冊/登入，點選 **New Project** →
   **Deploy from GitHub repo**，選擇你的專案。
2. Railway 會自動偵測 `railway.json` 並用 Nixpacks 建置，安裝
   `npm install`、啟動 `npm start`，通常不需要手動設定。
3. 部署完成後，到專案的 **Settings → Networking** 產生一個公開網域
   （Generate Domain），會得到類似
   `https://wedding-racing-game-production.up.railway.app` 的網址。
4. 用法同上，把 `/`、`/display`、`/admin` 接在網域後面即可。
5. Railway 免費方案有每月額度限制（依方案而定），若使用時數較長建議事先
   確認額度或升級方案，避免婚禮當天額度用盡。

### 部署後檢查清單

- [ ] 用自己的手機（切到行動網路，不要連 Wi-Fi）打開賓客網址，確認能正常
      加入隊伍。
- [ ] 大螢幕網址在投影設備上打開，確認 QR Code 能正常顯示、掃描後能導到
      正確網址。
- [ ] 後台按「開始倒數」「遊戲開始」，確認大螢幕與手機都同步動畫、計分。
- [ ] 若用 Render 免費方案，記得提前暖機（見上方注意事項）。

## 操作流程（給主持人/工作人員）

1. 開啟**後台**（`/admin`），視需要調整隊伍名稱、上傳新郎/新娘頭像、設定遊戲
   秒數，按「💾 儲存設定」。
2. 開啟**大螢幕**（`/display`）投影到現場螢幕，會自動顯示 QR Code。
3. 現場公告請賓客掃碼、輸入暱稱、選隊伍（大螢幕與後台會即時顯示已加入人數）。
4. 人數差不多後，後台按「⏱️ 開始倒數」→ 大螢幕與手機同步出現 3-2-1。
5. 倒數結束後，後台按「🏁 遊戲開始」正式啟動計時與計分，賓客開始狂點手機。
6. 時間到會自動結算；也可隨時按「⏹️ 強制結束」提前結算。
7. 大螢幕會噴彩帶、公布獲勝隊伍與 MVP（獲勝隊伍中點擊數最高者）。
8. 要重新玩一局，後台按「🔄 重置遊戲」（隊名/頭像/秒數設定會保留，分數歸零）。

## 關鍵技術設計

### 1. 即時通訊：Socket.io
所有端（admin / display / guest）都是 Socket.io 的客戶端，伺服器是唯一的
「真相來源」：分數加總、剩餘時間、勝負判定全部在後端計算，前端只負責顯示，
避免多端時間或分數不同步。

### 2. 點擊節流 / 批次上傳（效能核心）
- **手機端**（`public/js/mobile.js`）：每次點擊只更新「本機畫面」與一個
  本地計數器 `pendingClicks`（零延遲手感），**不會**每點一下就送一次網路
  請求。真正送出是靠 `setInterval(flushClicks, 250)`，每 250ms 把這段時間
  累積的點擊數「批次」用一個 Socket 事件 `guest:clickBatch` 送出。
- **伺服器端**（`server/server.js`）：收到批次後立即在記憶體加總進
  `GameState`（極快），但「廣播」給大螢幕/後台是用獨立的 **10Hz
  （100ms）** 定時器統一推播 `state:update`。這樣不管同時有幾十人還是幾百
  人在狂點，大螢幕收到的更新頻率永遠固定、不會被灌爆，也不會忽快忽慢。

### 3. 賽車位置動畫演算法
車子左邊界百分比：
```
dynamicMax = max(領先隊伍點擊數, 落後隊伍點擊數, 30) × 1.15
車輛位置% = min(88%, 我方點擊數 / dynamicMax × 88%)
```
這個「動態基準」設計讓比賽不論規模大小（10 人玩或 500 人玩）都能維持
「你追我趕、最後一刻才分勝負」的視覺張力，同時仍完全依照兩隊點擊數的
**相對比例**推進，不是固定終點線的絕對數值。

### 4. MVP 計算邏輯
後端 `GameState.computeResult()`：
1. 比較兩隊 `teamClicks` 總和，判定獲勝隊伍（或平手）。
2. 在**獲勝隊伍**的玩家中，找出個人 `clicks` 最高者作為 MVP。
3. 一次性計算好結果物件（`{ winner, teamClicks, teamNames, mvp }`），透過
   `game:finished` 事件廣播給所有端，避免前端各自計算造成不一致。

### 5. 斷線容錯
- 玩家手機斷線（切換 App、螢幕鎖定）時，伺服器只標記 `connected: false`，
  **不會**清除其分數，避免暫時斷線導致戰績歸零。
- 大螢幕/後台若中途重新整理，連線後會立即收到一次完整的 `state:update`，
  自動恢復到正確畫面（等待/倒數/比賽中/結算）。

## 客製化重點

- 隊伍預設名稱、預設遊戲秒數：`server/gameState.js` 的 `DEFAULT_TEAMS` /
  `DEFAULT_DURATION`。
- 賽道視覺風格（顏色、跑道紋理、賽車 emoji）：`public/css/style.css` 的
  `.track-wrap` / `.kart-body`，以及 `public/display.html` 內的 emoji。
- 單次批次點擊上限（防呆）：`gameState.js` 的 `addClicks()` 中 `100` 這個數字。
- 廣播頻率：`server/server.js` 的 `BROADCAST_HZ_MS`（預設 100ms = 10Hz）。

## 系統需求

- Node.js 18+（建議 20 LTS）
- 現代瀏覽器（Chrome / Safari / Edge，支援 WebSocket）
- `admin.html` / `display.html` / `mobile.html` 皆使用 Tailwind CDN 與 QR
  Code 產生 API（`api.qrserver.com`），**這兩者需要裝置能連上網際網路**；
  Socket.io 本身則是同源連線，只要手機與伺服器在同一網路即可運作。
