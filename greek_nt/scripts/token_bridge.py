#!/usr/bin/env python3
"""
Greek NT → Token Field Bridge

Connects the Greek NT corpus through the tri-taal token field:
  NT verse → Greek isopsefia → token_field scan → lens_3 → cross-field resonance

Patañjali 1.40: 3 ≐ lens(kleinst ↔ grootst)
"""
import sys, os, json

# Add token_field path (quran_field is sibling of greek_nt)
# __file__ = greek_nt/scripts/token_bridge.py
# need to go: scripts → greek_nt → NPR_OS_sandbox → quran_field/scripts
_sandbox_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_token_field_path = os.path.join(_sandbox_root, 'quran_field', 'scripts')
if _token_field_path not in sys.path:
    sys.path.insert(0, _token_field_path)

from isopsefia import normalize_greek, isopsefia_value, word_value, digital_root
from token_field import FIELDS, lens_3_across_fields, tri_field_resonance

# ─── Token Field Integration ────────────────────────────────────────

def nt_verse_to_field(verse_text, book="NT", chapter=0, verse=0):
    """
    Scan NT verse through the Greek token field.
    
    Returns field scan + isopsefia values.
    """
    greek = FIELDS["greek"]
    
    # Normalize and extract Greek letters
    clean = normalize_greek(verse_text)
    letters = [c for c in clean if isopsefia_value(c) > 0]
    
    # Token field scan
    scan = greek.field_scan(letters)
    
    # Isopsefia values
    total_value = sum(isopsefia_value(c) for c in letters)
    
    return {
        "source": f"{book} {chapter}:{verse}" if chapter else book,
        "text": verse_text,
        "letters": letters,
        "letter_count": len(letters),
        "isopsefia_total": total_value,
        "isopsefia_dr": digital_root(total_value),
        "field_total": scan["field_total"],
        "field_dr": scan["total_dr"],
        "field_cycle": scan["total_cycle"],
        "tokens": scan["tokens"],
    }


def nt_lens_3(verse_result):
    """
    Apply Point-Prime 3 lens to NT verse.
    
    Patañjali 1.40: 3 ≐ lens(kleinst ↔ grootst)
    """
    greek = FIELDS["greek"]
    lens = greek.lens_3()
    
    # Count how many verse tokens fall in each register
    register_counts = {}
    for reg_name, reg_data in lens["registers"].items():
        start = int(reg_data["range"].strip("[]").split("-")[0])
        end = int(reg_data["range"].strip("[]").split("-")[1])
        count = sum(1 for t in verse_result["tokens"] if start <= t["pos"] <= end)
        register_counts[reg_name] = count
    
    return {
        "lens": lens["decomposition"],
        "registers": register_counts,
        "principle": "Schaal verandert; lens blijft 3.",
    }


def nt_tri_resonance(verse_text, arabic_text=None, sanskrit_text=None):
    """
    Run NT verse through tri-taal resonance with optional companion texts.
    """
    texts = {"greek": verse_text}
    if arabic_text:
        texts["arabic"] = arabic_text
    if sanskrit_text:
        texts["sanskrit"] = sanskrit_text
    
    return tri_field_resonance(texts)


# ─── Demo ───────────────────────────────────────────────────────────

def sandbox():
    """Demonstrate NT → Token Field bridge."""
    
    print("=" * 70)
    print("GREEK NT → TOKEN FIELD BRIDGE")
    print("Patañjali 1.40: 3 ≐ lens(kleinst ↔ grootst)")
    print("=" * 70)
    
    # 1. Matthew 1:1
    print("\n--- MATTHEW 1:1 ---")
    mt11 = "Βίβλος γενέσεως Ἰησοῦ χριστοῦ υἱοῦ Δαυὶδ υἱοῦ Ἀβραάμ"
    result = nt_verse_to_field(mt11, "Mt", 1, 1)
    
    print(f"  Greek: {mt11}")
    print(f"  Letters: {''.join(result['letters'])}")
    print(f"  Count: {result['letter_count']}")
    print(f"  Isopsefia: {result['isopsefia_total']} (DR={result['isopsefia_dr']})")
    print(f"  Field: {result['field_total']} (DR={result['field_dr']}, {result['field_cycle']})")
    
    # Token breakdown
    print(f"  Tokens:")
    for t in result["tokens"]:
        print(f"    {t['char']}: pos={t['pos']}, val={t['val']}, dr={t['dr']}, cycle={t['cycle']}")
    
    # Lens 3
    print(f"  Lens_3:")
    lens = nt_lens_3(result)
    print(f"    {lens['lens']}")
    for reg, cnt in lens["registers"].items():
        print(f"    {reg}: {cnt} tokens")
    
    # 2. John 1:1
    print("\n--- JOHN 1:1 ---")
    jn11 = "Ἐν ἀρχῇ ἦν ὁ λόγος καὶ ὁ λόγος ἦν πρὸς τὸν θεὸν καὶ θεὸς ἦν ὁ λόγος"
    result_jn = nt_verse_to_field(jn11, "Jn", 1, 1)
    
    print(f"  Greek: {jn11}")
    print(f"  Letters: {''.join(result_jn['letters'])}")
    print(f"  Count: {result_jn['letter_count']}")
    print(f"  Isopsefia: {result_jn['isopsefia_total']} (DR={result_jn['isopsefia_dr']})")
    print(f"  Field: {result_jn['field_total']} (DR={result_jn['field_dr']}, {result_jn['field_cycle']})")
    
    # 3. Tri-taal: John 1:1 + Arabic "بسم الله" + Sanskrit "ॐ"
    print("\n--- TRI-TAAL: Jn 1:1 + بسم الله + ॐ ---")
    tri = nt_tri_resonance(jn11, "بسم الله", "ॐ")
    
    for lang, scan in tri["fields"].items():
        print(f"  {lang.upper()}:")
        print(f"    Total: {scan['field_total']}, DR={scan['total_dr']}, Cycle={scan['total_cycle']}")
    
    print(f"  Cross-field resonance:")
    for r in tri["tri_resonance"]:
        print(f"    DR={r['shared_dr']} ({r['cycle']}): {', '.join(r['fields'])}")
    
    # 4. Lens 3 across NT
    print("\n--- LENS_3 OP NT VERZEN ---")
    for book, text, ch, vs in [
        ("Mt 1:1", mt11, 1, 1),
        ("Jn 1:1", jn11, 1, 1),
    ]:
        r = nt_verse_to_field(text, book.split()[0], ch, vs)
        l = nt_lens_3(r)
        print(f"  {book}: {r['letter_count']} letters, DR={r['field_dr']}, "
              f"REG_1={l['registers']['REGISTER_1']}, "
              f"REG_2={l['registers']['REGISTER_2']}, "
              f"REG_3={l['registers']['REGISTER_3']}")
    
    print("\n" + "=" * 70)
    print("Bridge compleet.")
    print("=" * 70)


if __name__ == "__main__":
    sandbox()
