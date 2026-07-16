#!/usr/bin/env python3
"""
Verify patanjali_passive_sanskrit_register.json

Checks:
1. Text extraction from source HTML (with/without accents)
2. UTF-8 byte count
3. Digital root
4. Hex representation
5. Base64 encoding
6. SHA-256 hash

Compares register values against independently computed values.
"""

import json
import hashlib
import base64
import unicodedata
import re
import sys
from urllib.request import urlopen

# --- Config ---
REGISTER_PATH = "/home/claw/.openclaw/workspace/NPR_OS_sandbox/patanjali/patanjali_passive_sanskrit_register.json"
SOURCE_URL = "https://sanskritdocuments.org/doc_yoga/yogasuutra.html"

# Vedic accent markers to strip
VEDIC_ACCENTS = "\u0951\u0952\u0953"  # ॑ ॒ ॓

def digital_root(n):
    """Iterative digital root."""
    while n > 9:
        n = sum(int(d) for d in str(n))
    return n

def extract_sutras_from_html(html_text):
    """
    Extract sūtra text from Sanskrit Documents HTML.
    Returns dict of 'X.Y' -> plain Devanagari (no accents, no verse markers).
    """
    sutras = {}
    
    # Find all lines that contain Devanagari text with verse markers
    # Pattern: ... ॥ X.Y॥  or ... ॥ X.Y ॥
    # Also handle multi-line sutras
    
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', '', html_text)
    
    # Join continuation lines (lines ending without ॥ that continue on next line)
    lines = clean.split('\n')
    joined_lines = []
    current = ""
    for line in lines:
        stripped = line.strip()
        if not stripped:
            if current:
                joined_lines.append(current)
                current = ""
            continue
        
        # Check if previous accumulated line ended with a verse marker
        if current and not re.search(r'॥.*\d+\.\d+', current):
            # Continuation line
            current += " " + stripped
        else:
            if current:
                joined_lines.append(current)
            current = stripped
    
    if current:
        joined_lines.append(current)
    
    for line in joined_lines:
        # Match lines with verse markers like ॥ 1.1॥ or ॥ 1.51॥
        match = re.search(r'॥\s*(\d+\.\d+)\s*॥', line)
        if not match:
            # Try alternative: ॥ X.Y॥  (no space before closing)
            match = re.search(r'॥\s*(\d+\.\d+)॥', line)
        
        if match:
            sutra_num = match.group(1)
            # Get text before the verse marker
            text = line[:match.start()].strip()
            
            # Remove any trailing ॥ 
            text = text.rstrip('॥').strip()
            
            # Remove Vedic accent markers
            text = text.translate(str.maketrans('', '', VEDIC_ACCENTS))
            
            # Remove any remaining HTML artifacts
            text = re.sub(r'\([^)]*\)', '', text)  # Remove parenthetical variants
            text = text.strip()
            
            if text:
                sutras[sutra_num] = text
    
    return sutras

