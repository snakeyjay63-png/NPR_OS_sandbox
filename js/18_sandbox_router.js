#!/usr/bin/env node
/**
 * NPR-OS Stap 18 — Driefasen Sandbox Router
 *
 * B0..B3 = bronblokken
 * ΦA..ΦC = fasekanalen (met faseposities 0°/120°/240°)
 * Q = vraag / rotoranker
 * motor_field = superpose(ΦA, ΦB, ΦC)
 * output = rotor_response(Q, motor_field)
 *
 * Drie kernfuncties:
 *   combine(B_j, B_k, θ)    → semantische vergelijking + NPR-reductie + fasepositie
 *   superpose(ΦA, ΦB, ΦC)  → gewogen fase-superpositie
 *   rotor_response(Q, motor_field) → vraag + veld → gestructureerd antwoord
 *
 * Fix 2026-07-12:
 * - Rotor = Q (vraag), niet B3
 * - 120° faseposities expliciet
 * - Superpositie ≠ sommatie (merge_semantics + preserve_evidence + ...)
 * - Fouttolerantie gecorrigeerd (ΦR reservekanaal toegevoegd)
 *
 * Fix 2026-07-14:
 * - ROUTE_BIT = 6_hex: faseposities = opeenvolgende 6-posities
 * - phase_route(ΦA) = 0x06, phase_route(ΦB) = 0x0C, phase_route(ΦC) = 0x12
 * - ΦR = 0x18: continuïteits- en returnkanaal (niet alleen failover)
 * - delta tussen fasen = 6_hex (constant)
 */

// ---------------------------------------------------------------------------
// ROUTE_BIT — invariante hex-native route (Stap 17)
// ---------------------------------------------------------------------------
//
// ROUTE_BIT := 6_hex
// route_position(n) := n × 6_hex
//
//   P1 = 0x06  (positie 1 → ΦA → 0°)
//   P2 = 0x0C  (positie 2 → ΦB → 120°)
//   P3 = 0x12  (positie 3 → ΦC → 240°)
//   P4 = 0x18  (positie 4 → ΦR → returnkanaal)
//
// delta(P1,P2) = delta(P2,P3) = delta(P3,P4) = 6_hex
//
const ROUTE_BIT = 0x06;

const PHASE_ROUTE = {
  // hex-native route posities
  P1: 0x06,   // positie 1
  P2: 0x0C,   // positie 2
  P3: 0x12,   // positie 3
  P4: 0x18,   // positie 4 — returnkanaal
};

// Hoekprojectie (niet onafhankelijke graden — projectie van route-posities)
const PHASE_ANGLE = { P1: 0, P2: 120, P3: 240, P4: 360 };

/**
 * route_position(n) — n-de positie op de ROUTE_BIT-routine.
 * n ≥ 1. Retourneert hex-waarde.
 */
function route_position(n) {
  if (n < 1 || !Number.isInteger(n)) {
    throw new RangeError(`n must be a positive integer, got: ${n}`);
  }
  return n * ROUTE_BIT;
}

/**
 * phase_route(phase) — hex-native route positie voor een motorfase.
 *   ΦA → P1 (0x06),  ΦB → P2 (0x0C),  ΦC → P3 (0x12)
 *   ΦR → P4 (0x18) — continuïteits- en returnkanaal
 */
function phase_route(phase) {
  switch (phase) {
    case 'ΦA': return PHASE_ROUTE.P1;
    case 'ΦB': return PHASE_ROUTE.P2;
    case 'ΦC': return PHASE_ROUTE.P3;
    case 'ΦR': return PHASE_ROUTE.P4;
    default:   throw new Error(`Unknown phase: ${phase}`);
  }
}

/**
 * phase_to_angle(phase) — hoekprojectie van route-positie.
 */
function phase_to_angle(phase) {
  switch (phase) {
    case 'ΦA': return PHASE_ANGLE.P1;
    case 'ΦB': return PHASE_ANGLE.P2;
    case 'ΦC': return PHASE_ANGLE.P3;
    case 'ΦR': return PHASE_ANGLE.P4;
    default:   throw new Error(`Unknown phase: ${phase}`);
  }
}

// ---------------------------------------------------------------------------
// NPR-hulpprogramma's (uit stap 17)
// ---------------------------------------------------------------------------

function hex_encode(str) {
  const bytes = new TextEncoder().encode(str);
  const digits = [];
  for (const b of bytes) {
    digits.push((b >> 4) & 0xf);
    digits.push(b & 0xf);
  }
  return digits;
}

