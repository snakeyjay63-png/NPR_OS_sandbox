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
// NPR-hulpprogramma's — geïmporteerd van stap 17 (canonieke module)
// ---------------------------------------------------------------------------
// FIX: lokale kopieën vervangen door import van 17_hex_encoders.
// Dit voorkomt drift tussen de twee implementaties.

const {
  encodeUtf8Text,
  drHex,
  nprMod9,
  reduceHex,
} = require('./17_hex_encoders.js');

/**
 * npr_reduce(text) — compatibiliteitswrapper rond stap-17.
 * Retourneert { dr_hex: number, npr_mod9: number, hex_digits: number[] }.
 */
function npr_reduce(text) {
  const r = encodeUtf8Text(text);
  // Stap 17 drHex is string hex ('A'..'F'); converteer naar number
  const dr_num = parseInt(r.drHex, 16);
  // hexDigits zijn strings; converteer naar numbers voor compatibiliteit
  const hex_digits = r.hexDigits.map(d => parseInt(d, 16));
  return { dr_hex: dr_num, npr_mod9: r.mod9, hex_digits };
}

/**
 * dr_hex(hex_digits) — compatibiliteitswrapper.
 * hex_digits: number[]
 */
function dr_hex(hex_digits) {
  const hexStr = hex_digits.map(d => d.toString(16).toUpperCase()).join('');
  return parseInt(drHex(hex_digits.map(d => d.toString(16).toUpperCase())), 16);
}

/**
 * npr_mod9(h) — compatibiliteitswrapper.
 */
function npr_mod9(h) {
  return nprMod9(h.toString(16).toUpperCase());
}

/**
 * hex_encode(str) — compatibiliteitswrapper.
 */
function hex_encode(str) {
  const r = encodeUtf8Text(str);
  return r.hexDigits.map(d => parseInt(d, 16));
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
  // contradiction via antoniem-detectie (contradiction_delta)
  const { score: contradiction } = find_contradictions(bj.keywords, bk.keywords);
  // FIX: unrelated kan niet negatief worden (support + contradiction > 1 mogelijk)
  // Normaliseer: support + contradiction + unrelated = 1
  const unrelated = +Math.max(0, 1 - semantic_support - contradiction).toFixed(3);

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
// contradiction_delta — tegenspraak-detectie (Stap 18)
// ---------------------------------------------------------------------------

/**
 * ANTONYM_PAIRS: canonieke antoniem-lijst voor contradiction-detectie.
 * Key-normalisatie: lowercase, alleen a-z0-9.
 */
const ANTONYM_PAIRS = [
  ['support', 'contradict'],
  ['true', 'false'],
  ['yes', 'no'],
  ['meer', 'minder'],
  ['more', 'less'],
  ['groter', 'kleiner'],
  ['greater', 'smaller'],
  ['constructief', 'destructief'],
  ['constructive', 'destructive'],
  ['positief', 'negatief'],
  ['positive', 'negative'],
  ['aanwezig', 'afwezig'],
  ['present', 'absent'],
  ['geldig', 'ongeldig'],
  ['valid', 'invalid'],
  ['consistent', 'inconsistent'],
  ['altijd', 'nooit'],
  ['always', 'never'],
  // V2-uitbreiding: domein-onafhankelijke antoniemen
  ['open', 'closed'],
  ['open', 'gesloten'],
  ['aan', 'uit'],
  ['on', 'off'],
  ['enable', 'disable'],
  ['toestaan', 'verbieden'],
  ['allow', 'forbid'],
  ['stijgen', 'dalen'],
  ['rise', 'fall'],
  ['increase', 'decrease'],
  ['bestaat', 'bestaanniet'],
  ['exists', 'notexists'],
  ['actief', 'inactief'],
  ['active', 'inactive'],
  ['succes', 'falen'],
  ['success', 'failure'],
  ['start', 'stop'],
  ['begin', 'end'],
  ['begint', 'eindigt'],
];

function normalize_kw(kw) {
  // \p{L} = letters, \p{N} = numbers, \p{M} = combining marks (diacritics, Devanagari matra's, etc.)
  return kw.normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}\p{M}]/gu, '');
}

/**
 * find_contradictions(kw_j, kw_k) → { score, pairs }
 * score ∈ [0, 1].
 */
