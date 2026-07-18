#!/usr/bin/env python3
"""
Greek NT Structure Generator

Generates per-book, per-chapter structure analysis:
  - Verse counts
  - Letter counts
  - Isopsefia totals
  - NPR cycle distribution
  - Key structural patterns
"""
import json
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(__file__))
from isopsefia import normalize_greek, isopsefia_value, digital_root

# Token field path
_sandbox_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_token_field_path = os.path.join(_sandbox_root, 'quran_field', 'scripts')
if _token_field_path not in sys.path:
    sys.path.insert(0, _token_field_path)

from token_field import FIELDS


def npr_cycle(dr: int) -> str:
    if dr % 3 == 0:
        return "Return"
    elif dr % 3 == 2:
        return "Pattern"
    else:
        return "Noise"


def analyze_book(book_path: str, book_code: str) -> dict:
    """Analyze a single book's structure."""
    with open(book_path, 'r', encoding='utf-8') as f:
        text = f.read()
    
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    
    book = {
        "code": book_code,
        "lines": len(lines),
        "total_letters": 0,
        "total_value": 0,
        "npr_distribution": {"Noise": 0, "Pattern": 0, "Return": 0},
        "chapters": [],
    }
    
    current_chapter = None
    chapter_data = None
    
    import re
    # Match verse references like "Mt 1:1", "Jn 3:16", etc.
    verse_ref = re.compile(r'^[A-Za-z0-9]+\s+\d+:\d+')
    
    for line in lines:
        # Skip title lines (e.g., "ΚΑΤΑ ΜΑΘΘΑΙΟΝ")
        if not re.match(r'^[A-Za-z0-9]+\s+\d+:', line):
            continue
        
        # Extract chapter:verse reference
        ref_match = re.match(r'^([A-Za-z0-9]+)\s+(\d+):(\d+)', line)
        if not ref_match:
            continue
        
        ch_num = int(ref_match.group(2))
        vs_num = int(ref_match.group(3))
        
        # New chapter?
        if ch_num != current_chapter:
            if chapter_data:
                book["chapters"].append(chapter_data)
            current_chapter = ch_num
            chapter_data = {
                "chapter": current_chapter,
                "verses": [],
                "total_letters": 0,
                "total_value": 0,
            }
        
        # Extract verse text (everything after reference)
        verse_text = line[ref_match.end():].strip()
        
        # Process verse
        clean = normalize_greek(verse_text)
        letters = [c for c in clean if isopsefia_value(c) > 0]
        total = sum(isopsefia_value(c) for c in letters)
        dr = digital_root(total) if total > 0 else 0
        
        verse = {
            "verse": vs_num,
            "letters": len(letters),
            "value": total,
            "dr": dr,
            "cycle": npr_cycle(dr),
        }
        
        chapter_data["verses"].append(verse)
        chapter_data["total_letters"] += len(letters)
        chapter_data["total_value"] += total
        
        book["total_letters"] += len(letters)
        book["total_value"] += total
        book["npr_distribution"][npr_cycle(dr)] += 1
    
    if chapter_data:
        book["chapters"].append(chapter_data)
    
    # Remove verse text for compact output
    for ch in book["chapters"]:
        ch["verses"] = [
            {"letters": v["letters"], "value": v["value"], "dr": v["dr"], "cycle": v["cycle"]}
            for v in ch["verses"]
        ]
    
    book["total_dr"] = digital_root(book["total_value"])
    book["total_cycle"] = npr_cycle(book["total_dr"])
    
    return book


def generate_structure(text_dir: str, output_path: str):
    """Generate structure for all books."""
    books = {}
    
    # Find all book files
    book_files = sorted([f for f in os.listdir(text_dir) if f.endswith('.txt') and f != 'sblgnt.txt'])
    
    for fname in book_files:
        code = fname.replace('.txt', '')
        book_path = os.path.join(text_dir, fname)
        print(f"  Processing {code}...")
        books[code] = analyze_book(book_path, code)
    
    result = {
        "name": "Greek NT Structure",
        "book_count": len(books),
        "books": books,
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"  → {output_path} ({len(json.dumps(result))} chars)")
    return result


def sandbox():
    """Generate and display NT structure."""
    
    print("=" * 70)
    print("GREEK NT STRUCTURE GENERATOR")
    print("=" * 70)
    
    text_dir = os.path.join(os.path.dirname(__file__), '..', 'text')
    output = os.path.join(os.path.dirname(__file__), '..', 'derived', 'nt_structure.json')
    
    result = generate_structure(text_dir, output)
    
    # Summary
    print(f"\n  Totaal: {result['book_count']} boeken")
    
    for code, book in result["books"].items():
        print(f"\n  {code}: {book['lines']} regels, {book['total_letters']} letters, "
              f"DR={book['total_dr']} ({book['total_cycle']})")
        print(f"    NPR: N={book['npr_distribution']['Noise']}, "
              f"P={book['npr_distribution']['Pattern']}, "
              f"R={book['npr_distribution']['Return']}")
    
    print("\n" + "=" * 70)
    print("Structuur gegenereerd.")
    print("=" * 70)


if __name__ == "__main__":
    sandbox()
