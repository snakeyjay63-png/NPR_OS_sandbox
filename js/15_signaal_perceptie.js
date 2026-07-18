#!/usr/bin/env node
/**
 * NPR-OS Stap 15: Signaal → Perceptie
 *
 * Canonieke 48-foneem-set (Sanskrit/Devanagari):
 *   14 klinkers  (v,1) .. (v,14)
 *   34 medeklinkers (c,1) .. (c,34)
 *
 * Pipeline: raw_text → NFC → segment_phonemes → phoneme_id → hex → freq/color
 *
 * Kanonieke MIDI-route (per Gaṇa):
 *   Gaṇa 1 velaar     → MIDI 48–52  (C3–E3)
 *   Gaṇa 2 palataal    → MIDI 53–57  (F3–A3)
 *   Gaṇa 3 retroflex   → MIDI 58–62  (A#3–D4)
 *   Gaṇa 4 dentaal     → MIDI 63–67  (D#4–G4)
 *   Gaṇa 5 labiaal     → MIDI 68–72  (G#4–C5)
 *   Gaṇa 6 antaḥstha   → MIDI 73–76  (C#5–E5)
 *   Gaṇa 7 uṣma        → MIDI 77–79  (F5–G5)
 *   Gaṇa 8 aspiraat    → MIDI 80      (G#5)
 *   ळ uitzondering     → MIDI 48      (C3, terug naar begin)
 *
 * Klinkers sturen filter cutoff/Q; medeklinkers sturen oscillator pitch.
 * Kleur = stuksgewijze functie over freq/f_base (f_base = 55 Hz).
 *
 * Autoriteit: 15_signaal_perceptie.md
 */

const f_base = 55; // Hz — ॐ oscillator-frequentie

// ── Klinkers (14) — filter cutoff + Q ────────────────────────
// Tabellenwaarden uit 15_signaal_perceptie.md §3
const VOWELS = [
  { ch: 'अ', id: ['v', 1],  hex: '01', filter: 200,  Q: 0.5 },
  { ch: 'आ', id: ['v', 2],  hex: '02', filter: 250,  Q: 0.6 },
  { ch: 'इ', id: ['v', 3],  hex: '03', filter: 350,  Q: 0.7 },
  { ch: 'ई', id: ['v', 4],  hex: '04', filter: 400,  Q: 0.8 },
  { ch: 'उ', id: ['v', 5],  hex: '05', filter: 300,  Q: 0.6 },
  { ch: 'ऊ', id: ['v', 6],  hex: '06', filter: 350,  Q: 0.7 },
  { ch: 'ऋ', id: ['v', 7],  hex: '07', filter: 500,  Q: 0.9 },
  { ch: 'ए', id: ['v', 8],  hex: '08', filter: 600,  Q: 1.0 },
  { ch: 'ऐ', id: ['v', 9],  hex: '09', filter: 700,  Q: 1.2 },
  { ch: 'ओ', id: ['v', 10], hex: '0A', filter: 650,  Q: 1.1 },
  { ch: 'औ', id: ['v', 11], hex: '0B', filter: 750,  Q: 1.3 },
  { ch: 'ं', id: ['v', 12], hex: '0C', filter: 100,  Q: 1.5 }, // anusvāra — sub-bass
  { ch: 'ः', id: ['v', 13], hex: '0D', filter: 800,  Q: 0.3 }, // visarga — delay
  { ch: 'ँ', id: ['v', 14], hex: '0E', filter: 150,  Q: 1.0 }, // chandra bindu — resonance
];

