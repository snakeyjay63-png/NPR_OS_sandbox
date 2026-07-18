#!/usr/bin/env python3
"""
Token Field Engine — 1 token = 1 μs
Alfabet als cyclisch veld, niet lineair.
"""

import json
import time
from typing import Optional

# ─── Grieks: 27 μs = 3×9 ───────────────────────────────────────────

GREEK_TOKENS = {
    # Register 1: eenheden (01-09)
    "α": {"pos": 1,  "val": 1,   "reg": 1},
    "β": {"pos": 2,  "val": 2,   "reg": 1},
    "γ": {"pos": 3,  "val": 3,   "reg": 1},
    "δ": {"pos": 4,  "val": 4,   "reg": 1},
    "ε": {"pos": 5,  "val": 5,   "reg": 1},
    "ϛ": {"pos": 6,  "val": 6,   "reg": 1},
    "ζ": {"pos": 7,  "val": 7,   "reg": 1},
    "η": {"pos": 8,  "val": 8,   "reg": 1},
    "θ": {"pos": 9,  "val": 9,   "reg": 1},
    # Register 2: tientallen (10-18)
    "ι": {"pos": 10, "val": 10,  "reg": 2},
    "κ": {"pos": 11, "val": 20,  "reg": 2},
    "λ": {"pos": 12, "val": 30,  "reg": 2},
    "μ": {"pos": 13, "val": 40,  "reg": 2},
    "ν": {"pos": 14, "val": 50,  "reg": 2},
    "ξ": {"pos": 15, "val": 60,  "reg": 2},
    "ο": {"pos": 16, "val": 70,  "reg": 2},
    "π": {"pos": 17, "val": 80,  "reg": 2},
    "ϟ": {"pos": 18, "val": 90,  "reg": 2},
    # Register 3: honderdtallen (19-27)
    "ρ": {"pos": 19, "val": 100, "reg": 3},
    "σ": {"pos": 20, "val": 200, "reg": 3},
    "τ": {"pos": 21, "val": 300, "reg": 3},
    "υ": {"pos": 22, "val": 400, "reg": 3},
    "φ": {"pos": 23, "val": 500, "reg": 3},
    "χ": {"pos": 24, "val": 600, "reg": 3},
    "ψ": {"pos": 25, "val": 700, "reg": 3},
    "ω": {"pos": 26, "val": 800, "reg": 3},
    "ϡ": {"pos": 27, "val": 900, "reg": 3},
}

# ─── Arabisch: 28 μs = 4×7 ─────────────────────────────────────────

ARABIC_TOKENS = {
    # FIELD_0: 01-07
    "ا": {"pos": 1,  "val": 1,   "field": 0},
    "ب": {"pos": 2,  "val": 2,   "field": 0},
    "ج": {"pos": 3,  "val": 3,   "field": 0},
    "د": {"pos": 4,  "val": 4,   "field": 0},
    "ه": {"pos": 5,  "val": 5,   "field": 0},
    "و": {"pos": 6,  "val": 6,   "field": 0},
    "ز": {"pos": 7,  "val": 7,   "field": 0},
    # FIELD_1: 08-14
    "ح": {"pos": 8,  "val": 8,   "field": 1},
    "ط": {"pos": 9,  "val": 9,   "field": 1},
    "ي": {"pos": 10, "val": 10,  "field": 1},
    "ك": {"pos": 11, "val": 20,  "field": 1},
    "ل": {"pos": 12, "val": 30,  "field": 1},
    "م": {"pos": 13, "val": 40,  "field": 1},
    "ن": {"pos": 14, "val": 50,  "field": 1},
    # FIELD_2: 15-21
    "س": {"pos": 15, "val": 60,  "field": 2},
    "ع": {"pos": 16, "val": 70,  "field": 2},
    "ف": {"pos": 17, "val": 80,  "field": 2},
    "ص": {"pos": 18, "val": 90,  "field": 2},
    "ق": {"pos": 19, "val": 100, "field": 2},
    "ر": {"pos": 20, "val": 200, "field": 2},
    "ش": {"pos": 21, "val": 300, "field": 2},
    # FIELD_3: 22-28
    "ت": {"pos": 22, "val": 400, "field": 3},
    "ث": {"pos": 23, "val": 500, "field": 3},
    "خ": {"pos": 24, "val": 600, "field": 3},
    "ذ": {"pos": 25, "val": 700, "field": 3},
    "ض": {"pos": 26, "val": 800, "field": 3},
    "ظ": {"pos": 27, "val": 900, "field": 3},
    "غ": {"pos": 28, "val": 1000,"field": 3},
}

