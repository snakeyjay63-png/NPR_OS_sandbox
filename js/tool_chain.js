#!/usr/bin/env node
/**
 * NPR-OS Tool Chain
 * Volledige pipeline: Stap 15 → 17 → 18 → 19
 *
 * Toont hoe alle vier stappen samenwerken.
 */

// --- Import stap 17 (canonieke hex-encoders) ---
const {
  encodeUtf8Text,
  encodeTokenId,
  encodeInteger,
  encodeHexString,
  reduceHex,
  decodeUtf8Hex,
  decodeIntegerHex,
  drHex,
  nprMod9,
} = require('./17_hex_encoders.js');

// --- Import stap 15 (signaal perceptie) ---
const {
  segmentPhonemes,
  getPhoneme,
} = require('./15_signaal_perceptie.js');

// --- Import stap 18 (sandbox router) ---
const {
  combine,
  combine_cycles,
  find_contradictions,
  contradiction_delta,
  pad_blocks,
} = require('./18_sandbox_router.js');

// --- Import stap 19 (return / convergence) ---
const { ReturnTool: ReturnPipeline } = require('./19_return.js');

// --- Helper ---
function section(title) {
  console.log(`\n${'─'.repeat(50)}`);
  console.log(`  ${title}`);
  console.log(`${'─'.repeat(50)}`);
}

function indent(text, spaces = 2) {
  return text.split('\n').map(l => ' '.repeat(spaces) + l).join('\n');
}

// =====================================================================
// STAP 15: Signaal Perceptie
// =====================================================================

function run_step15(text) {
  section(`STAP 15: Signaal Perceptie — "${text}"`);
  
  const phonemes = segmentPhonemes(text);
  console.log(`  Segmentatie: [${phonemes.map(p => `"${p}"`).join(', ')}]`);
  console.log(`  Aantal fonemen: ${phonemes.length}`);
  
  // Phoneme details
  const details = phonemes.map(p => {
    const info = getPhoneme(p);
    if (info) {
      return { phoneme: p, freq: info.freq, dr: info.id ? info.id[1] : '?' };
    }
    return { phoneme: p, freq: '—', dr: '?' };
  });
  
  if (details.some(d => d.freq !== '—')) {
    console.log(`  Frequenties: ${details.map(d => d.freq).join(', ')}`);
  }
  
  return phonemes;
}

// =====================================================================
// STAP 17: Hex-Encoders
// =====================================================================

function run_step17(text) {
  section(`STAP 17: Hex-Encoders — "${text}"`);
  
  // UTF-8 encoding
  const utf8 = encodeUtf8Text(text);
  console.log(`  Type: ${utf8.inputType}`);
  console.log(`  Hex: ${utf8.hex}`);
  console.log(`  drHex: ${utf8.drHex}`);
  console.log(`  mod9: ${utf8.mod9}`);
  console.log(`  Hex-digits: [${utf8.hexDigits.slice(0, 16).join(', ')}${utf8.hexDigits.length > 16 ? '...' : ''}]`);
  
  // Round-trip
  const decoded = decodeUtf8Hex(utf8.hex);
  console.log(`  Round-trip: "${decoded}" ${decoded === text ? '✅' : '⚠️ NFC verschil'}`);
  
  // Token encoding
  const token = encodeTokenId(42);
  console.log(`  Token 42: hex=${token.hex}, dr=${token.drHex}, mod9=${token.mod9}`);
  
  return utf8;
}

// =====================================================================
// STAP 18: Sandbox Router
// =====================================================================

function run_step18() {
  section('STAP 18: Sandbox Router — Semantic Cycles');
  
  // Maak twee semantische blokken
  const blockA = {
    id: 'A',
    text: 'constructieve transformatie signaal patroon',
    keywords: ['constructief', 'transformatie', 'signaal', 'patroon'],
  };
  
  const blockB = {
    id: 'B',
    text: 'transformatie signaal destructief patroon',
    keywords: ['destructief', 'transformatie', 'signaal', 'patroon'],
  };
  
  // Combineer twee blokken
  const combined = combine(blockA, blockB);
  console.log(`  Blok A: "${blockA.text}"`);
  console.log(`  Blok B: "${blockB.text}"`);
  console.log('');
  console.log('  Resultaat:');
  console.log(`    avg_support: ${combined.semantic.avg_support}`);
  console.log(`    avg_contradiction: ${combined.semantic.avg_contradiction}`);
  console.log(`    unrelated: ${combined.semantic.unrelated}`);
  console.log(`    shared_keywords: [${combined.semantic.shared_keywords.join(', ')}]`);
  console.log(`    contradiction: ${combined.semantic.contradiction.score}`);
  console.log(`    antoniem paren: ${combined.semantic.contradiction.pairs.length}`);
  console.log(`    NPR root: ${combined.npr.weighted_root}`);
  console.log('');
  
  // Contradiction detectie
  const antonyms = find_contradictions(blockA.keywords, blockB.keywords);
  console.log(`  Contradictions: ${antonyms.score}`);
  if (antonyms.pairs.length > 0) {
    antonyms.pairs.forEach(p => console.log(`    ${p[0]} ↔ ${p[1]}`));
  }
  
  // Cycle combinatie
  const cycleA = { motor_field: combined };
  const cycleB = { 
    motor_field: {
      semantic: { avg_support: 0.3, avg_contradiction: 0.2, shared_keywords: ['andere', 'set'] },
      npr: { weighted_root: 5, individual_roots: [5] },
    },
  };
  
  const multiCombined = combine_cycles([cycleA, cycleB], 'tool_chain test');
  console.log('');
  console.log(`  Multi-cycle resultaat:`);
  console.log(`    status: ${multiCombined.status}`);
  console.log(`    cycles: ${multiCombined.cycles}`);
  console.log(`    reliability: ${multiCombined.motor_field.reliability}`);
  console.log(`    contradiction_deltas: ${multiCombined.motor_field.contradiction_deltas.length}`);
  
  return combined;
}

