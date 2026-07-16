// @net 10.07.0.0/24
// ═══════════════════════════════════════════════════
// @net 10.07.0.0/24
// routes/map-registry.js — Map = Skill
// ═══════════════════════════════════════════════════
// Elke map is een skill. Routing activeert hem.
// Geen registry. Geen loader. Alleen paden.
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { register, phaseInfo } = require('./core');

// ─── Path → Slot registry ───
const PATH_TO_SLOT = new Map();

// ─── Auto-register map ───

// @addr 10.07.2.1 | fd00:npr:0007:002::1 — map register
function registerMap(basePath, routePrefix = '/tool') {
  const entries = fs.readdirSync(basePath, { withFileTypes: true });
  let registered = 0;

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const mapPath = path.join(basePath, entry.name);
    
    // Zoek entry point: index.js > handler.js
    let entryPoint = null;
    if (fs.existsSync(path.join(mapPath, 'index.js'))) {
      entryPoint = path.join(mapPath, 'index.js');
    } else if (fs.existsSync(path.join(mapPath, 'handler.js'))) {
      entryPoint = path.join(mapPath, 'handler.js');
    }

    // Elke map met entry point = route
    if (entryPoint) {
      const route = `${routePrefix}/${entry.name}`;
      const hash = crypto.createHash('md5').update(route).digest();
      const slot = hash.readUInt32BE(0) % 64;

      // Register path → slot
      PATH_TO_SLOT.set(route, slot);

      // Lazy-load handler
      register(slot, route, (req, res, ctx) => {
        const mod = require(entryPoint);
        if (typeof mod.handle === 'function') {
          mod.handle(req, res, ctx);
        } else {
          // Fallback: map inhoud tonen
          const files = fs.readdirSync(mapPath);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            tool: entry.name,
            path: mapPath,
            files,
            slot,
            phase: phaseInfo(slot).phase,
          }));
        }
      });

      registered++;
    }
  }

  return { basePath, registered, prefix: routePrefix };
}

// ─── Discover tools in directory ───

// @addr 10.07.0.1 | fd00:npr:0007:000::1 — discover maps
function discover(basePath, prefix = '/tool') {
  const tools = [];
  const entries = fs.readdirSync(basePath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;

    const mapPath = path.join(basePath, entry.name);
    const hasIndex = fs.existsSync(path.join(mapPath, 'index.js'));

    tools.push({
      name: entry.name,
      path: mapPath,
      route: `${prefix}/${entry.name}`,
      active: hasIndex ? 1 : 0,
      slot: hasIndex ? 
        crypto.createHash('md5').update(`${prefix}/${entry.name}`).digest().readUInt32BE(0) % 64 : null,
    });
  }

  return tools;
}

// @addr 10.07.0.3 | fd00:npr:0007:000::3 — manifest (all paths)
function manifest() {
  // Return all registered paths from PATH_TO_SLOT
  return Array.from(PATH_TO_SLOT.keys());
}

module.exports = { registerMap, discover };
