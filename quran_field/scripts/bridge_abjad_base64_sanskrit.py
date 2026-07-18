#!/usr/bin/env python3
"""
Bridge layer: Abjad → Base64 → Sanskrit phoneme → frequency.

Pipeline:
  Arabic char → Abjad value → binary bytes → base64 token
  → Śāradā index → Sanskrit phoneme → frequency

This creates a non-linear graph where each Arabic letter connects
to multiple dimensions simultaneously.
"""
import base64
import json
import struct

# ============================================================
# Layer 1: Abjad (already defined)
# ============================================================
ABJAD = {
    'ا': 1, 'ب': 2, 'ج': 3, 'د': 4, 'ه': 5, 'و': 6,
    'ز': 7, 'ح': 8, 'ط': 9, 'ي': 10, 'ك': 20, 'ل': 30,
    'م': 40, 'ن': 50, 'س': 60, 'ع': 70, 'ف': 80, 'ص': 90,
    'ق': 100, 'ر': 200, 'ش': 300, 'ت': 400, 'ث': 500,
    'خ': 600, 'ذ': 700, 'ض': 800, 'ظ': 900, 'غ': 1000,
}
ABJAD_ALIASES = {
    'أ': 1, 'إ': 1, 'آ': 1, 'ؤ': 6, 'ئ': 10, 'ٱ': 30,
}

# ============================================================
# Layer 2: Base64 alphabet as bridge
# ============================================================
BASE64_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

# ============================================================
# Layer 3: Sanskrit phoneme table (Śāradā + Gaṇa)
# ============================================================
# Vowels (स्वर) - 12 basic
SANSKRIT_VOWELS = {
    'a':   {'char': 'अ', 'sharada': 1,   'type': 'vowel', 'f0_hz': 200},
    'ā':   {'char': 'आ', 'sharada': 11,  'type': 'vowel', 'f0_hz': 220},
    'i':   {'char': 'इ', 'sharada': 2,   'type': 'vowel', 'f0_hz': 250},
    'ī':   {'char': 'ई', 'sharada': 21,  'type': 'vowel', 'f0_hz': 275},
    'u':   {'char': 'उ', 'sharada': 3,   'type': 'vowel', 'f0_hz': 300},
    'ū':   {'char': 'ऊ', 'sharada': 31,  'type': 'vowel', 'f0_hz': 330},
    'ṛ':   {'char': 'ऋ', 'sharada': 4,   'type': 'vowel', 'f0_hz': 350},
    'e':   {'char': 'ए', 'sharada': 5,   'type': 'vowel', 'f0_hz': 400},
    'ai':  {'char': 'ऐ', 'sharada': 6,   'type': 'vowel', 'f0_hz': 420},
    'o':   {'char': 'ओ', 'sharada': 7,   'type': 'vowel', 'f0_hz': 450},
    'au':  {'char': 'औ', 'sharada': 8,   'type': 'vowel', 'f0_hz': 480},
    'ḻ':   {'char': 'ॠ', 'sharada': 9,   'type': 'vowel', 'f0_hz': 500},
}

