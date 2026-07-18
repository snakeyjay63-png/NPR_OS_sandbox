#!/usr/bin/env python3
"""
Greek NT → NPR Layer (Noise → Pattern → Return)

Applies NPR cycle to each verse of the NT corpus.
Maps isopsefia values through digital root → NPR cycle.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from isopsefia import normalize_greek, isopsefia_value, digital_root


def npr_cycle(dr: int) -> str:
    """Map digital root to NPR cycle."""
    if dr % 3 == 0:
        return "Return"
    elif dr % 3 == 2:
        return "Pattern"
    else:
        return "Noise"


def verse_npr(text: str) -> dict:
    """Single verse → NPR analysis."""
    clean = normalize_greek(text)
    letters = [c for c in clean if isopsefia_value(c) > 0]
    
    if not letters:
        return {"letters": [], "total": 0, "dr": 0, "cycle": "Return", "distribution": {}}
    
    total = sum(isopsefia_value(c) for c in letters)
    dr = digital_root(total)
    cycle = npr_cycle(dr)
    
    # Per-letter distribution
    distribution = {"Noise": 0, "Pattern": 0, "Return": 0}
    for c in letters:
        v = isopsefia_value(c)
        d = digital_root(v)
        distribution[npr_cycle(d)] += 1
    
    return {
        "letters": letters,
        "letter_count": len(letters),
        "total": total,
        "dr": dr,
        "cycle": cycle,
        "distribution": distribution,
    }


def book_npr(book_text: str, book_code: str) -> dict:
    """Full book → NPR summary."""
    verses = [v.strip() for v in book_text.split('\n') if v.strip()]
    
    cycles = {"Noise": 0, "Pattern": 0, "Return": 0}
    verse_results = []
    
    for i, verse in enumerate(verses):
        r = verse_npr(verse)
        r["verse"] = i + 1
        cycles[r["cycle"]] += 1
        verse_results.append(r)
    
    total_value = sum(r["total"] for r in verse_results)
    
    return {
        "book": book_code,
        "verse_count": len(verses),
        "total_value": total_value,
        "total_dr": digital_root(total_value),
        "total_cycle": npr_cycle(digital_root(total_value)),
        "cycle_distribution": cycles,
        "verses": verse_results,
    }


def sandbox():
    """Demo: NPR layer on key verses."""
    
    print("=" * 70)
    print("GREEK NT → NPR LAYER")
    print("Noise → Pattern → Return")
    print("=" * 70)
    
    # Key verses
    verses = [
        ("Mt 1:1", "Βίβλος γενέσεως Ἰησοῦ χριστοῦ υἱοῦ Δαυὶδ υἱοῦ Ἀβραάμ"),
        ("Jn 1:1", "Ἐν ἀρχῇ ἦν ὁ λόγος καὶ ὁ λόγος ἦν πρὸς τὸν θεὸν καὶ θεὸς ἦν ὁ λόγος"),
        ("Jn 1:14", "Καὶ ὁ λόγος σὰρξ ἐγένετο καὶ ἐσκήνωσεν ἐν ἡμῖν"),
        ("Ro 8:28", "Οἴδαμεν δὲ ὅτι τοῖς ἀγαπῶσιν τὸν θεὸν πάντα συνεργεῖ εἰς ἀγαθόν"),
        ("Re 1:8", "Εἶπεν ὁ κύριος ὁ θεὸς ὁ ὤν καὶ ὁ ἦν καὶ ὁ ἐρχόμενος"),
    ]
    
    for label, text in verses:
        r = verse_npr(text)
        dist = r["distribution"]
        print(f"\n  {label}:")
        print(f"    Letters: {r['letter_count']}, Total: {r['total']}, DR: {r['dr']}")
        print(f"    Cycle: {r['cycle']}")
        print(f"    Distribution: N={dist['Noise']}, P={dist['Pattern']}, R={dist['Return']}")
    
    print("\n" + "=" * 70)
    print("NPR Layer compleet.")
    print("=" * 70)


if __name__ == "__main__":
    sandbox()