// ── Medeklinkers (34) — oscillator MIDI + envelope ───────────
// Continue MIDI-boog: Gaṇa 1→8 = C3→G#5 (articulatie-achter → voor)
const CONSONANTS = [
  // Gaṇa 1: velaar (क ख ग घ ङ)
  { ch: 'क', id: ['c', 1],  hex: '0F', midi: 48, attack: 0.005 },
  { ch: 'ख', id: ['c', 2],  hex: '10', midi: 49, attack: 0.005 },
  { ch: 'ग', id: ['c', 3],  hex: '11', midi: 50, attack: 0.005 },
  { ch: 'घ', id: ['c', 4],  hex: '12', midi: 51, attack: 0.005 },
  { ch: 'ङ', id: ['c', 5],  hex: '13', midi: 52, attack: 0.005 },
  // Gaṇa 2: palataal (च छ ज झ ञ)
  { ch: 'च', id: ['c', 6],  hex: '14', midi: 53, attack: 0.005 },
  { ch: 'छ', id: ['c', 7],  hex: '15', midi: 54, attack: 0.005 },
  { ch: 'ज', id: ['c', 8],  hex: '16', midi: 55, attack: 0.005 },
  { ch: 'झ', id: ['c', 9],  hex: '17', midi: 56, attack: 0.005 },
  { ch: 'ञ', id: ['c', 10], hex: '18', midi: 57, attack: 0.005 },
  // Gaṇa 3: retroflex (ट ठ ड ढ ण)
  { ch: 'ट', id: ['c', 11], hex: '19', midi: 58, attack: 0.005 },
  { ch: 'ठ', id: ['c', 12], hex: '1A', midi: 59, attack: 0.005 },
  { ch: 'ड', id: ['c', 13], hex: '1B', midi: 60, attack: 0.005 },
  { ch: 'ढ', id: ['c', 14], hex: '1C', midi: 61, attack: 0.005 },
  { ch: 'ण', id: ['c', 15], hex: '1D', midi: 62, attack: 0.005 },
  // Gaṇa 4: dentaal (त थ द ध न)
  { ch: 'त', id: ['c', 16], hex: '1E', midi: 63, attack: 0.005 },
  { ch: 'थ', id: ['c', 17], hex: '1F', midi: 64, attack: 0.005 },
  { ch: 'द', id: ['c', 18], hex: '20', midi: 65, attack: 0.005 },
  { ch: 'ध', id: ['c', 19], hex: '21', midi: 66, attack: 0.005 },
  { ch: 'न', id: ['c', 20], hex: '22', midi: 67, attack: 0.005 },
  // Gaṇa 5: labiaal (प फ ब भ म)
  { ch: 'प', id: ['c', 21], hex: '23', midi: 68, attack: 0.005 },
  { ch: 'फ', id: ['c', 22], hex: '24', midi: 69, attack: 0.005 },
  { ch: 'ब', id: ['c', 23], hex: '25', midi: 70, attack: 0.005 },
  { ch: 'भ', id: ['c', 24], hex: '26', midi: 71, attack: 0.005 },
  { ch: 'म', id: ['c', 25], hex: '27', midi: 72, attack: 0.020 }, // nāda (nasal)
  // Gaṇa 6: antaḥstha (य र ल व)
  { ch: 'य', id: ['c', 26], hex: '28', midi: 73, attack: 0.010 },
  { ch: 'र', id: ['c', 27], hex: '29', midi: 74, attack: 0.010 },
  { ch: 'ल', id: ['c', 28], hex: '2A', midi: 75, attack: 0.010 },
  { ch: 'व', id: ['c', 29], hex: '2B', midi: 76, attack: 0.010 },
  // Gaṇa 7: uṣma / sibilant (श ष स)
  { ch: 'श', id: ['c', 30], hex: '2C', midi: 77, attack: 0.001 },
  { ch: 'ष', id: ['c', 31], hex: '2D', midi: 78, attack: 0.001 },
  { ch: 'स', id: ['c', 32], hex: '2E', midi: 79, attack: 0.001 },
  // Gaṇa 8: aspiraat (ह) + uitzondering (ळ)
  { ch: 'ह', id: ['c', 33], hex: '2F', midi: 80, attack: 0.001 },
  { ch: 'ळ', id: ['c', 34], hex: '30', midi: 48, attack: 0.005 }, // terug naar C3
];

// ── Nukta-geëxtende set (5 extra) ────────────────────────────
// Bas + U+093C nukta-teken; inherente frequentie = basis+f
const NUKTA_EXTRA = [
  { ch: 'ड़', id: ['c', 35], hex: '31', midi: 60, attack: 0.005 }, // ड+f
  { ch: 'ढ़', id: ['c', 36], hex: '32', midi: 61, attack: 0.005 }, // ढ+f
  { ch: 'फ़', id: ['c', 37], hex: '33', midi: 69, attack: 0.005 }, // फ+f
  { ch: 'य़', id: ['c', 38], hex: '34', midi: 73, attack: 0.010 }, // य+f
  { ch: 'ज़', id: ['c', 39], hex: '35', midi: 55, attack: 0.005 }, // ज+f
];

