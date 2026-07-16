// ═══════════════════════════════════════════════════
// routes/map-registry.js — Map = Skill
// ═══════════════════════════════════════════════════
// Elke map is een skill. Routing activeert hem.
// Geen registry. Geen loader. Alleen paden.
// ═══════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { register, phaseInfo } = require('./core');

// ─── Auto-register map ───

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

module.exports = { registerMap, discover };
