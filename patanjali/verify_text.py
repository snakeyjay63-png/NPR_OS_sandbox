#!/usr/bin/env python3
"""
Verify Devanagari text in register against source HTML.
Strips Vedic accents from source before comparison.
"""

import json
import re
import unicodedata

REGISTER_PATH = "/home/claw/.openclaw/workspace/NPR_OS_sandbox/patanjali/patanjali_passive_sanskrit_register.json"
SOURCE_PATH = "/home/claw/.openclaw/workspace/NPR_OS_sandbox/patanjali/source_yogasuutra.html"

# Vedic accent markers
VEDIC_ACCENTS = "\u0951\u0952\u0953"  # ॑ ॒ ॓

def strip_accents(text):
    return text.translate(str.maketrans('', '', VEDIC_ACCENTS))

def extract_sutras(html_path):
    """Extract sutra text from source HTML, return dict of 'X.Y' -> normalized text."""
    with open(html_path, 'r', encoding='utf-8') as f:
        html = f.read()
    
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', ' ', html)
    
    sutras = {}
    lines = clean.split('\n')
    joined = []
    current = ""
    
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                joined.append(current)
                current = ""
            continue
        
        # If current doesn't end with a verse marker, this is a continuation
        if current and not re.search(r'॥\s*\d+\.\d+\s*॥', current):
            current += " " + stripped
        else:
            if current:
                joined.append(current)
            current = stripped
    
    if current:
        joined.append(current)
    
    # Devanagari digit map
    DEV_MAP = str.maketrans('०१२३४५६७८९', '0123456789')
    
    for line in joined:
        # Try Devanagari digits first
        match = re.search(r'॥\s*([०-९]+\.[०-९]+)\s*॥', line)
        if not match:
            match = re.search(r'॥\s*([०-९]+\.[०-९]+)॥', line)
        if not match:
            match = re.search(r'॥\s*(\d+\.\d+)\s*॥', line)
        if not match:
            match = re.search(r'॥\s*(\d+\.\d+)॥', line)
        
        if match:
            sutra_num = match.group(1).translate(DEV_MAP)
            text = line[:match.start()].strip()
            # Remove any preceding book/pada headers (e.g. ॥ प्रथमोऽध्यायः ॥  ॥ समाधि-पादः ॥)
            text = re.sub(r'॥[^॥]*॥\s*', '', text).strip()
            text = text.rstrip('॥').strip()
            text = strip_accents(text)
            # Remove parenthetical variants like (स्मितास्वरूपानुगमात्, स्मितानुगमात्)
            text = re.sub(r'\s*\(.*?\)\s*', '', text).strip()
            # Remove hyphenation line-break markers (hyphen + optional space at word boundary)
            text = re.sub(r'-\s*', '', text)
            text = unicodedata.normalize('NFC', text)
            
            if text:
                sutras[sutra_num] = text
    
    return sutras

def main():
    with open(REGISTER_PATH, 'r', encoding='utf-8') as f:
        register = json.load(f)
    
    source_sutras = extract_sutras(SOURCE_PATH)
    print(f"Extracted {len(source_sutras)} sutras from source.\n")
    
    # Collect all registered sutras
    all_registered = {}
    for book in register.get('books', []):
        for sutra in book.get('sutras', []):
            num = sutra['sutra']
            all_registered[num] = sutra
    
    total = len(all_registered)
    matches = 0
    mismatches = []
    missing = []
    
    for num in sorted(all_registered.keys(), key=lambda x: tuple(int(p) for p in x.split('.'))):
        reg_text = unicodedata.normalize('NFC', all_registered[num]['sanskrit'])
        
        if num not in source_sutras:
            missing.append(num)
            continue
        
        src_text = source_sutras[num]
        
        if reg_text == src_text:
            matches += 1
        else:
            mismatches.append((num, reg_text, src_text))
    
    print("=" * 60)
    print("TEXT VERIFICATION REPORT")
    print("=" * 60)
    print(f"Total sutras in register: {total}")
    print(f"Found in source:          {len(source_sutras)}")
    print(f"Text matches:             {matches}/{total}")
    print(f"Mismatches:               {len(mismatches)}")
    print(f"Missing from source:      {len(missing)}")
    print()
    
    if mismatches:
        print("MISMATCHES:")
        for num, reg, src in mismatches:
            print(f"\n  ❌ {num}:")
            print(f"    Register: {reg}")
            print(f"    Source:   {src}")
            # Show character-by-character diff
            min_len = min(len(reg), len(src))
            for i in range(min_len):
                if reg[i] != src[i]:
                    print(f"    First diff at pos {i}: register U+{ord(reg[i]):04X} vs source U+{ord(src[i]):04X}")
                    break
            if len(reg) != len(src):
                print(f"    Length: register {len(reg)} vs source {len(src)}")
        print()
    
    if missing:
        print(f"NOT FOUND IN SOURCE ({len(missing)}):")
        for num in missing:
            print(f"  ⚠ {num}")
        print()
    
    if not mismatches and not missing:
        print("✅ All text matches source (after stripping Vedic accents).")

if __name__ == '__main__':
    main()