# ─── Sanskriet: 48 μs = 6×8 ────────────────────────────────────────

SANSKRIT_TOKENS = {
    # VOWEL_FIELD: 01-0E hex (14 tokens)
    "अ": {"pos": 0x01, "hex": "0x01", "type": "vowel"},
    "आ": {"pos": 0x02, "hex": "0x02", "type": "vowel"},
    "इ": {"pos": 0x03, "hex": "0x03", "type": "vowel"},
    "ई": {"pos": 0x04, "hex": "0x04", "type": "vowel"},
    "उ": {"pos": 0x05, "hex": "0x05", "type": "vowel"},
    "ऊ": {"pos": 0x06, "hex": "0x06", "type": "vowel"},
    "ऋ": {"pos": 0x07, "hex": "0x07", "type": "vowel"},
    "ए": {"pos": 0x08, "hex": "0x08", "type": "vowel"},
    "ऐ": {"pos": 0x09, "hex": "0x09", "type": "vowel"},
    "ओ": {"pos": 0x0A, "hex": "0x0A", "type": "vowel"},
    "औ": {"pos": 0x0B, "hex": "0x0B", "type": "vowel"},
    "अं": {"pos": 0x0C, "hex": "0x0C", "type": "vowel"},
    "अः": {"pos": 0x0D, "hex": "0x0D", "type": "vowel"},
    "ँ": {"pos": 0x0E, "hex": "0x0E", "type": "vowel"},
    # CONSONANT_FIELD: 0F-30 hex (34 tokens)
    "क": {"pos": 0x0F, "hex": "0x0F", "type": "consonant"},
    "ख": {"pos": 0x10, "hex": "0x10", "type": "consonant"},
    "ग": {"pos": 0x11, "hex": "0x11", "type": "consonant"},
    "घ": {"pos": 0x12, "hex": "0x12", "type": "consonant"},
    "ङ": {"pos": 0x13, "hex": "0x13", "type": "consonant"},
    "च": {"pos": 0x14, "hex": "0x14", "type": "consonant"},
    "छ": {"pos": 0x15, "hex": "0x15", "type": "consonant"},
    "ज": {"pos": 0x16, "hex": "0x16", "type": "consonant"},
    "झ": {"pos": 0x17, "hex": "0x17", "type": "consonant"},
    "ञ": {"pos": 0x18, "hex": "0x18", "type": "consonant"},
    "ट": {"pos": 0x19, "hex": "0x19", "type": "consonant"},
    "ठ": {"pos": 0x1A, "hex": "0x1A", "type": "consonant"},
    "ड": {"pos": 0x1B, "hex": "0x1B", "type": "consonant"},
    "ढ": {"pos": 0x1C, "hex": "0x1C", "type": "consonant"},
    "ण": {"pos": 0x1D, "hex": "0x1D", "type": "consonant"},
    "त": {"pos": 0x1E, "hex": "0x1E", "type": "consonant"},
    "थ": {"pos": 0x1F, "hex": "0x1F", "type": "consonant"},
    "द": {"pos": 0x20, "hex": "0x20", "type": "consonant"},
    "ध": {"pos": 0x21, "hex": "0x21", "type": "consonant"},
    "न": {"pos": 0x22, "hex": "0x22", "type": "consonant"},
    "प": {"pos": 0x23, "hex": "0x23", "type": "consonant"},
    "फ": {"pos": 0x24, "hex": "0x24", "type": "consonant"},
    "ब": {"pos": 0x25, "hex": "0x25", "type": "consonant"},
    "भ": {"pos": 0x26, "hex": "0x26", "type": "consonant"},
    "म": {"pos": 0x27, "hex": "0x27", "type": "consonant"},
    "य": {"pos": 0x28, "hex": "0x28", "type": "consonant"},
    "र": {"pos": 0x29, "hex": "0x29", "type": "consonant"},
    "ल": {"pos": 0x2A, "hex": "0x2A", "type": "consonant"},
    "व": {"pos": 0x2B, "hex": "0x2B", "type": "consonant"},
    "श": {"pos": 0x2C, "hex": "0x2C", "type": "consonant"},
    "ष": {"pos": 0x2D, "hex": "0x2D", "type": "consonant"},
    "स": {"pos": 0x2E, "hex": "0x2E", "type": "consonant"},
    "ह": {"pos": 0x2F, "hex": "0x2F", "type": "consonant"},
    "ळ": {"pos": 0x30, "hex": "0x30", "type": "consonant"},
}


