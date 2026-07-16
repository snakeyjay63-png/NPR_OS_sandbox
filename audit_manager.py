#!/usr/bin/env python3
"""
NPR Audit Manager v2 — observe-only audits.

Format per punt:
  aandacht:  wat is er aan de hand
  regel:     welke regel/principe
  waarom:    waarom is het een punt

Audit observeert. Oplossing komt via ander proces.
Dit voorkomt verstoring van de structuur.
"""
import json, re, sys
from pathlib import Path
from datetime import date

AUDITS = Path(__file__).parent / "audits"
ARCHIVE = Path(__file__).parent / "audits_archive"

STATUS = {"ok": "✅", "partial": "⚠️", "design": "⚪", "issue": "❌", "critical": "🔴"}
STATUS_REV = {"✅":"ok","⚠️":"partial","⚪":"design","❌":"issue","🔴":"critical"}


def parse(path: Path):
    txt = path.read_text()
    res = {"file": path.name, "points": [], "summary": ""}
    m = re.search(r'\*\*Audit \d+/\d+:\s*(.+?)\s*\*\*', txt)
    if m: res["summary"] = m.group(1).strip()

    # Split on ## NUM. Titel
    pattern = r'^##\s+(\d+)\.\s+(.+)$'
    sections = re.split(pattern, txt, flags=re.MULTILINE)
    # sections: [preamble, num1, title1, body1, num2, title2, body2, ...]
    i = 1
    while i < len(sections) - 1:
        num = int(sections[i])
        title = sections[i+1].strip()
        body = sections[i+2] if i+2 < len(sections) else ""
        i += 3

        d = {"num": num, "title": title}

        # Parse body for key: value pairs
        for line in body.strip().split('\n'):
            line = line.strip()
            for key, label in [("aandacht", "**Aandacht:**"),
                               ("regel", "**Regel:**"),
                               ("waarom", "**Waarom:**"),
                               ("status", "**Status:**")]:
                if line.startswith(label):
                    d[key] = line.replace(label, "").strip()

        # If no aandacht found, treat first lines as aandacht
        if "aandacht" not in d and body.strip():
            first_line = body.strip().split('\n')[0].strip()
            if first_line and first_line != title:
                d["aandacht"] = first_line

        res["points"].append(d)

    return res


def count():
    c = {"ok": 0, "partial": 0, "design": 0, "issue": 0, "critical": 0}
    tot = 0
    for f in sorted(AUDITS.glob("audit_*.md")):
        for p in parse(f)["points"]:
            s = p.get("status", "")
            for emoji, label in STATUS_REV.items():
                if emoji in s:
                    c[label] += 1
                    break
            else:
                c["issue"] += 1
            tot += 1
    return c, tot, len(list(AUDITS.glob("audit_*.md")))


def summarize():
    c, tot, n = count()
    bar = " | ".join(f"{STATUS[k]} {v}" for k, v in c.items() if v)
    return f"\n# NPR Audit — {date.today().isoformat()}\n\n{bar}\n\nBestanden: {n} | Punten: {tot}\n"


def scaffold(num, start, end, title):
    lines = [
        f"# Audit {num}/6 — {title}",
        "",
        f"**Punten:** {start}-{end}",
        f"**Doel:** Observeren, niet oplossen. Structuur onverstoord houden.",
        "",
    ]
    for i in range(start, end + 1):
        lines += [
            f"## {i}. [Te inventariseren]", "",
            f"**Aandacht:** [Wat is er aan de hand]", "",
            f"**Regel:** [Welke regel/principe]", "",
            f"**Waarom:** [Waarom is het een punt]", "",
            f"**Status:** ❌ Nog te observeren", "",
        ]
    lines += [f"---", f"**Audit {num}/6: Te inventariseren**"]
    name = f"audit_{num:02d}_{title.lower().replace(' ', '_')}.md"
    (AUDITS / name).write_text("\n".join(lines))
    return name


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"

    if cmd == "list":
        c, tot, n = count()
        print(f"Audits: {n} | Punten: {tot}")
        for k, v in c.items():
            if v: print(f"  {STATUS[k]} {k}: {v}")

    elif cmd == "parse":
        print(json.dumps(parse(Path(sys.argv[2])), indent=2, ensure_ascii=False))

    elif cmd == "summarize":
        print(summarize())

    elif cmd == "create":
        print(f"Created: {scaffold(int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4]), sys.argv[5])}")

    elif cmd == "archive":
        ARCHIVE.mkdir(exist_ok=True)
        for f in AUDITS.glob("audit_*.md"):
            f.rename(ARCHIVE / f"{f.name}.done")
            print(f"Archived: {f.name}")
    else:
        print("Usage: audit_manager.py [list|parse|summarize|create|archive]")
