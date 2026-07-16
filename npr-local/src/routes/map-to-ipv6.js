// @net 10.08.0.0/24
// ═══════════════════════════════════════════════════
// @net 10.08.0.0/24
// routes/map-to-ipv6.js — Map → IPv6
// ═══════════════════════════════════════════════════
// Elke map wordt een IPv6 adres.
// Map = skill = tool = route = adres.
// 0.0.0.0 = eiland. Alles lokaal.
// ═══════════════════════════════════════════════════

const crypto = require('crypto');

// Map naam → IPv6 suffix
// @addr 10.08.0.1 | fd00:npr:0008:000::1 — map→IPv6
function mapToIPv6(mapName, base = 'fd00:npr') {
  // Hash map naam → 64-bit suffix
  const hash = crypto.createHash('sha256').update(mapName).digest();
  const h1 = hash.readUInt32BE(0).toString(16).padStart(8, '0');
  const h2 = hash.readUInt32BE(4).toString(16).padStart(8, '0');
  return `${base}:${h1}:${h2}`;
}

// Map → curl command
// @addr 10.08.0.2 | fd00:npr:0008:000::2 — map→curl
function mapToCurl(mapName, port = 4000) {
  const route = `/tool/${mapName}`;
  const ipv6 = mapToIPv6(mapName);
  return {
    map: mapName,
    route,
    ipv6,
    curl: `curl http://[::${ipv6.split(':').slice(2).join(':')}]:${port}${route}`,
  };
}

// Alle mappen → IPv6 map
// @addr 10.08.0.3 | fd00:npr:0008:000::3 — discover maps
function discoverMaps(sourcesDir) {
  const fs = require('fs');
  const maps = [];
  const entries = fs.readdirSync(sourcesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    
    const ipv6 = mapToIPv6(entry.name);
    maps.push({
      name: entry.name,
      ipv6,
      route: `/tool/${entry.name}`,
      curl: `curl http://[::1]:4000/tool/${entry.name}`,
    });
  }

  return maps;
}

module.exports = { mapToIPv6, mapToCurl, discoverMaps };
