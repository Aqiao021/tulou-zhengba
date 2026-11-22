'use strict';

const { createServer } = require('node:http');
const { createHash, randomBytes, randomInt } = require('node:crypto');
const { isUtf8 } = require('node:buffer');
const { createReadStream, existsSync, realpathSync, statSync } = require('node:fs');
const { networkInterfaces } = require('node:os');
const { execFile } = require('node:child_process');
const path = require('node:path');
const { isSea } = require('node:sea');

const serverDir = isSea() ? path.dirname(process.execPath) : __dirname;
const root = realpathSync(path.resolve(serverDir, '..'));
const sockets = new Set();
const rooms = new Map();
const RECONNECT_MS = 30_000;
const MAX_MESSAGE = 1024 * 1024;
const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const ANDROID_PROTOCOL = 'tulou-android';
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.ttf': 'font/ttf', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
let addresses = [];
let stopping = false;
let twaOrigin = '';

function failHttp(res, status) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(status === 404 ? '页面不存在' : '请求无效');
}

function serve(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  if (req.url === '/__tulou_lan') {
    res.writeHead(204, { 'X-Tulou-LAN': '1', 'Cache-Control': 'no-store' });
    res.end();
    return;
  }
  let file, stat;
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
    const parts = urlPath.split('/').filter(Boolean);
    if (!urlPath.startsWith('/') || /[\\:\x00]/.test(urlPath) || parts.some((piece) => piece.startsWith('.'))) {
      failHttp(res, 404);
      return;
    }
    file = realpathSync(path.join(root, ...parts, ...(urlPath.endsWith('/') ? ['index.html'] : [])));
    if (path.relative(root, file).split(path.sep)[0] === '..') throw new Error('Outside static root');
    if (path.isAbsolute(path.relative(root, file))) throw new Error('Outside static root');
    stat = statSync(file);
    if (!stat.isFile()) throw new Error('Not a file');
  } catch {
    failHttp(res, 404);
    return;
  }
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
    'Content-Length': stat.size,
    'X-Content-Type-Options': 'nosniff',
    'Cache-Control': 'no-cache',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).on('error', () => res.destroy()).pipe(res);
}

