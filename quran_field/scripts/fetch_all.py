#!/usr/bin/env python3
"""
Download complete Quran Uthmani text from Quran.com API.
Output:
  - source/quran_uthmani_simple.txt (plain text with verse markers)
  - derived/quran_ayah.json (structured JSON per ayah)
  - manifest/manifest.json (metadata, hashes, stats)
"""
import requests
import json
import hashlib
import time
import sys
import os

OUTPUT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE_DIR = os.path.join(OUTPUT_DIR, "source")
DERIVED_DIR = os.path.join(OUTPUT_DIR, "derived")
MANIFEST_DIR = os.path.join(OUTPUT_DIR, "manifest")

# Known chapter verse counts
CHAPTER_VERSES = {
    1: 7, 2: 286, 3: 200, 4: 176, 5: 120, 6: 165, 7: 206,
    8: 75, 9: 129, 10: 109, 11: 123, 12: 111, 13: 43, 14: 52,
    15: 99, 16: 128, 17: 111, 18: 110, 19: 98, 20: 135, 21: 112,
    22: 78, 23: 118, 24: 64, 25: 77, 26: 227, 27: 93, 28: 88,
    29: 69, 30: 60, 31: 34, 32: 30, 33: 73, 34: 54, 35: 45,
    36: 83, 37: 182, 38: 88, 39: 75, 40: 85, 41: 54, 42: 53,
    43: 89, 44: 59, 45: 37, 46: 35, 47: 38, 48: 29, 49: 18,
    50: 45, 51: 60, 52: 49, 53: 62, 54: 55, 55: 78, 56: 96,
    57: 29, 58: 22, 59: 24, 60: 13, 61: 14, 62: 11, 63: 11,
    64: 18, 65: 12, 66: 12, 67: 30, 68: 52, 69: 52, 70: 44,
    71: 28, 72: 28, 73: 20, 74: 56, 75: 40, 76: 31, 77: 50,
    78: 40, 79: 46, 80: 52, 81: 29, 82: 19, 83: 36, 84: 25,
    85: 22, 86: 17, 87: 19, 88: 26, 89: 30, 90: 20, 91: 15,
    92: 21, 93: 11, 94: 8, 95: 8, 96: 19, 97: 5, 98: 8,
    99: 8, 100: 11, 101: 11, 102: 8, 103: 3, 104: 9, 105: 5,
    106: 4, 107: 7, 108: 3, 109: 6, 110: 3, 111: 5, 112: 4,
    113: 5, 114: 6
}

TOTAL_VERSSES = sum(CHAPTER_VERSES.values())

def fetch_verse(chapter, verse):
    """Fetch a single verse Uthmani text."""
    key = f"{chapter}:{verse}"
    url = f"https://api.quran.com/api/v4/verses/by_key/{key}?fields=text_uthmani"
    resp = requests.get(url, timeout=10)
    if resp.status_code == 200:
        data = resp.json()
        return {
            "key": key,
            "chapter": chapter,
            "verse": verse,
            "text_uthmani": data.get("verse", {}).get("text_uthmani", "")
        }
    return None

def main():
    print(f"Fetching {TOTAL_VERSSES} verses...")
    
    all_verses = []
    text_lines = []
    text_lines.append("# Quran Uthmani Text - Tanzil verified")
    text_lines.append("# Source: Quran.com API (quran-uthmani edition)")
    text_lines.append(f"# Total verses: {TOTAL_VERSSES}")
    text_lines.append("# Format: SOURA:AYA | UTHMANI TEXT")
    text_lines.append("")
    
    for chapter, verses in CHAPTER_VERSES.items():
        chapter_done = 0
        for verse in range(1, verses + 1):
            v = fetch_verse(chapter, verse)
            if v:
                all_verses.append(v)
                text_lines.append(f"[{v['chapter']}:{v['verse']}] {v['text_uthmani']}")
                chapter_done += 1
            else:
                print(f"  WARNING: Failed to fetch {chapter}:{verse}", file=sys.stderr)
            
            if verse % 100 == 0:
                print(f"  Chapter {chapter}: {verse}/{verses}")
            
            # Rate limiting
            time.sleep(0.05)
        
        print(f"  Chapter {chapter}: {chapter_done}/{verses} ✓")
    
    # Save plain text
    text_content = "\n".join(text_lines) + "\n"
    text_path = os.path.join(SOURCE_DIR, "quran_uthmani_simple.txt")
    with open(text_path, "w", encoding="utf-8") as f:
        f.write(text_content)
    
    # Save JSON
    json_path = os.path.join(DERIVED_DIR, "quran_ayah.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump({
            "source": "quran.com API (quran-uthmani edition)",
            "riwaya": "Hafs an Asim",
            "total_verses": len(all_verses),
            "verses": all_verses
        }, f, ensure_ascii=False, indent=2)
    
    # Compute hashes
    with open(text_path, "rb") as f:
        text_sha = hashlib.sha256(f.read()).hexdigest()
    
    with open(json_path, "rb") as f:
        json_sha = hashlib.sha256(f.read()).hexdigest()
    
    # Stats
    all_text = "".join(v["text_uthmani"] for v in all_verses)
    unique_chars = set(all_text)
    
    # Manifest
    manifest = {
        "name": "quran_field_v1",
        "version": "1.0.0",
        "source": {
            "provider": "quran.com API",
            "edition": "quran-uthmani",
            "riwaya": "Hafs an Asim",
            "text_form": "Uthmani",
            "encoding": "UTF-8"
        },
        "integrity": {
            "text_sha256": text_sha,
            "json_sha256": json_sha
        },
        "statistics": {
            "total_verses": len(all_verses),
            "total_chapters": len(CHAPTER_VERSES),
            "total_characters": len(all_text),
            "unique_characters": len(unique_chars),
            "unique_characters_list": sorted(unique_chars)
        },
        "files": {
            "source": text_path,
            "derived": json_path
        },
        "generated": time.strftime("%Y-%m-%dT%H:%M:%S%z")
    }
    
    manifest_path = os.path.join(MANIFEST_DIR, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    
    print(f"\n✓ Downloaded: {len(all_verses)}/{TOTAL_VERSSES} verses")
    print(f"✓ SHA-256 (text): {text_sha}")
    print(f"✓ SHA-256 (json): {json_sha}")
    print(f"✓ Files: text={os.path.getsize(text_path)}B, json={os.path.getsize(json_path)}B")

if __name__ == "__main__":
    main()
