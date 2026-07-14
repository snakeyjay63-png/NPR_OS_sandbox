#!/usr/bin/env node
/**
 * NPR-OS Stap 19: Return - Sandbox Spiegelcyclus
 *
 * Tool-00: de sandbox als eigen tool
 * Sandbox-in-sandbox: output → nieuwe input
 * Bron-map: volledige traceerbaarheid
 * Taal-adres: concept-adressering
 *
 * Fix 2026-07-14:
 * - ROUTE_BIT import + hex-native route awareness
 * - Bronsluiting: complete_route → bronidentiteit (0 = 1)
 * - Hex/dec projectielus in taal-adres + bron-map
 */

const path = require('path');
const {
  combine,
  superpose,
  rotor_response,
  npr_reduce,
  dr_hex,
  npr_mod9,
  // Hex-native route (Stap 17/18)
  ROUTE_BIT,
  PHASE_ROUTE,
  route_position,
  phase_route,
} = require(path.join(__dirname, '18_sandbox_router.js'));

// ============================================================
// Tool-00: Sandbox als fundamentele tool
// ============================================================

/**
 * Tool-00 wrapper - de sandbox als routeerbaar instrument
 */
class Tool00 {
  constructor(options = {}) {
    this.name = 'Tool-00';
    this.description = 'NPR-OS Sandbox als fundamenteel routeerbaar instrument';
    this.capabilities = ['tekst-npr', 'return', 'verkenning', 'praktijk', 'spiegel'];
    // MAX_ITERATIONS: 1 ≤ MAX_ITERATIONS ≤ 64, default 9
    this.MAX_ITERATIONS = Math.min(64, Math.max(1, options.maxIterations || 9));
  }

  /**
   * Routeer input door de sandbox
   */
  route(input, options = {}) {
    const {
      route = 'standaard',
      iterations = 1,
      context = null
    } = options;

    let current_input = this.format_input(input, context);

    if (iterations > this.MAX_ITERATIONS) {
      throw new Error(`iterations (${iterations}) > MAX_ITERATIONS (${this.MAX_ITERATIONS})`);
    }
    if (iterations > 1) {
      return this.sandbox_return(current_input, iterations, route);
    }

    return this.single_pass(current_input, route);
  }

