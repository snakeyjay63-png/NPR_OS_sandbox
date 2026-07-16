// ═══════════════════════════════════════════════════
// interface/gateway.js — Minimal HTTP Gateway
// ═══════════════════════════════════════════════════
// Stripped from OpenClaw server-http.ts
// No auth, no multi-agent, no external channels.
// Single agent. Local only.
// ═══════════════════════════════════════════════════

const http = require('http');
const { dispatch, manifest, phaseInfo } = require('../routes/core');

// ─── Status ───

const startTime = Date.now();

function uptime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

// ─── Built-in routes ───

function handleHealth(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: 'live',
    uptime: uptime(),
    model: 'local',
    origin: '0.0.0.0',
  }, null, 2));
}

function handleStatus(req, res) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    gateway: 'npr-local',
    version: '0.0.1',
    uptime: uptime(),
    routes: manifest(),
    origin: '0.0.0.0',
  }, null, 2));
}

function handleNprTrace(req, res) {
  // Show NPR routing trace for a given path
  const url = new URL(req.url, `http://localhost`);
  const target = url.searchParams.get('path') || '/';
  const hash = require('crypto').createHash('md5').update(target).digest();
  const slot = hash.readUInt32BE(0) % 64;

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    path: target,
    slot,
    ...phaseInfo(slot),
    origin: '0.0.0.0',
    return: '0.0.0.0',
  }, null, 2));
}

// ─── Server ───

function createServer(routes) {
  // Register built-in routes
  routes.register(0, '/health', handleHealth);
  routes.register(0, '/status', handleStatus);
  routes.register(0, '/npr/trace', handleNprTrace);

  const server = http.createServer((req, res) => {
    // JSON helper
    res.json = (data) => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data, null, 2));
    };
    res.status = (code) => ({
      json: (data) => {
        res.writeHead(code, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(data, null, 2));
      }
    });

    // CORS (local only)
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Parse body synchronously
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        req.body = body ? JSON.parse(body) : {};
      } catch {
        req.body = {};
      }

      // Route after body is parsed
      try {
        dispatch(req, res);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          error: 'internal',
          message: err.message,
          stack: err.stack,
        }));
      }
    });
  });

  return server;
}

module.exports = { createServer, uptime };
