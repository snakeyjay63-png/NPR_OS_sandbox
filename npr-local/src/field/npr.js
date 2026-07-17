// @net 10.11.0.0/24 | fd00:npr:0011:000::/24
// ═══════════════════════════════════════════════════
// field/npr.js — NPR Cycle Engine
// ═══════════════════════════════════════════════════
// Noise → Pattern → Return
// Text → token analysis → digital root → hex routing
// ═══════════════════════════════════════════════════

// ─── Hex Helpers ───

// @addr 10.11.0.0 — hex formatter
function toHex(n) {
  n = parseInt(n) || 0;
  return "0x" + n.toString(16).toUpperCase();
}

// ─── Node Address Parser (sūtra addresses) ───

// @addr 10.11.0.0 — parse hierarchical node "g.i" → hex groups
function parseNode(nodeStr) {
  const parts = String(nodeStr).split(".");
  if (parts.length < 2) {
    return { group_hex: toHex(parseInt(parts[0]) || 0), index_hex: toHex(0), canonical: nodeStr };
  }
  const group = parseInt(parts[0]) || 0;
  const index = parseInt(parts[1]) || 0;
  return {
    group_hex: toHex(group),
    index_hex: toHex(index),
    canonical: nodeStr,
  };
}

// ─── Digital Root ───

// @addr 10.11.0.1 | fd00:npr:0011:000::1 — digital root
function digitalRoot(n) {
  n = Math.abs(parseInt(n) || 0);
  if (n === 0) return 0;
  return ((n - 1) % 9) + 1;
}

// ─── Token → numeric value ───

// @addr 10.11.0.2 | fd00:npr:0011:000::2 — token value
function tokenValue(token) {
  let sum = 0;
  for (const ch of token) {
    const code = ch.codePointAt(0) || 0;
    sum += code;
  }
  return sum;
}

// ─── NPR Analysis ───

// @addr 10.11.2.1 | fd00:npr:0011:002::1 — NPR analysis (hex-canonical)
function analyze(text) {
  const tokens = text.trim().split(/\s+/);
  let totalValue = 0;

  const tokenData = tokens.map(t => {
    const val = tokenValue(t);
    totalValue += val;
    return { token: t, value: val, dr: digitalRoot(val) };
  });

  const dr = digitalRoot(totalValue);
  const slot = (dr * 0x07) % 0x40; // spread across 0x40 slots

  return {
    tokens: tokenData,
    token_count_hex: toHex(tokens.length),
    tokenCount: tokens.length,
    total_value_hex: toHex(totalValue),
    totalValue,
    digital_root_hex: toHex(dr),
    digitalRoot: dr,
    slot_hex: toHex(slot),
    slot,
    origin: '0.0.0.0',
    return: '0.0.0.0',
  };
}

// ─── Phase Context ───

const SLOT_COUNT = 0x40;
const PHASE_SIZE = 0x10;

const PHASES = {
  '6N':  { id: 0x00, name: 'Noise',   description: 'Ruwe input, exploratie', drRange: [1, 2] },
  '12P': { id: 0x01, name: 'Pattern', description: 'Patroonherkenning, analyse', drRange: [3, 4] },
  '18R': { id: 0x02, name: 'Return',  description: 'Terugkeer, integratie', drRange: [5, 6] },
  '24H': { id: 0x03, name: 'Hexa',    description: 'Hexadecimale uitbreiding', drRange: [7, 8] },
  '32I': { id: 0x04, name: 'Identity', description: 'Identiteit, zelfreflectie', drRange: [9] },
};

// @addr 10.11.0.3 | fd00:npr:0011:000::3 — phase getter (hex-native)
function getPhase(slot) {
  if (slot < 0x10) return PHASES['6N'];
  if (slot < 0x20) return PHASES['12P'];
  if (slot < 0x30) return PHASES['18R'];
  if (slot < 0x38) return PHASES['24H'];
  return PHASES['32I'];
}

// @addr 10.11.0.4 | fd00:npr:0011:000::4 — phase context (hex-canonical)
function getPhaseContext(dr, slot) {
  const phase = getPhase(slot);
  const inRange = phase.drRange.includes(dr);
  return {
    phase: phase.name,
    phaseId: phase.id,
    phaseCode: Object.keys(PHASES)[Object.values(PHASES).indexOf(phase)],
    phaseCodeHex: toHex(phase.id),
    description: phase.description,
    digital_root_hex: toHex(dr),
    digitalRoot: dr,
    slot_hex: toHex(slot),
    slot,
    slot_in_phase_hex: toHex(slot % PHASE_SIZE),
    aligned: inRange,
    note: inRange ? 'DR-fase uitgelijnd' : 'DR-fase misaligned',
  };
}

// ─── NPR Route ───

