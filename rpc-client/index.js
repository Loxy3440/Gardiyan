// Gardiyan Rich Presence istemcisi (BILGISAYARINDA calisir, Discord masaustu uygulamasi acik olmali).
// Panelden (Hesabim RP sekmesi) kaydettigin ayari siteden ceker ve Discord'un resmi yerel RPC'si (IPC) ile hesabina basar.
// Token kullanmaz, self-bot degildir. Bagimlilik yok; Node 20.6+ gerekir.
const net = require('net');
const path = require('path');

const SITE_URL = String(process.env.SITE_URL || '').replace(/\/+$/, '');
const RP_KEY = process.env.RP_KEY || '';
const RPC_CLIENT_ID = process.env.RPC_CLIENT_ID || '';
const POLL_MS = 15_000;

if (!SITE_URL || !RP_KEY || !RPC_CLIENT_ID) {
  console.error('Eksik ayar: .env icinde SITE_URL, RP_KEY ve RPC_CLIENT_ID olmali (.env.example dosyasina bak).');
  process.exit(1);
}

// ---------- Discord IPC ----------
const OP = { HANDSHAKE: 0, FRAME: 1, CLOSE: 2, PING: 3, PONG: 4 };

function ipcCandidates(i) {
  if (process.platform === 'win32') return [`\\\\?\\pipe\\discord-ipc-${i}`];
  const base = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  return [
    path.join(base, `discord-ipc-${i}`),
    path.join(base, 'snap.discord', `discord-ipc-${i}`),
    path.join(base, 'app', 'com.discordapp.Discord', `discord-ipc-${i}`),
  ];
}

function encode(op, data) {
  const json = Buffer.from(JSON.stringify(data));
  const buf = Buffer.alloc(8 + json.length);
  buf.writeInt32LE(op, 0);
  buf.writeInt32LE(json.length, 4);
  json.copy(buf, 8);
  return buf;
}

function tryConnect(p) {
  return new Promise(resolve => {
    const sock = net.createConnection(p);
    sock.once('connect', () => resolve(sock));
    sock.once('error', () => resolve(null));
  });
}

let conn = null; // { sock, ready }
let pending = new Map();
let nonce = 0;

async function connect() {
  let sock = null;
  for (let i = 0; i < 10 && !sock; i++) for (const p of ipcCandidates(i)) { sock = await tryConnect(p); if (sock) break; }
  if (!sock) return null;

  const state = { sock, ready: false, buf: Buffer.alloc(0) };
  const ready = new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('Discord yanit vermedi')), 8000);
    state.onReady = () => { clearTimeout(t); resolve(); };
    state.onFail = e => { clearTimeout(t); reject(e); };
  });

  sock.on('data', chunk => {
    state.buf = Buffer.concat([state.buf, chunk]);
    while (state.buf.length >= 8) {
      const op = state.buf.readInt32LE(0), len = state.buf.readInt32LE(4);
      if (state.buf.length < 8 + len) break;
      let msg = {};
      try { msg = JSON.parse(state.buf.subarray(8, 8 + len).toString('utf8')); } catch {}
      state.buf = state.buf.subarray(8 + len);
      if (op === OP.PING) sock.write(encode(OP.PONG, msg));
      else if (op === OP.CLOSE) { state.onFail?.(new Error(msg.message || 'Discord baglantiyi kapatti')); sock.destroy(); }
      else if (op === OP.FRAME) {
        if (msg.evt === 'READY') { state.ready = true; state.onReady(); console.log(`[RPC] Discord'a baglandi (${msg.data?.user?.username || 'kullanici'})`); }
        else if (msg.nonce && pending.has(msg.nonce)) {
          const { resolve, reject } = pending.get(msg.nonce); pending.delete(msg.nonce);
          msg.evt === 'ERROR' ? reject(new Error(msg.data?.message || 'RPC hatasi')) : resolve(msg);
        }
      }
    }
  });
  sock.on('close', () => { if (conn === state) conn = null; for (const p of pending.values()) p.reject(new Error('Baglanti koptu')); pending.clear(); });
  sock.on('error', () => {});

  sock.write(encode(OP.HANDSHAKE, { v: 1, client_id: RPC_CLIENT_ID }));
  try { await ready; } catch (err) { sock.destroy(); console.error('[RPC] El sikisma basarisiz:', err.message); return null; }
  return state;
}

function request(state, cmd, args) {
  return new Promise((resolve, reject) => {
    const id = String(++nonce);
    const t = setTimeout(() => { pending.delete(id); reject(new Error('RPC zaman asimi')); }, 8000);
    pending.set(id, { resolve: m => { clearTimeout(t); resolve(m); }, reject: e => { clearTimeout(t); reject(e); } });
    state.sock.write(encode(OP.FRAME, { cmd, args, nonce: id }));
  });
}

// ---------- Ayar -> Discord aktivitesi ----------
function buildActivity(cfg) {
  const a = { type: cfg.type };
  if (cfg.details) a.details = cfg.details;
  if (cfg.state) a.state = cfg.state;
  if (cfg.timer === 'now' && cfg.updatedAt) a.timestamps = { start: Math.floor(cfg.updatedAt / 1000) };
  const assets = {};
  if (cfg.largeImage) assets.large_image = cfg.largeImage;
  if (cfg.largeText) assets.large_text = cfg.largeText;
  if (cfg.smallImage) assets.small_image = cfg.smallImage;
  if (cfg.smallText) assets.small_text = cfg.smallText;
  if (Object.keys(assets).length) a.assets = assets;
  if (cfg.buttons && cfg.buttons.length) a.buttons = cfg.buttons.slice(0, 2).map(b => ({ label: b.label, url: b.url }));
  return a;
}

async function fetchConfig() {
  const res = await fetch(SITE_URL + '/api/rp/config', { headers: { Authorization: 'Bearer ' + RP_KEY } });
  if (res.status === 401) throw new Error('RP_KEY yanlis veya Render\'da RP_KEY tanimli degil.');
  if (!res.ok) throw new Error('Site hata verdi: ' + res.status);
  return res.json();
}

let lastApplied = null; // son basilan ayarin parmak izi (baglanti kopunca sifirlanir)

async function tick() {
  let cfg;
  try { cfg = await fetchConfig(); }
  catch (err) { console.error('[SITE]', err.message); return; }

  if (!conn) {
    conn = await connect();
    lastApplied = null;
    if (!conn) { console.log('[RPC] Discord masaustu uygulamasi bulunamadi, tekrar denenecek...'); return; }
  }

  const want = cfg.enabled ? JSON.stringify(buildActivity(cfg)) : 'off';
  if (want === lastApplied) return;
  try {
    await request(conn, 'SET_ACTIVITY', { pid: process.pid, activity: cfg.enabled ? buildActivity(cfg) : null });
    lastApplied = want;
    console.log(cfg.enabled ? '[RPC] Rich Presence guncellendi.' : '[RPC] Rich Presence kapatildi.');
  } catch (err) {
    console.error('[RPC] Ayarlanamadi:', err.message);
  }
}

console.log('Gardiyan RP istemcisi basladi. Kapatmak icin Ctrl+C.');
tick();
setInterval(tick, POLL_MS);
process.on('SIGINT', async () => {
  try { if (conn) await request(conn, 'SET_ACTIVITY', { pid: process.pid, activity: null }); } catch {}
  process.exit(0);
});
