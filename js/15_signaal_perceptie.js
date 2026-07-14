#!/usr/bin/env node
/**
 * NPR-OS Stap 15: Signaal → Perceptie
 *
 * Canonieke 48-foneem-set (Sanskrit/Devanagari):
 *   14 klinkers  (v,1) .. (v,14)
 *   34 medeklinkers (c,1) .. (c,34)
 *
 * Pipeline: raw_text → NFC → segment_phonemes → phoneme_id → hex → freq/color
 */

// ── Klinkers (14) ─────────────────────────────────────────────
const VOWELS = [
  { ch: 'अ', id: ['v', 1],  hex: '01', freq: 1, midi: 48, filter: 200,  colorIdx: 0 },
  { ch: 'आ', id: ['v', 2],  hex: '02', freq: 1, midi: 49, filter: 250,  colorIdx: 1 },
  { ch: 'इ', id: ['v', 3],  hex: '03', freq: 2, midi: 50, filter: 300,  colorIdx: 2 },
  { ch: 'ई', id: ['v', 4],  hex: '04', freq: 2, midi: 51, filter: 350,  colorIdx: 3 },
  { ch: 'उ', id: ['v', 5],  hex: '05', freq: 3, midi: 52, filter: 400,  colorIdx: 4 },
  { ch: 'ऊ', id: ['v', 6],  hex: '06', freq: 3, midi: 53, filter: 450,  colorIdx: 5 },
  { ch: 'ऋ', id: ['v', 7],  hex: '07', freq: 4, midi: 54, filter: 500,  colorIdx: 6 },
  { ch: 'ए', id: ['v', 8],  hex: '08', freq: 4, midi: 55, filter: 550,  colorIdx: 7 },
  { ch: 'ऐ', id: ['v', 9],  hex: '09', freq: 5, midi: 56, filter: 600,  colorIdx: 0 },
  { ch: 'ओ', id: ['v', 10], hex: '0A', freq: 5, midi: 57, filter: 650,  colorIdx: 1 },
  { ch: 'औ', id: ['v', 11], hex: '0B', freq: 6, midi: 58, filter: 700,  colorIdx: 2 },
  { ch: 'ं', id: ['v', 12], hex: '0C', freq: 0, midi: 0,  filter: 0,    colorIdx: 3 }, // anusvara
  { ch: 'ः', id: ['v', 13], hex: '0D', freq: 0, midi: 0,  filter: 0,    colorIdx: 4 }, // visarga
  { ch: 'ँ',id: ['v', 14], hex: '0E', freq: 0, midi: 0,  filter: 0,    colorIdx: 5 }, // chandrabindu
];

