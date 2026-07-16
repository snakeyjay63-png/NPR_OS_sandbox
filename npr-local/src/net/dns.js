// @net 10.00.1.0/24
// dns.js — NPR DNS: naam → adres → port
//
// Mandelbrot-adressering: elke slot splitst recursief in 8×8 sub-adressen
// 64 top-level slots → elk kan 64 sub-slots → elk kan weer 64 → fractaal
//
// fd00:npr:* is een symbolische route-URI, geen echt IPv6
// Echte transport: http://127.0.0.1:PORT (IPv4 localhost) of http://[::1]:PORT

const crypto = require('crypto');

const BASE_PORT = 5000;
const MAX_DEPTH = 4; // fractaal diepte: 64 → 64² → 64³ → 64⁴

// ─── Naam → Slot (64 top-level) ───

function nameToSlot(name) {
  const hash = crypto.createHash('md5').update(name.toLowerCase()).digest();
  return hash.readUInt32BE(0) % 64;
}

// ─── Naam → Fractaal Adres (Mandelbrot 8×8 recursief) ───

/**
 * Parseer een fractaal adres string naar componenten
 * "17.3.0" → { slot: 17, sub: [3], depth: 1 }
 * "17.3.22" → { slot: 17, sub: [3, 22], depth: 2 }
 */
function parseFractalAddress(addr) {
  const parts = addr.split('.').map(Number);
  return {
    slot: parts[0],
    sub: parts.slice(1),
    depth: parts.length - 1,
  };
}

/**
 * Bouw fractaal adres string van slot + sub-adressen
 * 17 + [3, 22] → "17.3.22"
 */
function buildFractalAddress(slot, sub) {
  return [slot, ...(sub || [])].join('.');
}

/**
 * Naam → fractaal adres met diepte
 * "memory/search" → slot 22, sub-slot (hash van 'search' % 64)
 * "memory/search/context" → slot 22, sub [slot('search')], sub-sub [slot('context')]
 */
function nameToFractal(name) {
  const parts = name.split('/').filter(Boolean);
  const slots = parts.map((p, i) => {
    const hash = crypto.createHash('md5').update(p.toLowerCase()).digest();
    return hash.readUInt32BE(0) % 64;
  });
  return {
    name,
    slot: slots[0],
    path: slots,
    depth: slots.length - 1,
    address: buildFractalAddress(slots[0], slots.slice(1)),
  };
}

// ─── Slot → IPv4 (annotatie) ───

function slotToIP(slot) {
  const dr = (slot % 9) || 9; // digital root 1-9
  return `10.${String(dr).padStart(2, '0')}.0.${String(slot).padStart(2, '0')}`;
}

// ─── Slot → Port ───

function slotToPort(slot) {
  return BASE_PORT + slot;
}

// ─── Slot → NPR Route-URI (symbolisch, niet echt IPv6) ───

/**
 * Converteer slot → npr:// URI
 * npr://0017 → slot 17
 * npr://0017.0003 → slot 17, sub-slot 3
 * npr://0017.0003.0022 → slot 17.3.22 (diepte 2)
 *
 * Vervangt fd00:npr:* dat geen geldig IPv6 was.
 * fd00:npr:XXXX:YYYY → npr://XXXX.YYYY (leesbaar, uniek, geen IPv6-confusie)
 */
function slotToNprURI(slot, sub) {
  const parts = [slot, ...(sub || [])].map(n => String(n).padStart(4, '0'));
  return `npr://${parts.join('.')}`;
}

/**
 * Legacy compat: slot → fd00:npr:* (niet geldig IPv6, behoud alleen voor compat)
 * @deprecated Gebruik slotToNprURI() of addressToNprURI() in plaats daarvan
 */
function slotToRouteId(slot, sub) {
  // Gebruik geldige hex: 4e50 = "NP" in ASCII, 5200 = "R\0" ≈ NPR
  const base = 'fd00:4e50:5200'; // NPR in hex
  const s1 = (slot || 0).toString(16).padStart(4, '0');
  const s2 = (sub && sub[0] ? sub[0] : 0).toString(16).padStart(4, '0');
  return `${base}:${s1}:${s2}`;
}

// ─── Resolve: naam → { name, slot, ip, port, url, address, nprURI } ───

function resolve(name) {
  const fractal = nameToFractal(name);
  const slot = fractal.slot;
  const ip = slotToIP(slot);
  const port = slotToPort(slot);
  const nprURI = slotToNprURI(fractal.path[0], fractal.path.slice(1));
  // routeId: NPR hex (4e50=NP, 5200≈R), pad met 0 voor sub-slots
  const hexParts = fractal.path.map(n => n.toString(16).padStart(4, '0'));
  const routeId = `fd00:4e50:5200:${hexParts[0]}:${hexParts[1] || '0000'}:${hexParts[2] || '0000'}`;
  return {
    name,
    slot,
    ip,
    port,
    url: `http://127.0.0.1:${port}`,
    path: `/tool/${name}`,
    address: fractal.address,
    nprURI,
    routeId,
    depth: fractal.depth,
  };
}

// ─── Reverse: slot → naam (als registry bekend) ───

const SLOT_TO_NAME = new Map();

function register(name) {
  const entry = resolve(name);
  SLOT_TO_NAME.set(entry.slot, entry);
  return entry;
}

function reverse(slot) {
  return SLOT_TO_NAME.get(slot) || null;
}

// ─── Alle bekende namen ───

function list() {
  return Array.from(SLOT_TO_NAME.values()).sort((a, b) => a.slot - b.slot);
}

// ─── Naam genereren voor slot ───

function suggestName(slot, base) {
  const ipv4 = slotToIP(slot);
  return `${base}-${ipv4.replace(/\./g, '_')}`;
}

// ─── Mandelbrot sub-adressering ───

/**
 * Genereer alle mogelijke sub-adressen op een bepaalde diepte
 * 17 → [17.0, 17.1, ..., 17.63] (diepte 1)
 * 17.3 → [17.3.0, ..., 17.3.63] (diepte 2)
 */
function enumerateSubAddresses(address, depth = 1, maxDepth = 2) {
  const parsed = typeof address === 'string' ? parseFractalAddress(address) : { slot: address, sub: [], depth: 0 };
  if (parsed.depth >= maxDepth) return [buildFractalAddress(parsed.slot, parsed.sub)];

  const results = [];
  for (let i = 0; i < 64; i++) {
    const sub = [...parsed.sub, i];
    const addr = buildFractalAddress(parsed.slot, sub);
    if (sub.length >= depth) {
      results.push(addr);
    } else {
      results.push(...enumerateSubAddresses(addr, depth, maxDepth));
    }
  }
  return results;
}

/**
 * Converteer npr:// URI terug naar slot + path
 * npr://0017.0003 → { slot: 17, path: [17, 3], depth: 1 }
 */
function parseNprURI(uri) {
  if (!uri.startsWith('npr://')) return null;
  const parts = uri.slice(6).split('.').map(Number);
  return {
    slot: parts[0],
    path: parts,
    depth: parts.length - 1,
    address: parts.join('.'),
  };
}

module.exports = {
  nameToSlot,
  nameToFractal,
  parseFractalAddress,
  buildFractalAddress,
  slotToIP,
  slotToPort,
  slotToNprURI,
  slotToRouteId,
  resolve,
  register,
  reverse,
  list,
  suggestName,
  enumerateSubAddresses,
  parseNprURI,
  SLOT_TO_NAME,
  BASE_PORT,
  MAX_DEPTH,
};