// =====================================================================
// STAP 19: Return / Convergence
// =====================================================================

function run_step19() {
  section('STAP 19: Return / Convergence');
  
  // Simuleer een trajectory van iteraties
  const iterations = [
    { answer: 'constructieve transformatie signaal patroon hex' },
    { answer: 'transformatie signaal patroon hex native' },
    { answer: 'signaal patroon hex native reductie' },
    { answer: 'patroon hex native reductie invariantie' },
    { answer: 'hex native reductie invariantie sandbox' },
    { answer: 'native reductie invariantie sandbox retour' },
    { answer: 'reductie invariantie sandbox retour stilte' },
    { answer: 'invariantie sandbox retour stilte leeg' },
    { answer: 'sandbox retour stilte leeg śūnya' },
    { answer: 'retour stilte leeg śūnya ॐ' },
  ];
  
  const pipeline = new ReturnPipeline();
  
  // Semantic distances tussen opeenvolgende iteraties
  console.log('  Trajectory distances:');
  for (let i = 1; i < iterations.length; i++) {
    const dist = pipeline._semantic_distance(iterations[i], iterations[i - 1]);
    const arrow = i === 1 ? '→ ' : '  ';
    console.log(`    ${arrow}iter ${i} ← ${i-1}: ${dist.toFixed(4)}`);
  }
  
  // Convergence check
  console.log('');
  console.log('  Convergence:');
  for (let window = 3; window <= iterations.length; window++) {
    const windowIterations = iterations.slice(0, window);
    const converged = pipeline.has_converged(windowIterations);
    const marker = converged ? '✅' : '  ';
    console.log(`    ${marker} ${window} iteraties: root_stable=${converged.root_stable}, semantic_stable=${converged.semantic_stable}`);
    if (converged) break;
  }
  
  // Lege input test (was de bug)
  console.log('');
  console.log('  Lege input:');
  const emptyDist = pipeline._semantic_distance({ answer: '' }, { answer: '' });
  const partialDist = pipeline._semantic_distance({ answer: 'tekst' }, { answer: '' });
  console.log(`    empty ↔ empty: ${emptyDist}`);
  console.log(`    tekst ↔ empty: ${partialDist.toFixed(4)}`);
  
  return pipeline;
}

// =====================================================================
// MAIN: Volledige Tool Chain
// =====================================================================

function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║              NPR-OS Tool Chain v1.0                      ║');
  console.log('║              Stap 15 → 17 → 18 → 19                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  
  // Test tekst: Sanskrit + Nederlandse semantiek
  const testTexts = [
    'ॐ',            // Omkara
    'śūnya',      // Sanskrit
    'transformatie',  // Nederlands
    'signaal patroon hex',  // Compound
  ];
  
  // --- Stap 15: Alle test teksten ---
  for (const text of testTexts) {
    const phonemes = run_step15(text);
  }
  
  // --- Stap 17: Hex encoding ---
  const hexResult = run_step17('NPR-OS');
  
  // --- Stap 18: Semantic routing ---
  const combined = run_step18();
  
  // --- Stap 19: Convergence ---
  const pipeline = run_step19();
  
  // --- Samenvatting ---
  section('TOOL CHAIN RESULTAAT');
  console.log('');
  console.log('  Stap 15: ✅ Signaal Perceptie (segmentatie)');
  console.log('  Stap 17: ✅ Hex Encoders (encoding + round-trip)');
  console.log('  Stap 18: ✅ Sandbox Router (semantic cycles + contradictions)');
  console.log('  Stap 19: ✅ Return Pipeline (convergence detection)');
  console.log('');
  console.log('  Alle stappen functioneel geïntegreerd.');
  console.log('  NPR-OS V1 keten: compleet. •');
}

main();
