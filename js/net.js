(function () {
  'use strict';

  const C = window.TULOU_CORE;
  const VS = window.VS;
  const $ = (id) => document.getElementById(id);
  const screen = $('screen-versus');
  const query = new URLSearchParams(location.search);
  const capacitor = window.Capacitor;
  const nativeAndroid = capacitor?.isNativePlatform?.() && capacitor.getPlatform?.() === 'android';
  const android = /\bAndroid\b/i.test(navigator.userAgent);
  const twa = !nativeAndroid && location.protocol === 'https:' && android &&
    (query.get('apk') === 'twa' || /^android-app:\/\/com\.tulou\.zhengba\/?$/i.test(document.referrer));
  const appClient = nativeAndroid || twa;
  const mobileProtocol = 'tulou-android';
  const reconnectMs = 30_000;
  const nickKey = 'tulou-lan-nickname';
  const hostKey = 'tulou-lan-android-host';
  const roleNames = { L: '红方', R: '金方', watch: '观战' };
  const defaultNames = { L: '红方玩家', R: '金方玩家' };
  const readyLabels = { ready: '已准备', idle: '未准备', absent: '未连接' };
  const againButton = $('vs-again');
  const defaultAgain = againButton.textContent;

  screen.innerHTML = `
    <header class="net-heading">
      <button class="map-back" id="net-back" type="button">主菜单</button>
      <h2 id="net-title">双人对决</h2>
    </header>
    <main class="net-shell">
      <div class="net-modes" id="net-modes">
        <button class="net-mode net-mode-primary" id="net-online" type="button">
          <span class="net-mode-title">局域网对战</span>
          <span class="net-mode-detail" id="net-mode-detail">电脑版专属</span>
        </button>
        <button class="net-mode" id="net-local" type="button">
          <span class="net-mode-title">本机对战</span>
          <span class="net-mode-detail">同一台设备 · 同屏对决</span>
        </button>
      </div>
      <div class="net-pane net-offline" id="net-offline" hidden>
        <div>
          <p>局域网对战是电脑版专属。请先下载完整版游戏并解压。</p>
          <p>局域网对战需要先双击【启动局域网对战.bat】，再用打开的网页进入</p>
        </div>
        <button class="btn" id="net-offline-local" type="button">改用本机对战</button>
      </div>
      <div class="net-pane net-lan" id="net-lan" hidden>
        <div class="net-identity">
          <label for="net-name">你的昵称</label>
          <input id="net-name" type="text" maxlength="16" placeholder="输入昵称" autocomplete="off">
          <output id="net-role"></output>
          <output id="net-latency">延迟 —</output>
        </div>
        <div class="net-entry" id="net-entry">
          <button class="btn" id="net-create" type="button">创建房间</button>
          <form id="net-join-form">
            <label id="net-host-label" for="net-host" hidden>主机地址</label>
            <input id="net-host" type="text" hidden placeholder="192.168.1.5:8080" autocomplete="off" autocapitalize="none" spellcheck="false">
            <label for="net-code">房间码</label>
            <input id="net-code" type="text" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="四位数字" required autocomplete="off">
            <button class="btn ghost" id="net-join" type="submit">加入房间</button>
          </form>
        </div>
        <div class="net-lobby" id="net-lobby" hidden>
          <section class="net-invite" aria-label="邀请同学">
            <div id="net-qr" role="img" aria-label="局域网入房二维码"></div>
            <div class="net-invite-text">
              <div class="net-code-row"><span>房间码</span><strong id="net-room-code"></strong></div>
              <label class="net-address-row" id="net-address-row" hidden>
                选择网址<select id="net-address"></select>
              </label>
              <a id="net-invite-url" target="_blank" rel="noopener"></a>
              <button class="sbtn" id="net-copy" type="button">复制邀请链接</button>
            </div>
          </section>
          <section class="net-seats" aria-label="玩家席位">
            <div class="net-seat net-seat-red"><b>红方</b><strong id="net-L-name"></strong><span id="net-L-status"></span></div>
            <div class="net-seat net-seat-gold"><b>金方</b><strong id="net-R-name"></strong><span id="net-R-status"></span></div>
            <div class="net-lobby-actions">
              <output id="net-watchers"></output>
              <button class="btn ghost" id="net-ready" type="button">准备</button>
              <button class="btn" id="net-start" type="button">开始</button>
            </div>
          </section>
        </div>
        <p class="net-message" id="net-message" role="status"></p>
        <p class="net-app-hint" id="net-app-hint" hidden></p>
      </div>
    </main>`;

  const overlay = document.createElement('div');
  overlay.className = 'net-reconnect';
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="net-pane" role="dialog" aria-label="连接中断">
      <p class="net-drop-message" role="status"></p>
      <p>连接恢复后，本局会继续。</p>
      <button class="btn ghost" type="button">返回主菜单</button>
    </section>`;
  $('app').append(overlay);
  const notice = document.createElement('p');
  notice.className = 'net-notice';
  notice.setAttribute('role', 'status');
  notice.hidden = true;
  $('app').append(notice);

  let socket = null;
  let role = null;
  let code = '';
  let token = '';
  let room = null;
  let pending = null;
  let round = null;
  let ownDeadline = 0;
  let reconnectTimer = 0;
  let displaced = false;
  let noticeTimer = 0;
  let pingTimer = 0;
  let opened = 0;
  let latency = null;
  let autoJoined = false;
  let desktop = false;
  let serverOrigin = '';

  function localAddress(hostname, allowLoopback = false) {
    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/.exec(hostname);
    if (ipv4) {
      const a = Number(ipv4[1]), b = Number(ipv4[2]);
      return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
        (a === 169 && b === 254) || (allowLoopback && a === 127);
    }
    return /^\[(?:f[cd][0-9a-f]{2}|fe[89ab][0-9a-f]):/i.test(hostname) ||
      (allowLoopback && (hostname === 'localhost' || hostname === '[::1]'));
  }

  function refreshMode() {
    screen.dataset.lanEnvironment = appClient ? 'android' : desktop ? 'desktop' : 'web';
    $('net-mode-detail').textContent = appClient ? 'Android · 加入房间' : desktop ? '两台设备 · 同一个 Wi-Fi' : '电脑版专属';
  }

  function probeDesktop() {
    if (appClient || location.protocol !== 'http:' || !localAddress(location.hostname, true)) return Promise.resolve(false);
    const controller = new AbortController();
    const deadline = setTimeout(() => controller.abort(), 1400);
    return fetch('/__tulou_lan', { cache: 'no-store', redirect: 'error', signal: controller.signal })
      .then((res) => res.status === 204 && res.headers.get('X-Tulou-LAN') === '1')
      .catch(() => false)
      .finally(() => clearTimeout(deadline));
  }

  refreshMode();
  const environmentReady = probeDesktop().then((isDesktop) => {
    desktop = isDesktop;
    refreshMode();
  });
  $('net-host-label').hidden = $('net-host').hidden = $('net-app-hint').hidden = !appClient;
  $('net-host').required = Boolean(appClient);
  $('net-create').hidden = Boolean(appClient);
  if (twa) $('net-host').placeholder = 'wss://192.168.1.5:8443';
  $('net-app-hint').textContent = twa
    ? '此安装版需要浏览器信任的 WSS 地址。普通 HTTP 主机可用 Capacitor 版加入。'
    : '两台设备请连同一个 Wi-Fi。填写电脑版控制台上的主机地址和四位房间码。';

  function appHost(input) {
    const value = input.trim();
    if (!value || /[\\\s]/.test(value)) return null;
    try {
      const url = new URL(value.includes('://') ? value : (twa ? 'https://' : 'http://') + value);
      if (!['http:', 'https:', 'ws:', 'wss:'].includes(url.protocol) || !localAddress(url.hostname) ||
          url.username || url.password || url.search || url.hash || !['/', '/ws'].includes(url.pathname)) return null;
      const secure = url.protocol === 'https:' || url.protocol === 'wss:';
      return { origin: (secure ? 'https://' : 'http://') + url.host, secure };
    } catch { return null; }
  }

  function saved(store, key) {
    try { return window[store].getItem(key) || ''; } catch { return ''; }
  }

  function save(store, key, value) {
    try {
      if (value) window[store].setItem(key, value);
      else window[store].removeItem(key);
    } catch { /* 本地存储不可用时仍可手动入房 */ }
  }

  function tokenKey(roomCode) {
    return 'tulou-lan-room-' + (appClient ? serverOrigin + ':' : '') + roomCode;
  }
  function message(text) { $('net-message').textContent = text; }
  function nickname() { return $('net-name').value.trim().slice(0, 16); }
  function changeUrl(roomCode) {
    if (!desktop && !appClient) return;
    const url = new URL(location.href);
    if (roomCode) url.searchParams.set('room', roomCode);
    else url.searchParams.delete('room');
    history.replaceState(history.state, '', url);
  }

  function switchView(view) {
    $('net-modes').hidden = view !== 'modes';
    $('net-lan').hidden = view !== 'lan';
    $('net-offline').hidden = view !== 'offline';
    $('net-title').textContent = view === 'modes' ? '双人对决' : '局域网对战';
    C.showScreen('versus');
  }

  function open() {
    switchView('modes');
  }

  async function openLan() {
    await environmentReady;
    if (!desktop && !appClient) { switchView('offline'); return; }
    $('net-name').value = saved('localStorage', nickKey);
    if (appClient) $('net-host').value = saved('localStorage', hostKey);
    message('');
    switchView('lan');
    updateRoomUi();
  }

  function home() {
    C.Sound.play('click');
    C.showScreen('menu');
  }

  function local() {
    C.Sound.play('click');
    leave();
    VS.start();
  }

  function closeNotice(text) {
    clearTimeout(noticeTimer);
    C.showScreen('menu');
    notice.textContent = text;
    notice.hidden = false;
    noticeTimer = setTimeout(() => { notice.hidden = true; }, 6000);
  }

  function setPending(request) {
    pending = request;
    $('net-create').disabled = !!pending;
    $('net-join').disabled = !!pending;
    if (request) message(request.type === 'create' ? '正在创建房间…' : '正在加入房间…');
  }

  function send(data) {
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(data));
    return true;
  }

  function joinRequest(roomCode, sessionToken) {
    const request = { type: 'join', code: roomCode, name: nickname() };
    if (sessionToken) request.token = sessionToken;
    else {
      const backup = saved('localStorage', tokenKey(roomCode));
      if (backup) request.resumeToken = backup;
    }
    return request;
  }

  function join(roomCode) {
    if (!/^\d{4}$/.test(roomCode)) { message('请输入四位数字房间码'); return; }
    if (appClient) {
      const host = appHost($('net-host').value);
      if (!host) { message('请输入主机的局域网 IP 地址及端口'); return; }
      if (twa && !host.secure) { message('此安装版只能连接 WSS。普通 HTTP 主机请用 Capacitor 版加入。'); return; }
      if (serverOrigin !== host.origin) {
        const old = socket;
        socket = null;
        old?.close();
        serverOrigin = host.origin;
        latency = null;
      }
    }
    request(joinRequest(roomCode, saved('sessionStorage', tokenKey(roomCode))));
  }

  function request(body) {
    if (!desktop && (!appClient || body.type !== 'join')) return;
    setPending(body);
    if (socket?.readyState === WebSocket.OPEN) send(body);
    else connect();
  }

  function openMatch(nextRound, state) {
    if (round !== nextRound || !VS.active) {
      round = nextRound;
      VS.startNet(role, state);
    } else if (state && role !== 'L') {
      VS.receiveSnapshot(state, []);
    }
  }

  function connect() {
    if (socket?.readyState === WebSocket.CONNECTING || socket?.readyState === WebSocket.OPEN) return;
    const url = new URL('/ws', appClient ? serverOrigin : location.href);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    let ws;
    try { ws = appClient ? new WebSocket(url, mobileProtocol) : new WebSocket(url); }
    catch {
      setPending(null);
      showConnectError();
      return;
    }
    socket = ws;
    ws.addEventListener('open', () => {
      if (ws !== socket) return;
      if (ownDeadline && code) send(joinRequest(code, token));
      else if (pending) send(pending);
      ping();
      if (!pingTimer) pingTimer = setInterval(() => {
        if (socket?.readyState === WebSocket.OPEN) ping();
      }, 2000);
    });
    ws.addEventListener('message', (event) => {
      if (ws !== socket) return;
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (data && typeof data === 'object') receive(data);
    });
    ws.addEventListener('close', (event) => {
      if (ws !== socket) return;
      socket = null;
      latency = null;
      if (!role) {
        setPending(null);
        showConnectError();
      } else if (event.code === 1001) {
        closeNotice(role === 'L' ? '局域网服务器已关闭' : '主机已断开');
      } else if (event.code === 4000) {
        displaced = true;
        closeNotice('此席位已在另一页面重连');
      } else {
        ownDeadline ||= Date.now() + reconnectMs;
        updateConnection();
        if (room?.phase === 'lobby') message('正在重新连接房间…');
        scheduleReconnect();
      }
    });
  }

  function showConnectError() {
    message(twa ? '连接失败。请核对 WSS 地址、证书和主机的网页来源配置。' :
      appClient ? '连接失败。请核对地址、同一个 Wi-Fi 和主机防火墙。' :
        '连接不到局域网服务器。请用启动程序打开的游戏网址进入。');
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    if (!role || !ownDeadline) return;
    if (Date.now() >= ownDeadline) {
      closeNotice(role === 'L' ? '局域网连接已断开' : '主机已断开');
    } else {
      reconnectTimer = setTimeout(() => {
        if (!ownDeadline) return;
        if (socket?.readyState === WebSocket.OPEN) socket.close();
        else connect();
        scheduleReconnect();
      }, Math.min(1500, ownDeadline - Date.now()));
    }
  }

  function receive(data) {
    switch (data.type) {
      case 'welcome':
        code = data.code;
        role = data.role;
        token = data.token || '';
        room = data.room;
        ownDeadline = 0;
        clearTimeout(reconnectTimer);
        setPending(null);
        message('');
        if (token) {
          save('sessionStorage', tokenKey(code), token);
          save('localStorage', tokenKey(code), token);
        }
        if (appClient) save('localStorage', hostKey, serverOrigin);
        changeUrl(code);
        updateInvite(data.addresses);
        if (room.phase === 'playing' || room.phase === 'result') openMatch(room.round, data.state);
        else if (VS.active) {
          VS.stop();
          round = null;
          switchView('lan');
        }
        updateRoomUi();
        break;
      case 'room':
        if (!role) break;
        if (room?.phase !== 'lobby' && data.room.phase === 'lobby') {
          VS.stop();
          round = null;
          switchView('lan');
        }
        room = data.room;
        updateRoomUi();
        break;
      case 'start':
        if (role) {
          openMatch(data.round);
          updateRoomUi();
        }
        break;
      case 'input':
        if (role === 'L') VS.receiveInput(data.side, data.action, data.args);
        break;
      case 'snapshot':
        if (role === 'R' || role === 'watch') VS.receiveSnapshot(data.state, Array.isArray(data.events) ? data.events : []);
        break;
      case 'forfeit':
        overlay.hidden = true;
        VS.setNetPaused(false);
        VS.netForfeit(data.winner);
        break;
      case 'gone':
        closeNotice('主机已断开');
        break;
      case 'error':
        if (ownDeadline) { closeNotice(role === 'L' ? '房间已关闭' : '主机已断开'); break; }
        setPending(null);
        message(data.message || '房间操作失败，请重试。');
        break;
      case 'pong':
        if (data.time !== opened) break;
        latency = Math.max(0, Math.round(performance.now() - opened));
        $('net-latency').textContent = `延迟 ${latency} ms`;
        updateSeats();
        break;
    }
  }

  function ping() {
    opened = performance.now();
    send({ type: 'ping', time: opened, latency });
  }

  function updateConnection() {
    const missing = !room?.players.L?.connected || !room?.players.R?.connected;
    const waiting = room?.phase === 'playing' && (!!ownDeadline || missing);
    overlay.hidden = !waiting;
    if (VS.active && role &&
        (room?.phase === 'playing' || room?.phase === 'result')) VS.setNetPaused(waiting);
    if (waiting) {
      updateCountdown();
      refreshCountdown();
    }
  }

  let countdownTimer = 0;
  function updateCountdown() {
    const deadline = ownDeadline || room?.deadline;
    const sec = deadline ? Math.max(0, Math.ceil((deadline - Date.now()) / 1000)) : 30;
    const lost = ownDeadline ? '连接已中断，正在重连' : role === 'watch' ? '有玩家掉线，等待重连' :
      '对手掉线，等待重连';
    const label = overlay.querySelector('.net-drop-message');
    const next = `${lost}（${sec} 秒）`;
    if (label.textContent !== next) label.textContent = next;
  }

  function refreshCountdown() {
    if (countdownTimer) return;
    countdownTimer = setInterval(() => {
      if (!overlay.hidden) updateCountdown();
      else { clearInterval(countdownTimer); countdownTimer = 0; }
    }, 200);
  }

  function updateSeats() {
    for (const side of ['L', 'R']) {
      const player = room?.players[side];
      const name = $('net-' + side + '-name');
      const status = $('net-' + side + '-status');
      const pingMs = side === role ? latency : player?.latency;
      const connected = player?.connected && !(side === role && ownDeadline);
      name.textContent = player?.name || (player ? defaultNames[side] : '等待入房');
      status.textContent = connected ?
        `已连接 · ${readyLabels[player.ready ? 'ready' : 'idle']}${Number.isFinite(pingMs) ? ' · ' + pingMs + ' ms' : ' · — ms'}` :
        player ? '等待重连' : readyLabels.absent;
      status.dataset.connected = String(!!connected);
    }
  }

  function updateRoomUi() {
    $('net-entry').hidden = !!role;
    $('net-lobby').hidden = !role;
    $('net-role').textContent = role ? (role === 'watch' ? '观战中' : '你是 ' + roleNames[role]) : '';
    $('net-watchers').textContent = room?.spectators ? `观战 ${room.spectators} 人` : '';
    $('net-latency').textContent = latency == null ? '延迟 —' : `延迟 ${latency} ms`;
    $('net-name').disabled = role === 'watch';
    const me = room?.players[role];
    if (role && document.activeElement !== $('net-name') && !$('net-name').value && me) $('net-name').placeholder = me.name;
    const ready = $('net-ready');
    ready.hidden = role !== 'L' && role !== 'R';
    ready.textContent = me?.ready ? '取消准备' : '准备';
    ready.disabled = !!ownDeadline || room?.phase !== 'lobby';
    const start = $('net-start');
    start.hidden = role !== 'L';
    start.disabled = !!ownDeadline || room?.phase !== 'lobby' ||
      !room.players.L?.ready || !room.players.R?.ready || !room.players.R?.connected;
    if (role === 'watch' && room?.phase === 'lobby') message('房间已有两位玩家。比赛开始后将自动进入观战。');
    againButton.hidden = role === 'watch';
    againButton.disabled = !!role && (!!ownDeadline || !!me?.again || !room?.players.L?.connected || !room?.players.R?.connected);
    againButton.textContent = me?.again ? '等待对方再来一局' : defaultAgain;
    updateSeats();
    updateConnection();
  }

  function updateInvite(addresses) {
    $('net-room-code').textContent = code;
    const input = $('net-address');
    const values = appClient ? [serverOrigin] : Array.isArray(addresses) ? [...new Set(addresses)] : [];
    if (!values.length) values.push(location.origin);
    const previous = input.value;
    input.replaceChildren(...values.map((address) => new Option(address, address)));
    if (values.includes(previous)) input.value = previous;
    else if (values.includes(location.origin)) input.value = location.origin;
    $('net-address-row').hidden = values.length < 2;
    drawInvite();
  }

  function drawInvite() {
    const base = new URL($('net-address').value || (appClient ? serverOrigin : location.origin));
    const url = new URL('/', base);
    url.searchParams.set('room', code);
    const link = $('net-invite-url');
    link.href = url.href;
    link.textContent = url.href;
    const target = $('net-qr');
    target.replaceChildren();
    if (appClient) return;
    if (window.QRCode) {
      new window.QRCode(target, {
        text: url.href, width: 240, height: 240, colorDark: '#17110f',
        colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.M
      });
    } else target.textContent = '扫描不可用，请用链接加入';
  }

  function leave() {
    const ws = socket;
    send({ type: 'leave' });
    socket = null;
    ws?.close();
    clearTimeout(reconnectTimer);
    clearInterval(pingTimer);
    pingTimer = 0;
    ownDeadline = 0;
    setPending(null);
    if (code && token) {
      const key = tokenKey(code);
      if (saved('sessionStorage', key) === token) save('sessionStorage', key, '');
      if (!displaced && saved('localStorage', key) === token) save('localStorage', key, '');
    }
    displaced = false;
    if (code || role) changeUrl('');
    code = '';
    token = '';
    role = null;
    room = null;
    round = null;
    latency = null;
    serverOrigin = '';
    overlay.hidden = true;
    updateRoomUi();
  }

  async function autoJoin() {
    if (autoJoined) return;
    autoJoined = true;
    await environmentReady;
    const roomCode = new URLSearchParams(location.search).get('room');
    if ((desktop || appClient) && /^\d{4}$/.test(roomCode || '')) {
      await openLan();
      $('net-code').value = roomCode;
      if (desktop || saved('localStorage', hostKey)) join(roomCode);
    }
  }

  $('net-back').addEventListener('click', home);
  $('net-local').addEventListener('click', local);
  $('net-offline-local').addEventListener('click', local);
  $('net-online').addEventListener('click', () => { C.Sound.play('click'); openLan(); });
  $('net-create').addEventListener('click', () => {
    if (!desktop) return;
    C.Sound.play('click');
    request({ type: 'create', name: nickname() });
  });
  $('net-join-form').addEventListener('submit', (event) => {
    event.preventDefault();
    C.Sound.play('click');
    join($('net-code').value);
  });
  $('net-code').addEventListener('input', (event) => {
    event.target.value = event.target.value.replace(/\D/g, '').slice(0, 4);
  });
  $('net-name').addEventListener('change', () => {
    const name = nickname();
    save('localStorage', nickKey, name);
    send({ type: 'name', name });
  });
  $('net-ready').addEventListener('click', () => {
    C.Sound.play('click');
    send({ type: 'ready', ready: !room?.players[role]?.ready });
  });
  $('net-start').addEventListener('click', () => {
    C.Sound.play('click');
    send({ type: 'start' });
  });
  $('net-address').addEventListener('change', drawInvite);
  $('net-copy').addEventListener('click', async () => {
    const url = $('net-invite-url').href;
    let copied = false;
    try { await navigator.clipboard.writeText(url); copied = true; }
    catch {
      const field = document.createElement('input');
      field.value = url;
      field.className = 'net-clipboard';
      screen.append(field);
      field.select();
      try { copied = document.execCommand('copy'); } catch { /* URL remains available */ }
      field.remove();
      $('net-copy').focus();
    }
    message(copied ? '邀请链接已复制' : '请长按邀请链接复制，或扫描二维码加入。');
  });
  overlay.querySelector('button').addEventListener('click', home);

  window.NET = {
    open, leave, autoJoin,
    input: (action, ...args) => role === 'R' && send({ type: 'input', action, args }),
    snapshot: (state, events) => role === 'L' && socket?.bufferedAmount < 512 * 1024 &&
      send({ type: 'snapshot', state, events }),
    again: () => { if (role === 'L' || role === 'R') send({ type: 'again' }); },
    get role() { return role; }
  };

  if (!$('intro') || $('intro').hidden) autoJoin();
})();