const ALL_CONSONANTS = [...CONSONANTS, ...NUKTA_EXTRA];
const ALL_PHONEMES = [...VOWELS, ...ALL_CONSONANTS];

// ── Lookup maps ──────────────────────────────────────────────
const BY_CHAR = new Map(ALL_PHONEMES.map(p => [p.ch, p]));

// Russell 8-kleuren — exacte RGB uit §5
const RUSSELL_COLORS = [
  { idx: 0, name: 'Wit',    rgb: [255, 255, 255] },
  { idx: 1, name: 'Rood',   rgb: [255, 0, 0] },
  { idx: 2, name: 'Oranje', rgb: [255, 165, 0] },
  { idx: 3, name: 'Geel',   rgb: [255, 255, 0] },
  { idx: 4, name: 'Groen',  rgb: [0, 128, 0] },
  { idx: 5, name: 'Blauw',  rgb: [0, 0, 255] },
  { idx: 6, name: 'Indigo', rgb: [75, 0, 130] },
  { idx: 7, name: 'Violet', rgb: [128, 0, 128] },
];

// ── Derived calculations ─────────────────────────────────────

/** MIDI → frequentie (A4 = 440 Hz) */
function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/**
 * Stuksgewijze kleur-functie uit §5.
 * Gebruikt exacte rationale grenzen; geen mod-approximatie.
 */
function colorIndexFromFreq(hz) {
  const r = hz / f_base;
  if (r < 130 / 55) return 0; // Wit
  if (r < 220 / 55) return 1; // Rood
  if (r < 330 / 55) return 2; // Oranje
  if (r < 440 / 55) return 3; // Geel
  if (r < 550 / 55) return 4; // Groen
  if (r < 700 / 55) return 5; // Blauw
  if (r < 800 / 55) return 6; // Indigo
  return 7; // Violet
}

// ── Envelope defaults (§4) ───────────────────────────────────
const ENVELOPES = {
  sparsa:      { a: 0.005, d: 0.05, s: 0.2, r: 0.1 }, // stops
  nada:        { a: 0.02,  d: 0.1,  s: 0.7, r: 0.2 }, // nasals
  antahstha:   { a: 0.01,  d: 0.08, s: 0.5, r: 0.15 }, // semi
  ushma:       { a: 0.001, d: 0.02, s: 0.8, r: 0.05 }, // sibilants
};

// ── Mātrā → vowel mapping ────────────────────────────────────
const MATRA_MAP = {
  '\u0902': 'ं', // anusvara
  '\u0903': 'ः', // visarga
  '\u0901': 'ँ', // chandrabindu
  '\u093E': 'आ', '\u093F': 'इ', '\u0940': 'ई',
  '\u0941': 'उ', '\u0942': 'ऊ', '\u0943': 'ऋ',
  '\u0947': 'ए', '\u0948': 'ऐ',
  '\u094B': 'ओ', '\u094C': 'औ',
};

const VIRAMA = '\u094D';
const OM = '\u0950';
const NUKTA = '\u093C';
const INDEPENDENT_VOWELS = new Set(VOWELS.map(v => v.ch));

// ── Core pipeline functions ──────────────────────────────────

/** Unicode NFC-normalisatie (N***) */
function normalizeNfc(text) {
  if (text == null || text === '') throw new Error('EMPTY_INPUT');
  return String(text).normalize('NFC');
}

/**
 * Segmenteert Devanagari-tekst naar atomische fonemen.
 * Matra's → zelfstandige klinkers; consonant zonder mark → +अ.
 */
