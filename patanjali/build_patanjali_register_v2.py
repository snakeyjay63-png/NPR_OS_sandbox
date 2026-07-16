#!/usr/bin/env python3
"""
Build version 2 of the passive Pātañjalayogasūtra register.

Version 2 keeps two explicit text layers per sūtra:

1. source_accented
   The Devanāgarī source text with Vedic accent marks exactly as published.

2. working_unaccented
   The derived working text after removing only the configured Vedic accent
   code points. Avagraha, anusvāra, visarga, vowel signs, conjuncts and
   ordinary spacing are retained.

Each layer receives its own:
- NFC string
- UTF-8 byte count
- digital root
- hexadecimal byte-count representation
- Base64
- SHA-256

The script downloads the Sanskrit Documents HTML page, extracts both the
"sasvara" and "niḥsvara" sections, and verifies that stripping only the
declared accent marks from the source layer reproduces the unaccented layer.

Usage:
    python build_patanjali_register_v2.py \
        --old-register patanjali_passive_sanskrit_register.json \
        --output patanjali_passive_sanskrit_register_v2.json

Dependencies:
    Python 3.10+
    beautifulsoup4

Install dependency:
    python -m pip install beautifulsoup4
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import sys
import unicodedata
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


SOURCE_URL = "https://sanskritdocuments.org/doc_yoga/yogasuutra.html"

EXPECTED_COUNTS = {1: 51, 2: 55, 3: 55, 4: 34}
EXPECTED_TOTAL = sum(EXPECTED_COUNTS.values())

# Marks observed in the selected accented source.
# They are removed only when deriving the working layer.
ACCENT_MARKS = {
    "\u0951": "DEVANAGARI STRESS SIGN UDATTA",
    "\u0952": "DEVANAGARI STRESS SIGN ANUDATTA",
    "\u1CDA": "VEDIC TONE DOUBLE SVARITA",
}

DEVANAGARI_DIGITS = str.maketrans("०१२३४५६७८९", "0123456789")
MARKER_RE = re.compile(r"॥\s*([१२३४])\.([०१२३४५६७८९]+)\s*॥")


@dataclass(frozen=True)
class SutraText:
    sutra_id: str
    text: str


def digital_root(value: int) -> int:
    return 0 if value == 0 else 1 + ((value - 1) % 9)


def metrics(text: str) -> dict[str, Any]:
    nfc = unicodedata.normalize("NFC", text)
    data = nfc.encode("utf-8")
    count = len(data)
    return {
        "text": nfc,
        "unicode_normalization": "NFC",
        "utf8_bytes": count,
        "digital_root": digital_root(count),
        "utf8_byte_count_hex": format(count, "X"),
        "base64_utf8": base64.b64encode(data).decode("ascii"),
        "sha256": hashlib.sha256(data).hexdigest(),
    }


def strip_declared_accents(text: str) -> str:
    return unicodedata.normalize(
        "NFC",
        "".join(ch for ch in text if ch not in ACCENT_MARKS),
    )


def normalize_space(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def fetch_html(url: str) -> str:
    request = urllib.request.Request(
        url,
        headers={"User-Agent": "NPR-Patanjali-Register/2.0"},
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset)


def html_to_lines(html: str) -> list[str]:
    try:
        from bs4 import BeautifulSoup
    except ImportError as exc:
        raise RuntimeError(
            "beautifulsoup4 is required: python -m pip install beautifulsoup4"
        ) from exc

    soup = BeautifulSoup(html, "html.parser")
    return [line.rstrip() for line in soup.get_text("\n").splitlines()]


def join_fragment(buffer: list[str], line: str) -> None:
    line = line.strip()
    if not line:
        return

    if buffer and buffer[-1].endswith("-"):
        buffer[-1] = buffer[-1][:-1] + line
    else:
        buffer.append(line)


def extract_section(
    lines: list[str],
    *,
    start_phrase: str,
    end_phrase: str | None,
) -> dict[str, str]:
    start = None
    end = len(lines)

    for index, line in enumerate(lines):
        if start is None and start_phrase in line:
            start = index + 1
            continue
        if start is not None and end_phrase and end_phrase in line:
            end = index
            break

    if start is None:
        raise ValueError(f"section start not found: {start_phrase!r}")

    records: dict[str, str] = {}
    buffer: list[str] = []

    for raw_line in lines[start:end]:
        line = normalize_space(raw_line)
        if not line:
            continue

        # Ignore headings, colophons and source notes.
        if (
            line.startswith("#")
            or "अध्यायः" in line
            or line.startswith("॥ इति")
            or line.startswith("॥ महर्षि")
        ):
            buffer.clear()
            continue

        # Skip lines that are ONLY verse markers + Devanagari header text
        # (e.g. ॥ प्रथमोऽध्यायः ॥  ॥ समाधि-पादः ॥)
        if re.fullmatch(r'(\s*॥[^॥]+॥\s*)+', line):
            buffer.clear()
            continue

        marker = MARKER_RE.search(line)
        if marker:
            before = line[: marker.start()].strip()
            join_fragment(buffer, before)

            book = int(marker.group(1).translate(DEVANAGARI_DIGITS))
            number = int(marker.group(2).translate(DEVANAGARI_DIGITS))
            sutra_id = f"{book}.{number}"

            text = normalize_space(" ".join(buffer))
            if not text:
                raise ValueError(f"empty text for {sutra_id}")
            if sutra_id in records:
                raise ValueError(f"duplicate sūtra {sutra_id}")

            records[sutra_id] = unicodedata.normalize("NFC", text)
            buffer.clear()
            continue

        # Ignore parenthesized editorial variants after a completed marker.
        if line.startswith("(") and line.endswith(")"):
            continue

        join_fragment(buffer, line)

    return records


def flatten_old_register(document: dict[str, Any]) -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    for book in document.get("books", []):
        for entry in book.get("sutras", []):
            result[entry["sutra"]] = entry
    return result


def compare_text(
    sutra_id: str,
    derived: str,
    published_unaccented: str,
    old_working: str | None,
) -> None:
    if derived != published_unaccented:
        raise ValueError(
            f"{sutra_id}: removing declared accent marks does not reproduce "
            "the published niḥsvara text.\n"
            f"derived:   {derived}\n"
            f"published: {published_unaccented}"
        )

    if old_working is not None and published_unaccented != old_working:
        raise ValueError(
            f"{sutra_id}: published niḥsvara text differs from version 1.\n"
            f"v1:        {old_working}\n"
            f"published: {published_unaccented}"
        )


def build_v2(
    old_document: dict[str, Any],
    accented: dict[str, str],
    unaccented: dict[str, str],
) -> dict[str, Any]:
    if len(accented) != EXPECTED_TOTAL:
        raise ValueError(
            f"accented section contains {len(accented)} sūtras; "
            f"expected {EXPECTED_TOTAL}"
        )
    if len(unaccented) != EXPECTED_TOTAL:
        raise ValueError(
            f"unaccented section contains {len(unaccented)} sūtras; "
            f"expected {EXPECTED_TOTAL}"
        )

    old_entries = flatten_old_register(old_document)
    active_nodes = set(
        old_document.get("npr_route", {}).get("active_nodes", [])
    )

    books: list[dict[str, Any]] = []

    for book_no, expected_count in EXPECTED_COUNTS.items():
        sutras: list[dict[str, Any]] = []

        for number in range(1, expected_count + 1):
            sutra_id = f"{book_no}.{number}"
            source_text = accented[sutra_id]
            published_working = unaccented[sutra_id]
            derived_working = strip_declared_accents(source_text)

            old_entry = old_entries.get(sutra_id)
            old_text = old_entry.get("sanskrit") if old_entry else None

            compare_text(
                sutra_id,
                derived_working,
                published_working,
                old_text,
            )

            sutras.append({
                "sutra": sutra_id,
                "status": "passive",
                "npr_route_node": sutra_id in active_nodes,
                "source_accented": metrics(source_text),
                "working_unaccented": {
                    **metrics(published_working),
                    "derived_from": "source_accented",
                    "transformation": {
                        "operation": "remove_declared_vedic_accent_marks",
                        "removed_code_points": [
                            {
                                "character": mark,
                                "code_point": f"U+{ord(mark):04X}",
                                "name": name,
                            }
                            for mark, name in ACCENT_MARKS.items()
                        ],
                        "other_characters_changed": False,
                    },
                },
            })

        old_book = next(
            (b for b in old_document.get("books", []) if b.get("book") == book_no),
            {},
        )
        books.append({
            "book": book_no,
            "pada": old_book.get("pada"),
            "sutra_count": len(sutras),
            "sutras": sutras,
        })

    return {
        "title": "Pātañjalayogasūtra Passive Sanskrit Register",
        "version": "2.0",
        "status": "passive",
        "corpus": {
            "sutra_count": EXPECTED_TOTAL,
            "book_count": 4,
            "numbering": old_document.get("corpus", {}).get("numbering"),
            "source": SOURCE_URL,
        },
        "text_layers": {
            "source_accented": {
                "role": "primary_source_object",
                "description": (
                    "Published Devanāgarī source with Vedic accent marks retained."
                ),
            },
            "working_unaccented": {
                "role": "derived_working_object",
                "description": (
                    "Derived by removing only the declared Vedic accent code points."
                ),
            },
        },
        "methodology": {
            "translation": None,
            "commentary": None,
            "automatic_npr_interpretation": False,
            "unicode_normalization": "NFC",
            "encoding": "UTF-8",
            "verse_markers_included": False,
            "sutra_numbers_included_in_encoded_string": False,
            "leading_trailing_spaces_included": False,
            "internal_spaces_preserved": True,
            "source_accents_retained": True,
            "working_layer_is_derived": True,
            "activation_rule": (
                "A sūtra becomes active only when a query, route, "
                "or verification step refers to it."
            ),
        },
        "npr_route": old_document.get("npr_route", {}),
        "books": books,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--old-register",
        type=Path,
        required=True,
        help="Version 1 JSON register",
    )
    parser.add_argument(
        "--output",
        type=Path,
        required=True,
        help="Destination for version 2 JSON",
    )
    parser.add_argument(
        "--source-url",
        default=SOURCE_URL,
        help="Accented/unaccented source page",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    try:
        old_document = json.loads(
            args.old_register.read_text(encoding="utf-8")
        )
        html = fetch_html(args.source_url)
        lines = html_to_lines(html)

        accented = extract_section(
            lines,
            start_phrase="पातञ्जलयोगसूत्राणि सस्वर",
            end_phrase="निःस्वर",
        )
        unaccented = extract_section(
            lines,
            start_phrase="निःस्वर",
            end_phrase=None,
        )

        output = build_v2(old_document, accented, unaccented)
        args.output.write_text(
            json.dumps(output, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(
        f"OK: wrote {EXPECTED_TOTAL} two-layer records to {args.output}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
