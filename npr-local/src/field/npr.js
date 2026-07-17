// @net 10.11.0.0/24
// ═══════════════════════════════════════════════════
// @net 10.11.0.0/24
// field/npr.js — NPR Cycle Engine
// ═══════════════════════════════════════════════════
// Noise → Pattern → Return
// Text → token analysis → digital root → routing
// ═══════════════════════════════════════════════════

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

// @addr 10.11.2.1 | fd00:npr:0011:002::1 — NPR analysis
function analyze(text) {
  const tokens = text.trim().split(/\s+/);
  let totalValue = 0;

  const tokenData = tokens.map(t => {
    const val = tokenValue(t);
    totalValue += val;
    return { token: t, value: val, dr: digitalRoot(val) };
  });

  const dr = digitalRoot(totalValue);
  const slot = (dr * 7) % 64; // spread across 64 slots

  return {
    tokens: tokenData,
    tokenCount: tokens.length,
    totalValue,
    digitalRoot: dr,
    slot,
    origin: '0.0.0.0',
    return: '0.0.0.0',
  };
}

// ─── Phase Context ───

const PHASES = {
  '6N': { name: 'Noise', description: 'Ruwe input, exploratie', drRange: [1, 2] },
  '12P': { name: 'Pattern', description: 'Patroonherkenning, analyse', drRange: [3, 4] },
  '18R': { name: 'Return', description: 'Terugkeer, integratie', drRange: [5, 6] },
  '24H': { name: 'Hexa', description: 'Hexadecimale uitbreiding', drRange: [7, 8] },
  '32I': { name: 'Identity', description: 'Identiteit, zelfreflectie', drRange: [9] },
};

// @addr 10.11.0.3 | fd00:npr:0011:000::3 — phase getter
function getPhase(slot) {
  if (slot < 16) return PHASES['6N'];
  if (slot < 32) return PHASES['12P'];
  if (slot < 48) return PHASES['18R'];
  if (slot < 56) return PHASES['24H'];
  return PHASES['32I'];
}

// @addr 10.11.0.4 | fd00:npr:0011:000::4 — phase context
function getPhaseContext(dr, slot) {
  const phase = getPhase(slot);
  const inRange = phase.drRange.includes(dr);
  return {
    phase: phase.name,
    phaseCode: Object.keys(PHASES)[Object.values(PHASES).indexOf(phase)],
    description: phase.description,
    digitalRoot: dr,
    slot,
    aligned: inRange,
    note: inRange ? 'DR-fase uitgelijnd' : 'DR-fase misaligned',
  };
}

// ─── NPR Route ───

// @addr 10.11.2.2 | fd00:npr:0011:002::2 — NPR route
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
      digitalRoot: analysis.digitalRoot,
      slot: analysis.slot,
      tokenBreakdown: analysis.tokens,
    },
    phase: phaseContext,
    return: {
      origin: '0.0.0.0',
      slot: analysis.slot,
      phases: [
        { node: '1.5',   function: 'category' },
        { node: '1.25',  function: 'perspective' },
        { node: '1.19',  function: 'relations' },
        { node: '1.13',  function: 'structure' },
        { node: '1.40',  function: 'scale' },
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

module.exports = { analyze, nprRoute, digitalRoot, tokenValue, getPhaseContext, PHASES, generateCycle, CANONICAL_CYCLES, resolveCycle, findCycleForValue };