function find_contradictions(kw_j, kw_k) {
  const contradictions = [];
  const nj = new Set(kw_j.map(normalize_kw));
  const nk = new Set(kw_k.map(normalize_kw));

  for (const [a, b] of ANTONYM_PAIRS) {
    if ((nj.has(a) && nk.has(b)) || (nj.has(b) && nk.has(a))) {
      contradictions.push([a, b]);
    }
  }

  const total = Math.max(nj.size, nk.size, 1);
  const score = Math.min(contradictions.length / total, 1.0);
  return { score, pairs: contradictions };
}

/**
 * contradiction_delta — berekent tegenspraak-delta.
 *
 * Twee modi:
 *   1. Twee combine-resultaten → delta van hun contradiction-scores
 *   2. Twee blokken (met keywords) → antoniem-based detectie
 */
function contradiction_delta(a, b) {
  if (a?.semantic && b?.semantic) {
    const delta = Math.abs((a.semantic.contradiction ?? 0) - (b.semantic.contradiction ?? 0));
    return {
      delta: +delta.toFixed(4),
      scoreA: a.semantic.contradiction ?? 0,
      scoreB: b.semantic.contradiction ?? 0,
    };
  }
  if (a?.keywords && b?.keywords) {
    const { score, pairs } = find_contradictions(a.keywords, b.keywords);
    return { delta: score, scoreA: 0, scoreB: 0, pairs };
  }
  return { delta: 0, scoreA: 0, scoreB: 0 };
}

// ---------------------------------------------------------------------------
// combine_cycles — multi-cycle combinatie (Stap 18)
// ---------------------------------------------------------------------------

const EMPTY_BLOCK = Object.freeze({
  id: '__empty__',
  text: '',
  keywords: [],
});

/**
 * pad_blocks(blocks) → array van 4 blokken (vult met EmptyBlock indien nodig).
 *
 * FIX: meer dan 4 blokken wordt niet stil verwijderd.
 *   0-4 blokken → één padded cyclus
 *   meer dan 4 → opsplitsen in meerdere cycli
 */
function pad_blocks(blocks) {
  const r = [...blocks];
  if (r.length > 4) {
    // Opsplitsen in meerdere cycli van max 4 blokken
    const cycles = [];
    for (let i = 0; i < r.length; i += 4) {
      const chunk = r.slice(i, i + 4);
      while (chunk.length < 4) chunk.push(EMPTY_BLOCK);
      cycles.push(chunk);
    }
    return cycles;
  }
  while (r.length < 4) r.push(EMPTY_BLOCK);
  return [r];
}

/**
 * cycle_weight(CycleResult) → ℝ≥0
 *
 * Drie factoren (combinatieformule implementatie-afhankelijk):
 *   1. semantic_overlap    (0–1) — avg_support
 *   2. npr_root_consistency (0–1) — hoe dicht NPR-roots bij elkaar
 *   3. contradiction_penalty (0–1) — 1 - avg_contradiction
 *
 * Combinatie: 40% overlap + 30% root-consistency + 30% contradiction-penalty
 */
function cycle_weight(cr) {
  if (!cr || !cr.motor_field) return 0;
  const { semantic, npr } = cr.motor_field;

  const semantic_overlap = semantic?.avg_support ?? 0;

  const roots = npr?.individual_roots ?? [];
  let root_consistency = 1.0;
  if (roots.length >= 2) {
    const spread = Math.max(...roots) - Math.min(...roots);
    root_consistency = Math.max(0, 1 - spread / 9);
  }

  const contradiction_penalty = 1 - (semantic?.avg_contradiction ?? 0);

  return +(
    semantic_overlap * 0.4 +
    root_consistency * 0.3 +
    contradiction_penalty * 0.3
  ).toFixed(4);
}

/**
 * combine_cycles(List<CycleResult> × Question → CombinedResult)
 *
 * combine_cycles(cycle_results, Q) :=
 *   let W = Σ_i cycle_weight(cycle_results[i]) in
 *   if W > 0:
 *     gewogen combinatie van motorvelden
 *   else:
 *     status := no_active_cycle_weight
 *
 * Spec: signature is normatief, combinatieformule is implementatie-afhankelijk.
 */