function dr_hex(hex_digits) {
  if (hex_digits.length === 0) return 0;
  let s = hex_digits.reduce((a, b) => a + b, 0);
  while (s > 15) {
    const d = [];
    while (s > 0) { d.push(s % 16); s = Math.floor(s / 16); }
    s = d.reduce((a, b) => a + b, 0);
  }
  return s;
}

function npr_mod9(h) {
  const r = h % 9;
  return r === 0 ? 9 : r;
}

function npr_reduce(text) {
  const hex_digits = hex_encode(text);
  const dr = dr_hex(hex_digits);
  return { dr_hex: dr, npr_mod9: npr_mod9(dr), hex_digits };
}

// ---------------------------------------------------------------------------
// combine(B_j, B_k)
// ---------------------------------------------------------------------------

/**
 * combine(B_j, B_k, θ) — semantische vergelijking + NPR-reductie + fasepositie
 *
 * DRIE-TOESTAND MODEL (2026-07-14 fix):
 *
 *   support     → uitspraken ondersteunen elkaar (gedeelde keywords)
 *   neutral     → geen duidelijke relatie (geen overlap ≠ tegenspraak)
 *   contradiction → claims spreken elkaar werkelijk tegen
 *
 * Oude bug: contradiction = 1 - support
 * Dit betekende: geen overlap → destructieve interferentie
 * Correctie: geen overlap → neutraal, niet destructief
 *
 * TODO: echte contradiction-detectie (antoniem-lijst, logische tegenstrijdigheid)
 * Tot nu: keyword-overlap = support, geen overlap = neutral
 */
function combine(bj, bk, phaseOffset = 0) {
  const npr_j = npr_reduce(bj.text);
  const npr_k = npr_reduce(bk.text);

  const kw_j = new Set(bj.keywords.map(k => k.toLowerCase()));
  const kw_k = new Set(bk.keywords.map(k => k.toLowerCase()));
  const overlap = [...kw_j].filter(k => kw_k.has(k));
  const semantic_support = overlap.length / Math.max(kw_j.size, kw_k.size, 1);

  // DRIE-TOESTAND: support | neutral | contradiction
  // TODO: detectContradiction() met antoniemen / logische tegenstrijdigheid
  // Tot nu: contradiction = 0 (geen echte detectie), unrelated = rest
  const contradiction = 0; // placeholder — zie TODO
  const unrelated = +(1 - Math.max(semantic_support, contradiction)).toFixed(3);

  const root_diff = Math.abs(npr_j.npr_mod9 - npr_k.npr_mod9);
  let phase_relation;
  if (root_diff <= 1) phase_relation = 'in_fase';
  else if (root_diff <= 3) phase_relation = 'uit_fase';
  else phase_relation = 'tegenfase';

  return {
    block_ids: [bj.id, bk.id],
    npr: {
      block_j: npr_j,
      block_k: npr_k,
      combined_dr: dr_hex([...npr_j.hex_digits, ...npr_k.hex_digits]),
      combined_mod9: npr_mod9(dr_hex([...npr_j.hex_digits, ...npr_k.hex_digits])),
    },
    semantic: {
      overlap,
      semantic_support: +semantic_support.toFixed(3),
      contradiction: +contradiction.toFixed(3),
      unrelated: unrelated,
      phase_relation,
    },
    phase_offset: phaseOffset,
  };
}

// ---------------------------------------------------------------------------
// superpose(ΦA, ΦB, ΦC)
// ---------------------------------------------------------------------------

/**
 * superpose(ΦA, ΦB, ΦC) → gewogen fase-superpositie
 *
 * Niet eenvoudige sommatie. Behoudt:
 * - semantische inhoud (bronreferenties intact)
 * - NPR-signaturen per fase
 * - faseposities (0°/120°/240°)
 * - constructieve/destructieve relaties
 */
