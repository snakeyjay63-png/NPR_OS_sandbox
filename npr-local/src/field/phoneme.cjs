// @net 10.15.0.0/24
// ═══════════════════════════════════════════════════
// @net 10.15.0.0/24
// field/phoneme.cjs — Stap 15: Signaal Perceptie
// ═══════════════════════════════════════════════════
//
// Devanagari phoneme segmentation pipeline.
// Decomposes compound graphemes (consonant + matra) into
// atomic phonemes for downstream NPR analysis.
//
// normalize_nfc      : UnicodeText → NormalizedText
// segment_phonemes   : NormalizedText → List<AtomicPhoneme>
// canonicalize_matra : Consonant × DependentVowel → List<AtomicPhoneme>
// phoneme_id         : AtomicPhoneme → PhonemeID
//
// ═══════════════════════════════════════════════════

/**
 * Standard Devanagari matra mapping: dependent vowel mark → independent vowel.
 * Each key is the matra character; each value is the independent vowel it represents.
 * @type {Record<string, string>}
 */
const MATRA_MAP = {
  '\u093E': '\u0906', // ा → आ (aa)
  '\u093F': '\u0907', // ि → इ (i)
  '\u0940': '\u0908', // ी → ई (ii)
  '\u0939': '\u0909', // ु → उ (u)
  '\u093A': '\u090A', // ू → ऊ (uu)
  '\u093B': '\u0910', // ृ → ऋ (ri — mapped to independent ऋ)
  '\u094B': '\u0911', // ऌ → ऌ (vocalic l — rare)
  '\u0944': '\u0912', // ॄ → ऌ (vocalic l — lengthened, rare)
  '\u0947': '\u090E', // े → ए (e)
  '\u0948': '\u090F', // ै → ऐ (ai)
  '\u094C': '\u0914', // ो → ओ (o)
  '\u094F': '\u0914', // ौ → औ (au)
  '\u0950': '\u0950', // ॉ → ॉ (lengthened o — kept as-is)
};

/**
 * Set of characters that are dependent vowel marks (matras) in Devanagari.
 * @type {Set<string>}
 */
const MATRA_CHARS = new Set(Object.keys(MATRA_MAP));

/** Halant (virama) character — removes the inherent vowel "a" from a consonant. */
const HALANT = '\u094D';

// ─── Character Classification Helpers ─────────────

/**
 * Check if a character is a Devanagari consonant.
 * @param {string} ch - Single character to check.
 * @returns {boolean} True if the character is a Devanagari consonant.
 */
function isDevanagariConsonant(ch) {
  const cp = ch.codePointAt(0);
  // Devanagari consonants: U+0915 to U+0939 (excluding U+0930 which is vowel variant)
  return cp >= 0x0915 && cp <= 0x0939 && cp !== 0x0930;
}

/**
 * Check if a character is a Devanagari independent vowel.
 * @param {string} ch - Single character to check.
 * @returns {boolean} True if the character is a Devanagari independent vowel.
 */
function isDevanagariVowel(ch) {
  const cp = ch.codePointAt(0);
  // Independent vowels: U+0904-U+0914, U+093B-U+093C, U+0950-U+0952
  return (cp >= 0x0904 && cp <= 0x0914) ||
         (cp >= 0x093B && cp <= 0x093C) ||
         (cp >= 0x0950 && cp <= 0x0952);
}

/**
 * Check if a character is a matra (dependent vowel mark).
 * @param {string} ch - Single character to check.
 * @returns {boolean} True if the character is a matra.
 */
function isMatra(ch) {
  return MATRA_CHARS.has(ch);
}

/**
 * Determine the phoneme type for a single character.
 * @param {string} ch - Single Devanagari character.
 * @returns {string} One of: 'vowel', 'consonant', 'matra', 'halant', 'special', 'devanagari_other', 'unknown'.
 */
function classifyPhoneme(ch) {
  const cp = ch.codePointAt(0);

  if (ch === HALANT) return 'halant';
  if (isMatra(ch)) return 'matra';
  if (isDevanagariVowel(ch)) return 'vowel';
  if (isDevanagariConsonant(ch)) return 'consonant';

  // Special characters: anusvara (ं), visarga (ः), avagraha (ऽ)
  if (cp === 0x0902 || cp === 0x0903 || cp === 0x097C) return 'special';

  // Other Devanagari range characters
  if (cp >= 0x0900 && cp <= 0x097F) return 'devanagari_other';

  return 'unknown';
}

// ─── Core Pipeline Functions ──────────────────────

/**
 * Unicode NFC normalization.
 * Combines decomposed characters into their composed equivalents where possible.
 *
 * @param {string} text - Raw Unicode text to normalize.
 * @returns {string} NFC-normalized text.
 * @throws {Error} On empty or non-string input.
 */
function normalize_nfc(text) {
  if (typeof text !== 'string') {
    throw new Error('invalid_input: expected string, got ' + typeof text);
  }
  if (text.length === 0) {
    throw new Error('empty_input: normalize_nfc received empty string');
  }
  return text.normalize('NFC');
}

/**
 * Generate a canonical PhonemeID for a single atomic phoneme character.
 *
 * @param {string} phoneme - Single character representing an atomic phoneme.
 * @returns {{char: string, type: string, codePoint: number, codePointHex: string}}
 * @throws {Error} If input contains more than one character or is empty.
 */
