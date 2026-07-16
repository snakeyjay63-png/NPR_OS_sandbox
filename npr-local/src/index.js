// ═══════════════════════════════════════════════════
// NPR Local — Entry Point
// ═══════════════════════════════════════════════════
// Single agent. Local only. NPR routing.
// ═══════════════════════════════════════════════════

const path = require('path');
const { createServer } = require('./interface/gateway');
const { register } = require('./routes/core');
const { handleAgentChat, handleAgentChatStream, getCurrentWorkspace, setCurrentWorkspace, listSessions, forkSession, mergeSessions } = require('./agent/loop');
const { registerMap } = require('./routes/map-registry');
const { getContextForRoute, listWarehouse, PHASE_CONTEXT } = require('./memory/context');
const { discoverMaps } = require('./routes/map-to-ipv6');
const { selectByGoal, listCapabilities, routeCapability } = require('./routes/capabilities');

// ─── Config ───

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '::1';

// ─── Boot ───

const routes = require('./routes/core');

// Register core routes
register(16, '/agent/chat', handleAgentChat); // slot 16 = 12P/Pattern
register(17, '/agent/chat-stream', handleAgentChatStream); // SSE streaming
register(18, '/agent/workspace', (req, res) => { // slot 18 = 13D/Direct
  if (req.method === 'GET') {
    res.json({ workspace: getCurrentWorkspace() });
  } else if (req.method === 'POST') {
    setCurrentWorkspace(req.body.path);
    res.json({ workspace: getCurrentWorkspace() });
  }
});

// Auto-register tools: elke map met index.js = route
const toolsDir = path.join(__dirname, 'sources');
const mapResult = registerMap(toolsDir, '/tool');
console.log(`[map-registry] Loaded ${mapResult.registered} tools`);

// Create and start server
const server = createServer(routes);

// Allow port reuse for faster restarts
server.listen(PORT, HOST, () => {
  console.log(`\nNPR Local v0.0.1`);
  console.log(`Host: ${HOST}:${PORT}`);
  console.log(`Origin: 0.0.0.0`);
  console.log(`Routes:`);
  console.log(`  GET  /health`);
  console.log(`  GET  /status`);
  console.log(`  GET  /npr/trace?path=<path>`);
  console.log(`  POST /agent/chat`);
  console.log(`  POST /agent/chat (tool:scan)`);
  console.log(`  /tool/* (auto-discovered)`);
  console.log(`  GET  /context?slot=N (dynamic context)`);
  console.log(`  GET  /warehouse (context files on disk)`);
  console.log(`  GET  /maps (map → IPv6 → curl)`);
  console.log(`  GET  /capabilities (wiskundige selectie)`);
  console.log(`  GET  /select?goal=<doel> (dynamische tool selectie)`);
  console.log(`  GET  /sessions (sessie lijst)`);
  console.log(`  POST /sessions (fork sessie)`);
  console.log(`  POST /sessions/:id/merge (merge sessie)`);
  console.log(`  GET  /sessions/:id (lees sessie)`);
  console.log('');

  // Register context endpoints
  register(48, '/context', (req, res, ctx) => {
    const slot = parseInt(ctx.url.searchParams.get('slot')) || 0;
    const wsDir = process.env.WORKSPACE || path.join(__dirname, '..', '..', '..', '.openclaw', 'workspace');
    const context = getContextForRoute(slot, wsDir);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(context, null, 2));
  });

  register(52, '/warehouse', (req, res, ctx) => {
    const wsDir = process.env.WORKSPACE || path.join(__dirname, '..', '..', '..', '.openclaw', 'workspace');
    const files = listWarehouse(wsDir);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ warehouse: files, phases: PHASE_CONTEXT }, null, 2));
  });

  // Map → IPv6 → curl (het eiland)
  register(60, '/maps', (req, res, ctx) => {
    const toolsDir = path.join(__dirname, 'sources');
    const maps = discoverMaps(toolsDir);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      island: '0.0.0.0',
      maps,
      note: 'Elke map = IPv6 = tool via curl',
    }, null, 2));
  });

  // Capabilities & dynamische selectie
  register(58, '/capabilities', (req, res, ctx) => {
    const caps = listCapabilities();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      island: '0.0.0.0',
      capabilities: caps,
      note: 'Geen decimale routes. Alles gaat terug naar 0.0.0.0',
    }, null, 2));
  });

  // Dynamische tool selectie via doel
  register(62, '/select', (req, res, ctx) => {
    const goal = ctx.url.searchParams.get('goal') || 'geen doel';
    const selection = selectByGoal(goal);
    
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      goal,
      selection,
      note: 'Wiskundige selectie via digitale root → 0.0.0.0',
    }, null, 2));
  });

  // Sessie beheer
  register(10, '/sessions', (req, res, ctx) => {
    if (req.method === 'GET') {
      const sessions = listSessions();
      res.json({ sessions, count: sessions.length });
    } else if (req.method === 'POST') {
      // Fork: { sourceId, newId? }
      const { sourceId, newId } = req.body;
      if (!sourceId) return res.status(400).json({ error: 'sourceId required' });
      const forked = forkSession(sourceId, newId);
      if (!forked) return res.status(404).json({ error: 'source session not found' });
      res.json({ forked, newId: forked.id });
    }
  });

  register(11, '/sessions/:id', (req, res, ctx) => {
    const { id } = ctx.params;
    const { sessions } = require('./agent/loop');
    const session = sessions.get(id);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    res.json({
      id: session.id,
      turns: session.turns || 0,
      history: session.history || [],
      createdAt: session.createdAt,
    });
  });

  register(12, '/sessions/:id/merge', (req, res, ctx) => {
    const { id } = ctx.params;
    const { sourceId } = req.body;
    if (!sourceId) return res.status(400).json({ error: 'sourceId required' });
    const result = mergeSessions(id, sourceId);
    if (result.error) return res.status(404).json(result);
    res.json(result);
  });
});

// ─── Graceful shutdown ───

process.on('SIGINT', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});

process.on('SIGTERM', () => {
  console.log('\nShutting down...');
  server.close(() => process.exit(0));
});