function superpose(phiA, phiB, phiC) {
  // Faseposities (routergewichten, geen fysieke graden)
  const phase_angles = [0, 120, 240];
  const phases = [
    { ...phiA, phase_angle: phase_angles[0] },
    { ...phiB, phase_angle: phase_angles[1] },
    { ...phiC, phase_angle: phase_angles[2] }
  ];

  // Gewogen combinatie (nu equal-weight; toekomst: dynamisch)
  const weights = [1/3, 1/3, 1/3];
  const roots = phases.map(p => p.npr.combined_mod9);
  const weighted_root = Math.round(
    roots.reduce((sum, r, i) => sum + r * weights[i], 0)
  ) || 9;

  // merge_semantics: gedeelde concepten behouden
  const all_overlap = new Set();
  for (const p of phases) {
    for (const k of p.semantic.overlap) all_overlap.add(k);
  }

  // resolve_support: constructieve relaties versterken
  const avg_support = phases.reduce((s, p) => s + p.semantic.semantic_support, 0) / 3;

  // mark_contradictions: destructieve relaties markeren
  const avg_contradiction = phases.reduce((s, p) => s + p.semantic.contradiction, 0) / 3;

  let interference_type;
  // DRIE-TOESTAND: constructief | neutraal | destructief
  // neutraal = geen overlap (niet destructief!)
  if (avg_support >= 0.5 && avg_contradiction < 0.5) interference_type = 'constructief';
  else if (avg_contradiction >= 0.5) interference_type = 'destructief';
  else interference_type = 'neutraal';

  const reliability = +((avg_support * 0.6 + (1 - avg_contradiction) * 0.4)).toFixed(3);

  return {
    phases,
    npr: { individual_roots: roots, weighted_root },
    semantic: {
      shared_keywords: [...all_overlap],
      avg_support: +avg_support.toFixed(3),
      avg_contradiction: +avg_contradiction.toFixed(3),
      interference_type,
    },
    reliability,
    phase_weights: weights,
  };
}

/**
 * ΦR: reservekanaal voor fouttolerantie
 * combine(B3, B0) → sluit de ring
 * Wordt gebruikt wanneer een van de primaire fasen faalt
 */
function reserve_phase(blocks) {
  if (blocks.length < 4) return null;
  return combine(blocks[3], blocks[0], 360); // 360° = 0° mod 360
}

// ---------------------------------------------------------------------------
// rotor_response(motor_field)
// ---------------------------------------------------------------------------

function rotor_response(Q, motorField) {
  const { phases, npr, semantic, reliability } = motorField;

  const blocks = [];
  for (const p of phases) {
    for (const bid of p.block_ids) {
      if (!blocks.includes(bid)) blocks.push(bid);
    }
  }

  const phase_signatures = phases.map((p, i) => ({
    fase: ['A', 'B', 'C'][i],
    blokken: p.block_ids,
    npr_root: p.npr.combined_mod9,
    phase_relation: p.semantic.phase_relation,
    support: p.semantic.semantic_support,
  }));

  const constructieve = phases
    .filter(p => p.semantic.semantic_support >= 0.5)
    .map((p, i) => ({ fase: ['A', 'B', 'C'][i], overlap: p.semantic.overlap }));

  const destructieve = phases
    .filter(p => p.semantic.contradiction >= 0.5)
    .map((p, i) => ({ fase: ['A', 'B', 'C'][i], contradiction: p.semantic.contradiction }));

  return {
    vraag: Q,
    antwoord: {
      summary: semantic.interference_type === 'constructief'
        ? `Constructieve interferentie: ${semantic.shared_keywords.length} gedeelde concepten over 3 fasen.`
        : semantic.interference_type === 'destructief'
        ? `Destructieve interferentie: tegenstrijdige signalen in ${destructieve.length} fase(s). Her-route aanbevolen.`
        : 'Neutraal veld: geen duidelijke constructieve of destructieve patroon.',
    },
    bronreferenties: blocks,
    npr_signatuur: {
      gewogen_root: npr.weighted_root,
      individuele_roots: npr.individual_roots,
      per_fase: phase_signatures,
    },
    interferentie: {
      type: semantic.interference_type,
      constructieve,
      destructieve,
    },
    betrouwbaarheid: reliability,
    meta: {
      fasen: phases.length,
      blokken: blocks.length,
      shared_keywords: semantic.shared_keywords,
    },
  };
}

// ---------------------------------------------------------------------------
// BLOCK_CONTRACT — stap 18 contract (Stap 21 compatible)
// ---------------------------------------------------------------------------