// ── Medeklinkers (34) ─────────────────────────────────────────
// Gaṇa 1: वर्ग (velar) क ख ग घ ङ
const GANA1 = [
  { ch: 'क', id: ['c', 1],  hex: '0F', freq: 3, midi: 48, filter: 800  },
  { ch: 'ख', id: ['c', 2],  hex: '10', freq: 3.5,midi: 49, filter: 850  },
  { ch: 'ग', id: ['c', 3],  hex: '11', freq: 4, midi: 50, filter: 900  },
  { ch: 'घ', id: ['c', 4],  hex: '12', freq: 4.5,midi: 51, filter: 950  },
  { ch: 'ङ', id: ['c', 5],  hex: '13', freq: 5, midi: 52, filter: 1000 },
];
// Gaṇa 2: तव (retroflex)
const GANA2 = [
  { ch: 'ट', id: ['c', 6],  hex: '14', freq: 3, midi: 48, filter: 1100 },
  { ch: 'ठ', id: ['c', 7],  hex: '15', freq: 3.5,midi: 49, filter: 1150 },
  { ch: 'ड', id: ['c', 8],  hex: '16', freq: 4, midi: 50, filter: 1200 },
  { ch: 'ढ', id: ['c', 9],  hex: '17', freq: 4.5,midi: 51, filter: 1250 },
  { ch: 'ण', id: ['c', 10], hex: '18', freq: 5, midi: 52, filter: 1300 },
];
// Gaṇa 3: दव (dental)
const GANA3 = [
  { ch: 'त', id: ['c', 11], hex: '19', freq: 3, midi: 48, filter: 1400 },
  { ch: 'थ', id: ['c', 12], hex: '1A', freq: 3.5,midi: 49, filter: 1450 },
  { ch: 'द', id: ['c', 13], hex: '1B', freq: 4, midi: 50, filter: 1500 },
  { ch: 'ध', id: ['c', 14], hex: '1C', freq: 4.5,midi: 51, filter: 1550 },
  { ch: 'न', id: ['c', 15], hex: '1D', freq: 5, midi: 52, filter: 1600 },
];
// Gaṇa 4: पव (labial)
const GANA4 = [
  { ch: 'प', id: ['c', 16], hex: '1E', freq: 3, midi: 48, filter: 1700 },
  { ch: 'फ', id: ['c', 17], hex: '1F', freq: 3.5,midi: 49, filter: 1750 },
  { ch: 'ब', id: ['c', 18], hex: '20', freq: 4, midi: 50, filter: 1800 },
  { ch: 'भ', id: ['c', 19], hex: '21', freq: 4.5,midi: 51, filter: 1850 },
  { ch: 'म', id: ['c', 20], hex: '22', freq: 5, midi: 52, filter: 1900 },
];
// Gaṇa 5: अन्तस्थ + ऊष्म + दन्त्य (semivowel, sibilant, dental fricative)
const GANA5 = [
  { ch: 'य', id: ['c', 21], hex: '23', freq: 3, midi: 48, filter: 2000 },
  { ch: 'र', id: ['c', 22], hex: '24', freq: 3.5,midi: 49, filter: 2050 },
  { ch: 'ल', id: ['c', 23], hex: '25', freq: 4, midi: 50, filter: 2100 },
  { ch: 'व', id: ['c', 24], hex: '26', freq: 4.5,midi: 51, filter: 2150 },
  { ch: 'श', id: ['c', 25], hex: '27', freq: 5, midi: 52, filter: 2200 },
  { ch: 'ष', id: ['c', 26], hex: '28', freq: 5, midi: 53, filter: 2250 },
  { ch: 'स', id: ['c', 27], hex: '29', freq: 5, midi: 54, filter: 2300 },
  { ch: 'ह', id: ['c', 28], hex: '2A', freq: 6, midi: 55, filter: 2400 },
  { ch: 'ळ', id: ['c', 29], hex: '2B', freq: 3, midi: 56, filter: 2500 },
  { ch: 'ड़', id: ['c', 30], hex: '2C', freq: 3.5,midi: 57, filter: 2600 },
  { ch: 'ढ़', id: ['c', 31], hex: '2D', freq: 4, midi: 58, filter: 2700 },
  { ch: 'फ़', id: ['c', 32], hex: '2E', freq: 4.5,midi: 59, filter: 2800 },
  { ch: 'य़', id: ['c', 33], hex: '2F', freq: 5, midi: 60, filter: 2900 },
  { ch: 'ज़', id: ['c', 34], hex: '30', freq: 5.5,midi: 61, filter: 3000 },
];

const CONSONANTS = [...GANA1, ...GANA2, ...GANA3, ...GANA4, ...GANA5];
const ALL_PHONEMES = [...VOWELS, ...CONSONANTS];

// ── Lookup maps ──────────────────────────────────────────────
const BY_CHAR = new Map(ALL_PHONEMES.map(p => [p.ch, p]));

const RUSSELL_COLORS = [
  { idx: 0, rgb: [255, 0, 0] },     // R
  { idx: 1, rgb: [255, 127, 0] },   // O
  { idx: 2, rgb: [255, 255, 0] },   // Y
  { idx: 3, rgb: [0, 255, 0] },     // G
  { idx: 4, rgb: [0, 127, 255] },   // B
  { idx: 5, rgb: [0, 0, 255] },     // V
  { idx: 6, rgb: [127, 0, 255] },   // P
  { idx: 7, rgb: [191, 0, 127] },   // M
];

// ── Mātrā → vowel mapping ────────────────────────────────────
const MATRA_MAP = {
  '\u0902': 'ं', // anusvara
  '\u0903': 'ः', // visarga
  '\u0901': 'ँ', // chandrabindu
  '\u093E': 'आ', // ā
  '\u093F': 'इ', // i
  '\u0940': 'ई', // ī
  '\u0941': 'उ', // u (U+0941)
  '\u0942': 'ऊ', // ū (U+0942)
  '\u0943': 'ऋ', // ṛ (U+0943)
  // U+0944 ॠ = lange ṝ-vorm → niet in canonieke 48-set; wordt afgevangen als INVALID_CLUSTER
  '\u0947': 'ए', // e
  '\u0948': 'ऐ', // ai
  '\u094B': 'ओ', // o
  '\u094C': 'औ', // au
};