# ─── Core Engine ────────────────────────────────────────────────────

def digital_root(n: int) -> int:
    """Iterative digital root."""
    while n >= 10:
        s = 0
        while n:
            s += n % 10
            n //= 10
        n = s
    return n


def npr_cycle(dr: int) -> str:
    """Map digital root to NPR cycle."""
    if dr % 3 == 0:
        return "Return"
    elif dr % 3 == 2:
        return "Pattern"
    else:
        return "Noise"


class TokenField:
    """
    Cyclisch tokenveld — niet-lineair.
    
    Elk token is tegelijk: positie + waarde + klank + veldlidmaatschap.
    Geen lijst — een veld dat gelijktijdig pulseert.
    """
    
    def __init__(self, name: str, tokens: dict, geometry: tuple):
        self.name = name
        self.tokens = tokens
        self.token_count = len(tokens)
        self.duration_us = self.token_count  # 1 token = 1 μs
        self.geometry = geometry  # e.g. (3, 9) for Greek
        
    def get_token(self, char: str) -> Optional[dict]:
        """Haal token op uit het veld."""
        return self.tokens.get(char)
    
    def tick(self, tick: int) -> list:
        """
        Op een gegeven μs-tick, welke tokens zijn actief?
        
        In cyclisch veld: tick % duration geeft positie.
        Meerdere tokens kunnen tegelijk actief zijn via geometry.
        """
        cycle_pos = tick % self.duration_us
        active = []
        for char, info in self.tokens.items():
            pos = info.get("pos", 0)
            # Lineair match
            if pos == cycle_pos + 1:
                active.append({"char": char, "info": info, "mode": "linear"})
            # Geometry match (binnen hetzelfde register/field)
            g0, g1 = self.geometry
            if g0 > 0:
                field_id = (pos - 1) // g1
                cycle_field = (cycle_pos) // g1
                if field_id == cycle_field:
                    active.append({"char": char, "info": info, "mode": "field"})
        return active
    
    def field_scan(self, text: str) -> dict:
        """
        Scan tekst door het volledige veld.
        Retourneert gelijktijdige lezing: alle tokens tegelijk.
        """
        result = {
            "text": text,
            "tokens": [],
            "field_total": 0,
            "geometry": self.geometry,
            "duration_us": self.duration_us,
        }
        
        for char in text:
            token = self.get_token(char)
            if token:
                t = {"char": char, **token}
                # Bereken NPR van waarde
                val = token.get("val", token.get("pos", 0))
                dr = digital_root(val)
                t["dr"] = dr
                t["cycle"] = npr_cycle(dr)
                result["tokens"].append(t)
                result["field_total"] += val
        
        # Totale NPR
        total = result["field_total"]
        result["total_dr"] = digital_root(total)
        result["total_cycle"] = npr_cycle(result["total_dr"])
        
        return result
    
    def cross_field_resonance(self, other: "TokenField", mod_limit: int = 12) -> dict:
        """
        Vind resonantie tussen twee velden.
        
        Kijk welke tokenposities overlappen via mod-mapping.
        """
        g_self = self.geometry
        g_other = other.geometry
        
        # Vind gemene deler van geometrieën
        overlaps = []
        for s_char, s_info in self.tokens.items():
            s_pos = s_info.get("pos", 0)
            for o_char, o_info in other.tokens.items():
                o_pos = o_info.get("pos", 0)
                # Mod-resonantie: posities die mod-gelijk zijn
                for mod in range(2, mod_limit + 1):
                    if s_pos % mod == o_pos % mod:
                        overlaps.append({
                            "self": s_char,
                            "other": o_char,
                            "mod": mod,
                            "self_pos": s_pos,
                            "other_pos": o_pos,
                        })
        
        return {
            "field_a": self.name,
            "field_b": other.name,
            "geometry_a": g_self,
            "geometry_b": g_other,
            "overlaps": overlaps[:20],  # Limiet voor leesbaarheid
            "total_overlaps": len(overlaps),
        }


