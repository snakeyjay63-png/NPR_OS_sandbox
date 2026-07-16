// ═══════════════════════════════════════════════════
// boot.js — NPR Local Unified Boot
// ═══════════════════════════════════════════════════
// All services in one process. Single kill to stop all.
// :5000 = npr-local, :5004 = geowon, :5010 = config
// ═══════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');

const servers = [];

// ─── Helpers ───

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg':  'image/svg+xml',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.md':   'text/markdown; charset=utf-8',
};

// ─── Config Server (:5010) ───

const configServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  let urlPath = new URL(req.url, 'http://localhost').pathname;
  if (urlPath === '/') urlPath = '/config-llama.html';

  const filePath = path.join(__dirname, 'public', urlPath);
  if (!fs.existsSync(filePath) || !filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(404); res.end('404'); return;
  }
  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
  res.end(fs.readFileSync(filePath));
});

configServer.listen(5010, () => console.log('[5010] Config server'));
servers.push(configServer);

// ─── Geowon Memory Gateway (:5004) ───

const geowonDir = path.join(__dirname, '..', '..', 'geowon', 'memory');
if (!fs.existsSync(geowonDir)) fs.mkdirSync(geowonDir, { recursive: true });

const sessions = new Map();

function saveSession(id, data) {
  const f = path.join(geowonDir, `${id}.json`);
  fs.writeFileSync(f, JSON.stringify(data, null, 2));
}

const geowonServer = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');

  if (url.pathname.startsWith('/session/')) {
    const id = url.pathname.replace(/^\/session\//, '');
    if (req.method === 'GET') {
      if (!sessions.has(id)) {
        const f = path.join(geowonDir, `${id}.json`);
        if (fs.existsSync(f)) sessions.set(id, JSON.parse(fs.readFileSync(f, 'utf-8')));
        else sessions.set(id, { history: [], createdAt: Date.now() });
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(sessions.get(id)));
      return;
    }
    if (req.method === 'POST') {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        try {
          const msg = JSON.parse(body);
          const session = sessions.get(id) || { history: [], createdAt: Date.now() };
          if (!session.history) session.history = [];
          if (Array.isArray(msg.history)) {
            for (const m of msg.history) session.history.push({ ...m, timestamp: Date.now() });
          } else {
            session.history.push({ ...msg, timestamp: Date.now() });
          }
          if (session.history.length > 50) session.history = session.history.slice(-50);
          sessions.set(id, session);
          saveSession(id, session);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ saved: true, historyLen: session.history.length }));
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  if (url.pathname === '/sessions' && req.method === 'GET') {
    const list = [];
    try {
      fs.readdirSync(geowonDir).forEach(f => {
        if (f.endsWith('.json')) {
          const data = JSON.parse(fs.readFileSync(path.join(geowonDir, f), 'utf-8'));
          list.push({ id: f.replace('.json', ''), historyLen: data.history?.length || 0 });
        }
      });
    } catch {}
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ sessions: list }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ status: 'geowon', port: 4004 }));
});

geowonServer.listen(5004, () => console.log('[5004] Geowon memory gateway'));
servers.push(geowonServer);

// ─── Boot Banner ───

console.log('\n╔═══════════════════════════════════════╗');
console.log('║     NPR Local v0.0.1 — Boot          ║');
console.log('║  :5000  npr-local (main)              ║');
console.log('║  :5004  geowon (memory)               ║');
console.log('║  :5010  config-llama (UI)             ║');
console.log('║  :8765  llama-server (model)          ║');
console.log('╚═══════════════════════════════════════╝\n');

// ─── Main NPR Local (:4000) ───

// Temporarily suppress SIGINT from index.js (we handle shutdown)
const origHandlers = process.listeners('SIGINT').slice();
process.removeAllListeners('SIGINT');
process.removeAllListeners('SIGTERM');

require('./src/index');

// ─── Graceful Shutdown ───

process.on('SIGINT', () => {
  console.log('\n[boot] Shutting down...');
  for (const s of servers) s.close(() => {});
  setTimeout(() => process.exit(0), 1000);
});

process.on('SIGTERM', () => {
  console.log('\n[boot] Shutting down...');
  for (const s of servers) s.close(() => {});
  setTimeout(() => process.exit(0), 1000);
});