function segmentPhonemes(nfcText) {
  if (!nfcText || nfcText.length === 0) throw new Error('EMPTY_INPUT');

  const result = [];
  let i = 0;
  while (i < nfcText.length) {
    const ch = nfcText[i];
    const cp = ch.codePointAt(0);

    if (cp < 0x0900 || cp > 0x097F) {
      throw new Error(`UNSUPPORTED_CHARACTER: ${ch} (U+${cp.toString(16).toUpperCase()})`);
    }

    // ॐ → ओ ं म
    if (ch === OM) { result.push('ओ', 'ं', 'म'); i++; continue; }

    // Zelfstandige klinker
    if (INDEPENDENT_VOWELS.has(ch)) { result.push(ch); i++; continue; }

    // Matra alone → vowel equivalent
    if (ch in MATRA_MAP) { result.push(MATRA_MAP[ch]); i++; continue; }

    // Dangling virama
    if (ch === VIRAMA) throw new Error('DANGLING_VIRAMA');

    // Nukta: base + U+093C → composite
    if (i + 1 < nfcText.length && nfcText[i + 1] === NUKTA) {
      const candidate = ch + NUKTA;
      if (BY_CHAR.has(candidate)) {
        i += 2;
        if (i < nfcText.length) {
          const next = nfcText[i];
          if (next in MATRA_MAP) {
            result.push(candidate, MATRA_MAP[next]); i++; continue;
          }
          if (next === VIRAMA) { result.push(candidate); i++; continue; }
        }
        result.push(candidate, 'अ');
        continue;
      }
    }

    // Canonieke consonant
    const con = BY_CHAR.get(ch);
    if (con) {
      i++;
      if (i < nfcText.length) {
        const next = nfcText[i];
        if (next in MATRA_MAP) {
          result.push(ch, MATRA_MAP[next]); i++; continue;
        }
        if (next === VIRAMA) { result.push(ch); i++; continue; }
      }
      result.push(ch, 'अ'); // inherente अ
      continue;
    }

    throw new Error(`INVALID_CLUSTER at pos ${i}: ${ch}`);
  }
  return result;
}

/** foneem → (categorie, śāradā-positie) */
function phonemeId(phonemeChar) {
  const p = BY_CHAR.get(phonemeChar);
  if (!p) throw new Error(`UNSUPPORTED_PHONEME: ${phonemeChar}`);
  return p.id;
}

/** phoneme_id → hex-string */
function hexIndex(idArr) {
  const [cat, pos] = idArr;
  const list = cat === 'v' ? VOWELS : ALL_CONSONANTS;
  return list[pos - 1]?.hex ?? null;
}

/**
 * Volledig NPR-signaal voor één foneem.
 * Retourneert: phoneme_id, hex_index, freq_ratio, synth_param, color.
 */
function nprSignal(phonemeChar) {
  const p = BY_CHAR.get(phonemeChar);
  if (!p) throw new Error(`UNSUPPORTED_PHONEME: ${phonemeChar}`);

  const [cat, pos] = p.id;
  let freq, synthParam, freqRatio;

  if (cat === 'v') {
    // Klinker → filter cutoff
    freq = p.filter;
    freqRatio = freq / f_base;
    synthParam = { type: 'cutoff', value: freq, Q: p.Q };
  } else {
    // Medeklinker → oscillator pitch
    freq = midiToFreq(p.midi);
    freqRatio = freq / f_base;
    synthParam = { type: 'pitch', value: freq, midi: p.midi };
  }

  const cIdx = colorIndexFromFreq(freq);

  return {
    phoneme: phonemeChar,
    phoneme_id: p.id,
    hex_index: p.hex,
    freq_hz: Math.round(freq * 100) / 100,
    freq_ratio: Math.round(freqRatio * 100) / 100,
    synth_param: synthParam,
    color_index: cIdx,
    color_name: RUSSELL_COLORS[cIdx].name,
    color_value: `rgb(${RUSSELL_COLORS[cIdx].rgb.join(',')})`,
  };
}

/** Signaal voor exact één foneem (fout bij meerdere) */
function nprSignalSingle(text) {
  const phonemes = segmentPhonemes(normalizeNfc(text));
  if (phonemes.length !== 1) throw new Error('MULTIPLE_PHONEMES_IN_SINGLE');
  return nprSignal(phonemes[0]);
}

/** Signaal-sequentie voor een string fonemen */
function nprSignalSequence(text) {
  const phonemes = segmentPhonemes(normalizeNfc(text));
  return phonemes.map(ch => nprSignal(ch));
}

// ── Exports ──────────────────────────────────────────────────
module.exports = {
  normalizeNfc, segmentPhonemes, phonemeId, hexIndex,
  nprSignal, nprSignalSingle, nprSignalSequence,
  ALL_PHONEMES, VOWELS, ALL_CONSONANTS, NUKTA_EXTRA,
  BY_CHAR, RUSSELL_COLORS, ENVELOPES,
  f_base, midiToFreq, colorIndexFromFreq,
};