# ─── Sandbox ─────────────────────────────────────────────────────────

# Initialiseer velden
greek = TokenField("Greek", GREEK_TOKENS, (3, 9))
arabic = TokenField("Arabic", ARABIC_TOKENS, (4, 7))
sanskrit = TokenField("Sanskrit", SANSKRIT_TOKENS, (6, 8))

FIELDS = {
    "greek": greek,
    "arabic": arabic,
    "sanskrit": sanskrit,
}


def tri_field_resonance(texts: dict) -> dict:
    """
    Tri-taal resonantie: Grieks + Arabisch + Sanskriet tegelijk.
    
    texts = {"greek": "...", "arabic": "...", "sanskrit": "..."}
    """
    result = {"fields": {}, "tri_resonance": []}
    
    for lang, text in texts.items():
        field = FIELDS.get(lang)
        if not field:
            continue
        scan = field.field_scan(text)
        result["fields"][lang] = scan
    
    # Vind shared digital roots tussen velden
    dr_sets = {}
    for lang, scan in result["fields"].items():
        drs = set(t["dr"] for t in scan["tokens"])
        dr_sets[lang] = drs
    
    # Shared DRs
    all_drs = set()
    for drs in dr_sets.values():
        all_drs |= drs
    
    for dr in all_drs:
        present = [lang for lang, drs in dr_sets.items() if dr in drs]
        if len(present) > 1:
            result["tri_resonance"].append({
                "shared_dr": dr,
                "cycle": npr_cycle(dr),
                "fields": present,
            })
    
    return result