  /**
   * Simple keyword extractor (stopwords → meaningful tokens)
   */
  extract_keywords(text) {
    const stopwords = new Set(['de', 'en', 'is', 'in', 'op', 'van', 'met', 'voor', 'het', 'een',
      'tot', 'door', 'als', 'dat', 'dit', 'bij', 'uit', 'over', 'naar', 'aan',
      'ook', 'nog', 'meer', 'wat', 'hoe', 'er', 'ze', 'mij', 'we', 'ik',
      'the', 'and', 'are', 'but', 'for', 'not', 'you', 'all', 'can', 'had']);
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2 && !stopwords.has(w));
  }

  /**
   * Pre-process raw text blocks into router-compatible format
   */
  prepare_blocks(raw_blocks) {
    return raw_blocks.map((text, i) => ({
      id: `B${i}`,
      text: typeof text === 'string' ? text : text.text,
      keywords: typeof text === 'string'
        ? this.extract_keywords(text)
        : (text.keywords || this.extract_keywords(text.text || ''))
    }));
  }

  /**
   * Single sandbox-pass (uses Stap 18 router functions)
   */
  single_pass(input, route, iteration = 1) {
    const vraag = input.vraag || input;
    const raw_blokken = input.blokken || [
      `Vraag: ${vraag}`,
      `Context: ${input.context || 'standaard'}`,
      `Route: ${route}`,
      `Tool: Tool-00`
    ];

    // Pre-process blocks (raw text → structured with keywords + NPR)
    const blokken = this.prepare_blocks(raw_blokken);

    // Stap 18 pipeline: blokken → fasen → motorveld → rotor
    const phiA = combine(blokken[0], blokken[1], 0);
    const phiB = combine(blokken[1], blokken[2], 120);
    const phiC = combine(blokken[2], blokken[3], 240);
    const motorField = superpose(phiA, phiB, phiC);
    const answer = rotor_response(vraag, motorField);

    // Aggregate NPR: concatenate all hex digits → dr_hex (niet gemiddeld!)
    const all_hex_digits = [];
    for (const b of blokken) {
      const npr = npr_reduce(b.text);
      all_hex_digits.push(...npr.hex_digits);
    }
    const route_root = all_hex_digits.length > 0 ? dr_hex(all_hex_digits) : 0;
    const route_mod9 = npr_mod9(route_root);

    // Verwerkte blokken met NPR-data (voor bron-map)
    const processed_blokken = blokken.map(b => ({
      ...b,
      npr: npr_reduce(b.text)
    }));

    // rotor_response returns: { vraag, antwoord: { summary }, bronreferenties, npr_signatuur, interferentie, betrouwbaarheid, meta }
    const rotorAnswer = answer.antwoord?.summary || answer.summary || 'Geen output';
    const rotorConfidence = answer.betrouwbaarheid || 0;
    const rotorInterference = answer.interferentie?.type || motorField.semantic?.interference_type || 'onbekend';
    const rotorBronnen = answer.bronreferenties || [];

    return {
      vraag: vraag,
      answer: rotorAnswer,
      bronnen: rotorBronnen,
      npr_root: route_root,
      mod9: route_mod9,
      confidence: rotorConfidence,
      interferentie_type: rotorInterference,
      fasen: [phiA, phiB, phiC],
      motor_field: motorField,
      tool: 'Tool-00',
      route: route,
      iteratie: iteration,
      taal_adres: this.make_taal_adres({ npr_root: route_root, mod9: route_mod9, iteratie: iteration }, input),
      bron_map: this.make_bron_map(
        { npr_root: route_root, mod9: route_mod9, confidence: rotorConfidence,
          interferentie_type: rotorInterference, answer: rotorAnswer },
        processed_blokken, input
      )
    };
  }

  /**
   * Sandbox-in-sandbox return-lus
   */
  sandbox_return(input, iterations, initial_route = 'standaard', return_mode = 'deepen') {
    let current = { ...input, route: initial_route };
    const trajectory = [];
    const return_trace = [];

    for (let i = 0; i < iterations; i++) {
      const pass_route = i === 0 ? initial_route : 'return';
      const output = this.single_pass(current, pass_route, i + 1);

      trajectory.push(output);
      return_trace.push({
        iteratie: i + 1,
        route: pass_route,
        return_mode: return_mode,
        npr_root: output.npr_root,
        mod9: output.mod9,
        betrouwbaarheid: output.confidence,
        interferentie: output.interferentie_type,
        taal_adres: output.taal_adres
      });

      // Return: output → nieuwe input (state_{i+1} = return_transform(state_i))
      current = this.output_to_input(output, i + 1, return_mode);
      current.parent_output_id = `sb_iter_${i + 1}`;
    }

    const final = trajectory[trajectory.length - 1];

    return {
      final: final,
      trajectory: trajectory,
      return_trace: return_trace,
      depth: iterations,
      converged: this.has_converged(trajectory).converged,
      tool: 'Tool-00',
      taal_adres: final.taal_adres,
      bron_map: final.bron_map
    };
  }

  /**
   * Output → nieuwe input formatter
   * return_mode bepaalt wat er met Q gebeurt:
   *   deepen  → Q blijft gelijk, context groeit
   *   explore → Q verandert (afgeleid van output)
   *   act     → Q wordt actie-vraag
   *   reflect → Q wordt zelfreflectie
   */
  output_to_input(output, iteratie, return_mode = 'deepen') {
    let vraag;
    switch (return_mode) {
      case 'deepen':
        vraag = output.vraag; // Q_{i+1} = Q_i
        break;
      case 'explore':
        vraag = `Welke aspecten van "${output.answer}" verdienen verdieping? (iteratie ${iteratie})`;
        break;
      case 'act':
        vraag = `Welke actie volgt uit: "${output.answer}"? (iteratie ${iteratie})`;
        break;
      case 'reflect':
        vraag = `Wat zegt NPR-signatuur root=${output.npr_root}/mod9=${output.mod9} over de eigen router? (iteratie ${iteratie})`;
        break;
      default:
        vraag = `Wat betekent dit resultaat in bredere context? (iteratie ${iteratie})`;
    }

    // Reduceer 6 return-blokken naar 4 canonieke blokken:
    //   B0 = vorige output
    //   B1 = NPR-signatuur + fasen
    //   B2 = betrouwbaarheid + interferentie
    //   B3 = return-metadata + routegeschiedenis
    const fase_labels = output.fasen ? output.fasen.map((f, i) => ['ΦA', 'ΦB', 'ΦC'][i]).join(', ') : 'ΦA, ΦB, ΦC';

    return {
      vraag: vraag,
      blokken: [
        `Vorige output: ${output.answer}`,
        `NPR-signatuur: root=${output.npr_root}, mod9=${output.mod9}, fasen: ${fase_labels}`,
        `Betrouwbaarheid: ${output.confidence.toFixed(3)}, interferentie: ${output.interferentie_type}`,
        `Tool-00 return-lus actief, iteratie ${iteratie}, mode: ${return_mode}`
      ],
      context: `return-iteratie-${iteratie}`,
      route: 'return',
      return_mode: return_mode
    };
  }

  /**
   * Input formatter
   */
  format_input(input, extra_context = null) {
    if (typeof input === 'string') {
      return { vraag: input, context: extra_context };
    }
    return { ...input, context: extra_context || input.context };
  }

  /**
   * Convergentie-check (Stap 19 criteria)
   *
   *   root_stable(i) := root(output_i) = root(output_{i-1})
   *   semantic_stable(i) := semantic_distance(answer_i, answer_{i-1}) ≤ threshold
   *   contradiction_stable(i) := |confidence_i - confidence_{i-1}| < 0.05
   *   converged(i) := root_stable ∧ semantic_stable ∧ contradiction_stable
   *
   * semantic_distance: hybride (40% Jaccard + 30% bigram + 30% NPR-hex)
   */
  has_converged(trajectory, options = {}) {
    if (trajectory.length < 2) return false;
    const last = trajectory[trajectory.length - 1];
    const prev = trajectory[trajectory.length - 2];
    const threshold = options.semantic_threshold || 0.3;

    // root_stable
    const rootStable = last.npr_root === prev.npr_root;

    // semantic_stable — hybride afstand (Jaccard + bigram + NPR-hex)
    const semDist = this._semantic_distance(last, prev);
    const semanticStable = semDist <= threshold;

    // contradiction_stable — betrouwbaarheidsverschil als proxy
    const contradictionStable = Math.abs(last.confidence - prev.confidence) < 0.05;

    return {
      converged: rootStable && semanticStable && contradictionStable,
      root_stable: rootStable,
      semantic_stable: semanticStable,
      contradiction_stable: contradictionStable,
      semantic_distance: semDist,
      confidence_delta: Math.abs(last.confidence - prev.confidence),
    };
  }

  /**
   * Semantische afstand — hybride meting (Stap 19 v2)
   *
   * Combinatie van drie signalen:
   *   1. Jaccard-afstand (keyword-overlap) — 40%
   *   2. Bigram-overlap (woord-rij nabijheid) — 30%
   *   3. NPR-hex-afstand (signaal-niveau) — 30%
   *
   * Retourneert ∈ [0, 1].
   *   0 = identiek, 1 = volledig verschillend.
   */
  _semantic_distance(a, b) {
    const textA = typeof a === 'string' ? a : (a.answer || '');
    const textB = typeof b === 'string' ? b : (b.answer || '');

    // 1. Jaccard-afstand (keyword-niveau)
    const kwA = this.extract_keywords(textA);
    const kwB = this.extract_keywords(textB);
    const jaccard = this._jaccard_distance(kwA, kwB);

    // 2. Bigram-afstand (woord-rij nabijheid)
    const bigram = this._bigram_distance(kwA, kwB);

    // 3. NPR-hex-afstand (signaal-niveau)
    const npr = this._npr_distance(textA, textB);

    // Combinatie: 40% Jaccard + 30% bigram + 30% NPR
    return +(jaccard * 0.4 + bigram * 0.3 + npr * 0.3).toFixed(4);
  }

  /**
   * Jaccard-afstand tussen twee keyword-lijsten.
   * Retourneert ∈ [0, 1].
   */
  _jaccard_distance(listA, listB) {
    const setA = new Set(listA);
    const setB = new Set(listB);
    if (setA.size === 0 && setB.size === 0) return 0;
    const overlap = [...setA].filter(w => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return 1 - (overlap / union);
  }

  /**
   * Bigram-afstand (woord-rij nabijheid).
   * Vergelijkt opeenvolgende woordparen.
   * Retourneert ∈ [0, 1].
   */
  _bigram_distance(listA, listB) {
    const gramsA = this._ngrams(listA, 2);
    const gramsB = this._ngrams(listB, 2);
    if (gramsA.length === 0 && gramsB.length === 0) return 0;
    const setA = new Set(gramsA);
    const setB = new Set(gramsB);
    const overlap = [...setA].filter(g => setB.has(g)).length;
    const union = new Set([...setA, ...setB]).size;
    return 1 - (overlap / union);
  }

  /**
   * Genereer n-grams van een lijst.
   */
  _ngrams(list, n) {
    const result = [];
    for (let i = 0; i <= list.length - n; i++) {
      result.push(list.slice(i, i + n).join(' '));
    }
    return result;
  }

  /**
   * NPR-hex-afstand (signaal-niveau).
   * Vervangt _semantic_distance_simple.
   * Vergelijkt NPR-reductie van twee teksten via hex-digit overlap.
   * Retourneert ∈ [0, 1].
   */
  _npr_distance(textA, textB) {
    // FIX: lege strings kunnen niet ge-encodet worden (EMPTY_INPUT)
    // Vang dit af vóór npr_reduce
    if (!textA && !textB) return 0;      // beide leeg = identiek
    if (!textA || !textB) return 1;      // één leeg = maximale afstand
    const nprA = npr_reduce(textA);
    const nprB = npr_reduce(textB);

    const hexA = nprA.hex_digits;
    const hexB = nprB.hex_digits;

    if (hexA.length === 0 && hexB.length === 0) return 0;

    // Jaccard-achtige overlap van hex-cijfers (met frequentie)
    const freqA = {};
    for (const h of hexA) freqA[h] = (freqA[h] || 0) + 1;
    const freqB = {};
    for (const h of hexB) freqB[h] = (freqB[h] || 0) + 1;

    const keys = new Set([...Object.keys(freqA), ...Object.keys(freqB)]);
    let intersection = 0, union = 0;
    for (const k of keys) {
      intersection += Math.min(freqA[k] || 0, freqB[k] || 0);
      union += Math.max(freqA[k] || 0, freqB[k] || 0);
    }

    return union === 0 ? 0 : +(1 - intersection / union).toFixed(4);
  }

  /**
   * Genereer taal-adres
   * dr_hex = één hex-cijfer (0-9, A-F)
   * dr_dec = decimale projectie
   * route_positie = hex-native ROUTE_BIT positie
   */
  make_taal_adres(output, input) {
    const dr_dec = output.npr_root || 0;
    const dr_hex = dr_dec.toString(16).toUpperCase(); // dec → hex
    const mod9 = output.mod9 || '0';
    const timestamp = Math.floor(Date.now() / 1000);

    // Route-positie: bepaal welke ROUTE_BIT-positie dit resultaat hoort bij
    // iteratie 1 → P1 (0x06), iteratie 2 → P2 (0x0C), iteratie 3 → P3 (0x12)
    // iteratie 4+ → P4 (0x18) = returnkanaal
    const iter = output.iteratie || 1;
    const routeKey = iter <= 3 ? `P${iter}` : 'P4';
    const routeHex = phase_route(routeKey === 'P4' ? 'ΦR' : `Φ${['A','B','C'][iter-1]}`).toString(16).toUpperCase();

    return `taal://npr/dr${dr_hex}:mod${mod9}:route0x${routeHex}:sandbox/iteratie_${iter}/${timestamp}`;
  }

  /**
   * Genereer bron-map (uitgebreide traceerbaarheid)
   *
   * blokken = verwerkte blokken met npr-data (niet ruwe strings)
   */
  make_bron_map(output, processed_blokken, input) {
    const iter = output.iteratie || 1;
    const routeKey = iter <= 3 ? `P${iter}` : 'P4';
    const phaseLabel = routeKey === 'P4' ? 'ΦR' : `Φ${['A','B','C'][iter-1]}`;
    const routePos = phase_route(phaseLabel);

    return {
      output_id: `sb_${Date.now().toString(16).slice(-6)}`,
      timestamp: Math.floor(Date.now() / 1000),
      vraag: input.vraag || 'nvt',
      blokken: processed_blokken.map((b, i) => ({
        id: `B${i}`,
        text_preview: (b.text || '').substring(0, 60) + '...',
        bron: input[`bron_${i}`] || 'sandbox',
        source_id: `src_${i}`,
        token_range: { start: i * 65536, end_exclusive: (i + 1) * 65536 }, // [start, end_exclusive)
        npr: {
          dr_hex: (b.npr?.dr_hex || 0).toString(),
          dr_dec: b.npr?.dr_hex || 0,
          mod9: b.npr?.npr_mod9 || 0
        }
      })),
      resultaat: {
        npr_root: output.npr_root,
        mod9: output.mod9,
        interferentie: output.interferentie_type,
        betrouwbaarheid: output.confidence,
        antwoord: output.answer
      },
      route: {
        route_bit: ROUTE_BIT,
        route_bit_hex: `0x${ROUTE_BIT.toString(16).toUpperCase()}`,
        positie: routeKey,
        hex: `0x${routePos.toString(16).toUpperCase()}`,
        dec: routePos,
        fase: phaseLabel,
        // Decimale projectie (basisbewust — route kan door dec lopen)
        dec_projection: {
          P1: { hex: 0x06, dec: 6 },
          P2: { hex: 0x0C, dec: 12 },
          P3: { hex: 0x12, dec: 18 },
          P4: { hex: 0x18, dec: 24 },
        }
      },
      traceerbaarheid: {
        router_id: '18_sandbox_router',
        iteration_id: `iter_${(output.iteratie || 1).toString().padStart(3, '0')}`,
        parent_output_id: input.parent_output_id || 'root',
        taal_adres: output.taal_adres || ''
      },
      return_trace: [] // wordt gevuld bij return-iteraties
    };
  }
}