function phoneme_id(phoneme) {
  if (typeof phoneme !== 'string') {
    throw new Error('invalid_input: phoneme_id expects a string');
  }
  if (phoneme.length === 0) {
    throw new Error('empty_input: phoneme_id received empty string');
  }
  if (phoneme.length > 1) {
    throw new Error('multiple_phonemes_in_single: phoneme_id expects one character, got "' + phoneme + '"');
  }

  const cp = phoneme.codePointAt(0);
  return {
    char: phoneme,
    type: classifyPhoneme(phoneme),
    codePoint: cp,
    codePointHex: 'U+' + cp.toString(16).toUpperCase().padStart(4, '0'),
  };
}

/**
 * Expand a consonant + dependent vowel (matra) pair into atomic phonemes.
 * The consonant is preserved; the matra is replaced by its independent vowel equivalent.
 *
 * Example: क + ा → [क, आ]
 * Example: त + ी → [त, ई]
 *
 * @param {string} consonant - Single Devanagari consonant character.
 * @param {string} dependent_vowel - Single matra character.
 * @returns {string[]} Array of two atomic phoneme strings.
 * @throws {Error} If inputs are invalid or not recognized.
 */
function canonicalize_matra(consonant, dependent_vowel) {
  if (typeof consonant !== 'string' || consonant.length !== 1) {
    throw new Error('invalid_input: canonicalize_matra expects a single consonant character');
  }
  if (typeof dependent_vowel !== 'string' || dependent_vowel.length !== 1) {
    throw new Error('invalid_input: canonicalize_matra expects a single matra character');
  }
  if (!isDevanagariConsonant(consonant)) {
    throw new Error('unsupported_phoneme: expected Devanagari consonant, got "' + consonant + '"');
  }
  if (!MATRA_CHARS.has(dependent_vowel)) {
    throw new Error('unsupported_phoneme: expected matra, got "' + dependent_vowel + '"');
  }

  const independentVowel = MATRA_MAP[dependent_vowel];
  if (!independentVowel) {
    throw new Error('invalid_cluster: no mapping for matra "' + dependent_vowel + '"');
  }

  return [consonant, independentVowel];
}

/**
 * Segment normalized Devanagari text into atomic phonemes.
 *
 * Decomposition rules:
 * 1. Consonant + matra pairs are expanded: क+ा → [क, आ]
 * 2. Halant (्) removes the inherent vowel from a consonant — consumed, not emitted
 * 3. Standalone vowels and consonants are emitted as-is
 * 4. Special characters (anusvara, visarga, avagraha) are emitted as-is
 * 5. Non-Devanagari characters are emitted as-is (passthrough)
 *
 * @param {string} text - NFC-normalized Devanagari text.
 * @returns {{phonemes: string[], errors: string[]}} Segmented phonemes and any encountered errors.
 * @throws {Error} On empty input.
 */
function segment_phonemes(text) {
  if (typeof text !== 'string') {
    throw new Error('invalid_input: segment_phonemes expects a string');
  }
  if (text.length === 0) {
    throw new Error('empty_input: segment_phonemes received empty string');
  }

  const phonemes = [];
  const errors = [];
  let i = 0;

  while (i < text.length) {
    const ch = text[i];
    const type = classifyPhoneme(ch);

    switch (type) {
      case 'consonant': {
        // Look ahead for matra or halant
        const next = i + 1 < text.length ? text[i + 1] : null;

        if (next && isMatra(next)) {
          // Consonant + matra → expand to [consonant, independent_vowel]
          try {
            const expanded = canonicalize_matra(ch, next);
            phonemes.push(...expanded);
            i += 2;
          } catch (e) {
            errors.push(e.message);
            phonemes.push(ch); // emit consonant, skip matra
            i += 2;
          }
        } else if (next && next === HALANT) {
          // Consonant + halant → consonant cluster start (consume halant, emit consonant)
          phonemes.push(ch);
          i += 2; // skip halant
        } else {
          // Standalone consonant (with inherent 'a' vowel)
          phonemes.push(ch);
          i++;
        }
        break;
      }

      case 'vowel':
        phonemes.push(ch);
        i++;
        break;

      case 'matra':
        // Orphan matra without preceding consonant — emit as independent vowel
        if (MATRA_MAP[ch]) {
          phonemes.push(MATRA_MAP[ch]);
        } else {
          phonemes.push(ch);
        }
        i++;
        break;

      case 'halant':
        // Orphan halant — skip (no preceding consonant to modify)
        i++;
        break;

      case 'special':
      case 'devanagari_other':
        phonemes.push(ch);
        i++;
        break;

      case 'unknown':
        // Non-Devanagari character — passthrough
        phonemes.push(ch);
        i++;
        break;

      default:
        errors.push('unsupported_phoneme at index ' + i + ': "' + ch + '"');
        i++;
    }
  }

  return { phonemes, errors };
}

// ─── Module Exports ───────────────────────────────

module.exports = {
  normalize_nfc,
  segment_phonemes,
  canonicalize_matra,
  phoneme_id,
  MATRA_MAP,
  MATRA_CHARS,
  HALANT,
  // Internal helpers (exported for testing)
  isDevanagariConsonant,
  isDevanagariVowel,
  isMatra,
  classifyPhoneme,
};
