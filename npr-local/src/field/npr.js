// ═══════════════════════════════════════════════════
// field/npr.js — NPR Cycle Engine
// ═══════════════════════════════════════════════════
// Noise → Pattern → Return
// Text → token analysis → digital root → routing
// ═══════════════════════════════════════════════════

// ─── Digital Root ───

function digitalRoot(n) {
  n = Math.abs(parseInt(n) || 0);
  if (n === 0) return 0;
  return ((n - 1) % 9) + 1;
}

// ─── Token → numeric value ───

function tokenValue(token) {
  let sum = 0;
  for (const ch of token) {
    const code = ch.codePointAt(0) || 0;
    sum += code;
  }
  return sum;
}

// ─── NPR Analysis ───

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

// ─── NPR Route ───

function nprRoute(input) {
  const analysis = analyze(input);
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

module.exports = { analyze, nprRoute, digitalRoot, tokenValue };