def sandbox():
    """Demonstreer niet-lineair veldgedrag + tri-taal resonantie."""
    
    print("=" * 70)
    print("TOKEN FIELD SANDBOX — 1 token = 1 μs")
    print("=" * 70)
    
    # 1. Veld-overzicht
    print("\n--- VELD OVERZICHT ---")
    for name, field in FIELDS.items():
        g0, g1 = field.geometry
        print(f"  {name:10} : {field.token_count:2d} tokens = {field.duration_us:2d} μs = {g0}×{g1}")
    
    # 2. Sanskriet veld-structuur
    print("\n--- SANSKRIT VELD (48 μs = 6×8) ---")
    vowels = [f"{c}({i['hex']})" for c, i in SANSKRIT_TOKENS.items() if i["type"] == "vowel"]
    consonants = [f"{c}({i['hex']})" for c, i in SANSKRIT_TOKENS.items() if i["type"] == "consonant"]
    print(f"  VOWEL_FIELD   [01-0E]: {len(vowels)} tokens")
    print(f"    {', '.join(vowels)}")
    print(f"  CONSONANT_FIELD [0F-30]: {len(consonants)} tokens")
    print(f"    {', '.join(consonants[:10])}...")
    
    # 6×8 raster
    print(f"\n  6×8 RASTER (ROUTE_6 × BYTE_AXIS_8):")
    for fi in range(6):
        start = fi * 8 + 1
        end = start + 7
        field_tokens = []
        for c, i in SANSKRIT_TOKENS.items():
            if start <= i["pos"] <= end:
                field_tokens.append(f"{c}")
        print(f"    FIELD_{fi} [{start:2d}-{end:2d}]: {', '.join(field_tokens)}")
    
    # 3. Tekst-scans
    print("\n--- DRIE TAALSCANS ---")
    
    scan_g = greek.field_scan("χαιρ")
    print(f"\n  Grieks 'χαιρ':")
    for t in scan_g["tokens"]:
        print(f"    {t['char']} : pos={t['pos']}, val={t['val']}, dr={t['dr']}, cycle={t['cycle']}")
    print(f"    → Total={scan_g['field_total']}, DR={scan_g['total_dr']}, Cycle={scan_g['total_cycle']}")
    
    scan_a = arabic.field_scan("دوام")
    print(f"\n  Arabisch 'دوام':")
    for t in scan_a["tokens"]:
        print(f"    {t['char']} : pos={t['pos']}, val={t['val']}, field={t['field']}, dr={t['dr']}, cycle={t['cycle']}")
    print(f"    → Total={scan_a['field_total']}, DR={scan_a['total_dr']}, Cycle={scan_a['total_cycle']}")
    
    scan_s = sanskrit.field_scan("अगम")  # अ(01) ग(11) म(27)
    print(f"\n  Sanskriet 'अगम':")
    for t in scan_s["tokens"]:
        h = t.get("hex", "?")
        typ = t.get("type", "?")
        print(f"    {t['char']} : {h}, type={typ}, pos={t['pos']}, dr={t['dr']}, cycle={t['cycle']}")
    print(f"    → Total={scan_s['field_total']}, DR={scan_s['total_dr']}, Cycle={scan_s['total_cycle']}")
    
    # 4. Cross-field resonantie (alle paren)
    print("\n--- CROSS-FIELD RESONANTIE ---")
    
    res_ga = greek.cross_field_resonance(arabic)
    print(f"  Grieks ↔ Arabisch: {res_ga['total_overlaps']} overlaps")
    for o in res_ga["overlaps"][:4]:
        print(f"    {o['self']}({o['self_pos']}) ↔ {o['other']}({o['other_pos']}) mod {o['mod']}")
    
    res_gs = greek.cross_field_resonance(sanskrit)
    print(f"  Grieks ↔ Sanskriet: {res_gs['total_overlaps']} overlaps")
    for o in res_gs["overlaps"][:4]:
        print(f"    {o['self']}({o['self_pos']}) ↔ {o['other']}({o['other_pos']}) mod {o['mod']}")
    
    res_as = arabic.cross_field_resonance(sanskrit)
    print(f"  Arabisch ↔ Sanskriet: {res_as['total_overlaps']} overlaps")
    for o in res_as["overlaps"][:4]:
        print(f"    {o['self']}({o['self_pos']}) ↔ {o['other']}({o['other_pos']}) mod {o['mod']}")
    
    # 5. Tri-taal resonantie
    print("\n--- TRI-TAAL RESONANTIE ---")
    tri = tri_field_resonance({
        "greek": "χαιρ",
        "arabic": "دوام",
        "sanskrit": "अगम",
    })
    for r in tri["tri_resonance"]:
        print(f"  DR={r['shared_dr']} ({r['cycle']}): {', '.join(r['fields'])}")
    
    # 6. Simultaan veldpuls
    print("\n--- SIMULTAAN VELDPULS ---")
    for tick in range(12):
        ga = len(greek.tick(tick))
        aa = len(arabic.tick(tick))
        sa = len(sanskrit.tick(tick))
        print(f"  μs {tick:2d}: G={ga:2d}, A={aa:2d}, S={sa:2d}")
    
    # 7. Niet-lineair veld
    print(f"\n--- NIET-LINEAIR VELDGEDRAG ---")
    print(f"  Grieks (3×9): 3 registers × 9 tokens")
    print(f"    REG_1: {', '.join(c for c,i in GREEK_TOKENS.items() if i['reg']==1)}")
    print(f"    REG_2: {', '.join(c for c,i in GREEK_TOKENS.items() if i['reg']==2)}")
    print(f"    REG_3: {', '.join(c for c,i in GREEK_TOKENS.items() if i['reg']==3)}")
    print(f"  → Alle registers tegelijk actief binnen 27 μs cyclus")
    
    print(f"\n  Arabisch (4×7): 4 velden × 7 tokens")
    for fi in range(4):
        chars = [c for c,i in ARABIC_TOKENS.items() if i['field']==fi]
        print(f"    FIELD_{fi}: {', '.join(chars)}")
    print(f"  → Alle velden tegelijk actief binnen 28 μs cyclus")
    
    print(f"\n  Sanskriet (6×8): 6 velden × 8 tokens")
    print(f"  → Alle velden tegelijk actief binnen 48 μs cyclus")
    
    # 8. Route 27→28→48
    print(f"\n--- GEZAMENLIJKE ROUTE: 27 → 28 → 48 ---")
    print(f"  Grieks    → 3×9-registerveld  (27 μs)")
    print(f"  Arabisch  → 4×7-loopveld      (28 μs)")
    print(f"  Sanskriet → 6×8-routingveld   (48 μs)")
    print(f"  → token → positie → waarde → veld → cyclus → Return")
    
    print("\n" + "=" * 70)
    print("Sandbox compleet.")
    print("=" * 70)


if __name__ == "__main__":
    sandbox()
