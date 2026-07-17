/**
 * NPR Local — Entry Point
 *
 * Rol: Server bootstrap + HTML verificatie
 * Kan: Server starten; verificatie HTML serveren via browser én curl
 *
 * @exports {boot, verifyHTML, handleFavicon}
 * @net 10.01.0.0/24
 */

const http = require('http');
const path = require('path');

const PKG = require('../package.json');
const log = require('./log');
const { createServer, ticks } = require('./interface/gateway');
const { register, manifest } = require('./routes/core');
const { handleAgentChat, handleAgentChatStream, getCurrentWorkspace, setCurrentWorkspace, listSessions, forkSession, mergeSessions, getContextBreath } = require('./agent/loop');
const { registerMap } = require('./routes/map-registry');
const { getContextForRoute, listWarehouse, PHASE_CONTEXT } = require('./memory/context');
const { discoverMaps } = require('./routes/map-to-ipv6');
const { selectByGoal, listCapabilities, routeCapability } = require('./routes/capabilities');
const BrowserBridge = require('./net/browser-bridge');

// ─── Config ───

const PORT = process.env.NPR_PORT || 17000;
const HOST = process.env.HOST || '::1';
const GW_PORT = process.env.GATEWAY_PORT || 5017;
const GW_HOST = process.env.GATEWAY_HOST || '::1';

// ─── Gateway Ground Layer ───
// The NPRGateway is the enduring foundation — sessions, turns, tools live here
let gateway = null;

async function ensureGateway() {
  if (gateway) return gateway;
  try {
    const { createGateway } = require('./gateway/index.cjs');
    gateway = createGateway({
      port: GW_PORT,
      hostname: GW_HOST,
    });
    await gateway.start();
    log.info('NPR-Gateway booted', { port: GW_PORT });
    return gateway;
  } catch (err) {
    log.warn('NPR-Gateway failed to start (running standalone)', { error: err.message });
    return null;
  }
}

// ─── Favicon ───
// @addr 10.01.0.1 | fd00:npr:0001:000::1 — favicon (•)
const FAVICON = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);

function handleFavicon(req, res) {
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=86400',
  });
  res.end(FAVICON);
}

/**
 * Boot — server starten met alle routes
 * @addr 10.01.0.2 | fd00:npr:0001:000::2
 * @returns {http.Server} Running server instance
 */