function combine_cycles(cycle_results, question) {
  if (!Array.isArray(cycle_results) || cycle_results.length === 0) {
    throw new Error('combine_cycles: requires non-empty array of CycleResult');
  }

  const weighted = cycle_results.map(cr => ({
    result: cr,
    weight: cycle_weight(cr),
  }));

  // FIX: single-cycle identiteit — één cyclus wordt niet opnieuw gewogen
  if (cycle_results.length === 1) {
    const cr = cycle_results[0];
    const w = weighted[0].weight;
    return {
      status: w > 0 ? 'single_cycle' : 'no_active_cycle_weight',
      cycles: 1,
      vraag: question,
      motor_field: w > 0 ? cr.motor_field : null,
    };
  }

  const totalWeight = weighted.reduce((s, w) => s + w.weight, 0);

  if (totalWeight === 0) {
    // FIX: documenteer no_active_cycle_weight
    // Dit betekent: geen enkel motorveld is geldig (null of lege semantiek)
    // Niet: inhoudelijk zwakke cycli. Zelfs lage support + hoge contradiction
    // geeft nog steeds een gewicht > 0. Alleen volledig ontbrekende data
    // resulteert in no_active_cycle_weight.
    return {
      status: 'no_active_cycle_weight',
      cycles: cycle_results.length,
      vraag: question,
      motor_field: null,
    };
  }

  // Genormaliseerde gewichten
  const norm = weighted.map(w => ({
    result: w.result,
    weight: w.weight / totalWeight,
  }));

  // Gedeelde keywords over alle cycli
  const all_kw = new Set();
  for (const { result } of norm) {
    const mf = result.motor_field;
    if (mf?.semantic?.shared_keywords) {
      for (const k of mf.semantic.shared_keywords) all_kw.add(k);
    }
  }

  // Gewogen NPR-root
  const weighted_root = Math.round(
    norm.reduce(
      (s, { result, weight }) =>
        s + (result.motor_field?.npr?.weighted_root ?? 0) * weight,
      0
    )
  ) || 9;

  // Contradiction-delta tussen cycli
  const cd = [];
  for (let i = 0; i < norm.length - 1; i++) {
    for (let j = i + 1; j < norm.length; j++) {
      // FIX: score-delta + inter-cycle claim vergelijking
      const scoreDelta = contradiction_delta(
        norm[i].result.motor_field,
        norm[j].result.motor_field
      );
      // Inter-cycle: direct keyword-antoniem vergelijking tussen cycli
      const kwA = new Set(norm[i].result.motor_field?.semantic?.shared_keywords ?? []);
      const kwB = new Set(norm[j].result.motor_field?.semantic?.shared_keywords ?? []);
      const allA = [...kwA];
      const allB = [...kwB];
      const interCycle = allA.length > 0 && allB.length > 0
        ? find_contradictions(allA, allB)
        : { score: 0, pairs: [] };
      cd.push({
        ...scoreDelta,
        inter_cycle_score: interCycle.score,
        inter_cycle_pairs: interCycle.pairs,
      });
    }
  }

  // Gewogen gemiddelden
  const avg_support = norm.reduce(
    (s, { result, weight }) =>
      s + (result.motor_field?.semantic?.avg_support ?? 0) * weight,
    0
  );
  const avg_contradiction = norm.reduce(
    (s, { result, weight }) =>
      s + (result.motor_field?.semantic?.avg_contradiction ?? 0) * weight,
    0
  );

  let interference_type;
  if (avg_support >= 0.5 && avg_contradiction < 0.5) interference_type = 'constructief';
  else if (avg_contradiction >= 0.5) interference_type = 'destructief';
  else interference_type = 'neutraal';

  const reliability = +((avg_support * 0.6 + (1 - avg_contradiction) * 0.4)).toFixed(3);

  return {
    status: 'combined',
    cycles: cycle_results.length,
    vraag: question,
    motor_field: {
      phases: [], // individuele cycli behouden eigen fasen
      npr: {
        individual_roots: norm.map(n => n.result.motor_field?.npr?.weighted_root ?? 0),
        weighted_root,
        cycle_weights: norm.map(n => +n.weight.toFixed(4)),
      },
      semantic: {
        shared_keywords: [...all_kw],
        avg_support: +avg_support.toFixed(3),
        avg_contradiction: +avg_contradiction.toFixed(3),
        interference_type,
      },
      reliability,
      contradiction_deltas: cd,
    },
  };
}

// ---------------------------------------------------------------------------
// BLOCK_CONTRACT — stap 18 contract (Stap 21 compatible)
// ---------------------------------------------------------------------------

