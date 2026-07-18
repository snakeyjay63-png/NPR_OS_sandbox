#!/usr/bin/env python3
"""
Greek NT Bridge: Isopsefia → Sanskrit hex-index → frequency.

Primary layers:
  Greek → isopsefia decimal (1-800) → digital root / mod-9
  Sanskrit → positional hex-index (0x01-0x30) → frequency

Bridge mechanism:
  isopsefia decimal → mod-48 → Sanskrit hex-index → phoneme → frequency
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))
from isopsefia import (
    normalize_greek, isopsefia_value, word_value,
    verse_values, digital_root, DIACRITICS, CRITICAL
)

# Sanskrit phoneme table (shared with Arabic bridge)
SANSKRIT_PHONEMES = [
    ('0x01', 'अ', 'a',   200), ('0x02', 'आ', 'aa',  220),
    ('0x03', 'इ', 'i',   250), ('0x04', 'ई', 'ii',  275),
    ('0x05', 'उ', 'u',   300), ('0x06', 'ऊ', 'uu',  330),
    ('0x07', 'ऋ', 'ri',  350), ('0x08', 'ए', 'e',   400),
    ('0x09', 'ऐ', 'ai',  420), ('0x0A', 'ओ', 'o',   450),
    ('0x0B', 'औ', 'au',  480), ('0x0C', 'ॠ', 'li',  500),
    ('0x0D', 'क', 'k',   110), ('0x0E', 'ख', 'kh',  120),
    ('0x0F', 'ग', 'g',   130), ('0x10', 'घ', 'gh',  140),
    ('0x11', 'ङ', 'ng',  150),
    ('0x12', 'च', 'c',   165), ('0x13', 'छ', 'ch',  170),
    ('0x14', 'ज', 'j',   175), ('0x15', 'झ', 'jh',  180),
    ('0x16', 'ञ', 'ny',  185),
    ('0x17', 'ट', 'T',   190), ('0x18', 'ठ', 'Th',  195),
    ('0x19', 'ड', 'D',   200), ('0x1A', 'ढ', 'Dh',  205),
    ('0x1B', 'ण', 'N',   210),
    ('0x1C', 'त', 't',   220), ('0x1D', 'थ', 'th',  225),
    ('0x1E', 'द', 'd',   230), ('0x1F', 'ध', 'dh',  235),
    ('0x20', 'न', 'n',   240),
    ('0x21', 'प', 'p',   250), ('0x22', 'फ', 'ph',  255),
    ('0x23', 'ब', 'b',   260), ('0x24', 'भ', 'bh',  265),
    ('0x25', 'म', 'm',   270),
    ('0x26', 'य', 'y',   280), ('0x27', 'र', 'r',   285),
    ('0x28', 'ल', 'l',   290), ('0x29', 'व', 'v',   295),
    ('0x2A', 'श', 'sh',  300), ('0x2B', 'ष', 'Sh',  310),
    ('0x2C', 'स', 's',   320), ('0x2D', 'ह', 'h',   330),
    ('0x2E', 'क्ष', 'ksh', 340), ('0x2F', 'त्र', 'tr',  345),
    ('0x30', 'ज्ञ', 'jny', 350),
]

HEX_TO_PHONEME = {h: {'char': c, 'key': k, 'hz': f} for h, c, k, f in SANSKRIT_PHONEMES}

def bridge_letter(greek_char):
    """Single Greek letter → isopsefia → Sanskrit hex-index → frequency."""
    val = isopsefia_value(greek_char)
    if val == 0:
        return None
    
    sanskrit_idx = ((val - 1) % 48) + 1
    sanskrit_hex = f'0x{sanskrit_idx:02X}'
    phoneme = HEX_TO_PHONEME.get(sanskrit_hex, HEX_TO_PHONEME['0x01'])
    
    return {
        'greek': greek_char,
        'isopsefia': val,
        'isopsefia_hex': hex(val),
        'digital_root': digital_root(val),
        'sanskrit_hex': sanskrit_hex,
        'sanskrit_char': phoneme['char'],
        'sanskrit_key': phoneme['key'],
        'frequency_hz': phoneme['hz'],
    }

def bridge_word(greek_word):
    """Greek word → full bridge analysis."""
    clean = normalize_greek(greek_word)
    letters = [bridge_letter(c) for c in clean]
    letters = [l for l in letters if l is not None]
    
    if not letters:
        return None
    
    total = sum(l['isopsefia'] for l in letters)
    
    return {
        'word': greek_word,
        'clean': clean,
        'letters': letters,
        'total': total,
        'total_hex': hex(total),
        'digital_root': digital_root(total),
    }

def bridge_verse(verse_text):
    """Full verse → bridge analysis."""
    words = [w.strip() for w in verse_text.split() if w.strip()]
    results = []
    
    for word in words:
        r = bridge_word(word)
        if r:
            results.append(r)
    
    grand_total = sum(r['total'] for r in results)
    
    return {
        'words': results,
        'total': grand_total,
        'total_hex': hex(grand_total),
        'digital_root': digital_root(grand_total),
    }

# Demo: Matthew 1:1
if __name__ == '__main__':
    verse = "Βίβλος γενέσεως Ἰησοῦ χριστοῦ υἱοῦ Δαυὶδ υἱοῦ Ἀβραάμ"
    print(f"Greek: {verse}")
    print(f"Primary: Isopsefia decimal | Sanskrit hex-index")
    print("=" * 70)
    
    result = bridge_verse(verse)
    
    for w in result['words']:
        freqs = ' → '.join(f"{l['sanskrit_char']}({l['frequency_hz']})" for l in w['letters'][:5])
        if len(w['letters']) > 5:
            freqs += '...'
        print(f"  {w['word']:15} = {w['total']:>4} ({w['total_hex']}) DR:{w['digital_root']}  →  {freqs}")
    
    print(f"\nVerse total: {result['total']} ({result['total_hex']}) DR:{result['digital_root']}")