async function boot() {
  const routes = require('./routes/core');

  // ─── Agent routes ───
  register(16, '/agent/chat', handleAgentChat);
  register(17, '/agent/chat-stream', handleAgentChatStream);
  register(18, '/agent/workspace', (req, res) => {
    if (req.method === 'GET') {
      res.json({ workspace: getCurrentWorkspace() });
    } else if (req.method === 'POST') {
      setCurrentWorkspace(req.body.path);
      res.json({ workspace: getCurrentWorkspace() });
    }
  });

  // ─── Context Breath endpoint (Patanjali 1.5) ───
  register(19, '/agent/context', (req, res) => {
    const breath = getContextBreath();
    
    if (req.method === 'GET') {
      // GET: show state + discern
      res.json({
        state: breath.getState(),
        discern: breath.discern(),
      });
    } else if (req.method === 'POST') {
      // POST: push a block
      const { id, content, action } = req.body || {};
      
      if (action === 'expand') {
        const result = breath.expand(req.body.targetSize);
        res.json({ result, state: breath.getState() });
      } else if (action === 'compress') {
        const result = breath.compress();
        res.json({ result, state: breath.getState() });
      } else if (id && content) {
        const result = breath.push(id, content);
        res.json({ result, discern: breath.discern() });
      } else {
        res.status(400).json({ error: 'require: {id, content} or {action: "expand"|"compress"}' });
      }
    } else if (req.method === 'DELETE') {
      // DELETE: remove a block
      const { id } = req.body || {};
      if (id) {
        breath.deleteBlock(id);
        res.json({ deleted: id, state: breath.getState() });
      } else {
        res.status(400).json({ error: 'require: {id}' });
      }
    }
  });

  // ─── Context 64K: Harmonisch Blokmodel ───
  register(54, '/context/64k', (req, res) => {
    const { Context64K, FIELDS, BLOCK_SIZE, BLOCK_COUNT, MAX_CONTEXT_TOKENS, analyzeContext64K } = require('./field/context-64k.cjs');
    const ctx = new Context64K();

    if (req.method === 'GET') {
      res.json({
        status: ctx.status(),
        validation: ctx.validate(),
        constants: { BLOCK_SIZE, BLOCK_COUNT, MAX_CONTEXT_TOKENS },
        fields: FIELDS,
      });
    } else if (req.method === 'POST') {
      const { action, field, blocks, ratio } = req.body || {};

      if (action === 'allocate') {
        const result = ctx.allocate(field, blocks);
        res.json({ allocated: result, status: ctx.status(), validation: ctx.validate() });
      } else if (action === 'compact') {
        const result = ctx.compact(field || 'recent', 'summary', ratio || 4);
        res.json({ result, status: ctx.status(), validation: ctx.validate() });
      } else if (action === 'analyze') {
        const result = analyzeContext64K(ctx);
        res.json({ analysis: result, status: ctx.status() });
      } else if (action === 'reset') {
        ctx.reset();
        res.json({ status: ctx.status(), validation: ctx.validate() });
      } else {
        res.status(400).json({ error: 'require: {action: "allocate"|"compact"|"analyze"|"reset"}' });
      }
    }
  });

  // ─── Fase 1: OpenClaw CLI parity ───

  // GET /agent/logs — tail agent event log (openclaw logs)
  register(20, '/agent/logs', require('./routes/agent-logs').handler);

  // GET/POST /config — config read/write (openclaw config get/set)
  register(21, '/config', require('./routes/config-route').handler);

  // GET /memory/context?slot=&phase=&workspace= — phase-appropriate context (openclaw memory context)
  register(53, '/memory/context', require('./routes/memory-context').handler);

  // GET /memory/search?q= — memory search (openclaw memory search)
  register(22, '/memory/search', require('./routes/memory-search').handler);

  // GET /doctor — self-diagnose + repair (openclaw doctor)
  register(23, '/doctor', require('./routes/doctor').handler);

  // GET/POST /tool/exec — system tool integration (bluetoothctl, tmux, lazygit, ffmpeg, htop, git)
  register(25, '/tool/exec', require('./routes/tool-exec').handler);

  // POST /tty/agent — terminal agent turn (for --tty mode)
  register(24, '/tty/agent', (req, res) => {
    if (req.method === 'POST' && req.body) {
      const { message, session } = req.body;
      if (!message) {
        return res.status(400).json({ error: 'require: {message}' });
      }
      
      // Reuse agentTurn from loop
      handleAgentChat(req, res, { message, session });
    } else {
      res.status(405).json({ error: 'POST with {message} required' });
    }
  });

  // ─── Auto-discover tools ───
  const toolsDir = path.join(__dirname, 'sources');
  const mapResult = registerMap(toolsDir, '/tool');

  // ─── Favicon ───
  register(0, '/favicon.ico', handleFavicon);

  // ─── Enter portal ───
  register(0, '/enter', enterHTML);

  // ─── Gateway Dashboard (proxy to gateway) ───
  register(0, '/dashboard', (req, res) => {
    const fs = require('fs');
    const dashboardPath = path.join(__dirname, '..', 'dashboard', 'index.html');
    if (fs.existsSync(dashboardPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(dashboardPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>Dashboard not found</h1>');
    }
  });

  // ─── Gateway API proxy (for unified access) ───
  register(0, '/api/gateway/proxy', (req, res) => {
    const http = require('http');
    const proxyOpts = {
      hostname: GW_HOST === '::1' ? '::1' : GW_HOST,
      port: GW_PORT,
      path: req.url.split('?')[1] ? '?' + req.url.split('?')[1] : '',
      method: req.method,
      headers: { ...req.headers, host: `${GW_HOST}:${GW_PORT}` },
    };
    const proxyReq = http.request(proxyOpts, (proxyRes) => {
      res.writeHead(proxyRes.statusCode, proxyRes.headers);
      proxyRes.pipe(res);
    });
    proxyReq.on('error', () => {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Gateway unreachable', port: GW_PORT }));
    });
    req.pipe(proxyReq);
  });

  // ─── Chat UI (GET = HTML, POST/other = agent handler from priority 16) ───
  // Note: handleAgentChat already registered at priority 16 above
  // This priority-0 handler serves the HTML page on GET requests only
  register(0, '/agent/chat', (req, res) => {
    if (req.method === 'GET') {
      const fs = require('fs');
      const chatPath = path.join(__dirname, '..', 'public', 'chat.html');
      if (fs.existsSync(chatPath)) {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(chatPath).pipe(res);
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>Chat not found</h1>');
      }
    } else {
      // POST/PUT → fall through to handleAgentChat (priority 16)
      handleAgentChat(req, res);
    }
  });

  // ─── Settings UI ───
  register(0, '/config', (req, res) => {
    const fs = require('fs');
    const configPath = path.join(__dirname, '..', 'public', 'config-llama.html');
    if (fs.existsSync(configPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(configPath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>Config not found</h1>');
    }
  });

  // ─── Verificatie endpoint ───
  register(0, '/verify', verifyHTML);

  // ─── Tick endpoint (JSON) ───
  register(0, '/tick', (req, res) => {
    const key = '/tick';
    const arr = ticks.get(key) || [];
    const last = arr.length ? arr[arr.length - 1] : null;
    res.json({
      uptime: Math.floor(process.uptime()),
      tick: {
        lastUs: last,           // &micro;s integer
        lastMs: last ? (last / 1000).toFixed(3) : null,
        lastHex: last ? '0x' + last.toString(16).toUpperCase() : null,
        count: arr.length,
      },
    });
  });

  // ─── Stroom endpoint (GBS Hub speed measurement) ───
  const stroomHandler = require('./routes/stroom').handler(ticks);
  register(0, '/gbs-hub/gbs/stroom', stroomHandler);
  register(0, '/stroom', stroomHandler);

  // ─── Browser Bridge (slot 59 — WebAPI → kernel routes) ───
  register(59, '/bridge', (req, res) => {
    const fs = require('fs');
    const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'bridge.html'), 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  register(59, '/bridge/api', (req, res, ctx) => {
    const name = ctx.url.searchParams.get('name');
    const api = ctx.url.searchParams.get('api');
    const slot = ctx.url.searchParams.get('slot');
    const text = ctx.url.searchParams.get('text');
    const category = ctx.url.searchParams.get('category');

    if (text) {
      return res.json(BrowserBridge.routeFromText(text));
    }
    if (api) {
      return res.json(BrowserBridge.routeFromAPI(api));
    }
    if (name) {
      return res.json(BrowserBridge.getRouteByName(name));
    }
    if (slot !== null) {
      return res.json(BrowserBridge.getRoute(parseInt(slot)));
    }
    if (category) {
      return res.json({ category, routes: BrowserBridge.listCapabilities(category) });
    }
    res.json({ map: BrowserBridge.map, total: 64 });
  });

  // ─── Gateway Introspection (slot 62 — self-knowledge) ───
  register(62, '/introspect', require('./routes/gateway-introspect').handler);

  // ─── Llama Supervisor (slot 61 — llama.cpp lifecycle) ───
  const llamaControl = require('./routes/llama-control');
  register(61, '/llama/status', llamaControl.handlerStatus);
  register(61, '/llama/start', llamaControl.handlerStart);
  register(61, '/llama/stop', llamaControl.handlerStop);
  register(61, '/llama/restart', llamaControl.handlerRestart);
  register(61, '/llama/logs', llamaControl.handlerLogs);
  register(61, '/llama/config', llamaControl.handlerConfig);
  register(61, '/llama/stream', llamaControl.handlerStream);
  register(61, '/llama/probe', llamaControl.handlerProbe);

  // ─── NPR Hex VM (slot 63 — assembly sandbox) ───
  const hexVm = require('./routes/hex-vm');
  register(63, '/hex-vm/status', hexVm.handlerStatus);
  register(63, '/hex-vm/opcode', hexVm.handlerOpcode);
  register(63, '/hex-vm/assemble', hexVm.handlerAssemble);
  register(63, '/hex-vm/run', hexVm.handlerRun);
  register(63, '/hex-vm/execute', hexVm.handlerExecute);
  register(63, '/hex-vm/disassemble', hexVm.handlerDisassemble);

  // ─── Memory API (read-only viewer routes) ───
  // Files accessed via API route, not bundled into npr-local.
  // Validates the full connection path: browser → runtime → workspace.
  register(53, '/api/memory/surface', (req, res) => {
    const wsDir = process.env.WORKSPACE || path.join(__dirname, '..', '..', '..');
    const memDir = path.join(wsDir, 'memory');
    const fs = require('fs');
    try {
      const files = fs.readdirSync(memDir).filter(f => f.endsWith('.md')).sort();
      // Load today's + yesterday's
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      let content = "# Surface — Daily Notes\n";
      let lines = 0;
      for (const d of [today, yesterday]) {
        const f = d + '.md';
        if (files.includes(f)) {
          content += `\n--- ${d} ---\n`;
          const c = fs.readFileSync(path.join(memDir, f), 'utf8');
          content += c;
          lines += c.split('\n').length;
        }
      }
      res.json({ content, lines, files: files.slice(-7).map(f => 'memory/' + f) });
    } catch (e) {
      res.json({ content: '(memory directory not accessible)', lines: 0, files: [] });
    }
  });

  register(53, '/api/memory/deep', (req, res) => {
    const wsDir = process.env.WORKSPACE || path.join(__dirname, '..', '..', '..');
    const fs = require('fs');
    try {
      const f = path.join(wsDir, 'MEMORY_claw.md');
      const c = fs.readFileSync(f, 'utf8');
      res.json({ content: c, lines: c.split('\n').length, files: ['MEMORY_claw.md'] });
    } catch (e) {
      res.json({ content: '(MEMORY_claw.md not found)', lines: 0, files: [] });
    }
  });

  register(53, '/api/memory/bedrock', (req, res) => {
    const wsDir = process.env.WORKSPACE || path.join(__dirname, '..', '..', '..');
    const fs = require('fs');
    try {
      const files = ['SOUL.md', 'USER.md', 'IDENTITY.md'];
      let content = '# Bedrock — Identity & User\n';
      let lines = 1;
      for (const f of files) {
        const p = path.join(wsDir, f);
        content += `\n--- ${f} ---\n`;
        try {
          const c = fs.readFileSync(p, 'utf8');
          content += c;
          lines += c.split('\n').length;
        } catch (e) {
          content += '(not found)';
        }
      }
      res.json({ content, lines, files });
    } catch (e) {
      res.json({ content: '(bedrock directory not accessible)', lines: 0, files: [] });
    }
  });

  register(53, '/api/memory/file', (req, res, ctx) => {
    const wsDir = process.env.WORKSPACE || path.join(__dirname, '..', '..', '..');
    const name = ctx.url.searchParams.get('name');
    const fs = require('fs');
    if (!name) return res.json({ error: 'name required' });
    try {
      // Sanitize: only allow .md files from memory/ or workspace root
      const safeName = name.replace(/\.\./g, '').replace(/^\//, '');
      let p = path.join(wsDir, 'memory', safeName);
      if (!fs.existsSync(p)) p = path.join(wsDir, safeName);
      if (!fs.existsSync(p)) return res.json({ error: 'file not found' });
      const c = fs.readFileSync(p, 'utf8');
      res.json({ content: c, lines: c.split('\n').length, path: p });
    } catch (e) {
      res.json({ error: e.message });
    }
  });

  // ─── Memory Viewer UI ───
  register(0, '/memory', (req, res) => {
    const fs = require('fs');
    const p = path.join(__dirname, '..', 'public', 'memory-viewer.html');
    if (fs.existsSync(p)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      fs.createReadStream(p).pipe(res);
    } else {
      res.writeHead(404); res.end('Memory viewer not found');
    }
  });

  // ─── Context endpoints ───
  register(48, '/context', (req, res, ctx) => {
    const slot = parseInt(ctx.url.searchParams.get('slot')) || 0;
    const wsDir = process.env.WORKSPACE || path.join(__dirname, '..', '..', '..');
    res.json(getContextForRoute(slot, wsDir));
  });

  register(52, '/warehouse', (req, res, ctx) => {
    const wsDir = process.env.WORKSPACE || path.join(__dirname, '..', '..', '..');
    res.json({ warehouse: listWarehouse(wsDir), phases: PHASE_CONTEXT });
  });

  // ─── Map → IPv6 ───
  register(60, '/maps', (req, res) => {
    res.json({
      island: '0.0.0.0',
      maps: discoverMaps(path.join(__dirname, 'sources')),
    });
  });

  // ─── Capabilities ───
  register(58, '/capabilities', (req, res) => {
    res.json({ island: '0.0.0.0', capabilities: listCapabilities() });
  });

  register(62, '/select', (req, res, ctx) => {
    const goal = ctx.url.searchParams.get('goal') || 'geen doel';
    res.json({ goal, selection: selectByGoal(goal) });
  });

  // ─── Sessions ───
  register(10, '/sessions', (req, res, ctx) => {
    if (req.method === 'GET') {
      res.json({ sessions: listSessions(), count: listSessions().length });
    } else if (req.method === 'POST') {
      const { sourceId, newId } = req.body;
      if (!sourceId) return res.status(400).json({ error: 'sourceId required' });
      const forked = forkSession(sourceId, newId);
      if (!forked) return res.status(404).json({ error: 'source session not found' });
      res.json({ forked, newId: forked.id });
    }
  });

  register(11, '/sessions/:id', (req, res, ctx) => {
    const { sessions } = require('./agent/loop');
    const session = sessions.get(ctx.params.id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({ id: session.id, turns: session.turns || 0, history: session.history || [], createdAt: session.createdAt });
  });

  register(12, '/sessions/:id/merge', (req, res, ctx) => {
    const { sourceId } = req.body;
    if (!sourceId) return res.status(400).json({ error: 'sourceId required' });
    const result = mergeSessions(ctx.params.id, sourceId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  });

  // ─── Start Gateway (ground layer) ───
  const gw = await ensureGateway();

  // ─── Start server ───
  const server = createServer(routes);
  server.listen(PORT, HOST, () => {
    log.info(`NPR-Local v${PKG.version} booted`, { host: HOST, port: PORT, pid: process.pid });
    console.log(`\nNPR-OS booted`);
    console.log(`  Runtime : ${HOST}:${PORT}`);
    console.log(`  Gateway : ${GW_HOST}:${GW_PORT}${gw ? ' ✓' : ' ✗'}`);
    console.log(`\n  Enter   : http://[${HOST}]:${PORT}/enter`);
    console.log(`  Dashboard: http://[${HOST}]:${PORT}/dashboard`);
    console.log(`  Verify  : http://[${HOST}]:${PORT}/verify`);
  });

  return server;
}

/**
 * Verify HTML — verificatie endpoint
 *
 * Retourneert HTML pagina met alle endpoints en status
 * Werkt via browser én curl
 *
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res
 * @addr 10.01.0.3 | fd00:npr:0001:000::3
 */
// Lines 183-310 replacement for verifyHTML

// ─── Helpers ───

function toHex(ms, digits = 4) {
  const val = Math.round(ms * 100);
  return '0x' + val.toString(16).toUpperCase().padStart(digits, '0');
}

function msToHex(ms) {
  return toHex(ms);
}

// ─── Verify HTML ───

function verifyHTML(req, res) {
  const uptime = Math.floor(process.uptime());
  const endpoints = Object.values(manifest());

  // Route rows
  const routeRows = endpoints.flatMap(e =>
    e.paths.map(p =>
      `<tr><td>GET</td><td><span class="curl">${p}</span></td><td>${e.phase}</td></tr>`
    )
  ).join('');

  // ─── Sunya baseline analysis (server-side &micro;s) ───
  // baseline = 64&micro;s = 2^6
  const SUNYA_BASELINE = 64;
  let allTicks = [];
  const tickRows = [];
  for (const [p, arr] of ticks) {
    if (!arr.length) continue;
    const last = arr[arr.length - 1]; // &micro;s integer
    const avg = Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
    allTicks.push(...arr);
    tickRows.push({
      path: p,
      last: last,       // &micro;s
      lastMs: (last / 1000).toFixed(3),
      lastHex: '0x' + last.toString(16).toUpperCase(),
      avg: avg,         // &micro;s
      avgMs: (avg / 1000).toFixed(3),
      avgHex: '0x' + avg.toString(16).toUpperCase(),
      count: arr.length,
      under: last < SUNYA_BASELINE
    });
  }

  const underHorizon = allTicks.filter(t => t < SUNYA_BASELINE).length;
  const aboveHorizon = allTicks.filter(t => t >= SUNYA_BASELINE).length;

  const tickTableHTML = tickRows.length > 0
    ? `<table class="table"><thead><tr><th>Path</th><th>Last (&micro;s)</th><th>Last (hex)</th><th>Avg (&micro;s)</th><th>Avg (hex)</th><th>Count</th></tr></thead><tbody>`
      + tickRows.map(t =>
          `<tr><td><span class="curl">${t.path}</span></td>`
          + `<td class="${t.under ? 'fast' : 'slow'}">${t.last}&micro;s (${t.lastMs}ms)</td>`
          + `<td class="hex">${t.lastHex}</td>`
          + `<td>${t.avg}&micro;s (${t.avgMs}ms)</td>`
          + `<td class="hex">${t.avgHex}</td>`
          + `<td class="tick">${t.count}</td></tr>`
        ).join('')
      + `</tbody></table>`
    : '<p class="tick">Nog geen requests gemeten</p>';

  // Compute horizon average for above-baseline ticks
  const aboveTicks = allTicks.filter(t => t >= SUNYA_BASELINE);
  const avgAbove = aboveTicks.length > 0
    ? Math.round(aboveTicks.reduce((a, b) => a + b, 0) / aboveTicks.length)
    : 0;

  const sunyaHTML = `
  <h2>◈ Tick Analysis</h2>
  <div class="sunya-analysis">
    <div class="sunya-line"><span class="sunya-label">sunya baseline</span> <span class="hex">${SUNYA_BASELINE}&micro;s = 2<sup>6</sup> (1→4→16→64 · 0.0.0.0)</span></div>
    <div class="sunya-line"><span class="sunya-label">horizon</span> ◈ ${underHorizon + aboveHorizon > 0 ? (underHorizon > aboveHorizon ? 'onder' : 'boven') : 'undefined'} (${avgAbove > 0 ? avgAbove + '&micro;s' : '—'}) — ${underHorizon + aboveHorizon > 0 ? (underHorizon > aboveHorizon ? 'onder de horizon' : 'boven de horizon') : '—'}</div>
    <div class="sunya-line"><span class="sunya-label">verspreiding</span> <span class="fast">${underHorizon} ≤ ${SUNYA_BASELINE}&micro;s</span> · <span class="slow">${aboveHorizon} > ${SUNYA_BASELINE}&micro;s</span></div>
  </div>`;

  // Collect all testable paths from manifest
  // POST-only routes with test payloads (excluded from GET testPaths)
  // Single char = 1 token → 6bit → 24hexa routing path
  // "4" → slot 49, dr 7, 24H Hexa
  const postEndpoints = [
    { path: '/agent/chat', body: JSON.stringify({ message: '4', dryRun: true }) },
    { path: '/agent/chat-stream', body: JSON.stringify({ message: '4', dryRun: true }) },
  ];
  const postOnlyPaths = new Set(postEndpoints.map(p => p.path));

  const testPaths = endpoints.flatMap(e => e.paths).filter(p =>
    !p.includes(':') && p !== '/verify' && p !== '/favicon.ico' && !postOnlyPaths.has(p)
  );

  const html = `<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <link rel="icon" href="/favicon.ico">
  <title>NPR Local — Verificatie</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: monospace; background: #0a0a0a; color: #e0e0e0; padding: 2rem; }
    h1 { color: #fff; margin-bottom: 0.5rem; }
    h2 { color: #ccc; margin: 1rem 0 0.5rem; }
    .status { color: #0f0; }
    .slow { color: #f80; }
    .fast { color: #0f0; }
    .hex { color: #c0a060; font-family: monospace; }
    .table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
    .table th { text-align: left; padding: 0.5rem; border-bottom: 1px solid #333; color: #888; }
    .table td { padding: 0.5rem; border-bottom: 1px solid #222; }
    .curl { background: #1a1a1a; padding: 0.25rem 0.5rem; border-radius: 3px; color: #0f0; }
    .tick { font-size: 0.8rem; color: #555; }
    .footer { margin-top: 2rem; color: #555; font-size: 0.8rem; }
    .phase-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; margin: 2px; font-size: 0.85rem; }
    .btn { background: #1a1a1a; color: #0f0; border: 1px solid #0f0; padding: 0.5rem 1rem; cursor: pointer; font-family: monospace; border-radius: 3px; margin-right: 0.5rem; }
    .btn:hover { background: #0f0; color: #000; }
    .run-results { margin: 1rem 0; }
    .run-row { display: flex; gap: 1rem; padding: 0.25rem 0; border-bottom: 1px solid #1a1a1a; align-items: center; }
    .run-path { flex: 2; color: #0f0; }
    .run-time { flex: 1; text-align: right; }
    .run-hex { flex: 1; text-align: right; color: #c0a060; }
    .run-status { flex: 0.5; text-align: right; }
    .stroom-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0; }
    .stroom-card { background: #111; border: 1px solid #222; padding: 1rem; border-radius: 4px; }
    .stroom-label { color: #888; font-size: 0.85rem; }
    .stroom-value { font-size: 1.5rem; color: #0f0; margin: 0.25rem 0; }
    .stroom-hex { color: #c0a060; font-size: 0.85rem; }
    .stroom-fasen { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin: 1rem 0; }
    .fase-card { background: #111; padding: 1rem; border-radius: 4px; text-align: center; }
    .fase-l1 { border: 1px solid rgba(0,170,255,0.26); }
    .fase-l2 { border: 1px solid rgba(0,255,0,0.26); }
    .fase-l3 { border: 1px solid rgba(255,0,170,0.26); }
    .sunya-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1rem 0; }
    .loading { color: #f80; animation: blink 1s infinite; }
    @keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
    .sunya-analysis { background: #111; border: 1px solid #222; padding: 1rem; border-radius: 4px; margin: 1rem 0; }
    .sunya-line { padding: 0.25rem 0; border-bottom: 1px solid #1a1a1a; }
    .sunya-label { color: #888; min-width: 120px; display: inline-block; }
  </style>
</head>
<body>
  <h1>NPR Local v${PKG.version}</h1>
  <p class="status">Status: actief | Uptime: ${uptime}s</p>
  <p>Port: ${PORT} | Host: ${HOST}</p>

  <h2>Endpoints</h2>
  <table class="table">
    <thead><tr><th>Method</th><th>Path</th><th>Fase</th></tr></thead>
    <tbody>${routeRows}</tbody>
  </table>

  <h2>Fase-map</h2>
  <p>
    <span class="phase-badge" style="background:rgba(0,170,255,0.13);color:#0af;border:1px solid rgba(0,170,255,0.26)">maxwell</span>
    <span class="phase-badge" style="background:rgba(0,255,0,0.13);color:#0f0;border:1px solid rgba(0,255,0,0.26)">planck</span>
    <span class="phase-badge" style="background:rgba(255,0,170,0.13);color:#f0a;border:1px solid rgba(255,0,170,0.26)">mandelbrot</span>
  </p>

  <h2>Run/Test</h2>
  <div>
    <button class="btn" onclick="runAllTest()">Run GET</button>
    <button class="btn" onclick="runPostTest()">Test POST</button>
    <button class="btn" onclick="loadStroom()">Load /stroom</button>
  </div>
  <div id="runResults" class="run-results"></div>

  <h2>Stroom (GBS Hub Physics)</h2>
  <div id="stroomContainer">
    <p class="tick">Click "Load /stroom" to fetch live physics data</p>
  </div>

  <h2>Ticks (${tickRows.length} endpoints)</h2>
  ${tickTableHTML}
  ${sunyaHTML}

  <div class="footer">
    <p>Curl: <span class="curl">curl http://[${HOST}]:${PORT}/verify</span></p>
    <p>Fasen: maxwell → planck → mandelbrot | Alle routes → 0.0.0.0</p>
  </div>

  <script>
    const testPaths = ${JSON.stringify(testPaths)};

    function usToHex(us) {
      const val = Math.round(us);
      return '0x' + val.toString(16).toUpperCase().padStart(4, '0');
    }
    function fmtMs(ms) {
      // Show raw ms float — no rounding
      // e.g. 2.134123456ms → "2.134123456ms"
      return String(ms) + 'ms';
    }

    async function runAllTest() {
      const container = document.getElementById('runResults');
      container.innerHTML = '<p class="loading">Running ' + testPaths.length + ' GET endpoints...</p>';

      const results = [];

      for (const p of testPaths) {
        const start = performance.now();
        try {
          const resp = await fetch(p);
          const timeMs = performance.now() - start;
          let tickUs = null;
          if (resp.status === 200 && resp.headers.get('content-type')?.includes('json')) {
            try { const body = await resp.json(); tickUs = body.tickUs ?? null; } catch(e) {}
          }
          results.push({ path: p, method: 'GET', timeMs: timeMs, tickUs, status: resp.status, ok: resp.status >= 200 && resp.status < 300 });
        } catch(e) {
          results.push({ path: p, method: 'GET', timeMs: 0, tickUs: null, status: 'ERR', ok: false });
        }
      }

      let html = '<div style="margin-top:0.5rem">';
      results.forEach(r => {
        // Use server-side tickUs (real µs) when available; fallback to browser ms
        const serverUs = r.tickUs;
        const cls = serverUs != null ? (serverUs > 1000 ? 'slow' : 'fast') : (r.timeMs > 100 ? 'slow' : 'fast');
        html += '<div class="run-row">';
        html += '<span class="run-path">' + r.path + '</span>';
        html += '<span class="phase-badge" style="background:rgba(0,255,0,0.15);color:#0f0;border:1px solid rgba(0,255,0,0.3)">' + r.method + '</span>';
        if (serverUs != null) {
          html += '<span class="run-time ' + cls + '">' + serverUs + '&micro;s (' + usToHex(serverUs) + ')</span>';
        } else {
          html += '<span class="run-time ' + cls + '">' + String(r.timeMs) + 'ms</span>';
        }
        html += '<span class="run-status ' + (r.ok ? 'fast' : 'slow') + '">' + r.status + '</span>';
        html += '</div>';
      });
      html += '</div>';

      const tickUsResults = results.filter(r => r.tickUs != null);
      const totalTickUs = tickUsResults.reduce((a, b) => a + b.tickUs, 0);
      const avgTickUs = tickUsResults.length > 0 ? totalTickUs / tickUsResults.length : 0;
      const totalTimeMs = results.reduce((a, b) => a + b.timeMs, 0);
      const avgTimeMs = totalTimeMs / results.length;
      html += '<div style="margin-top:1rem;padding-top:0.5rem;border-top:1px solid #333">';
      html += '<strong>Server total:</strong> ' + totalTickUs + '&micro;s (' + usToHex(totalTickUs) + ') | ';
      html += '<strong>Server avg:</strong> ' + avgTickUs + '&micro;s (' + usToHex(avgTickUs) + ') | ';
      html += '<strong>Browser avg:</strong> ' + String(avgTimeMs) + 'ms | ';
      html += '<strong>Count:</strong> ' + results.length;
      html += '</div>';

      container.innerHTML = html;
    }

    async function runPostTest() {
      const container = document.getElementById('runResults');
      container.innerHTML = '<p class="loading">Testing ' + postEndpoints.length + ' POST endpoints (model call)...</p>';

      const results = [];
      const controller = new AbortController();

      for (const pe of postEndpoints) {
        const start = performance.now();
        try {
          const resp = await fetch(pe.path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: pe.body,
            signal: controller.signal
          });
          let tickUs = null;
          if (resp.status === 200) {
            try { const body = await resp.json(); tickUs = body.tickUs ?? null; } catch(e) {}
          }
          results.push({ path: pe.path, method: 'POST', tickUs, status: resp.status, ok: resp.status >= 200 && resp.status < 300 });
        } catch(e) {
          results.push({ path: pe.path, method: 'POST', tickUs: null, status: e.name === 'AbortError' ? 'TIMEOUT' : 'ERR', ok: false });
        }
      }

      let html = '<div style="margin-top:0.5rem">';
      results.forEach(r => {
        const serverUs = r.tickUs;
        const cls = serverUs != null ? (serverUs > 1000 ? 'slow' : 'fast') : 'slow';
        html += '<div class="run-row">';
        html += '<span class="run-path">' + r.path + '</span>';
        html += '<span class="phase-badge" style="background:rgba(255,136,0,0.15);color:#f80;border:1px solid rgba(255,136,0,0.3)">' + r.method + '</span>';
        if (serverUs != null) {
          html += '<span class="run-time ' + cls + '">' + serverUs + '&micro;s (' + usToHex(serverUs) + ')</span>';
        } else {
          html += '<span class="run-time slow">N/A (no server tick)</span>';
        }
        html += '<span class="run-status ' + (r.ok ? 'fast' : 'slow') + '">' + r.status + '</span>';
        html += '</div>';
      });
      html += '</div>';

      container.innerHTML = html;
    }

    const postEndpoints = ${JSON.stringify(postEndpoints)};

    async function loadStroom() {
      const container = document.getElementById('stroomContainer');
      container.innerHTML = '<p class="loading">Fetching /stroom...</p>';

      try {
        const resp = await fetch('/stroom');
        const data = await resp.json();

        let html = '';

        // Main metrics
        html += '<div class="stroom-grid">';
        html += '<div class="stroom-card"><div class="stroom-label">V (E-veld)</div><div class="stroom-value">' + data.V.toFixed(3) + '</div><div class="stroom-hex">' + msToHex(data.V) + '</div></div>';
        html += '<div class="stroom-card"><div class="stroom-label">I (B-veld)</div><div class="stroom-value">' + data.I.toFixed(3) + '</div><div class="stroom-hex">' + msToHex(data.I) + '</div></div>';
        html += '<div class="stroom-card"><div class="stroom-label">Ω (Weerstand)</div><div class="stroom-value">' + data.ohm.toFixed(3) + '</div><div class="stroom-hex">' + msToHex(data.ohm) + '</div></div>';
        html += '<div class="stroom-card"><div class="stroom-label">W (Vermogen)</div><div class="stroom-value">' + data.W.toFixed(3) + '</div><div class="stroom-hex">' + msToHex(data.W) + '</div></div>';
        html += '</div>';

        // Farasen
        html += '<div class="stroom-fasen">';
        html += '<div class="fase-card fase-l1"><div class="stroom-label">L1 (Maxwell)</div><div class="stroom-value" style="color:#0af">' + (data.fasen.L1.veld || 0).toFixed(3) + '</div><div class="stroom-hex">' + msToHex(data.fasen.L1.veld || 0) + '</div></div>';
        html += '<div class="fase-card fase-l2"><div class="stroom-label">L2 (Planck)</div><div class="stroom-value" style="color:#0f0">' + (data.fasen.L2.veld || 0).toFixed(3) + '</div><div class="stroom-hex">' + msToHex(data.fasen.L2.veld || 0) + '</div></div>';
        html += '<div class="fase-card fase-l3"><div class="stroom-label">L3 (Mandelbrot)</div><div class="stroom-value" style="color:#f0a">' + (data.fasen.L3.veld || 0).toFixed(3) + '</div><div class="stroom-hex">' + msToHex(data.fasen.L3.veld || 0) + '</div></div>';
        html += '</div>';

        // Sunya
        html += '<div class="sunya-grid">';
        html += '<div class="stroom-card"><div class="stroom-label">Zichtbaar</div><div class="stroom-value">' + data.sunya.zichtbaar + '</div></div>';
        html += '<div class="stroom-card"><div class="stroom-label">Slots</div><div class="stroom-value">' + data.sunya.slots + '</div></div>';
        html += '<div class="stroom-card"><div class="stroom-label">Noise</div><div class="stroom-value">' + data.sunya.noise.toFixed(4) + '</div><div class="stroom-hex">' + msToHex(data.sunya.noise) + '</div></div>';
        html += '<div class="stroom-card"><div class="stroom-label">Factor</div><div class="stroom-value">' + data.sunya.factor.toFixed(3) + '</div><div class="stroom-hex">' + msToHex(data.sunya.factor) + '</div></div>';
        html += '</div>';

        // Detail
        if (data.detail) {
          html += '<div style="margin-top:1rem"><span class="curl">' + (data.detail.faraday || data.detail.check || '') + '</span></div>';
        }

        container.innerHTML = html;
      } catch (e) {
        container.innerHTML = '<p class="slow">Error: ' + e.message + '</p>';
      }
    }

    // Auto-load stroom on page load
    loadStroom();
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}



/**
 * /enter — Minimal portal: chat + settings
 * @addr 10.01.0.0 | fd00:npr:0001:000::0
 */
function enterHTML(req, res) {
  const uptime = Math.floor(process.uptime());
  const uptimeH = Math.floor(uptime / 3600);
  const uptimeM = Math.floor((uptime % 3600) / 60);
  const uptimeS = uptime % 60;
  const uptimeStr = (uptimeH ? uptimeH + 'h ' : '') + (uptimeM || '0') + 'm ' + (uptimeS || '0') + 's';

  // Live gateway state detection
  const GW_PORT = process.env.GATEWAY_PORT || 5017;
  const GW_HOST = '[::1]';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>&bull; NPR-OS</title>
<style>
  :root {
    --bg: #0a0e14;
    --fg: #c9d1d9;
    --accent: #58a6ff;
    --muted: #484f58;
    --card: #161b22;
    --border: #21262d;
    --chat: #3fb950;
    --settings: #a371f7;
    --gateway: #f0883e;
    --runtime: #79c0ff;
    --field: #d2a8ff;
    --hexa: #ffa657;
    --memory: #f97583;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: var(--bg);
    color: var(--fg);
    font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    padding: 2rem;
    line-height: 1.6;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  h1 {
    font-size: 1.5rem;
    margin-bottom: 0.25rem;
    color: var(--accent);
  }
  h1 .dot {
    font-size: 2rem;
    vertical-align: middle;
  }
  .subtitle {
    color: var(--muted);
    font-size: 0.75rem;
    margin-bottom: 0.5rem;
  }
  .arch {
    font-size: 0.65rem;
    color: var(--muted);
    margin-bottom: 2rem;
    text-align: center;
    line-height: 2;
  }
  .arch .layer {
    display: inline-block;
    padding: 0.15rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 3px;
    margin: 0.1rem;
  }
  .arch .layer.active { border-color: var(--accent); color: var(--accent); }
  .arch .arrow { margin: 0 0.25rem; }
  .system-status {
    font-size: 0.7rem;
    color: var(--muted);
    margin-bottom: 2rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--border);
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .system-status .dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--chat);
    display: inline-block;
  }
  .system-status .dot.offline { background: #f87171; }
  .system-status .dot.loading { background: #facc15; animation: pulse 1s infinite; }
  @keyframes pulse { 0%,100%{ opacity:1; } 50%{ opacity:0.3; } }
  .cards {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    max-width: 600px;
    width: 100%;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    text-decoration: none;
    transition: border-color 0.2s;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }
  .card:hover { border-color: var(--accent); }
  .card-icon { font-size: 1.5rem; }
  .card-title { font-size: 0.85rem; font-weight: bold; }
  .card-desc { font-size: 0.65rem; color: var(--muted); }
  .card.chat .card-title { color: var(--chat); }
  .card.settings .card-title { color: var(--settings); }
  .card.gateway .card-title { color: var(--gateway); }
  .card.runtime .card-title { color: var(--runtime); }
  .card.memory .card-title { color: var(--memory); }
  .uptime {
    margin-top: 2rem;
    font-size: 0.6rem;
    color: var(--muted);
    letter-spacing: 1px;
  }
  .footer {
    margin-top: 1rem;
    font-size: 0.55rem;
    color: var(--muted);
    text-align: center;
  }
</style>
</head>
<body>
  <h1><span class="dot">&bull;</span> NPR-OS</h1>
  <p class="subtitle">Noise → Pattern → Return</p>

  <div class="arch">
    <span class="layer active" style="border-color:var(--gateway);color:var(--gateway)">Gateway :${GW_PORT}</span>
    <span class="arrow">→</span>
    <span class="layer active" style="border-color:var(--runtime);color:var(--runtime)">Runtime :${PORT}</span>
    <span class="arrow">→</span>
    <span class="layer">Field</span>
    <span class="arrow">→</span>
    <span class="layer">Hexa</span>
  </div>

  <div class="system-status" id="sys-status">
    <span class="dot loading"></span>
    <span>System: initializing...</span>
  </div>

  <div class="cards">
    <a href="/dashboard" class="card runtime">
      <span class="card-icon">◉</span>
      <span class="card-title">Dashboard</span>
      <span class="card-desc">Runtime monitor + SSE</span>
    </a>
    <a href="/agent/chat" class="card chat">
      <span class="card-icon">&ldquo;</span>
      <span class="card-title">Chat</span>
      <span class="card-desc">Agent conversation</span>
    </a>
    <a href="/memory" class="card memory">
      <span class="card-icon">🧠</span>
      <span class="card-title">Memory</span>
      <span class="card-desc">Layers + daily notes</span>
    </a>
    <a href="/gateway" class="card gateway">
      <span class="card-icon">⬡</span>
      <span class="card-title">Gateway</span>
      <span class="card-desc">Router + supervisor</span>
    </a>
    <a href="/config" class="card settings">
      <span class="card-icon">&#9881;</span>
      <span class="card-title">Config</span>
      <span class="card-desc">Model + settings</span>
    </a>
    <a href="/sec" class="card runtime">
      <span class="card-icon">🛡</span>
      <span class="card-title">Security</span>
      <span class="card-desc">/sec router</span>
    </a>
  </div>

  <p class="uptime">uptime ${uptimeStr} | pid ${process.pid} | port :${PORT}</p>

  <div class="footer">
    index.js → gateway/index.cjs → unified process
  </div>

  <script>
    // Live system health
    (async () => {
      const el = document.getElementById('sys-status');
      let gwOk = false, rtOk = false;

      // Check gateway
      try {
        const r = await fetch('/api/gateway/proxy?url=/api/gateway/status');
        if (r.ok) { gwOk = true; }
      } catch(e) {}

      // Fallback: direct gateway check
      if (!gwOk) {
        try {
          const r = await fetch('http://${GW_HOST}:${GW_PORT}/api/gateway/status');
          if (r.ok) {
            const d = await r.json();
            gwOk = true;
            el.innerHTML = '<span class="dot"></span><span>Gateway: ' + d.state + ' | Runtime: active</span>';
          }
        } catch(e) {}
      }

      // Check runtime health
      try {
        const r = await fetch('/health');
        if (r.ok) { rtOk = true; }
      } catch(e) {}

      if (gwOk && rtOk) {
        el.innerHTML = '<span class="dot"></span><span>Unified system active</span>';
      } else if (rtOk) {
        el.innerHTML = '<span class="dot"></span><span>Runtime active | Gateway: checking...</span>';
      } else {
        el.innerHTML = '<span class="dot offline"></span><span>System initializing...</span>';
      }
    })();
  </script>
</body>
</html>`;

  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
}

// ─── Uncaught exception handler (global safety net) ───
// @addr 10.01.0.9 — process-level error boundary
process.on('uncaughtException', (err) => {
  log.error('Uncaught exception', { message: err.message, stack: err.stack?.split('\n').slice(0, 3).join(' | ') });
  // Graceful shutdown — do NOT exit immediately, let pending requests finish
  const timer = setTimeout(() => {
    log.error('Force shutdown after 5s timeout');
    process.exit(1);
  }, 5000);
  timer.unref();
});

process.on('unhandledRejection', (reason, promise) => {
  log.error('Unhandled rejection', { reason: String(reason) });
});

// ─── Direct run ───

if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--tty') || args.includes('-t')) {
    // Terminal mode — fysiek toetsenbord → NPR field
    const terminal = require('./terminal');
    
    if (terminal.initTTY()) {
      console.log('Terminal mode active — press ESC to quit');
    } else {
      console.log('TTY mode failed — falling back to HTTP server');
      const server = boot();
      process.on('SIGINT', () => {
        console.log('\nShutting down...');
        server.close(() => process.exit(0));
      });
    }
  } else {
    // HTTP mode (default)
    const server = boot();

    process.on('SIGINT', () => {
      console.log('\nShutting down...');
      server.close(() => process.exit(0));
    });

    process.on('SIGTERM', () => {
      console.log('\nShutting down...');
      server.close(() => process.exit(0));
    });
  }
}

module.exports = { boot, verifyHTML };
