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

module.exports = { analyze, nprRoute, digitalRoot, tokenValue, getPhaseContext, PHASES };