const BLOCK_CONTRACT = Object.freeze({
  id: '18_sandbox_router',
  phases: ['combine', 'superpose', 'rotor_response'],
  inputSchema: 'NPR_SOURCE_BLOCKS',
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
  // Contradiction + multi-cycle (Stap 18 v2)
  find_contradictions, contradiction_delta,
  EMPTY_BLOCK, pad_blocks, cycle_weight, combine_cycles,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

if (require.main === module && process.argv.includes('--test')) {
  let pass = 0, fail = 0;
  const assert_eq = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    if (ok) { pass++; console.log(`  ✅ ${name}`); }
    else { fail++; console.log(`  ❌ ${name}`); console.log(`     expected: ${JSON.stringify(expected)}`); console.log(`     actual:   ${JSON.stringify(actual)}`); }
  };
  const assert_true = (name, cond) => { if (cond) { pass++; console.log(`  ✅ ${name}`); } else { fail++; console.log(`  ❌ ${name}`); } };
  const assert_lt = (name, a, b) => { if (a < b) { pass++; console.log(`  ✅ ${name} (${a} < ${b})`); } else { fail++; console.log(`  ❌ ${name} (${a} >= ${b})`); } };
  const assert_gte = (name, a, b) => { if (a >= b) { pass++; console.log(`  ✅ ${name} (${a} >= ${b})`); } else { fail++; console.log(`  ❌ ${name} (${a} < ${b})`); } };
  const assert_near = (name, a, b, eps = 0.001) => assert_true(`  ${name} (${a.toFixed(4)} ≈ ${b.toFixed(4)})`, Math.abs(a - b) < eps);

  console.log('=== Stap 18 Tests ===\n');

  // --- find_contradictions ---
  console.log('find_contradictions:');
  const c1 = find_contradictions(['support', 'constructief'], ['contradict', 'destructief']);
  assert_gte('antoniem-paren detected', c1.pairs.length, 2);
  assert_true('score > 0 for antonyms', c1.score > 0);

  const c2 = find_contradictions(['transformatie', 'hex'], ['invariantie', 'reductie']);
  assert_eq('no antonyms found', c2.pairs.length, 0);
  assert_eq('score 0 for unrelated', c2.score, 0);

  const c3 = find_contradictions(['true', 'meer', 'positief'], ['false', 'minder', 'negatief']);
  assert_gte('meerdere antoniem-paren', c3.pairs.length, 3);
  assert_true('score > 0.5 for many antonyms', c3.score > 0.5);

  const c4 = find_contradictions([], []);
  assert_eq('empty arrays', c4.score, 0);

  console.log('');

  // --- contradiction_delta ---
  console.log('contradiction_delta:');
  const d1 = contradiction_delta(
    { keywords: ['support', 'constructief'] },
    { keywords: ['contradict', 'destructief'] }
  );
  assert_true('delta > 0 for contradicting keywords', d1.delta > 0);

  const d2 = contradiction_delta(
    { semantic: { contradiction: 0.3 } },
    { semantic: { contradiction: 0.7 } }
  );
  assert_near('delta from semantic scores', d2.delta, 0.4);

  const d3 = contradiction_delta({}, {});
  assert_eq('empty objects', d3.delta, 0);

  console.log('');

  // --- pad_blocks ---
  console.log('pad_blocks:');
  const b1 = [{ id: 'X' }];
  const padded = pad_blocks(b1);
  // FIX: pad_blocks nu returns array of cycles (array of arrays)
  assert_eq('returns 1 cycle', padded.length, 1);
  assert_eq('pad to 4 blocks', padded[0].length, 4);
  assert_eq('first block preserved', padded[0][0].id, 'X');
  assert_eq('padding is EmptyBlock', padded[0][1].id, '__empty__');

  const b2 = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }, { id: 'E' }];
  const padded2 = pad_blocks(b2);
  // FIX: 5 blokken → 2 cycli (4 + 1, met padding)
  assert_eq('5 blocks → 2 cycles', padded2.length, 2);
  assert_eq('first cycle has 4', padded2[0].length, 4);
  assert_eq('second cycle has 4 (padded)', padded2[1].length, 4);
  assert_eq('E in second cycle', padded2[1][0].id, 'E');

  console.log('');

  // --- cycle_weight ---
  console.log('cycle_weight:');
  const cr1 = {
    motor_field: {
      semantic: { avg_support: 0.8, avg_contradiction: 0.1 },
      npr: { individual_roots: [3, 3, 4] }
    }
  };
  const w1 = cycle_weight(cr1);
  assert_true('high weight for good cycle', w1 > 0.5);

  const cr2 = {
    motor_field: {
      semantic: { avg_support: 0.0, avg_contradiction: 0.9 },
      npr: { individual_roots: [1, 9] }
    }
  };
  const w2 = cycle_weight(cr2);
  assert_true('low weight for bad cycle', w2 < 0.3);

  assert_eq('null cycle', cycle_weight(null), 0);
  assert_eq('empty cycle', cycle_weight({}), 0);

  console.log('');

  // --- combine_cycles ---
  console.log('combine_cycles:');
  const cycles = [
    { motor_field: { semantic: { avg_support: 0.7, avg_contradiction: 0.1, shared_keywords: ['alpha'] }, npr: { weighted_root: 3, individual_roots: [3] } } },
    { motor_field: { semantic: { avg_support: 0.6, avg_contradiction: 0.2, shared_keywords: ['beta'] }, npr: { weighted_root: 5, individual_roots: [5] } } },
  ];
  const combined = combine_cycles(cycles, 'test vraag?');
  assert_eq('combined status', combined.status, 'combined');
  assert_eq('cycle count', combined.cycles, 2);
  assert_gte('reliability > 0', combined.motor_field.reliability, 0);
  assert_true('has shared keywords', combined.motor_field.semantic.shared_keywords.length >= 1);
  assert_true('has contradiction deltas', combined.motor_field.contradiction_deltas.length >= 1);

  // Single cycle → identity route (niet opnieuw gewogen)
  const singleCycle = [{ motor_field: { semantic: { avg_support: 0.7, avg_contradiction: 0.1, shared_keywords: ['gamma'] }, npr: { weighted_root: 4, individual_roots: [4] } } }];
  const sc = combine_cycles(singleCycle, 'single?');
  assert_eq('single cycle → single_cycle', sc.status, 'single_cycle');
  assert_eq('single cycle preserves motor_field', sc.motor_field.semantic.shared_keywords[0], 'gamma');

  // Near-zero weight single cycle → still single_cycle (gewicht > 0)
  const lowCycles = [{ motor_field: { semantic: { avg_support: 0, avg_contradiction: 1, shared_keywords: [] }, npr: { weighted_root: 1, individual_roots: [1, 9] } } }];
  const lc = combine_cycles(lowCycles, 'low?');
  assert_eq('low weight single cycle', lc.status, 'single_cycle');
  assert_true('low weight still has motor_field', lc.motor_field !== null);

  // Null motor_field → weight = 0 → no_active_cycle_weight
  const nullCycles = [{ motor_field: null }];
  const nc = combine_cycles(nullCycles, 'null?');
  assert_eq('null motor_field → no_active_cycle_weight', nc.status, 'no_active_cycle_weight');

  // Empty array
  try {
    combine_cycles([], 'fail?');
    fail++; console.log('  ❌ empty array should throw');
  } catch (e) {
    pass++; console.log('  ✅ empty array throws');
  }

  // --- FIX: Unicode keywords ---
  console.log('');
  console.log('Unicode keywords:');
  assert_eq('śūnya preserved', normalize_kw('śūnya'), 'śūnya');
  assert_eq('één preserved', normalize_kw('één'), 'één');
  assert_eq('Sanskrit preserved', normalize_kw('भाषा'), 'भाषा');
  assert_eq('NFC normalized', normalize_kw('e\u0301'), normalize_kw('é'));

  // --- FIX: unrelated ≥ 0 ---
  console.log('');
  console.log('unrelated ≥ 0:');
  const highSupportBlock = { id: 'X', text: 't', keywords: ['true', 'constructief', 'positief', 'geldig', 'aanwezig'] };
  const highContradictBlock = { id: 'Y', text: 't', keywords: ['false', 'destructief', 'negatief', 'ongeldig', 'afwezig'] };
  const highResult = combine(highSupportBlock, highContradictBlock);
  assert_true('unrelated ≥ 0 even bij veel antoniemen', highResult.semantic.unrelated >= 0);

  // --- FIX: inter-cycle contradiction ---
  console.log('');
  console.log('inter-cycle contradiction:');
  const cycleA = { motor_field: { semantic: { avg_support: 0.5, avg_contradiction: 0, shared_keywords: ['open', 'aan', 'toestaan'] }, npr: { weighted_root: 3, individual_roots: [3] } } };
  const cycleB = { motor_field: { semantic: { avg_support: 0.5, avg_contradiction: 0, shared_keywords: ['gesloten', 'uit', 'verbieden'] }, npr: { weighted_root: 5, individual_roots: [5] } } };
  const interCombined = combine_cycles([cycleA, cycleB], 'inter?');
  assert_true('inter-cycle has deltas', interCombined.motor_field.contradiction_deltas.length >= 1);
  assert_true('inter-cycle detects antonyms', interCombined.motor_field.contradiction_deltas[0].inter_cycle_score > 0);

  console.log(`\n=== Resultaat: ${pass} ✅ | ${fail} ❌ ===`);
  if (fail > 0) process.exit(1);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

if (require.main === module && !process.argv.includes('--test')) {
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