# Consonants (व्यंजन) - Gaṇa groups
SANSKRIT_CONSONANTS = {
    # Antaraha (velar) - क्वादि
    'k':   {'char': 'क', 'sharada': 101, 'gana': 'kva', 'f0_hz': 110},
    'kh':  {'char': 'ख', 'sharada': 102, 'gana': 'kva', 'f0_hz': 120},
    'g':   {'char': 'ग', 'sharada': 103, 'gana': 'kva', 'f0_hz': 130},
    'gh':  {'char': 'घ', 'sharada': 104, 'gana': 'kva', 'f0_hz': 140},
    'ṅ':   {'char': 'ङ', 'sharada': 105, 'gana': 'kva', 'f0_hz': 150},
    # Talavaya (palatal) - क्ष्वादि
    'c':   {'char': 'च', 'sharada': 201, 'gana': 'ksha', 'f0_hz': 165},
    'ch':  {'char': 'छ', 'sharada': 202, 'gana': 'ksha', 'f0_hz': 170},
    'j':   {'char': 'ज', 'sharada': 203, 'gana': 'ksha', 'f0_hz': 175},
    'jh':  {'char': 'झ', 'sharada': 204, 'gana': 'ksha', 'f0_hz': 180},
    'ñ':   {'char': 'ञ', 'sharada': 205, 'gana': 'ksha', 'f0_hz': 185},
    # Mūrdhanya (retroflex) - ट्वादि
    'ṭ':   {'char': 'ट', 'sharada': 301, 'gana': 'ṭva', 'f0_hz': 190},
    'ṭh':  {'char': 'ठ', 'sharada': 302, 'gana': 'ṭva', 'f0_hz': 195},
    'ḍ':   {'char': 'ड', 'sharada': 303, 'gana': 'ṭva', 'f0_hz': 200},
    'ḍh':  {'char': 'ढ', 'sharada': 304, 'gana': 'ṭva', 'f0_hz': 205},
    'ṇ':   {'char': 'ण', 'sharada': 305, 'gana': 'ṭva', 'f0_hz': 210},
    # Dantaya (dental) - त्वादि
    't':   {'char': 'त', 'sharada': 401, 'gana': 'tva', 'f0_hz': 220},
    'th':  {'char': 'थ', 'sharada': 402, 'gana': 'tva', 'f0_hz': 225},
    'd':   {'char': 'द', 'sharada': 403, 'gana': 'tva', 'f0_hz': 230},
    'dh':  {'char': 'ध', 'sharada': 404, 'gana': 'tva', 'f0_hz': 235},
    'n':   {'char': 'न', 'sharada': 405, 'gana': 'tva', 'f0_hz': 240},
    # Oṣṭhya (labial) - प्वादि
    'p':   {'char': 'प', 'sharada': 501, 'gana': 'pva', 'f0_hz': 250},
    'ph':  {'char': 'फ', 'sharada': 502, 'gana': 'pva', 'f0_hz': 255},
    'b':   {'char': 'ब', 'sharada': 503, 'gana': 'pva', 'f0_hz': 260},
    'bh':  {'char': 'भ', 'sharada': 504, 'gana': 'pva', 'f0_hz': 265},
    'm':   {'char': 'म', 'sharada': 505, 'gana': 'pva', 'f0_hz': 270},
    # Antastha (semi-vowels/sibilants) - य्रादि
    'y':   {'char': 'य', 'sharada': 601, 'gana': 'yā', 'f0_hz': 280},
    'r':   {'char': 'र', 'sharada': 602, 'gana': 'yā', 'f0_hz': 285},
    'l':   {'char': 'ल', 'sharada': 603, 'gana': 'yā', 'f0_hz': 290},
    'v':   {'char': 'व', 'sharada': 604, 'gana': 'yā', 'f0_hz': 295},
    'ś':   {'char': 'श', 'sharada': 605, 'gana': 'yā', 'f0_hz': 300},
    'ṣ':   {'char': 'ष', 'sharada': 606, 'gana': 'yā', 'f0_hz': 310},
    's':   {'char': 'स', 'sharada': 607, 'gana': 'yā', 'f0_hz': 320},
    'h':   {'char': 'ह', 'sharada': 608, 'gana': 'yā', 'f0_hz': 330},
    'ḫ':   {'char': 'क्ष', 'sharada': 609, 'gana': 'yā', 'f0_hz': 340},
}

# Reverse lookup: sharada → phoneme
SHARADA_TO_PHONEME = {}
for key, val in {**SANSKRIT_VOWELS, **SANSKRIT_CONSONANTS}.items():
    SHARADA_TO_PHONEME[val['sharada']] = {
        'key': key,
        'char': val['char'],
        'type': val.get('type', 'consonant'),
        'f0_hz': val['f0_hz'],
    }


# ============================================================
# Bridge functions
# ============================================================

def abjad_value(char):
    """Get Abjad value for Arabic character."""
    return ABJAD.get(char, ABJAD_ALIASES.get(char, 0))

def abjad_to_bytes(value):
    """Convert Abjad integer to bytes (little-endian uint16)."""
    return struct.pack('<H', value % 65536)

def abjad_to_base64(value):
    """Convert Abjad value → bytes → base64 token."""
    b = abjad_to_bytes(value)
    return base64.b64encode(b).decode('ascii')

def abjad_to_sharada_index(abjad_val):
    """Direct Abjad → Śāradā index mapping.
    
    Range 1-1000 maps to Śāradā 1-609.
    Uses mod-609 with offset to cover full phoneme table.
    """
    available_sharadas = sorted(SHARADA_TO_PHONEME.keys())
    idx = (abjad_val - 1) % len(available_sharadas)
    return available_sharadas[idx]

def base64_to_sharada_index(b64_token):
    """Convert base64 token to Śāradā index via character positions."""
    pos_sum = sum(BASE64_CHARS.find(c) for c in b64_token if c in BASE64_CHARS)
    return abjad_to_sharada_index(pos_sum + 1)

