// @net 10.08.0.0/24
// ═══════════════════════════════════════════════════
// routes/map-to-ipv6.js — Map → NPR Route-URI
// ═══════════════════════════════════════════════════
// Elke map wordt een NPR route-adres (npr:// URI).
// Map = skill = tool = route = adres.
// 0.0.0.0 = eiland. Alles lokaal.
//
// BELANGRIJK: fd00:npr:* is GEEN geldig IPv6.
// We gebruiken npr:// URI's als symbolische route-adressen.
// Echte transport: http://127.0.0.1:PORT of http://[::1]:PORT
// ═══════════════════════════════════════════════════

const crypto = require('crypto');

// ─── Map → npr:// URI (symbolisch route-adres, niet echt IPv6) ───

// @addr 10.08.0.1 | npr://0008.0000.0001 — map→URI
function mapToNprURI(mapName) {
  // Hash map naam → twee 16-bit segments
  const hash = crypto.createHash('sha256').update(mapName).digest();
  const s1 = hash.readUInt16BE(0).toString(16).padStart(4, '0');
  const s2 = hash.readUInt16BE(2).toString(16).padStart(4, '0');
  return `npr://0008.${s1}.${s2}`;
}

// Legacy alias (behoud compatibiliteit)
// @deprecated Gebruik mapToNprURI() in plaats daarvan
function mapToIPv6(mapName) {
  return mapToNprURI(mapName);
}

// ─── npr:// → geldige hex-routeId (fd00:4e50:5200:...) ───
// 4e50 = "NP", 5200 ≈ "R" → NPR in hex
// @addr 10.08.0.4 | npr://0008.0000.0004 — URI→routeId
function nprToHexRouteId(nprURI) {
  // npr://0008.1a2b.3c4d → fd00:4e50:5200:0008:1a2b:3c4d
  const parts = nprURI.slice(6).split('.');
  if (parts.length < 3) return null;
  return `fd00:4e50:5200:${parts[0]}:${parts[1]}:${parts[2]}`;
}

// ─── Map → curl command ───
// @addr 10.08.0.2 | npr://0008.0000.0002 — map→curl
function mapToCurl(mapName, port = 17000) {
  const route = `/tool/${mapName}`;
  const uri = mapToNprURI(mapName);
  return {
    map: mapName,
    route,
    nprURI: uri,
    routeId: nprToHexRouteId(uri),
    curl: `curl http://127.0.0.1:${port}${route}`,
    transport: `http://[::1]:${port}${route}`,
  };
}

// ─── Alle mappen → URI map ───
// @addr 10.08.0.3 | npr://0008.0000.0003 — discover maps
function discoverMaps(sourcesDir) {
  const fs = require('fs');
  const maps = [];
  const entries = fs.readdirSync(sourcesDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
    
    const uri = mapToNprURI(entry.name);
    maps.push({
      name: entry.name,
      nprURI: uri,
      routeId: nprToHexRouteId(uri),
      route: `/tool/${entry.name}`,
      curl: `curl http://127.0.0.1:17000/tool/${entry.name}`,
    });
  }

  return maps;
}

// ─── Mandelbrot fractaal adressering ───
// Elke map kan weer 64 sub-slots hebben (8×8 recursief)
// @addr 10.08.0.5 | npr://0008.0000.0005 — fractaal
function mapToFractalURI(mapName, subPath) {
  const base = mapToNprURI(mapName);
  if (!subPath) return base;
  
  // subPath = "3.22" → voeg toe aan URI
  const subSlots = subPath.split('.').map(s => {
    const slot = parseInt(s, 10);
    return String(slot).padStart(4, '0');
  });
  
  return base + '.' + subSlots.join('.');
}

module.exports = {
  mapToNprURI,
  mapToIPv6,      // legacy compat
  nprToHexRouteId,
  mapToCurl,
  discoverMaps,
  mapToFractalURI,
};