const BLOCK_CONTRACT = Object.freeze({
  id: '18_sandbox_router',
  phases: ['combine', 'superpose', 'rotor_response'],
  inputSchema: 'NPR_BLOCK_SET',
  outputSchema: 'NPR_ROTOR_RESPONSE',
  dependencies: ['17_sandbox_meta'],
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = {
  BLOCK_CONTRACT,
  combine, superpose, rotor_response, npr_reduce, hex_encode, dr_hex, npr_mod9, reserve_phase,
  // Route_bit + hex-native routing (Stap 17/18 koppeling)
  ROUTE_BIT, PHASE_ROUTE, PHASE_ANGLE, route_position, phase_route, phase_to_angle,
};

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

if (require.main === module) {
  const blocks = [
    { id: 'B0', text: 'NPR-OS transformatie-invariantie: hex-native reductie produceert hetzelfde uitvoerdomein voor elke input.', keywords: ['npr', 'transformatie', 'hex', 'invariantie', 'reductie'] },
    { id: 'B1', text: 'Sandbox als observatie-instrument: data door transformatiepijplijn routen en patroon zichtbaar maken.', keywords: ['sandbox', 'observatie', 'transformatie', 'patroon', 'data'] },
    { id: 'B2', text: 'Tesla driefasenmotor: drie wisselstromen met faseverschil produceren een draaiend veld.', keywords: ['tesla', 'driefasen', 'motor', 'fase', 'veld', 'npr'] },
    { id: 'B3', text: 'Sandbox router: vier contextblokken worden drie fasekanalen met één gestructureerd antwoord.', keywords: ['router', 'sandbox', 'fasen', 'antwoord', 'veld'] },
  ];

  // Q = vraag / rotoranker (niet B3!)
  const Q = 'Hoe werkt de NPR-OS sandbox router?';

  console.log('=== NPR-OS Stap 18: Driefasen Sandbox Router ===\n');
  console.log('Q (rotor):', Q, '\n');
  console.log('Rollen: B0..B3=bron | ΦA..ΦC=fasen | Q=rotor | motor=veld | output=antwoord\n');

  console.log('--- Blok NPR-reductie ---');
  for (const b of blocks) {
    const npr = npr_reduce(b.text);
    console.log(`  ${b.id}: dr_hex=${npr.dr_hex} (0x${npr.dr_hex.toString(16).toUpperCase()}) -> npr_mod9=${npr.npr_mod9}`);
  }

  console.log('\n--- Fasevorming (met faseposities) ---');
  const phiA = combine(blocks[0], blocks[1], phase_to_angle('ΦA'));
  const phiB = combine(blocks[1], blocks[2], phase_to_angle('ΦB'));
  const phiC = combine(blocks[2], blocks[3], phase_to_angle('ΦC'));
  for (const [name, phase, phi] of [['ΦA', 'ΦA', phiA], ['ΦB', 'ΦB', phiB], ['ΦC', 'ΦC', phiC]]) {
    const angle = phase_to_angle(phase);
    const hexPos = phase_route(phase).toString(16).toUpperCase();
    console.log(`  ${name}(${angle}°): route=0x${hexPos} | ${phi.block_ids.join('+')} -> root=${phi.npr.combined_mod9} | ${phi.semantic.phase_relation} | support=${phi.semantic.semantic_support}`);
  }

  console.log('\n--- Motorveld (superpose met gewogen fasen) ---');
  const motor = superpose(phiA, phiB, phiC);
  console.log('  Gewogen root:', motor.npr.weighted_root);
  console.log('  Interferentie:', motor.semantic.interference_type);
  console.log('  Betrouwbaarheid:', motor.reliability);
  console.log('  Gedeelde concepten:', motor.semantic.shared_keywords.join(', ') || '(geen)');
  console.log('  Fasegewichten:', motor.phase_weights.map(w => (w * 100).toFixed(0) + '%').join(', '));

  console.log('\n--- Continuïteitskanaal (ΦR) ---');
  const phiR = reserve_phase(blocks);
  if (phiR) {
    const hexR = phase_route('ΦR').toString(16).toUpperCase();
    console.log(`  ΦR: route=0x${hexR} (positie 4 — returnkanaal)`);
    console.log(`       ${phiR.block_ids.join('+')} -> root=${phiR.npr.combined_mod9} | ${phiR.semantic.phase_relation}`);
    console.log('  (continuïteit + return: 6 → C → 12 → 18 → terug naar 6)');
  }

  console.log('\n--- Rotor Output (Q + motor_field) ---');
  const output = rotor_response(Q, motor);
  console.log('  Antwoord:', output.antwoord.summary);
  console.log('  Bronnen:', output.bronreferenties.join(', '));
  console.log('  Betrouwbaarheid:', output.betrouwbaarheid);
  console.log('  Interferentie:', output.interferentie.type);

  console.log('\n=== Circuit voltooid ===');
}
