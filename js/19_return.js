#!/usr/bin/env node
/**
 * NPR-OS Stap 19: Return - Sandbox Spiegelcyclus
 *
 * Tool-00: de sandbox als eigen tool
 * Sandbox-in-sandbox: output → nieuwe input
 * Bron-map: volledige traceerbaarheid
 * Taal-adres: concept-adressering
 */

const path = require('path');
const {
  combine,
  superpose,
  rotor_response,
  npr_reduce,
  dr_hex,
  npr_mod9
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
      converged: this.has_converged(trajectory),
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
   * CONVERGENCE_PROXY_V1 — benadering, niet volledige semantische convergentie
   *
   *   root_stable(i) := root(output_i) = root(output_{i-1})
   *   semantic_stable(i) := Jaccard-afstand(keywords) ≤ 0.3
   *   contradiction_delta := |confidence_i - confidence_{i-1}| < 0.05
   *   converged(i) := root_stable ∧ semantic_stable ∧ contradiction_delta
   *
   * TODO: echte embedding-gebaseerde semantische afstand
   * TODO: echte contradiction-detectie (niet betrouwbaarheidsverschil)
   */
  has_converged(trajectory) {
    if (trajectory.length < 2) return false;
    const last = trajectory[trajectory.length - 1];
    const prev = trajectory[trajectory.length - 2];

    // root_stable
    const rootStable = last.npr_root === prev.npr_root;

    // semantic_stable — CONVERGENCE_PROXY_V1 (Jaccard-afstand tussen keywords)
    const semanticStable = this._semantic_distance_simple(last, prev) <= 0.3;

    // contradiction_delta — CONVERGENCE_PROXY_V1 (betrouwbaarheidsverschil als proxy)
    const contradictionDelta = Math.abs(last.confidence - prev.confidence) < 0.05;

    return rootStable && semanticStable && contradictionDelta;
  }

  /**
   * Simpele semantische afstand (keyword-overlap proxy)
   * TODO: vervangen door echte embedding-gebaseerde afstand
   */
  _semantic_distance_simple(a, b) {
    const keywordsA = this.extract_keywords(a.answer);
    const keywordsB = this.extract_keywords(b.answer);
    if (keywordsA.length === 0 || keywordsB.length === 0) return 1;
    const setA = new Set(keywordsA);
    const setB = new Set(keywordsB);
    const overlap = [...setA].filter(w => setB.has(w)).length;
    const union = new Set([...setA, ...setB]).size;
    return 1 - (overlap / union); // Jaccard distance
  }

  /**
   * Genereer taal-adres
   * dr_hex = één hex-cijfer (0-9, A-F)
   */
  make_taal_adres(output, input) {
    const dr_dec = output.npr_root || 0;
    const dr_hex = dr_dec.toString(16).toUpperCase(); // dec → hex
    const mod9 = output.mod9 || '0';
    const timestamp = Math.floor(Date.now() / 1000);

    return `taal://npr/dr${dr_hex}:mod${mod9}:sandbox/iteratie_${output.iteratie || 1}/${timestamp}`;
  }

  /**
   * Genereer bron-map (uitgebreide traceerbaarheid)
   *
   * blokken = verwerkte blokken met npr-data (niet ruwe strings)
   */
  make_bron_map(output, processed_blokken, input) {
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
      traceerbaarheid: {
        router_version: '18.0',
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

// Export
module.exports = { Tool00 };

// Run if called directly
if (require.main === module) {
  run_demo();
}