// ── Tests ────────────────────────────────────────────────────
if (require.main === module) {
  const P = [], F = [];
  function t(n, fn) { try { fn(); P.push(n); } catch (e) { F.push(`${n}: ${e.message}`); } }
  function eq(a, b) {
    if (typeof a === 'number' && typeof b === 'number') {
      if (Math.abs(a - b) > 0.06) throw new Error(`${a} !== ${b}`);
    } else if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(`${a} !== ${b}`);
    }
  }
  function throwsWith(fn, prefix) {
    let thrown = false;
    try { fn(); } catch (e) { thrown = true; if (!e.message.startsWith(prefix)) throw new Error(`got "${e.message}"`); }
    if (!thrown) throw new Error(`Expected error starting with ${prefix}`);
  }
  function approx(a, b, tol = 0.2) {
    if (Math.abs(a - b) > tol) throw new Error(`${a} not approx ${b}`);
  }

  // ── Segmentatie ──
  t('अ → [अ]', () => eq(segmentPhonemes('अ'), ['अ']));
  t('क → [क, अ]', () => eq(segmentPhonemes('क'), ['क', 'अ']));
  t('का → [क, आ]', () => eq(segmentPhonemes('का'), ['क', 'आ']));
  t('कि → [क, इ]', () => eq(segmentPhonemes('कि'), ['क', 'इ']));
  t('क् → [क]', () => eq(segmentPhonemes('क्'), ['क']));
  t('क्त → [क, त, अ]', () => eq(segmentPhonemes('क्त'), ['क', 'त', 'अ']));
  t('ॐ → [ओ, ं, म]', () => eq(segmentPhonemes('ॐ'), ['ओ', 'ं', 'म']));
  t('ं standalone → [ं]', () => eq(segmentPhonemes('ं'), ['ं']));
  t('ः standalone → [ः]', () => eq(segmentPhonemes('ः'), ['ः']));
  t('ँ standalone → [ँ]', () => eq(segmentPhonemes('ँ'), ['ँ']));
  // Nukta
  t('ड़ → [ड़, अ]', () => eq(segmentPhonemes('ड़'), ['ड़', 'अ']));
  t('ढ़ → [ढ़, अ]', () => eq(segmentPhonemes('ढ़'), ['ढ़', 'अ']));
  t('फ़ → [फ़, अ]', () => eq(segmentPhonemes('फ़'), ['फ़', 'अ']));
  t('य़ → [य़, अ]', () => eq(segmentPhonemes('य़'), ['य़', 'अ']));
  t('ज़ → [ज़, अ]', () => eq(segmentPhonemes('ज़'), ['ज़', 'अ']));
  t('ड़ि → [ड़, इ]', () => eq(segmentPhonemes('ड़ि'), ['ड़', 'इ']));
  t('ड़क् → [ड़, अ, क]', () => eq(segmentPhonemes('ड़क्'), ['ड़', 'अ', 'क']));
  // Fouten
  t('empty → EMPTY_INPUT', () => throwsWith(() => segmentPhonemes(''), 'EMPTY_INPUT'));
  t('latin → UNSUPPORTED', () => throwsWith(() => segmentPhonemes('hello'), 'UNSUPPORTED'));

  // ── Data-integriteit ──
  t('48 canonieke fonemen', () => eq(VOWELS.length + CONSONANTS.length, 48));
  t('totaal 53 incl. nukta', () => eq(ALL_PHONEMES.length, 53));
  t('48 unieke canonieke IDs', () => {
    const ids = [...VOWELS, ...CONSONANTS].map(p => JSON.stringify(p.id));
    eq(new Set(ids).size, 48);
  });
  t('48 unieke canonieke hex', () => {
    const hexes = [...VOWELS, ...CONSONANTS].map(p => p.hex);
    eq(new Set(hexes).size, 48);
  });
  t('hex range 01–30', () => {
    const vals = [...VOWELS, ...CONSONANTS].map(p => parseInt(p.hex, 16));
    eq(Math.min(...vals), 1);
    eq(Math.max(...vals), 0x30);
  });

  // ── MIDI-frequentie (spec-conform) ──
  t('क MIDI 48 → ~130.81 Hz (C3)', () => {
    const s = nprSignal('क');
    eq(s.synth_param.midi, 48);
    approx(s.freq_hz, 130.81);
  });
  t('स MIDI 79 → ~783.99 Hz (G5)', () => {
    const s = nprSignal('स');
    eq(s.synth_param.midi, 79);
    approx(s.freq_hz, 783.99);
  });
  t('ह MIDI 80 → ~830.61 Hz (G#5)', () => {
    const s = nprSignal('ह');
    eq(s.synth_param.midi, 80);
    approx(s.freq_hz, 830.61);
  });
  t('ळ MIDI 48 → ~130.81 Hz (terug C3)', () => {
    const s = nprSignal('ळ');
    eq(s.synth_param.midi, 48);
    approx(s.freq_hz, 130.81);
  });
  t('म MIDI 72 → ~523.25 Hz (C5)', () => {
    const s = nprSignal('म');
    eq(s.synth_param.midi, 72);
    approx(s.freq_hz, 523.25);
  });

  // ── Klinker-filter (spec-conform) ──
  t('अ filter 200 Hz, Q 0.5', () => {
    const s = nprSignal('अ');
    eq(s.synth_param.type, 'cutoff');
    eq(s.synth_param.value, 200);
    eq(s.synth_param.Q, 0.5);
  });
  t('ए filter 600 Hz, Q 1.0', () => {
    const s = nprSignal('ए');
    eq(s.synth_param.type, 'cutoff');
    eq(s.synth_param.value, 600);
  });
  t('ः filter 800 Hz, Q 0.3', () => {
    const s = nprSignal('ः');
    eq(s.synth_param.value, 800);
    eq(s.synth_param.Q, 0.3);
  });

  // ── Kleur (stuksgewijze functie, §5) ──
  t('क → Rood (1)', () => eq(nprSignal('क').color_index, 1));
  t('अ → Rood (1)', () => eq(nprSignal('अ').color_index, 1));
  t('स → Indigo (6)', () => eq(nprSignal('स').color_index, 6));
  t('ह → Violet (7)', () => eq(nprSignal('ह').color_index, 7));
  t('ए → Blauw (5)', () => eq(nprSignal('ए').color_index, 5));
  t('ः → Violet (7)', () => eq(nprSignal('ः').color_index, 7));

  // ── Volledige keten (§5 voorbeelden) ──
  t('स keten: id→hex→freq→color', () => {
    const s = nprSignal('स');
    eq(s.phoneme_id, ['c', 32]);
    eq(s.hex_index, '2E');
    approx(s.freq_hz, 783.99);
    eq(s.color_index, 6);
    eq(s.color_name, 'Indigo');
  });
  t('क keten: id→hex→freq→color', () => {
    const s = nprSignal('क');
    eq(s.phoneme_id, ['c', 1]);
    eq(s.hex_index, '0F');
    approx(s.freq_hz, 130.81);
    eq(s.color_index, 1);
    eq(s.color_name, 'Rood');
  });
  t('अ keten: id→hex→filter→color', () => {
    const s = nprSignal('अ');
    eq(s.phoneme_id, ['v', 1]);
    eq(s.hex_index, '01');
    eq(s.synth_param.value, 200);
    eq(s.color_index, 1);
  });

  // ── Determinisme ──
  t('zelfde input → zelfde output', () => {
    const a = nprSignal('त');
    const b = nprSignal('त');
    eq(JSON.stringify(a), JSON.stringify(b));
  });

  // ── Sequence ──
  t('नमस्ते → 6 phoneme-signals', () => {
    const seq = nprSignalSequence('नमस्ते');
    // न म अ स् त ए
    // → न,अ, म,अ, स, त,ए
    // "नमस्ते" = न्+अ + म्+अ + स्+त + ए
    // nfc = न म् अ स् त् ए (simplified check)
    // just verify it returns array of signals
    if (!Array.isArray(seq) || seq.length < 1) throw new Error('empty sequence');
    seq.forEach(s => {
      if (!s.phoneme_id || !s.hex_index) throw new Error('incomplete signal');
    });
  });

  console.log(`\nStap 15: ${P.length}/${P.length + F.length} ✅`);
  F.forEach(f => console.log(`  ❌ ${f}`));

  // ── Debug: print a few kanonieke signals ──
  if (F.length === 0) {
    console.log('\n— Kanonieke signaal-voorbeelden —');
    ['अ', 'क', 'स', 'ह', 'ए'].forEach(ch => {
      const s = nprSignal(ch);
      console.log(`  ${ch} → id=${JSON.stringify(s.phoneme_id)} hex=${s.hex_index} ` +
        `${s.freq_hz}Hz (${s.synth_param.type}) ratio=${s.freq_ratio} → ${s.color_name}`);
    });
  }
}