// ============================================================
// Live Demo
// ============================================================

function run_demo() {
  const tool00 = new Tool00();

  console.log('=== NPR-OS Stap 19: Return - Sandbox Spiegelcyclus ===\n');

  // --- Demo 1: Single Pass ---
  console.log('--- Demo 1: Single Pass (Tool-00) ---');
  const single = tool00.route({
    vraag: 'Hoe werkt de NPR-cyclus?',
    blokken: [
      'NPR = Noise, Pattern, Return',
      'Noise = ruwe input, ongestructureerd',
      'Pattern = herkenning, structuur, ordening',
      'Return = output wordt nieuwe input, cyclus sluit'
    ]
  });

  console.log(`Vraag: ${single.vraag}`);
  console.log(`Antwoord: ${single.answer}`);
  console.log(`NPR: root=${single.npr_root}, mod9=${single.mod9}`);
  console.log(`Betrouwbaarheid: ${single.confidence.toFixed(3)}`);
  console.log(`Interferentie: ${single.interferentie_type}`);
  console.log(`Taal-adres: ${single.taal_adres}`);
  console.log(`Bronnen: ${single.bron_map.blokken.map(b => b.id).join(', ')}`);
  console.log();

  // --- Demo 2: Return Lus (3 iteraties) ---
  console.log('--- Demo 2: Return Lus (3 iteraties) ---');
  const return_result = tool00.route({
    vraag: 'Wat is de relatie tussen taal en fysica?',
    blokken: [
      'Taal is een fysiek fenomeen - geluidsgolven, elektromagnetische signalen',
      'Fysica beschrijft de wereld die taal probeert vast te leggen',
      'NPR-OS bridge: taal → hex → frequentie → fysica',
      'Elke letter heeft een frequentie, elke frequentie heeft een getal'
    ],
    iterations: 3
  }, { route: 'standaard', iterations: 3 });

  console.log(`Diepte: ${return_result.depth} iteraties`);
  console.log(`Convergentie: ${return_result.converged ? 'JA ✅' : 'NEE ⚠️'}`);
  console.log();

  return_result.return_trace.forEach(trace => {
    console.log(`  Iteratie ${trace.iteratie}:`);
    console.log(`    Route: ${trace.route}`);
    console.log(`    NPR: root=${trace.npr_root}, mod9=${trace.mod9}`);
    console.log(`    Betrouwbaarheid: ${trace.betrouwbaarheid.toFixed(3)}`);
    console.log(`    Interferentie: ${trace.interferentie}`);
    console.log(`    Taal-adres: ${trace.taal_adres}`);
  });

  // Route-overzicht: hex-native veldroute
  console.log('\n--- Hex-Native Veldroute ---');
  console.log(`  ROUTE_BIT = 0x${ROUTE_BIT.toString(16).toUpperCase()} (6_hex)`);
  for (let n = 1; n <= 4; n++) {
    const pos = route_position(n);
    const key = `P${n}`;
    const phase = n <= 3 ? `Φ${['A','B','C'][n-1]}` : 'ΦR';
    const label = n === 4 ? 'returnkanaal' : `fase ${n}`;
    console.log(`  ${key} = 0x${pos.toString(16).toUpperCase().padStart(2,'0')} (${pos} dec) → ${phase} [${label}]`);
  }
  console.log(`  Volledige lus: 0=1 → 6 → C → 12 → 18 → 0=1`);

  console.log();
  console.log(`Eindresultaat:`);
  console.log(`  Antwoord: ${return_result.final.answer}`);
  console.log(`  Taal-adres: ${return_result.final.taal_adres}`);

  // --- Demo 3: Bron-Map Traceerbaarheid ---
  console.log('\n--- Demo 3: Bron-Map Traceerbaarheid ---');
  const bron_demo = tool00.route({
    vraag: 'Test voor bron-map',
    blokken: [
      'Bron A: NPR-OS documentatie',
      'Bron B: Stap 18 router output',
      'Bron C: Stap 17 observatie data',
      'Bron D: Stap 19 return concept'
    ]
  });

  console.log(`Output ID: ${bron_demo.bron_map.output_id}`);
  console.log(`Vraag: ${bron_demo.bron_map.vraag}`);
  console.log(`Bronnen:`);
  bron_demo.bron_map.blokken.forEach(b => {
    console.log(`  ${b.id}: ${b.text_preview}`);
  });
  console.log(`Resultaat NPR: root=${bron_demo.bron_map.resultaat.npr_root}, mod9=${bron_demo.bron_map.resultaat.mod9}`);
  console.log(`Traceerbaar: output ← ${bron_demo.bron_map.blokken.map(b => b.id).join(' ← ')}`);

  console.log('\n=== Stap 19 voltooid ===');
  return { single, return_result, bron_demo };
}

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
  const assert_lt = (name, a, b) => { if (a < b) { pass++; console.log(`  ✅ ${name} (${a.toFixed(4)} < ${b.toFixed(4)})`); } else { fail++; console.log(`  ❌ ${name} (${a.toFixed(4)} >= ${b.toFixed(4)})`); } };
  const assert_gte = (name, a, b) => { if (a >= b) { pass++; console.log(`  ✅ ${name} (${a.toFixed(4)} >= ${b.toFixed(4)})`); } else { fail++; console.log(`  ❌ ${name} (${a.toFixed(4)} < ${b.toFixed(4)})`); } };
  const assert_near = (name, a, b, eps = 0.01) => assert_true(`  ${name} (${a.toFixed(4)} ≈ ${b.toFixed(4)})`, Math.abs(a - b) < eps);

  const tool = new Tool00();

  console.log('=== Stap 19 Tests ===\n');

  // --- semantic_distance ---
  console.log('_semantic_distance:');

  // Identieke teksten → afstand = 0
  const d1 = tool._semantic_distance(
    { answer: 'transformatie hex-native reductie' },
    { answer: 'transformatie hex-native reductie' }
  );
  assert_true('identieke teksten → afstand ≈ 0', d1 < 0.1);

  // Volledig verschillende teksten → afstand > 0.5
  const d2 = tool._semantic_distance(
    { answer: 'transformatie hex-native reductie invariantie' },
    { answer: 'zonneschijn katten belastingformules' }
  );
  assert_gte('verschillende teksten → afstand > 0.5', d2, 0.5);

  // Deels overlap → afstand tussen 0 en 0.5
  const d3 = tool._semantic_distance(
    { answer: 'NPR-OS sandbox router transformatie' },
    { answer: 'NPR-OS sandbox signal perceptie' }
  );
  assert_true('gedeeltelijke overlap → 0 < afstand < 0.7', d3 > 0 && d3 < 0.7);

  // Lege teksten → afstand = 0
  const d4 = tool._semantic_distance({ answer: '' }, { answer: '' });
  assert_eq('lege teksten → afstand = 0', d4, 0);

  // Eén leeg → afstand > 0.5 (geen perfecte 1 door hybride gewichten)
  const d5 = tool._semantic_distance({ answer: 'transformatie hex-native reductie invariantie sandbox' }, { answer: '' });
  assert_gte('één leeg → afstand > 0.5', d5, 0.5);

  console.log('');

  // --- _jaccard_distance ---
  console.log('_jaccard_distance:');
  const j1 = tool._jaccard_distance(['a', 'b', 'c'], ['a', 'b', 'c']);
  assert_eq('identieke sets → 0', j1, 0);

  const j2 = tool._jaccard_distance(['a', 'b'], ['c', 'd']);
  assert_eq('geen overlap → 1', j2, 1);

  const j3 = tool._jaccard_distance(['a', 'b', 'c'], ['a', 'c', 'd']);
  assert_true('gedeeltelijke overlap → 0 < afstand < 1', j3 > 0 && j3 < 1);

  console.log('');

  // --- _bigram_distance ---
  console.log('_bigram_distance:');
  const b1 = tool._bigram_distance(['a', 'b', 'c'], ['a', 'b', 'c']);
  assert_eq('identieke bigrams → 0', b1, 0);

  const b2 = tool._bigram_distance(['a', 'b'], ['x', 'y']);
  assert_eq('geen overlap bigrams → 1', b2, 1);

  const b3 = tool._bigram_distance(['a', 'b', 'c'], ['b', 'c', 'd']);
  assert_true('gedeeltelijke bigram overlap → 0 < afstand < 1', b3 > 0 && b3 < 1);

  console.log('');

  // --- _npr_distance ---
  console.log('_npr_distance:');
  const n1 = tool._npr_distance('abcdef', 'abcdef');
  assert_eq('identieke NPR → 0', n1, 0);

  const n2 = tool._npr_distance('aaaa', 'zzzz');
  assert_true('verschillende NPR → afstand > 0', n2 > 0);

  const n3 = tool._npr_distance('', '');
  assert_eq('lege NPR → 0', n3, 0);

  console.log('');

  // --- has_converged ---
  console.log('has_converged:');
  const traj1 = [
    { npr_root: 3, answer: 'transformatie hex-native reductie', confidence: 0.7 },
    { npr_root: 3, answer: 'transformatie hex-native reductie', confidence: 0.71 },
  ];
  const conv1 = tool.has_converged(traj1);
  assert_true('stabiele trajectory → converged', conv1.converged);
  assert_true('root_stable', conv1.root_stable);
  assert_true('semantic_stable', conv1.semantic_stable);
  assert_true('contradiction_stable', conv1.contradiction_stable);

  const traj2 = [
    { npr_root: 3, answer: 'transformatie hex-native', confidence: 0.7 },
    { npr_root: 5, answer: 'zonneschijn katten', confidence: 0.3 },
  ];
  const conv2 = tool.has_converged(traj2);
  assert_true('verschillende roots → not converged', !conv2.converged);
  assert_true('root NOT stable', !conv2.root_stable);

  console.log(`\n=== Resultaat: ${pass} ✅ | ${fail} ❌ ===`);
  if (fail > 0) process.exit(1);
  process.exit(0);
}

