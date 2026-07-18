#!/usr/bin/env python3
"""
Bridge v2: Primary representations.

Sanskrit → positional hex-index (0x01–0x30) → frequency
Arabic → Abjad decimal value (1–1000) → digital root / mod-9

Hex representation of Abjad is secondary only.
Abjad identity remains decimal.
"""
import struct
import base64

# ============================================================
# LAYER 1: Sanskrit — Hex-index (primary)
# ============================================================
SANSKRIT_PHONEMES = [
    # Vowels (01–0C)
    ('0x01', 'अ',  'a',    200), ('0x02', 'आ',  'aa',   220),
    ('0x03', 'इ',  'i',    250), ('0x04', 'ई',  'ii',   275),
    ('0x05', 'उ',  'u',    300), ('0x06', 'ऊ',  'uu',   330),
    ('0x07', 'ऋ',  'ri',   350), ('0x08', 'ए',  'e',    400),
    ('0x09', 'ऐ',  'ai',   420), ('0x0A', 'ओ',  'o',    450),
    ('0x0B', 'औ',  'au',   480), ('0x0C', 'ॠ',  'li',   500),
    # Velar (0D–11)
    ('0x0D', 'क',  'k',    110), ('0x0E', 'ख',  'kh',   120),
    ('0x0F', 'ग',  'g',    130), ('0x10', 'घ',  'gh',   140),
    ('0x11', 'ङ',  'ng',   150),
    # Palatal (12–16)
    ('0x12', 'च',  'c',    165), ('0x13', 'छ',  'ch',   170),
    ('0x14', 'ज',  'j',    175), ('0x15', 'झ',  'jh',   180),
    ('0x16', 'ञ',  'ny',   185),
    # Retroflex (17–1B)
    ('0x17', 'ट',  'T',    190), ('0x18', 'ठ',  'Th',   195),
    ('0x19', 'ड',  'D',    200), ('0x1A', 'ढ',  'Dh',   205),
    ('0x1B', 'ण',  'N',    210),
    # Dental (1C–20)
    ('0x1C', 'त',  't',    220), ('0x1D', 'थ',  'th',   225),
    ('0x1E', 'द',  'd',    230), ('0x1F', 'ध',  'dh',   235),
    ('0x20', 'न',  'n',    240),
    # Labial (21–25)
    ('0x21', 'प',  'p',    250), ('0x22', 'फ',  'ph',   255),
    ('0x23', 'ब',  'b',    260), ('0x24', 'भ',  'bh',   265),
    ('0x25', 'म',  'm',    270),
    # Semi-vowels / sibilants (26–30)
    ('0x26', 'य',  'y',    280), ('0x27', 'र',  'r',    285),
    ('0x28', 'ल',  'l',    290), ('0x29', 'व',  'v',    295),
    ('0x2A', 'श',  'sh',   300), ('0x2B', 'ष',  'Sh',   310),
    ('0x2C', 'स',  's',    320), ('0x2D', 'ह',  'h',    330),
    ('0x2E', 'क्ष', 'ksh', 340), ('0x2F', 'त्र', 'tr',   345),
    ('0x30', 'ज्ञ', 'jny', 350),
]

# Build lookup: hex_index → phoneme info
HEX_TO_PHONEME = {h: {'char': c, 'key': k, 'hz': f} for h, c, k, f in SANSKRIT_PHONEMES}

# ============================================================
# LAYER 2: Arabic — Abjad decimal (primary)
# ============================================================
ABJAD = {
    'ا': 1, 'ب': 2, 'ج': 3, 'د': 4, 'ه': 5, 'و': 6, 'ز': 7, 'ح': 8, 'ط': 9,
    'ي': 10, 'ك': 20, 'ل': 30, 'م': 40, 'ن': 50, 'س': 60, 'ع': 70, 'ف': 80, 'ص': 90,
    'ق': 100, 'ر': 200, 'ش': 300, 'ت': 400, 'ث': 500, 'خ': 600, 'ذ': 700, 'ض': 800, 'ظ': 900, 'غ': 1000,
}
ABJAD_ALIASES = {
    'أ': 1, 'إ': 1, 'آ': 1, 'ؤ': 6, 'ئ': 10, 'ٱ': 30,
}

def abjad_value(char):
    """Abjad decimal value (primary identity)."""
    return ABJAD.get(char, ABJAD_ALIASES.get(char, 0))

def digital_root(n):
    if n == 0: return 0
    r = n % 9
    return r if r != 0 else 9

# ============================================================
# Bridge: Abjad decimal → Sanskrit hex-index
# ============================================================
# 28 Abjad values map to 48 Sanskrit phonemes via mod-48
# Abjad value stays decimal; Sanskrit index stays hex.

def bridge(arabic_char):
    val = abjad_value(arabic_char)
    if val == 0:
        return None
    
    # Primary representations
    abjad_dec = val
    abjad_hex = hex(val)  # Secondary only
    dr = digital_root(val)
    
    # Map to Sanskrit hex-index (1-48 → 0x01-0x30)
    sanskrit_idx_num = ((val - 1) % 48) + 1
    sanskrit_hex = f'0x{sanskrit_idx_num:02X}'
    
    phoneme = HEX_TO_PHONEME.get(sanskrit_hex)
    if phoneme is None:
        # Fallback to first phoneme
        phoneme = HEX_TO_PHONEME['0x01']
    
    return {
        'arabic': arabic_char,
        'abjad_dec': abjad_dec,
        'abjad_hex': abjad_hex,
        'digital_root': dr,
        'sanskrit_hex': sanskrit_hex,
        'sanskrit_char': phoneme['char'],
        'sanskrit_key': phoneme['key'],
        'frequency_hz': phoneme['hz'],
    }

# ============================================================
# Demo
# ============================================================
def demo():
    word = 'دوام'
    print(f'Word: {word}')
    print(f'Primary: Abjad decimal | Sanskrit hex-index')
    print('=' * 60)
    
    results = []
    for char in word:
        r = bridge(char)
        if r:
            results.append(r)
            a = r['abjad_dec']; h = r['abjad_hex']; d = r['digital_root']
            sh = r['sanskrit_hex']; sc = r['sanskrit_char']; sk = r['sanskrit_key']
            fh = r['frequency_hz']
            print(f'{char:3} | Abjad:{a:>4} dec ({h}) | DR:{d} | {sh} {sc}({sk}) | {fh} Hz')
    
    total = sum(r['abjad_dec'] for r in results)
    print(f'\nTotal: Abjad={total}, DR={digital_root(total)}')
    print(f'Bridge: {total} dec → {hex(total)} hex → DR={digital_root(total)}')

if __name__ == '__main__':
    demo()