// RFC 6455 framing. Follow TCP chunk boundaries independently of frame boundaries.
function frame(op, payload) {
  const n = payload.length;
  const prefix = Buffer.allocUnsafe(n < 126 ? 2 : n <= 0xffff ? 4 : 10);
  prefix[0] = 0x80 | op;
  if (n < 126) prefix[1] = n;
  else if (n <= 0xffff) {
    prefix[1] = 126;
    prefix.writeUInt16BE(n, 2);
  } else {
    prefix[1] = 127;
    prefix.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([prefix, payload]);
}

function write(client, bytes) {
  if (client.closing || client.socket.destroyed) return;
  if (client.socket.writableLength > 2 * MAX_MESSAGE) client.socket.destroy();
  else client.socket.write(bytes);
}

function close(client, code, reason = '') {
  if (client.closing) return;
  client.closing = true;
  const payload = Buffer.allocUnsafe(2 + Buffer.byteLength(reason));
  payload.writeUInt16BE(code);
  payload.write(reason, 2);
  client.socket.end(frame(8, payload));
  setTimeout(() => client.socket.destroy(), 800).unref();
}

function read(client, chunk) {
  if (client.closing) return;
  let bytes = client.pending.length ? Buffer.concat([client.pending, chunk]) : chunk;
  while (bytes.length >= 2) {
    const fin = (bytes[0] & 0x80) !== 0;
    const op = bytes[0] & 0x0f;
    const shortLength = bytes[1] & 0x7f;
    if ((bytes[0] & 0x70) || !(bytes[1] & 0x80) || ![0, 1, 2, 8, 9, 10].includes(op)
      || (op >= 8 && (!fin || shortLength > 125))) {
      close(client, 1002);
      return;
    }
    let offset = shortLength < 126 ? 2 : shortLength === 126 ? 4 : 10;
    if (bytes.length < offset + 4) break;
    let n = shortLength;
    if (shortLength === 126) {
      n = bytes.readUInt16BE(2);
      if (n < 126) { close(client, 1002); return; }
    } else if (shortLength === 127) {
      const wide = bytes.readBigUInt64BE(2);
      if ((wide >> 63n) || wide <= 65535n) { close(client, 1002); return; }
      if (wide > BigInt(MAX_MESSAGE)) { close(client, 1009); return; }
      n = Number(wide);
    }
    if (n > MAX_MESSAGE || (op === 0 && client.partBytes + n > MAX_MESSAGE)) {
      close(client, 1009);
      return;
    }
    const mask = bytes.subarray(offset, offset + 4);
    offset += 4;
    if (bytes.length < offset + n) break;
    const payload = bytes.subarray(offset, offset + n);
    for (let i = 0; i < n; i++) payload[i] ^= mask[i % 4];
    bytes = bytes.subarray(offset + n);
    if (op >= 8) {
      if (op === 8) {
        if (n === 1) { close(client, 1002); return; }
        if (n >= 2) {
          const code = payload.readUInt16BE();
          if (code < 1000 || code >= 5000 || [1004, 1005, 1006, 1015].includes(code) ||
              (code >= 1016 && code < 3000)) { close(client, 1002); return; }
          if (!isUtf8(payload.subarray(2))) { close(client, 1007); return; }
        }
        client.closing = true;
        client.socket.end(frame(8, payload));
        setTimeout(() => client.socket.destroy(), 800).unref();
        return;
      }
      if (op === 9) write(client, frame(10, payload));
      else client.waitingPong = false;
      continue;
    }
    if (op === 2) { close(client, 1003); return; }
    if ((op === 0) !== Boolean(client.parts)) { close(client, 1002); return; }
    let message = payload;
    if (!fin || client.parts) {
      if (!client.parts) client.parts = [];
      if (client.parts.length >= 2048) { close(client, 1009); return; }
      client.parts.push(payload);
      client.partBytes += n;
      if (!fin) continue;
      message = Buffer.concat(client.parts, client.partBytes);
      client.parts = null;
      client.partBytes = 0;
    }
    if (!isUtf8(message)) { close(client, 1007); return; }
    receive(client, message);
    if (client.closing) return;
  }
  // Copy only the unfinished bytes. Otherwise a short subarray could pin a large frame.
  client.pending = Buffer.from(bytes);
}

function upgrade(req, socket, head) {
  socket.on('error', () => socket.destroy());
  const key = req.headers['sec-websocket-key'];
  const version = req.headers['sec-websocket-version'];
  const host = req.headers.host;
  const origin = req.headers.origin;
  const protocol = req.headers['sec-websocket-protocol'];
  const joinOnly = protocol === ANDROID_PROTOCOL &&
    (origin === 'http://localhost' || (twaOrigin && origin === twaOrigin));
  const sameOrigin = !origin || origin === 'http://' + host || origin === 'https://' + host;
  if (!host || (protocol ? !joinOnly : !sameOrigin)) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }
  if (stopping || req.method !== 'GET' || req.url !== '/ws' || req.headers.upgrade?.toLowerCase() !== 'websocket'
    || !req.headers.connection?.toLowerCase().split(',').some((item) => item.trim() === 'upgrade')
    || typeof key !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(key)) {
    socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
    return;
  }
  if (version !== '13') {
    socket.end('HTTP/1.1 426 Upgrade Required\r\nSec-WebSocket-Version: 13\r\nConnection: close\r\n\r\n');
    return;
  }
  const accept = createHash('sha1').update(key + WS_GUID).digest('base64');
  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    'Sec-WebSocket-Accept: ' + accept,
  ];
  if (joinOnly) headers.push('Sec-WebSocket-Protocol: ' + ANDROID_PROTOCOL);
  socket.write(headers.join('\r\n') + '\r\n\r\n');
  socket.setNoDelay(true);
  const client = {
    socket, joinOnly, room: null, role: null, pending: Buffer.alloc(0), parts: null, partBytes: 0,
    waitingPong: false, closing: false, rateStart: Date.now(), messages: 0, joinedAt: Date.now(),
  };
  sockets.add(client);
  socket.on('data', (chunk) => read(client, chunk));
  socket.once('close', () => {
    sockets.delete(client);
    detach(client, false);
  });
  if (head.length) read(client, head);
}

function send(client, obj) {
  if (client) write(client, frame(1, Buffer.from(JSON.stringify(obj))));
}
function error(client, message) {
  send(client, { type: 'error', message });
}
function broadcast(room, obj, except = null) {
  const bytes = frame(1, Buffer.from(JSON.stringify(obj)));
  for (const client of [room.players.L?.client, room.players.R?.client, ...room.watchers]) {
    if (client && client !== except) write(client, bytes);
  }
}