// @addr 10.11.2.2 | fd00:npr:0011:002::2 — NPR route (hex-canonical)
function nprRoute(input) {
  const analysis = analyze(input);
  const phaseContext = getPhaseContext(analysis.digitalRoot, analysis.slot);

  return {
    noise: {
      raw: input,
      tokens: analysis.tokenCount,
      value: analysis.totalValue,
    },
    pattern: {
      digital_root_hex: analysis.digital_root_hex,
      digitalRoot: analysis.digitalRoot,
      slot_hex: analysis.slot_hex,
      slot: analysis.slot,
      tokenBreakdown: analysis.tokens,
    },
    phase: phaseContext,
    return: {
      origin: '0.0.0.0',
      slot_hex: analysis.slot_hex,
      slot: analysis.slot,
      phases: [
        { node: parseNode('1.5'),   function: 'category' },
        { node: parseNode('1.25'),  function: 'perspective' },
        { node: parseNode('1.19'),  function: 'relations' },
        { node: parseNode('1.13'),  function: 'structure' },
        { node: parseNode('1.40'),  function: 'scale' },
      ],
    },
  };
}

// ─── Three-Layer Cycle Model ───
//
// Zelfde nodes kunnen via verschillende generatoren worden bereikt.
// Drie lagen:
//   1. absolute trace  — ruwe numerieke reeks (6, 12, 18, 24)
//   2. digitale projectie — dr(waarde) per stap (6, 3, 9, 6)
//   3. generator       — stapgrootte (+6, +3, ...)
//
// Drie cycli:
//   +3 (v=9):  9→12→15→18  → dr: 9→3→6→9
//   +3 (v=3):  3→6→9→12    → dr: 3→6→9→3
//   +6 (v=6):  6→12→18→24  → dr: 6→3→9→6
//
// Cyclus 3 bezoekt {3,6,9} via ander pad en andere stap.
// Zelfde bestemming, andere reis.

// @addr 10.11.0.5 | fd00:npr:0011:000::5 — three-layer cycle
function generateCycle(generator, start, steps = 4) {
  const absolute = [];
  const nodeTrace = [];
  let val = start;
  for (let i = 0; i < steps; i++) {
    absolute.push(val);
    nodeTrace.push(digitalRoot(val));
    val += generator;
  }
  return {
    generator,
    start,
    absolute: absolute,
    nodeTrace: nodeTrace,
  };
}

// @addr 10.11.0.6 | fd00:npr:0011:000::6 — canonical NPR cycles (6 total: 2 directions × 3 starts)
// +3 ≡ forward  (3→6→9→3)
// +6 ≡ reverse  (3→9→6→3;  +6 ≡ −3 mod 9)
const CANONICAL_CYCLES = {
  // ── Generator +3 (forward) ──
  c3_3: { generator: 3, start: 3, absolute: [3, 6, 9, 12],    nodeTrace: [3, 6, 9, 3] },
  c6_3: { generator: 3, start: 6, absolute: [6, 9, 12, 15],  nodeTrace: [6, 9, 3, 6] },
  c9_3: { generator: 3, start: 9, absolute: [9, 12, 15, 18], nodeTrace: [9, 3, 6, 9] },
  // ── Generator +6 (reverse; +6 ≡ −3 mod 9) ──
  c3_6: { generator: 6, start: 3, absolute: [3, 9, 15, 21],  nodeTrace: [3, 9, 6, 3] },
  c6_6: { generator: 6, start: 6, absolute: [6, 12, 18, 24], nodeTrace: [6, 3, 9, 6] },
  c9_6: { generator: 6, start: 9, absolute: [9, 15, 21, 27], nodeTrace: [9, 6, 3, 9] },
};

// @addr 10.11.0.7 | fd00:npr:0011:000::7 — resolve cycle from generator+start
function resolveCycle(generator, start) {
  const key = `c${start}_${digitalRoot(generator)}`;
  if (CANONICAL_CYCLES[key]) return CANONICAL_CYCLES[key];
  return generateCycle(generator, start);
}

// @addr 10.11.0.8 | fd00:npr:0011:000::8 — find which cycle a value belongs to
function findCycleForValue(value) {
  const dr = digitalRoot(value);
  const results = [];
  for (const [key, cycle] of Object.entries(CANONICAL_CYCLES)) {
    if (cycle.absolute.includes(value) || cycle.nodeTrace.includes(dr)) {
      results.push({ key, ...cycle, matchType: cycle.absolute.includes(value) ? 'absolute' : 'node' });
    }
  }
  return results;
}

module.exports = { analyze, nprRoute, digitalRoot, tokenValue, getPhaseContext, PHASES, generateCycle, CANONICAL_CYCLES, resolveCycle, findCycleForValue, toHex };
