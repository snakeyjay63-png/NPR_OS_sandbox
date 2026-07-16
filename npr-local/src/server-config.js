// @net 10.13.0.0/24
// ═══════════════════════════════════════════════════
// server-config.js — Static file server :18000
// ═══════════════════════════════════════════════════
// 6 × 3000 = 18000
// Serves public/ directory
// ═══════════════════════════════════════════════════

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PORT = process.env.CONFIG_PORT || 18000;
const PUBLIC = path.join(__dirname, '..', 'public');

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

// Current llama-server config (from process)
const CURRENT_CONFIG = {
  model: 'Qwen3.6-27B-Q4_K_M.gguf',
  host: '127.0.0.1',
  port: 8765,
  gpuLayers: 79,            // bijna max RTX 4090 (standaard)
  ctxSize: 65536,
  parallel: 1,
  flashAttn: 'auto',
  offline: true,
};

// Proxy helper for llama-server requests
// @addr 10.13.1.1 | fd00:npr:0013:001::1 — llama proxy
function proxyRequest(targetUrl, req, res) {
  const parsed = new URL(targetUrl);
  const options = {
    hostname: parsed.hostname,
    port: parsed.port,
    path: parsed.pathname + parsed.search,
    method: req.method,
    headers: { 'Content-Type': 'application/json' }
  };
  
  const proxyReq = http.request(options, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (e) => {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Proxy error', message: e.message }));
  });
  
  req.pipe(proxyReq);
}

// Parse llama-server process arguments
// @addr 10.13.0.1 | fd00:npr:0013:000::1 — llama arg parser
function parseLlamaArgs(psOutput) {
  if (!psOutput) return CURRENT_CONFIG;
  
  const result = { ...CURRENT_CONFIG, raw: psOutput };
  
  // Extract values from command line
  const match = (re) => {
    const m = psOutput.match(re);
    return m ? m[1] : null;
  };
  
  result.ngl = parseInt(match(/--n-gpu-layers (\d+)/)) || 79;
  result.ctxSize = parseInt(match(/--ctx-size (\d+)/)) || 65536;
  result.parallel = parseInt(match(/--parallel (\d+)/)) || 1;
  result.port = parseInt(match(/--port (\d+)/)) || 8765;
  result.host = match(/--host ([\d.]+|[a-fA-F:]+)/) || '127.0.0.1';
  result.model = match(/--model (.+?)\s/) || match(/--model (.+)/) || result.model;
  
  return result;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost`);

  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Proxy to llama-server (:8765)
  if (url.pathname.startsWith('/llama/')) {
    const proxyPath = url.pathname.replace(/^\/llama\//, '');
    const proxyUrl = `http://127.0.0.1:8765/${proxyPath}`;
    proxyRequest(proxyUrl, req, res);
    return;
  }

  // Restart service — localhost only
  if (url.pathname === '/restart' && req.method === 'POST') {
    const clientIp = req.socket.remoteAddress;
    if (clientIp !== '::1' && clientIp !== '127.0.0.1' && clientIp !== '::ffff:127.0.0.1') {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'forbidden: restart requires localhost' }));
      return;
    }

    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { service } = JSON.parse(body || '{}');
        const nprLocalDir = path.resolve(__dirname, '..');
        const geowonDir = path.resolve(__dirname, '../../..', 'geowon');

        if (service === 'npr-local' || !service) {
          execSync(`pkill -f "node src/index.js"`, { timeout: 5000 });
          setTimeout(() => {
            const proc = execSync(`cd ${nprLocalDir} && nohup node src/index.js > /tmp/npr-local.log 2>&1 &`, { timeout: 3000 });
            console.log('[config] Restarted npr-local');
          }, 1500);
        }

        if (service === 'geowon') {
          execSync(`pkill -f "node index.js.*geowon" || lsof -ti :4004 | xargs kill`, { timeout: 5000 });
          setTimeout(() => {
            execSync(`cd ${geowonDir} && nohup node index.js > /tmp/geowon.log 2>&1 &`, { timeout: 3000 });
            console.log('[config] Restarted geowon');
          }, 1500);
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ restarted: service || 'npr-local' }));
      } catch(e) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Config endpoint (live process detection)
  if (url.pathname === '/config' && req.method === 'GET') {
    try {
      const psOutput = execSync('ps aux | grep llama-server | grep -v grep', { encoding: 'utf-8' });
      const args = parseLlamaArgs(psOutput.trim());
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(args, null, 2));
      return;
    } catch (e) {
      // Fallback to static config
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(CURRENT_CONFIG, null, 2));
      return;
    }
  }

  // Docs endpoint (serve markdown files)
  if (url.pathname.startsWith('/docs/')) {
    const relPath = url.pathname.replace('/docs/', '');
    const docsDir = path.join(__dirname, '..', 'docs');
    const filePath = path.join(docsDir, relPath);
    if (!filePath.startsWith(docsDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain' });
      res.end(data);
    });
    return;
  }

  let pathname = url.pathname;
  if (pathname === '/') pathname = '/index.html';
  const filePath = path.join(PUBLIC, pathname);

  if (!filePath.startsWith(PUBLIC)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Try index.html fallback
      if (err.code === 'ENOENT') {
        const index = path.join(PUBLIC, 'index.html');
        fs.readFile(index, (err2, idxData) => {
          if (err2) {
            res.writeHead(404);
            res.end('Not found');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(idxData);
        });
        return;
      }
      res.writeHead(500);
      res.end(err.message);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[config-server] Serving public/ on :${PORT}`);
  console.log(`[config-server] → http://[::1]:${PORT}/config-llama.html`);
});

process.on('SIGINT', () => server.close(() => process.exit(0)));
process.on('SIGTERM', () => server.close(() => process.exit(0)));