function member(name, role, client) {
  return {
    name: nick(name, role), token: randomBytes(24).toString('base64url'), client,
    ready: false, again: false, latency: null, absentUntil: null,
  };
}
function nick(name, role) {
  const clean = typeof name === 'string' ? [...name.replace(/[\x00-\x1f\x7f]/g, '').trim()].slice(0, 16).join('') : '';
  return clean || (role === 'L' ? '红方' : '金方');
}
function publicRoom(room) {
  function playerState(player) {
    return player ? {
      name: player.name, connected: Boolean(player.client), ready: player.ready,
      again: player.again, latency: player.client ? player.latency : null,
    } : null;
  }
  return {
    players: { L: playerState(room.players.L), R: playerState(room.players.R) },
    phase: room.phase, deadline: room.deadline, round: room.round, spectators: room.watchers.size,
  };
}
function roomChanged(room) {
  broadcast(room, { type: 'room', room: publicRoom(room) });
}
function welcome(client, room, role) {
  client.room = room;
  client.role = role;
  send(client, {
    type: 'welcome', code: room.code, role, token: room.players[role]?.token ?? null,
    addresses, room: publicRoom(room), state: room.state,
  });
  roomChanged(room);
}

function create(client, name) {
  if (rooms.size >= 10_000) { error(client, '房间已满，请稍后再试'); return; }
  let code;
  do { code = String(randomInt(10_000)).padStart(4, '0'); } while (rooms.has(code));
  const room = {
    code, players: { L: member(name, 'L', client), R: null }, watchers: new Set(),
    phase: 'lobby', deadline: null, timer: null, round: 0, state: null,
  };
  rooms.set(code, room);
  welcome(client, room, 'L');
}

function join(client, msg) {
  const room = rooms.get(msg.code);
  if (!room) { error(client, '找不到此房间，请检查房间码'); return; }
  const role = (client.joinOnly ? ['R'] : ['L', 'R']).find((side) => {
    const player = room.players[side];
    if (!player) return false;
    return player.token === msg.token || (!player.client && player.token === msg.resumeToken);
  });
  if (role) {
    const player = room.players[role];
    const previous = player.client;
    if (previous) {
      previous.room = null;
      previous.role = null;
      close(previous, 4000, 'Reconnected elsewhere');
    }
    player.client = client;
    player.absentUntil = null;
    player.latency = null;
    schedule(room);
    welcome(client, room, role);
    return;
  }
  if (!room.players.R && room.players.L.client && room.phase === 'lobby') {
    room.players.R = member(msg.name, 'R', client);
    welcome(client, room, 'R');
    return;
  }
  room.watchers.add(client);
  welcome(client, room, 'watch');
}

function destroyRoom(room) {
  rooms.delete(room.code);
  clearTimeout(room.timer);
  const clients = [room.players.L?.client, room.players.R?.client, ...room.watchers];
  for (const client of clients) {
    if (client) {
      send(client, { type: 'gone' });
      client.room = null;
      client.role = null;
    }
  }
}

function detach(client, explicit) {
  const { room, role } = client;
  client.room = null;
  client.role = null;
  if (!room || !rooms.has(room.code) || stopping) return;
  if (role === 'watch') {
    room.watchers.delete(client);
    roomChanged(room);
    return;
  }
  const player = room.players[role];
  if (player?.client !== client) return;
  player.client = null;
  player.absentUntil = Date.now() + RECONNECT_MS;
  if (explicit && role === 'L') { destroyRoom(room); return; }
  if (role === 'R' && explicit && room.phase !== 'playing') {
    room.players.R = null;
    room.players.L.ready = false;
    room.players.L.again = false;
  }
  schedule(room);
  roomChanged(room);
}

function schedule(room) {
  clearTimeout(room.timer);
  const absent = Object.values(room.players).filter((player) => player?.absentUntil);
  const next = absent.length ? Math.min(...absent.map((player) => player.absentUntil)) : null;
  room.deadline = room.phase === 'playing' ? next : null;
  room.timer = next ? setTimeout(() => expire(room), Math.max(1, next - Date.now())) : null;
  room.timer?.unref();
}

function expire(room) {
  const expired = (player) => player?.absentUntil && player.absentUntil <= Date.now();
  const { L, R } = room.players;
  if (room.phase === 'playing' && (expired(L) || expired(R))) {
    const winner = L.client ? 'L' : R?.client ? 'R' : null;
    if (!winner) { destroyRoom(room); return; }
    room.phase = 'result';
    if (room.state) room.state = { ...room.state, over: true, winner, paused: false };
    // Keep the forfeiting seat reserved through results. It may reconnect to see the result.
    for (const p of [L, R]) {
      p.absentUntil = null;
      p.again = false;
    }
    broadcast(room, { type: 'forfeit', winner });
  } else {
    if (expired(L)) { destroyRoom(room); return; }
    if (expired(R)) {
      if (room.phase === 'result') {
        R.absentUntil = null;
        R.again = false;
      } else {
        room.players.R = null;
        L.ready = false;
      }
    }
  }
  schedule(room);
  roomChanged(room);
}
function start(room) {
  room.phase = 'playing';
  room.round++;
  room.state = null;
  for (const player of Object.values(room.players)) {
    player.ready = false;
    player.again = false;
  }
  schedule(room);
  roomChanged(room);
  broadcast(room, { type: 'start', round: room.round });
}

