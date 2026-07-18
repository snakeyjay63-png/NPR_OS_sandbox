#!/usr/bin/env python3
"""
Greek Isopsefia (ἰσοψηφία) — Letter values for Koinè Greek.

Primary identity: decimal value (1–800).
Hex representation: secondary only.

Rules:
- σ/ς = same value (200)
- Diacritics preserved but not counted
- Punctuation excluded
- Final sigma (ς) = sigma (σ) = 200
"""

# Standard Greek isopsefia values
ISOPSEFIA = {
    # Units (1-9)
    'α': 1,   'β': 2,   'γ': 3,   'δ': 4,   'ε': 5,
    'ϛ': 6,   'ζ': 7,   'η': 8,   'θ': 9,
    # Tens (10-90)
    'ι': 10,  'κ': 20,  'λ': 30,  'μ': 40,  'ν': 50,
    'ξ': 60,  'ο': 70,  'π': 80,  'ϟ': 90,
    # Hundreds (100-800)
    'ρ': 100, 'σ': 200, 'ς': 200, 'τ': 300, 'υ': 400,
    'φ': 500, 'χ': 600, 'ψ': 700, 'ω': 800,
}

# Uppercase mappings (text may have mixed case)
ISOPSEFIA_UPPER = {k.upper(): v for k, v in ISOPSEFIA.items()}

# Diacritics to strip (accents, breathings, etc.)
DIACRITICS = set('´`^͂ͅὰάὲέὴίΐὸόὺύῶΐΰͅ')

# Critical apparatus marks to strip
CRITICAL = set('⸀⸁⸂⸃⸄⸅⸆⸇⸈⸉⸊⸋⸌⸍⸎⸏⸐⸑')

def normalize_greek(text):
    """Strip diacritics and critical marks, preserve base letters."""
    result = []
    for char in text:
        if char in DIACRITICS or char in CRITICAL:
            continue
        result.append(char)
    return ''.join(result)

def isopsefia_value(char):
    """Get isopsefia value for a single Greek letter."""
    c = char.strip()
    return ISOPSEFIA.get(c, ISOPSEFIA_UPPER.get(c, 0))

def word_value(word):
    """Calculate isopsefia value for a Greek word."""
    clean = normalize_greek(word)
    return sum(isopsefia_value(c) for c in clean if isopsefia_value(c) > 0)

def digital_root(n):
    """Digital root (repeated sum to single digit)."""
    if n == 0:
        return 0
    r = n % 9
    return r if r != 0 else 9

def verse_values(verse_text):
    """Parse verse and calculate word/verse values."""
    words = verse_text.split()
    result = []
    total = 0
    
    for word in words:
        clean = normalize_greek(word)
        if not clean:
            continue
        
        val = word_value(clean)
        if val > 0:
            result.append({
                'word': word,
                'clean': clean,
                'value': val,
                'hex': hex(val),
                'dr': digital_root(val),
            })
            total += val
    
    return {
        'words': result,
        'total': total,
        'hex': hex(total),
        'dr': digital_root(total),
    }

# Demo
if __name__ == '__main__':
    # Test with Matthew 1:1
    verse = "Mt 1:1  Βίβλος γενέσεως Ἰησοῦ χριστοῦ υἱοῦ Δαυὶδ υἱοῦ Ἀβραάμ."
    print(f"Verse: {verse}")
    print("=" * 60)
    
    result = verse_values(verse)
    for w in result['words']:
        print(f"  {w['word']:15} → {w['clean']:12} = {w['value']:>4} ({w['hex']}) DR:{w['dr']}")
    
    print(f"\nTotal: {result['total']} ({result['hex']}) DR:{result['dr']}")
