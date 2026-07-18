#!/usr/bin/env python3
"""
Generate CONTENT-D layer: Abjad values + digital roots + NPR routing.
Input: derived/quran_ayah.json
Output: derived/quran_abjad_npr.json
"""
import json
import hashlib
import os

# Full Abjad table (28 letters)
ABJAD = {
    # Minor Abjad (1-10)
    'ا': 1,   'ب': 2, 'ج': 3, 'د': 4, 'ه': 5,
    'و': 6, 'ز': 7, 'ح': 8, 'ط': 9,
    # Major Abjad (10-100)
    'ي': 10, 'ك': 20, 'ل': 30, 'م': 40, 'ن': 50,
    'س': 60, 'ع': 70, 'ف': 80, 'ص': 90,
    # Multiples of 100
    'ق': 100, 'ر': 200, 'ش': 300, 'ت': 400,
    'ث': 500, 'خ': 600, 'ذ': 700, 'ض': 800,
    'ظ': 900, 'غ': 1000, 'ف': 1000,  # Note: some variants
    'ڢ': 10000  # Rare
}

# Simplified Abjad (standard 28)
ABJAD_STRICT = {
    'ا': 1, 'ب': 2, 'ج': 3, 'د': 4, 'ه': 5, 'و': 6,
    'ز': 7, 'ح': 8, 'ط': 9, 'ي': 10, 'ك': 20, 'ل': 30,
    'م': 40, 'ن': 50, 'س': 60, 'ع': 70, 'ف': 80, 'ص': 90,
    'ق': 100, 'ر': 200, 'ش': 300, 'ت': 400, 'ث': 500,
    'خ': 600, 'ذ': 700, 'ض': 800, 'ظ': 900, 'غ': 1000,
}

# Alternate forms that map to same value
ABJAD_ALIASES = {
    'أ': 1, 'إ': 1, 'آ': 1, 'ؤ': 6, 'ئ': 10,  # Hamza variants
    'ٱ': 30,  # Alif with hamza below → Lam
    'ٓ': 0,  # Sukun (no value)
    'ٰ': 0,  # Superscript alif (no value)
}

def get_abjad_value(char):
    """Get Abjad value for a character."""
    if char in ABJAD_STRICT:
        return ABJAD_STRICT[char]
    if char in ABJAD_ALIASES:
        return ABJAD_ALIASES[char]
    return None

def digital_root(n):
    """Compute digital root (mod-9)."""
    if n == 0:
        return 0
    r = n % 9
    return r if r != 0 else 9

def npr_phase(dr):
    """Map digital root to NPR phase."""
    if dr == 3:
        return "Noise"
    elif dr == 6:
        return "Pattern"
    elif dr == 9:
        return "Return"
    else:
        return f"Phase-{dr}"

def analyze_ayah(ayah):
    """Analyze a single ayah for Abjad + NPR."""
    text = ayah.get('text_uthmani', '')
    
    # Extract letters and compute Abjad sum
    letters = []
    abjad_sum = 0
    for char in text:
        val = get_abjad_value(char)
        if val and val > 0:
            letters.append({
                'char': char,
                'abjad': val,
                'dr': digital_root(val)
            })
            abjad_sum += val
    
    # Compute ayah-level metrics
    dr_sum = digital_root(abjad_sum)
    phase = npr_phase(dr_sum)
    
    # SHA-256 of text
    text_sha = hashlib.sha256(text.encode('utf-8')).hexdigest()[:16]
    
    return {
        'key': ayah['key'],
        'text': text[:100] + '...' if len(text) > 100 else text,
        'text_sha': text_sha,
        'letter_count': len(letters),
        'abjad_sum': abjad_sum,
        'digital_root': dr_sum,
        'npr_phase': phase,
        'letters_sample': letters[:10]  # First 10 letters as sample
    }

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_dir = os.path.dirname(script_dir)
    
    # Load ayah data
    ayah_path = os.path.join(base_dir, 'derived', 'quran_ayah.json')
    with open(ayah_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    verses = data['verses']
    print(f"Analyzing {len(verses)} verses...")
    
    # Analyze each ayah
    analyzed = []
    for i, ayah in enumerate(verses):
        result = analyze_ayah(ayah)
        analyzed.append(result)
        
        if (i + 1) % 1000 == 0:
            print(f"  Processed {i+1}/{len(verses)}...")
    
    # Compute aggregate stats
    all_dr = [a['digital_root'] for a in analyzed]
    phase_counts = {}
    for a in analyzed:
        phase = a['npr_phase']
        phase_counts[phase] = phase_counts.get(phase, 0) + 1
    
    # Sort by phase
    sorted_phases = sorted(phase_counts.items(), key=lambda x: x[0])
    
    # Build output
    output = {
        'version': '1.0.0',
        'source': ayah_path,
        'total_verses': len(analyzed),
        'phase_distribution': dict(sorted_phases),
        'digital_root_distribution': dict(sorted((str(i), all_dr.count(i)) for i in range(1, 10))),
        'verses': analyzed
    }
    
    # Save
    output_path = os.path.join(base_dir, 'derived', 'quran_abjad_npr.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Analysis complete!")
    print(f"  Output: {output_path}")
    print(f"  Size: {os.path.getsize(output_path)} bytes")
    print(f"\n  Phase distribution:")
    for phase, count in sorted_phases:
        print(f"    {phase}: {count} verses ({100*count/len(analyzed):.1f}%)")

if __name__ == '__main__':
    main()