const heroKeys = ['wenguan', 'wujiang', 'chou'];
const unitKeys = ['yao', 'kuai', 'big'];
function validInput({ action, args }) {
  if (!Array.isArray(args)) return false;
  switch (action) {
    case 'selectHero': return args.length === 1 && heroKeys.includes(args[0]);
    case 'sendUnit': return args.length === 1 && unitKeys.includes(args[0]);
    case 'moveCursor':
    case 'changeLane': return args.length === 1 && (args[0] === -1 || args[0] === 1);
    case 'placeOrUpgrade': return args.length === 0 || (args.length === 1 && Number.isInteger(args[0]) && args[0] >= 0 && args[0] < 64);
    case 'pointer': return args.length === 0 || (args.length === 2 && args.every(Number.isFinite)
      && args[0] >= 0 && args[0] <= 960 && args[1] >= 0 && args[1] <= 540);
    case 'useUlt': return args.length === 0;
    default: return false;
  }
}
function acceptSnapshot(room, client, msg) {
  if (room.phase !== 'playing' && room.phase !== 'result') return;
  const { state, events } = msg;
  if (!state?.P?.L || !state.P.R || typeof state.over !== 'boolean' ||
      !Array.isArray(events) || events.length > 4096 ||
      (state.over && state.winner != null && !['L', 'R'].includes(state.winner))) return;
  if (room.phase === 'result' && !state.over) return;
  room.state = state;
  broadcast(room, { type: 'snapshot', state, events }, client);
  if (state.over && room.phase !== 'result') {
    room.phase = 'result';
    schedule(room);
    roomChanged(room);
  }
}

function receive(client, bytes) {
  const now = Date.now();
  if (now - client.rateStart > 1000) {
    client.rateStart = now;
    client.messages = 0;
  }
  if (++client.messages > 200) { close(client, 1008, 'Rate limit'); return; }
  let msg;
  try { msg = JSON.parse(bytes.toString('utf8')); } catch { close(client, 1007); return; }
  if (!msg || typeof msg !== 'object' || typeof msg.type !== 'string') return;
  const { room, role } = client;
  const player = room?.players[role];
  if (msg.type === 'ping' && Number.isFinite(msg.time)) {
    send(client, { type: 'pong', time: msg.time });
    if (player && Number.isInteger(msg.latency) && msg.latency >= 0 && msg.latency <= 15_000 &&
        (player.latency === null || Math.abs(player.latency - msg.latency) >= 3)) {
      player.latency = msg.latency;
      if (room.phase !== 'playing') roomChanged(room);
    }
    return;
  }
  if (!room) {
    if (msg.type === 'create') {
      if (client.joinOnly) error(client, '此版本仅支持加入房间');
      else create(client, msg.name);
    }
    else if (msg.type === 'join' && typeof msg.code === 'string' && /^\d{4}$/.test(msg.code)) join(client, msg);
    else error(client, '请输入 4 位数字房间码');
    return;
  }
  if (msg.type === 'leave') { detach(client, true); return; }
  if (!player || player.client !== client) return;
  switch (msg.type) {
    case 'name':
      player.name = nick(msg.name, role);
      roomChanged(room);
      break;
    case 'ready':
      if (room.phase === 'lobby' && typeof msg.ready === 'boolean') {
        player.ready = msg.ready;
        roomChanged(room);
      }
      break;
    case 'start':
      if (role === 'L' && room.phase === 'lobby' && player.ready && room.players.R?.ready && room.players.R.client) start(room);
      break;
    case 'input':
      if (role === 'R' && room.phase === 'playing' && room.deadline === null && validInput(msg)) {
        send(room.players.L.client, { type: 'input', side: role, action: msg.action, args: msg.args });
      }
      break;
    case 'snapshot':
      if (role === 'L') acceptSnapshot(room, client, msg);
      break;
    case 'again':
      if (room.phase !== 'result') break;
      player.again = true;
      if (Object.values(room.players).every((p) => p?.again && p.client)) start(room);
      else roomChanged(room);
      break;
  }
}

