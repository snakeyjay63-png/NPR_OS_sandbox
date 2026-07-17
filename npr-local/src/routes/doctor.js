// @net 10.10.0.0/24
// routes/doctor.js — Self-diagnose + repair
// Equivalent: openclaw doctor

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const checks = [];
const repairs = [];

// ─── Checks ───

checks.push({
  name: 'node-version',
  desc: 'Node.js ≥ v20',
  run: () => {
    const v = process.version;
    const major = parseInt(v.slice(1).split('.')[0]);
    return { ok: major >= 20, detail: `Node ${v}` };
  },
});

checks.push({
  name: 'workspace-exists',
  desc: 'Workspace directory exists',
  run: () => {
    const ws = process.env.NPR_WORKSPACE || path.join(process.env.HOME, '.openclaw', 'workspace');
    const ok = fs.existsSync(ws) && fs.statSync(ws).isDirectory();
    return { ok, detail: ws };
  },
  repair: () => {
    const ws = process.env.NPR_WORKSPACE || path.join(process.env.HOME, '.openclaw', 'workspace');
    fs.mkdirSync(ws, { recursive: true });
    return `Created ${ws}`;
  },
});

checks.push({
  name: 'memory-exists',
  desc: 'Memory directory exists',
  run: () => {
    const mem = path.join(
      process.env.NPR_WORKSPACE || path.join(process.env.HOME, '.openclaw', 'workspace'),
      'memory',
    );
    return { ok: fs.existsSync(mem), detail: mem };
  },
  repair: () => {
    const ws = process.env.NPR_WORKSPACE || path.join(process.env.HOME, '.openclaw', 'workspace');
    const mem = path.join(ws, 'memory');
    fs.mkdirSync(mem, { recursive: true });
    return `Created ${mem}`;
  },
});

checks.push({
  name: 'model-endpoint',
  desc: 'Local model reachable',
  run: () => {
    const endpoint = process.env.NPR_MODEL_ENDPOINT || 'http://127.0.0.1:8765';
    try {
      execSync(`curl -sf --max-time 3 ${endpoint}/v1/models 2>/dev/null`, { timeout: 5000 });
      return { ok: true, detail: endpoint };
    } catch {
      return { ok: false, detail: `${endpoint} — unreachable` };
    }
  },
});

checks.push({
  name: 'geowon-reachable',
  desc: 'Geowon memory service reachable',
  run: () => {
    const port = process.env.NPR_GEOWON_PORT || 5001;
    try {
      execSync(`curl -sf --max-time 2 http://127.0.0.1:${port}/health 2>/dev/null`, { timeout: 3000 });
      return { ok: true, detail: `http://127.0.0.1:${port}` };
    } catch {
      return { ok: false, detail: `geowon:${port} — unreachable` };
    }
  },
});

checks.push({
  name: 'config-valid',
  desc: 'Config file valid JSON',
  run: () => {
    const p = path.join(process.env.HOME, '.openclaw', 'config.json');
    if (!fs.existsSync(p)) return { ok: true, detail: 'no config file (using defaults)' };
    try {
      JSON.parse(fs.readFileSync(p, 'utf8'));
      return { ok: true, detail: p };
    } catch (e) {
      return { ok: false, detail: `${p} — ${e.message}` };
    }
  },
});

checks.push({
  name: 'port-available',
  desc: 'NPR-Local port available',
  run: () => {
    const port = process.env.NPR_PORT || 17000;
    try {
      execSync(`curl -sf --max-time 1 http://127.0.0.1:${port}/health 2>/dev/null`, { timeout: 2000 });
      return { ok: true, detail: `port ${port} — serving` };
    } catch {
      return { ok: false, detail: `port ${port} — not responding` };
    }
  },
});

checks.push({
  name: 'npr-field',
  desc: 'NPR field engine loads',
  run: () => {
    try {
      const npr = require('../field/npr.js');
      return { ok: true, detail: `slots: ${npr.SLOTS?.length ?? 'unknown'}` };
    } catch (e) {
      return { ok: false, detail: `npr.js — ${e.message}` };
    }
  },
});

checks.push({
  name: 'agent-loop',
  desc: 'Agent loop loads',
  run: () => {
    try {
      const loop = require('../agent/loop.js');
      return { ok: typeof loop.agentTurn === 'function', detail: 'agentTurn OK' };
    } catch (e) {
      return { ok: false, detail: `loop.js — ${e.message}` };
    }
  },
});

checks.push({
  name: 'context-breath',
  desc: 'Context Breath loads',
  run: () => {
    try {
      const cb = require('../agent/context-breathe.js');
      return { ok: typeof cb.ContextBreath === 'function', detail: 'ContextBreath OK' };
    } catch (e) {
      return { ok: false, detail: `context-breathe.js — ${e.message}` };
    }
  },
});

// ─── Software Tool Checks ───

const TOOL_CHECKS = ['bluetoothctl', 'tmux', 'lazygit', 'ffmpeg', 'htop', 'git'];

for (const tool of TOOL_CHECKS) {
  checks.push({
    name: `tool-${tool}`,
    desc: `${tool} available`,
    run: () => {
      try {
        const p = execSync(`which ${tool} 2>/dev/null || command -v ${tool} 2>/dev/null`, {
          encoding: 'utf8',
          timeout: 2000,
        });
        return { ok: true, detail: p.trim() };
      } catch {
        return { ok: false, detail: `${tool} — not found` };
      }
    },
  });
}

// ─── Handler ───

function handler(req, res, ctx = {}) {
  const url = ctx.url || new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const params = new URLSearchParams(url.search);
  const doRepair = params.get('fix') === '1' || params.get('repair') === '1';

  const results = [];
  let allOk = true;

  for (const check of checks) {
    try {
      const result = check.run();
      results.push({
        name: check.name,
        desc: check.desc,
        ok: result.ok,
        detail: result.detail,
      });
      if (!result.ok) allOk = false;
    } catch (e) {
      results.push({ name: check.name, desc: check.desc, ok: false, detail: `check failed: ${e.message}` });
      allOk = false;
    }
  }

  // Repair if requested
  let repaired = [];
  if (doRepair) {
    for (const check of checks) {
      const result = results.find(r => r.name === check.name);
      if (result && !result.ok && check.repair) {
        try {
          const msg = check.repair();
          repaired.push({ name: check.name, message: msg });
          // Re-check
          const after = check.run();
          result.ok = after.ok;
          result.detail = after.detail;
          if (after.ok) allOk = true;
        } catch (e) {
          repaired.push({ name: check.name, error: e.message });
        }
      }
    }
  }

  res.writeHead(allOk ? 200 : 503, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    status: allOk ? 'healthy' : 'degraded',
    checks: results,
    repaired: repaired.length > 0 ? repaired : undefined,
    timestamp: new Date().toISOString(),
  }, null, 2));
}

module.exports = { handler, checks };