// Virāma
const VIRAMA = '\u094D';

// Om
const OM = '\u0950';

// Independent vowels (U+0905–U+0939, plus anusvara etc.)
const INDEPENDENT_VOWELS = new Set(VOWELS.map(v => v.ch));

// ── Core functions ───────────────────────────────────────────

function normalizeNfc(text) {
  if (text == null || text === '') throw new Error('EMPTY_INPUT');
  return String(text).normalize('NFC');
}

function phonemeId(phonemeChar) {
  const p = BY_CHAR.get(phonemeChar);
  if (!p) throw new Error(`UNSUPPORTED_PHONEME: ${phonemeChar}`);
  return p.id; // [cat, pos]
}

function hexIndex(phonemeIdArr) {
  const [cat, pos] = phonemeIdArr;
  if (cat === 'v') return VOWELS[pos - 1]?.hex ?? null;
  if (cat === 'c') return CONSONANTS[pos - 1]?.hex ?? null;
  return null;
}

function nprSignal(phonemeChar) {
  const p = BY_CHAR.get(phonemeChar);
  if (!p) throw new Error(`UNSUPPORTED_PHONEME: ${phonemeChar}`);
  const [cat, pos] = p.id;
  const colorIdx = cat === 'v' ? p.colorIdx % 8 : (pos - 1) % 8;
  const colorVal = RUSSELL_COLORS[colorIdx].rgb;
  return {
    phoneme: phonemeChar,
    phoneme_id: p.id,
    hex_index: p.hex,
    freq_ratio: p.freq,
    midi: p.midi,
    synth_param: { pitch: p.freq, cutoff: p.filter },
    color_index: colorIdx,
    color_value: `rgb(${colorVal.join(',')})`,
  };
}

function nprSignalSingle(text) {
  const phonemes = segmentPhonemes(normalizeNfc(text));
  if (phonemes.length !== 1) throw new Error('MULTIPLE_PHONEMES_IN_SINGLE');
  return nprSignal(phonemes[0]);
}

function nprSignalSequence(text) {
  const phonemes = segmentPhonemes(normalizeNfc(text));
  return phonemes.map(ch => nprSignal(ch));
}

function segmentPhonemes(nfcText) {
  if (!nfcText || nfcText.length === 0) throw new Error('EMPTY_INPUT');

  const result = [];
  let i = 0;
  while (i < nfcText.length) {
    const ch = nfcText[i];

    // Check Devanagari range
    const cp = ch.codePointAt(0);
    if (cp < 0x0900 || cp > 0x097F) throw new Error(`UNSUPPORTED_CHARACTER: ${ch} (U+${cp.toString(16).toUpperCase()})`);

    // Om → ओ ं म  (independent vowels ओ + anusvāra ं + consonant म)
    if (ch === OM) { result.push('ओ', 'ं', 'म'); i++; continue; }

    // Independent vowel
    if (INDEPENDENT_VOWELS.has(ch)) { result.push(ch); i++; continue; }

    // Mātrā standing alone (treat as vowel equivalent)
    if (ch in MATRA_MAP) { result.push(MATRA_MAP[ch]); i++; continue; }

    // Virāma standing alone → error
    if (ch === VIRAMA) throw new Error('DANGLING_VIRAMA');

    // Nukta check: base + U+093C → composite key (ड़, ढ़, फ़, य़, ज़)
    const NUKTA = '\u093C';
    if (i + 1 < nfcText.length && nfcText[i + 1] === NUKTA) {
      const candidate = ch + NUKTA;
      if (BY_CHAR.has(candidate)) {
        i += 2;
        // Check for matra or virama after nukta consonant
        if (i < nfcText.length) {
          const next = nfcText[i];
          if (next in MATRA_MAP) {
            result.push(candidate, MATRA_MAP[next]); i++; continue;
          }
          if (next === VIRAMA) {
            result.push(candidate); i++; continue;
          }
        }
        result.push(candidate, 'अ'); // nukta consonant + inherent अ
        continue;
      }
    }

    // Consonant cluster
    const con = BY_CHAR.get(ch);
    if (con) {
      i++;
      // Check for mātrā or virāma
      if (i < nfcText.length) {
        const next = nfcText[i];
        if (next in MATRA_MAP) {
          // Consonant + mātrā → consonant + vowel
          result.push(ch, MATRA_MAP[next]);
          i++;
          continue;
        }
        if (next === VIRAMA) {
          // Consonant + virāma → just consonant (kills inherent अ)
          result.push(ch);
          i++;
          continue;
        }
      }
      // Consonant without vowel mark → inherent अ
      result.push(ch, 'अ');
      continue;
    }

    throw new Error(`INVALID_CLUSTER at pos ${i}: ${ch}`);
  }
  return result;
}