function lanUrls(port, ipv6) {
  const found = new Map();
  for (const [name, info] of Object.entries(networkInterfaces())) {
    for (const entry of info) {
      if (entry.internal) continue;
      const v4 = entry.family === 'IPv4';
      if (!v4 && (!ipv6 || entry.address.toLowerCase().startsWith('fe80:'))) continue;
      const virtual = /virtual|vpn|hyper-v|vmware|virtualbox|wsl|utun|tap|tun|docker|loopback/i.test(name)
        || /^00(?::00){5}$/.test(entry.mac);
      const auto = v4 && /^(169\.254|198\.1[89])\./.test(entry.address);
      const rank = (virtual ? 4 : 0) + (auto ? 8 : 0) + (v4 ? 0 : 1);
      const url = 'http://' + (v4 ? entry.address : '[' + entry.address + ']') + ':' + port + '/';
      found.set(url, Math.min(rank, found.get(url) ?? Infinity));
    }
  }
  return [...found].sort((a, b) => a[1] - b[1]).map(([url]) => url);
}

function openBrowser(url) {
  const options = { windowsHide: true };
  const handler = (err) => { if (err) console.log('请手动打开浏览器：' + url); };
  if (process.platform === 'win32') execFile('explorer.exe', [url], options, (err) => {
    // Explorer returns status 1 after handing URLs to the existing shell.
    if (err && err.code !== 1) handler(err);
  });
  else if (process.platform === 'darwin') execFile('open', [url], options, handler);
  else execFile('xdg-open', [url], options, handler);
}
function launch(port, binding = '::') {
  const server = createServer(serve);
  server.on('upgrade', upgrade);
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE' && port < 65535) {
      console.log('端口 ' + port + ' 已被占用，尝试 ' + (port + 1));
      launch(port + 1, binding);
    } else if (binding === '::' && ['EAFNOSUPPORT', 'EADDRNOTAVAIL', 'EINVAL'].includes(err.code)) {
      launch(port, '0.0.0.0');
    } else {
      console.error('无法启动局域网服务器：' + err.message);
      process.exitCode = 1;
    }
  });
  server.listen(port, binding, () => {
    const url = 'http://127.0.0.1:' + port + '/';
    addresses = lanUrls(port, binding === '::');
    console.log('\n《土楼争霸》局域网服务器');
    console.log('主机页面：' + url);
    if (addresses.length) {
      console.log('同一 Wi-Fi 的其他设备请打开：');
      for (const address of addresses) console.log('  ' + address);
    } else {
      console.log('未找到局域网 IP，请确认已连接 Wi-Fi 或热点后重新启动。');
    }
    if (process.platform === 'win32') console.log('若 Windows 防火墙弹窗，请点击【允许访问】。');
    console.log('对战时请保持此窗口开启。按 Ctrl+C 可关闭服务器。\n');
    if (!process.argv.includes('--no-open')) openBrowser(url);
    process.once('SIGINT', () => shutdown(server));
    process.once('SIGTERM', () => shutdown(server));
    if (process.platform === 'win32') process.once('SIGHUP', () => shutdown(server));
  });
}
function shutdown(server) {
  if (stopping) return;
  stopping = true;
  for (const socket of sockets) close(socket, 1001, 'Host server closed');
  server.close();
}
setInterval(() => {
  for (const client of sockets) {
    if (client.waitingPong) client.socket.destroy();
    else if (!client.room && Date.now() - client.joinedAt > 120_000) close(client, 1000);
    else {
      client.waitingPong = true;
      write(client, frame(9, Buffer.alloc(0)));
    }
  }
}, 4_000).unref();

const portArgument = process.argv.find((arg) => arg.startsWith('--port='))?.slice(7);
const port = portArgument == null ? 8080 : Number(portArgument);
const twaArgument = process.argv.find((arg) => arg.startsWith('--twa-origin='))?.slice('--twa-origin='.length);
if (twaArgument) {
  try {
    const url = new URL(twaArgument);
    if (url.protocol === 'https:' && !url.username && !url.password && url.pathname === '/' && !url.search && !url.hash) {
      twaOrigin = url.origin;
    }
  } catch { /* 由下面的分支给出启动参数提示。 */ }
}
if (!existsSync(path.join(root, 'index.html'))) {
  console.error('找不到游戏文件。请保留 server 文件夹与 index.html 的相对位置。');
  process.exitCode = 1;
} else if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('端口须在 1–65535 之间。');
  process.exitCode = 1;
} else if (twaArgument != null && !twaOrigin) {
  console.error('--twa-origin 必须是 HTTPS 网站来源，例如 https://用户名.github.io');
  process.exitCode = 1;
} else {
  launch(port);
}