// ---------------------------------------------------------------------------
// BLOCK_CONTRACT — stap 19 contract (Stap 21 compatible)
// ---------------------------------------------------------------------------

const BLOCK_CONTRACT = Object.freeze({
  id: '19_return',
  phases: ['accept_return_input', 'execute_return', 'validate_source_closure'],
  inputSchema: 'NPR_RETURN_INPUT',
  outputSchema: 'NPR_RETURN_RESULT',
  dependencies: ['18_sandbox_router'],
});

// ---------------------------------------------------------------------------
// Standalone validators (voor Stap 21 VALIDATE_NEAREST)
// ---------------------------------------------------------------------------

/**
 * Valideer input voor Tool-00.
 * Gooit fout bij ongeldige invoer.
 */
function validate_return_input(input) {
  if (!input || typeof input !== 'object') {
    throw new Error('Tool-00: input moet een object zijn');
  }
  if (!input.vraag && typeof input !== 'string') {
    throw new Error('Tool-00: input moet een vraag bevatten');
  }
}

/**
 * Valideer output van Tool-00.
 * Gooit fout bij ontbrekende verplichte velden.
 */
function validate_return_result(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('Tool-00: output is geen object');
  }
  if (!result.vraag) {
    throw new Error('Tool-00: output mist vraag');
  }
  if (!result.answer && !result.final) {
    throw new Error('Tool-00: output mist antwoord of final');
  }
}

/**
 * Build source map (standalone wrapper voor bron-map generatie).
 */
function build_source_map(output, processed_blokken, input) {
  // Gebruik interne Tool00 logica via een tijdelijke instantie
  const tool = new Tool00();
  return tool.make_bron_map(output, processed_blokken, input);
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

module.exports = {
  Tool00,
  BLOCK_CONTRACT,
  validate_return_input,
  validate_return_result,
  build_source_map,
};

// Run if called directly
if (require.main === module) {
  run_demo();
}