def sharada_to_phoneme(sharada_idx):
    """Look up Sanskrit phoneme by Śāradā value."""
    if sharada_idx in SHARADA_TO_PHONEME:
        return SHARADA_TO_PHONEME[sharada_idx]
    # Fallback: find nearest
    keys = sorted(SHARADA_TO_PHONEME.keys())
    nearest = min(keys, key=lambda k: abs(k - sharada_idx))
    return SHARADA_TO_PHONEME[nearest]

def bridge_chain(arabic_char):
    """Full bridge: Arabic → Abjad → Base64 → Śāradā → Sanskrit → Hz."""
    val = abjad_value(arabic_char)
    if val == 0:
        return None
    
    b64 = abjad_to_base64(val)
    sharada = abjad_to_sharada_index(val)
    phoneme = sharada_to_phoneme(sharada)
    
    return {
        'arabic': arabic_char,
        'abjad': val,
        'base64': b64,
        'sharada_index': sharada,
        'sanskrit_char': phoneme['char'],
        'sanskrit_key': phoneme['key'],
        'sanskrit_type': phoneme['type'],
        'frequency_hz': phoneme['f0_hz'],
    }

# ============================================================
# Digital layer: direct numeric → Sanskrit
# ============================================================

def digital_to_sanskrit(digit):
    """Map single decimal digit to Sanskrit numeral character."""
    mapping = {
        0: {'char': '०', 'name': 'śūnya', 'value': 0},
        1: {'char': '१', 'name': 'eka', 'value': 1},
        2: {'char': '२', 'name': 'dva', 'value': 2},
        3: {'char': '३', 'name': 'tri', 'value': 3},
        4: {'char': '४', 'name': 'catur', 'value': 4},
        5: {'char': '५', 'name': 'pañca', 'value': 5},
        6: {'char': '६', 'name': 'ṣaṣ', 'value': 6},
        7: {'char': '७', 'name': 'saptan', 'value': 7},
        8: {'char': '८', 'name': 'aṣṭan', 'value': 8},
        9: {'char': '९', 'name': 'nava', 'value': 9},
    }
    return mapping.get(digit % 10)

def digital_root(n):
    """Digital root (mod-9)."""
    if n == 0:
        return 0
    r = n % 9
    return r if r != 0 else 9

# ============================================================
# Demo
# ============================================================

def demo():
    """Demonstrate bridge with दोام (dawām)."""
    word = "دوام"
    print("=" * 70)
    print("BRIDGE: Arabic → Abjad → Base64 → Sanskrit → Frequency")
    print("=" * 70)
    print(f"\nInput word: {word}")
    print()
    
    total_abjad = 0
    results = []
    
    for char in word:
        result = bridge_chain(char)
        if result:
            results.append(result)
            total_abjad += result['abjad']
            print(f"  {result['arabic']} → Abjad:{result['abjad']:>4} "
                  f"→ B64:{result['base64']:<8} "
                  f"→ Śā:{result['sharada_index']:>3} "
                  f"→ {result['sanskrit_char']}({result['sanskrit_key']}) "
                  f"→ {result['frequency_hz']} Hz")
    
    dr = digital_root(total_abjad)
    dr_sanskrit = digital_to_sanskrit(dr)
    
    print(f"\n  Word total: Abjad={total_abjad}, DR={dr}")
    print(f"  Digital root → Sanskrit: {dr_sanskrit['char']} ({dr_sanskrit['name']})")
    
    # NPR phase
    if dr == 3:
        phase = "Noise"
    elif dr == 6:
        phase = "Pattern"
    elif dr == 9:
        phase = "Return"
    else:
        phase = f"Phase-{dr}"
    
    print(f"  NPR Phase: {phase}")
    
    # Base64 bridge as full word
    word_abjad_bytes = b''
    for r in results:
        word_abjad_bytes += abjad_to_bytes(r['abjad'])
    word_b64 = base64.b64encode(word_abjad_bytes).decode('ascii')
    print(f"\n  Full word base64: {word_b64}")
    
    # Graph representation
    print("\n" + "=" * 70)
    print("GRAPH VIEW: Multi-dimensional connections")
    print("=" * 70)
    for r in results:
        print(f"""
{r['arabic']}
├─ Abjad: {r['abjad']}
├─ Base64: {r['base64']}
├─ Śāradā: {r['sharada_index']}
├─ Sanskrit: {r['sanskrit_char']} ({r['sanskrit_key']}, {r['sanskrit_type']})
├─ Frequency: {r['frequency_hz']} Hz
└─ Digital root: {digital_root(r['abjad'])}
""")
    
    return results

if __name__ == '__main__':
    demo()
