// ═══════════════════════════════════════════════════
// interface/gateway.js — Minimal HTTP Gateway
// ═══════════════════════════════════════════════════
// Stripped from OpenClaw server-http.ts
// No auth, no multi-agent, no external channels.
// Single agent. Local only.
// @net 10.02.0.0/24
// ═══════════════════════════════════════════════════

const http = require('http');
const { dispatch, manifest, phaseInfo } = require('../routes/core');

// ─── Global tick tracking ───
// @addr 10.02.4.0 — tick data (shared with stroom)
const ticks = new Map();

// @addr 10.02.3.1 | fd00:npr:0002:003::1 — error serializer
function safeError(err) {
  const safe = typeof err === 'string' ? { message: err } : { message: err.message || String(err) };
  if (process.env.NODE_ENV === 'development') {
    safe.devHint = err.message; // log-only hint, no stack
  }
  return safe;
}

// ─── Status ───

const startTime = Date.now();

// @addr 10.02.3.2 | fd00:npr:0002:003::2 — uptime helper
function uptime() {
  const s = Math.floor((Date.now() - startTime) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}

// ─── Built-in routes ───

// @addr 10.02.1.1 | fd00:npr:0002:001::1 — health endpoint
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

// @addr 10.02.1.3 | fd00:npr:0002:001::3 — server factory
function createServer(routes) {
  // Register built-in routes
  routes.register(0, '/health', handleHealth);
  routes.register(0, '/status', handleStatus);
  routes.register(0, '/npr/trace', handleNprTrace);

  const server = http.createServer((req, res) => {
    // ─── Global tick tracking ───
    const tickStart = process.hrtime.bigint();
    const tickKey = req.url.split('?')[0];
    const origEnd = res.end;
    res.end = function (...args) {
      // Compute μs integer
      const tickUsInt = Math.round(Number(process.hrtime.bigint() - tickStart) / 1000);
      const arr = ticks.get(tickKey) || [];
      arr.push(tickUsInt);
      ticks.set(tickKey, arr.slice(-50));
      // Inject tickUs into JSON body if response is JSON
      const body = args[0];
      if (typeof body === 'string' && body.trimStart().startsWith('{')) {
        try {
          const obj = JSON.parse(body);
          obj.tickUs = tickUsInt;
          args[0] = JSON.stringify(obj, null, 2);
        } catch(e) {
          // not valid JSON, pass through
        }
      }
      origEnd.apply(res, args);
    };

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

    // Body size limit (1MB)
    const MAX_BODY = 1 * 1024 * 1024;
    let body = '';
    let bodyTooLarge = false;

    req.setEncoding('utf8');
    req.on('data', chunk => {
      body += chunk;
      if (body.length > MAX_BODY && !bodyTooLarge) {
        bodyTooLarge = true;
        req.destroy();
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'request too large', limit: '1MB' }));
      }
    });
    req.on('end', () => {
      if (bodyTooLarge) return;

      // Only parse JSON for POST/PUT/PATCH/DELETE
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const contentType = req.headers['content-type'] || '';
        if (body && !contentType.includes('application/json')) {
          res.writeHead(415, { 'Content-Type': 'application/json' });
          req.body = {};
          res.end(JSON.stringify({ error: 'unsupported media type', expected: 'application/json' }));
          return;
        }
        try {
          req.body = body ? JSON.parse(body) : {};
        } catch (e) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          req.body = {};
          res.end(JSON.stringify({ error: 'invalid JSON', message: e.message }));
          return;
        }
      } else {
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
        }));
      }
    });
  });

  return server;
}

module.exports = { createServer, uptime, ticks };