// ── Exports ──────────────────────────────────────────────────
module.exports = {
  normalizeNfc, segmentPhonemes, phonemeId, hexIndex,
  nprSignal, nprSignalSingle, nprSignalSequence,
  ALL_PHONEMES, VOWELS, CONSONANTS, BY_CHAR, RUSSELL_COLORS,
};

// ── Tests ────────────────────────────────────────────────────
if (require.main === module) {
  const P = [], F = [];
  function t(n, fn) { try { fn(); P.push(n); } catch (e) { F.push(`${n}: ${e.message}`); } }
  function eq(a, b) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${a} !== ${b}`); }
  function startsWith(s, p) { if (!s.startsWith(p)) throw new Error(`${s} does not start with ${p}`); }
  function throwsWith(fn, prefix) {
    let thrown = false;
    try { fn(); } catch (e) { thrown = true; startsWith(e.message, prefix); }
    if (!thrown) throw new Error(`Expected error starting with ${prefix}`);
  }

  t('अ → [अ]', () => eq(segmentPhonemes('अ'), ['अ']));
  t('क → [क, अ]', () => eq(segmentPhonemes('क'), ['क', 'अ']));
  t('का → [क, आ]', () => eq(segmentPhonemes('का'), ['क', 'आ']));
  t('कि → [क, इ]', () => eq(segmentPhonemes('कि'), ['क', 'इ']));
  t('क् → [क]', () => eq(segmentPhonemes('क्'), ['क']));
  t('क्त → [क, त, अ]', () => eq(segmentPhonemes('क्त'), ['क', 'त', 'अ']));
  t('ॐ → [ओ, ँ, म]', () => eq(segmentPhonemes('ॐ'), ['ओ', 'ं', 'म']));
  t('ं → [ं]', () => eq(segmentPhonemes('ं'), ['ं']));
  t('ः → [ः]', () => eq(segmentPhonemes('ः'), ['ः']));
  t('ँ → [ँ]', () => eq(segmentPhonemes('ँ'), ['ँ']));
  // Nukta fonemen
  t('ड़ → [ड़, अ]', () => eq(segmentPhonemes('ड़'), ['ड़', 'अ']));
  t('ढ़ → [ढ़, अ]', () => eq(segmentPhonemes('ढ़'), ['ढ़', 'अ']));
  t('फ़ → [फ़, अ]', () => eq(segmentPhonemes('फ़'), ['फ़', 'अ']));
  t('य़ → [य़, अ]', () => eq(segmentPhonemes('य़'), ['य़', 'अ']));
  t('ज़ → [ज़, अ]', () => eq(segmentPhonemes('ज़'), ['ज़', 'अ']));
  t('ड़ि → [ड़, इ] (nukta + matra)', () => eq(segmentPhonemes('ड़ि'), ['ड़', 'इ']));
  t('ड़क् → [ड़, अ, क] (nukta + virama + conjunct)', () => eq(segmentPhonemes('ड़क्'), ['ड़', 'अ', 'क']));

  t('empty → error', () => throwsWith(() => segmentPhonemes(''), 'EMPTY_INPUT'));
  t('latin → error', () => throwsWith(() => segmentPhonemes('hello'), 'UNSUPPORTED'));
  t('48 unique IDs', () => eq(new Set(ALL_PHONEMES.map(p => JSON.stringify(p.id))).size, 48));
  t('48 unique hex', () => eq(new Set(ALL_PHONEMES.map(p => p.hex)).size, 48));
  t('hex range', () => {
    const hexes = ALL_PHONEMES.map(p => parseInt(p.hex, 16));
    eq(Math.min(...hexes), 1);
    eq(Math.max(...hexes), 0x30);
  });
  t('nprSignal complete', () => {
    const s = nprSignal('अ');
    eq(s.phoneme, 'अ');
    eq(s.phoneme_id, ['v', 1]);
    eq(s.hex_index, '01');
    startsWith(s.color_value, 'rgb(');
  });

  console.log(`\nStap 15: ${P.length}/${P.length + F.length} ✅`);
  F.forEach(f => console.log(`  ❌ ${f}`));
}