def verify_register(verify_text=True):
    """Main verification function."""
    
    # Load register
    with open(REGISTER_PATH, 'r', encoding='utf-8') as f:
        register = json.load(f)
    
    errors = []
    warnings = []
    stats = {
        'total': 0,
        'text_ok': 0,
        'bytes_ok': 0,
        'dr_ok': 0,
        'hex_ok': 0,
        'b64_ok': 0,
        'sha_ok': 0,
        'perfect': 0,
    }
    
    # Extract source text if requested
    source_sutras = {}
    if verify_text:
        try:
            print(f"Fetching source from {SOURCE_URL}...")
            response = urlopen(SOURCE_URL)
            html = response.read().decode('utf-8')
            source_sutras = extract_sutras_from_html(html)
            print(f"Extracted {len(source_sutras)} sutras from source.\n")
        except Exception as e:
            print(f"Warning: Could not fetch source: {e}")
            print("Skipping text comparison.\n")
            verify_text = False
    
    # Iterate through all books and sutras
    for book in register.get('books', []):
        for sutra in book.get('sutras', []):
            stats['total'] += 1
            sutra_num = sutra['sutra']
            registered_text = sutra['sanskrit']
            
            # Normalize to NFC
            text_nfc = unicodedata.normalize('NFC', registered_text)
            
            # Compute expected values
            utf8_bytes = text_nfc.encode('utf-8')
            expected_byte_count = len(utf8_bytes)
            expected_dr = digital_root(expected_byte_count)
            expected_hex = format(expected_byte_count, 'X')
            expected_b64 = base64.b64encode(utf8_bytes).decode('ascii')
            expected_sha = hashlib.sha256(utf8_bytes).hexdigest()
            
            # Compare
            sutra_ok = True
            
            # Text comparison (if source available)
            if verify_text and sutra_num in source_sutras:
                source_text = source_sutras[sutra_num]
                if text_nfc != source_text:
                    errors.append(f"{sutra_num}: Text mismatch")
                    errors.append(f"  Register: {text_nfc}")
                    errors.append(f"  Source:   {source_text}")
                    sutra_ok = False
                else:
                    stats['text_ok'] += 1
            elif verify_text:
                warnings.append(f"{sutra_num}: Not found in source extraction")
            
            # Byte count
            if sutra.get('utf8_bytes') != expected_byte_count:
                errors.append(f"{sutra_num}: Byte count {sutra.get('utf8_bytes')} != {expected_byte_count}")
                sutra_ok = False
            else:
                stats['bytes_ok'] += 1
            
            # Digital root
            if sutra.get('digital_root') != expected_dr:
                errors.append(f"{sutra_num}: Digital root {sutra.get('digital_root')} != {expected_dr}")
                sutra_ok = False
            else:
                stats['dr_ok'] += 1
            
            # Hex
            if sutra.get('utf8_byte_count_hex') != expected_hex:
                errors.append(f"{sutra_num}: Hex {sutra.get('utf8_byte_count_hex')} != {expected_hex}")
                sutra_ok = False
            else:
                stats['hex_ok'] += 1
            
            # Base64
            if sutra.get('base64_utf8') != expected_b64:
                errors.append(f"{sutra_num}: Base64 mismatch")
                sutra_ok = False
            else:
                stats['b64_ok'] += 1
            
            # SHA-256
            if sutra.get('sha256') != expected_sha:
                errors.append(f"{sutra_num}: SHA-256 mismatch")
                errors.append(f"  Register: {sutra.get('sha256')}")
                errors.append(f"  Expected: {expected_sha}")
                sutra_ok = False
            else:
                stats['sha_ok'] += 1
            
            if sutra_ok:
                stats['perfect'] += 1
    
    # Report
    print("=" * 60)
    print("VERIFICATION REPORT")
    print("=" * 60)
    print(f"Total sutras: {stats['total']}")
    print(f"Perfect (all checks pass): {stats['perfect']}/{stats['total']}")
    print()
    
    if verify_text:
        print(f"Text matches source:       {stats['text_ok']}/{stats['total']}")
    print(f"UTF-8 byte count correct:     {stats['bytes_ok']}/{stats['total']}")
    print(f"Digital root correct:         {stats['dr_ok']}/{stats['total']}")
    print(f"Hex representation correct:   {stats['hex_ok']}/{stats['total']}")
    print(f"Base64 encoding correct:      {stats['b64_ok']}/{stats['total']}")
    print(f"SHA-256 hash correct:         {stats['sha_ok']}/{stats['total']}")
    print()
    
    if warnings:
        print(f"WARNINGS ({len(warnings)}):")
        for w in warnings[:20]:
            print(f"  ⚠ {w}")
        if len(warnings) > 20:
            print(f"  ... and {len(warnings) - 20} more")
        print()
    
    if errors:
        print(f"ERRORS ({len(errors)}):")
        for e in errors[:40]:
            print(f"  ❌ {e}")
        if len(errors) > 40:
            print(f"  ... and {len(errors) - 40} more")
        return 1
    else:
        print("✅ No errors found.")
        return 0

if __name__ == '__main__':
    verify_text = '--skip-text' not in sys.argv
    sys.exit(verify_register(verify_text=verify_text))
