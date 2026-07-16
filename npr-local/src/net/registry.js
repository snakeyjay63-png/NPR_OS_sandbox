// @net 10.00.2.0/24
// registry.js — NPR Service Registry
//
// Elke service registreert zichzelf:
// - naam, slot, ip, port
// - capabilities (wat kan deze service)
// - status (alive/dead)
// - heartbeat (laatst gezien)

const dns = require('./dns');

const SERVICES = new Map();

// ─── Register een service ───

function registerService(name, opts = {}) {
  const entry = dns.register(name);
  const svc = {
    ...entry,
    capabilities: opts.capabilities || [],
    description: opts.description || '',
    status: 'alive',
    registered: Date.now(),
    heartbeat: Date.now(),
    meta: opts.meta || {},
  };
  SERVICES.set(name, svc);
  return svc;
}

// ─── Heartbeat ───

function heartbeat(name) {
  const svc = SERVICES.get(name);
  if (svc) {
    svc.heartbeat = Date.now();
    svc.status = 'alive';
    return true;
  }
  return false;
}

// ─── Check dead services (older than timeoutMs) ───

function checkHealth(timeoutMs = 30000) {
  const now = Date.now();
  for (const [name, svc] of SERVICES) {
    if (now - svc.heartbeat > timeoutMs) {
      svc.status = 'dead';
    }
  }
}

// ─── Find by capability ───

function findByCapability(cap) {
  const results = [];
  for (const svc of SERVICES.values()) {
    if (svc.capabilities.includes(cap)) {
      results.push(svc);
    }
  }
  return results;
}

// ─── Find by name pattern ───

function findByPattern(pattern) {
  const re = new RegExp(pattern, 'i');
  const results = [];
  for (const svc of SERVICES.values()) {
    if (re.test(svc.name) || re.test(svc.description)) {
      results.push(svc);
    }
  }
  return results;
}

// ─── List all ───

function list() {
  return Array.from(SERVICES.values()).sort((a, b) => a.slot - b.slot);
}

// ─── Get one ───

function get(name) {
  return SERVICES.get(name) || null;
}

// ─── DNS endpoint handler ───

function handleDNS(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const action = url.searchParams.get('action');
  const name = url.searchParams.get('name');
  const cap = url.searchParams.get('cap');

  if (action === 'resolve' && name) {
    const svc = SERVICES.get(name);
    if (svc) {
      sendJSON(res, svc);
    } else {
      // DNS resolve zonder registry = nog steeds slot/ip/port
      sendJSON(res, dns.resolve(name));
    }
  } else if (action === 'list') {
    sendJSON(res, list());
  } else if (action === 'find' && cap) {
    sendJSON(res, findByCapability(cap));
  } else if (action === 'search' && name) {
    sendJSON(res, findByPattern(name));
  } else {
    // Default: show DNS info for requested name
    const target = name || url.pathname.replace(/^\/dns\//, '');
    sendJSON(res, {
      dns: dns.resolve(target),
      service: SERVICES.get(target) || null,
    });
  }
}

function sendJSON(res, data) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

module.exports = {
  registerService,
  heartbeat,
  checkHealth,
  findByCapability,
  findByPattern,
  list,
  get,
  handleDNS,
  SERVICES,
};
