#!/usr/bin/env python3
"""
Tool-00 — NPR-Local Bestandssjabloon Validator v2

Valideert elk npr-local bestand tegen de basisregels:
  1. Minimaal 3 functies per bestand
  2. Module exports aanwezig
  3. Documentatie block bovenaan
  4. Geen single-responsibility fragmenten
  5. IPv6 adres per bestand (wet-ordening)

NPR 1.0 architectuur:
  - Bestanden laden NIEt lineair, maar tegelijk
  - IPv6 bepaalt de wet-ordening
  - Bij contradictie: IPv6 bepaalt welk bestand de leiding heeft
  - Begin is niet belangrijker dan einde

Output: audit-formaat (aandacht → regel → waarom)
"""
import hashlib
import json
import re
import sys
from pathlib import Path

SRC = Path(__file__).parent / "npr-local" / "src"
MIN_FUNCTIONS = 3
REQUIRED_EXPORTS = ["module.exports", "export default", "export const", "export function"]
DOC_PATTERNS = [r"/\*\*", r"^#\s", r'"""\s*\n']

# Regels die elk bestand moet volgen
RULES = {
    "functies": {
        "regel": f"Minimaal {MIN_FUNCTIONS} functies per bestand",
        "waarom": "Voorkomt fragmentatie; dwingt samenhang binnen een module",
    },
    "exports": {
        "regel": "Module exports moet expliciet aanwezig zijn",
        "waarom": "Zorgt voor duidelijke API grens; voorkomt onbedoelde koppeling",
    },
    "documentatie": {
        "regel": "Bestand moet beginnen met documentatie block",
        "waarom": "Zorgt voor context onafhankelijk van code; leest als contract",
    },
    "naam": {
        "regel": "Bestandsnaam moet beschrijvend zijn (min 4 karakters voor extensie)",
        "waarom": "Voorkomt ambiguïteit; file=module in NPR-architectuur",
    },
}

# Export schema per bestand — wat elk bestand MOET exporteren minimaal
# Dit is het contract: bestand → rol → vereiste exports
EXPORT_SCHEMA = {
    "agent/loop.js": {
        "rol": "Agent loop orchestrator",
        "kan": "NPR-cyclus aansturen; signaal → patroon → return",
        "moet": ["run", "process", "cycle"],
    },
    "field/keyboard-npr.js": {
        "rol": "Keyboard → NPR signaal converter",
        "kan": "Toetsenbord input omzetten naar NPR frequentie/signaal",
        "moet": ["keyboardNPR", "signalChain"],
    },
    "field/npr.js": {
        "rol": "NPR analyse kernel",
        "kan": "Tekst/signaal analyseren via NPR (Noise→Pattern→Return)",
        "moet": ["analyze", "nprRoute", "digitalRoot"],
    },
    "index.js": {
        "rol": "Entry point / server bootstrap",
        "kan": "Server starten; HTML verificatie pagina via browser én curl",
        "moet": ["boot", "verifyHTML"],
    },
    "interface/gateway.js": {
        "rol": "OpenClaw gateway proxy",
        "kan": "Verzoek doorsturen naar OpenClaw gateway",
        "moet": ["createServer", "uptime"],
    },
    "memory/context.js": {
        "rol": "Geheugen context manager",
        "kan": "Context laden/opslaan/zoeken in geheugenlaag",
        "moet": ["loadContext", "saveContext", "search"],
    },
    "routes/capabilities.js": {
        "rol": "Capabilities endpoint",
        "kan": "Beschikbare NPR-capabiliteiten rapporteren",
        "moet": ["getCapabilities", "register"],
    },
    "routes/core.js": {
        "rol": "Kern routing",
        "kan": "HTTP routes registreren en dispatcher",
        "moet": ["register", "dispatch"],
    },
    "routes/map-registry.js": {
        "rol": "Map registratie",
        "kan": "Maps registreren en ontdekken",
        "moet": ["registerMap", "discover"],
    },
    "routes/map-to-ipv6.js": {
        "rol": "Map → IPv6 converter",
        "kan": "Map data omzetten naar IPv6 addressing",
        "moet": ["mapToIPv6"],
    },
    "server-config.js": {
        "rol": "Server configuratie",
        "kan": "Config laden, valideren, defaults toepassen",
        "moet": ["config", "defaults", "validate"],
    },
    "sources/echo/handler.js": {
        "rol": "Echo source handler",
        "kan": "Echo verwerken en terugsturen",
        "moet": ["handle", "parse", "respond"],
    },
    "sources/system-scan/handler.js": {
        "rol": "System scan handler",
        "kan": "Systeem scannen en resultaten rapporteren",
        "moet": ["handle", "quickScan", "fullScan"],
    },
    "sources/system-scan/index.js": {
        "rol": "System scan kernel",
        "kan": "Volledig systeem overzicht (OS, packages, binaries, network)",
        "moet": ["fullScan", "quickScan", "scanOS"],
    },
    "workspace-context.js": {
        "rol": "Workspace context broker",
        "kan": "Workspace scannen, content zoeken, context bouwen",
        "moet": ["scanWorkspace", "buildContextString", "retrieveContent"],
    },
}


def count_functions(txt: str) -> int:
    """Tel functies: function decl, arrow, method."""
    funcs = re.findall(r"(?:function\s+\w+|=>\s*\{|^\s+\w+\s*\([^)]*\)\s*\{)", txt, re.MULTILINE)
    return max(len(funcs), 1)  # min 1 als fallback


def has_exports(txt: str) -> bool:
    """Check op module.exports of ES6 export."""
    return any(re.search(pattern, txt) for pattern in REQUIRED_EXPORTS)


def has_docs(txt: str) -> bool:
    """Check op documentatie bovenaan."""
    return any(re.search(pattern, txt[:500]) for pattern in DOC_PATTERNS)


def get_exported_names(txt: str) -> set[str]:
    """Extract namen van module.exports."""
    # Match module.exports = { ... } of module.exports = { key: val, ... }
    m = re.search(r"module\.exports\s*=\s*\{([^}]+)\}", txt, re.DOTALL)
    if m:
        block = m.group(1)
        names = re.findall(r"(\w+)\s*[:=,]", block)
        return set(names)
    # Fallback: named exports
    m = re.search(r"module\.exports\s*=\s*(\w+)", txt)
    if m:
        return {m.group(1)}
    return set()


def path_to_ipv6(filepath: Path) -> str:
    """
    Map bestandspad → IPv6 adres.
    
    IPv6 = wet-ordening:
      - Bepaalt autoriteit bij contradictie
      - Niet lineair, niet hiërarchisch
      - Gelijktijdige ladingsvolgorde
    """
    # Hash pad → 64-bit suffix
    hash_val = hashlib.sha256(str(filepath).encode()).digest()
    h1 = f"{hash_val.readUInt32BE(0):08x}" if hasattr(hash_val, 'readUInt32BE') else f"{int.from_bytes(hash_val[:4], 'big'):08x}"
    h2 = f"{int.from_bytes(hash_val[4:8], 'big'):08x}"
    return f"fd00:npr:{h1}:{h2}"


def digital_root(n: int) -> int:
    """Bereken digitale root (1-9)."""
    while n > 9:
        n = sum(int(d) for d in str(n))
    return n


def ipv6_authority(ipv6: str) -> int:
    """
    Bepaal autoriteit-niveau van IPv6.
    
    Hogere digitale root = hogere autoriteit bij contradictie.
    """
    # Gebruik laatste 2 hextets als autoriteit-basis
    parts = ipv6.split(':')
    hex_val = int(parts[-1], 16) if len(parts) >= 4 else 0
    return digital_root(hex_val)


def validate_file(filepath: Path) -> list[dict]:
    """Valideer één bestand; retourneert lijst van audit punten."""
    txt = filepath.read_text()
    issues = []
    rel = str(filepath.relative_to(SRC))

    # Regel 1: functies
    func_count = count_functions(txt)
    if func_count < MIN_FUNCTIONS:
        issues.append({
            "bestand": rel,
            "aandacht": f"Alleen {func_count} functie(s) gevonden; minimum is {MIN_FUNCTIONS}",
            "regel": RULES["functies"]["regel"],
            "waarom": RULES["functies"]["waarom"],
            "status": "❌",
        })

    # Regel 2: exports aanwezig
    exported = get_exported_names(txt)
    if not has_exports(txt):
        issues.append({
            "bestand": rel,
            "aandacht": "Geen module exports gevonden",
            "regel": RULES["exports"]["regel"],
            "waarom": RULES["exports"]["waarom"],
            "status": "❌",
        })

    # Regel 2b: exports voldoen aan schema
    schema = EXPORT_SCHEMA.get(rel)
    if schema and exported:
        missing = set(schema["moet"]) - exported
        if missing:
            issues.append({
                "bestand": rel,
                "aandacht": f"Ontbreekt in exports: {', '.join(sorted(missing))}",
                "regel": f"Rol '{schema['rol']}' vereist: {', '.join(schema['moet'])}",
                "waarom": f"{schema['kan']}",
                "status": "❌",
            })

    # Regel 3: documentatie
    if not has_docs(txt):
        issues.append({
            "bestand": rel,
            "aandacht": "Geen documentatie block bovenaan bestand",
            "regel": RULES["documentatie"]["regel"],
            "waarom": RULES["documentatie"]["waarom"],
            "status": "⚠️",
        })

    # Regel 4: naam
    stem = filepath.stem
    if len(stem) < 4 and stem != "index":
        issues.append({
            "bestand": rel,
            "aandacht": f"Bestandsnaam '{stem}' is te kort (min 4 karakters)",
            "regel": RULES["naam"]["regel"],
            "waarom": RULES["naam"]["waarom"],
            "status": "⚠️",
        })

    return issues


def scan_all():
    """Scan alle .js bestanden in npr-local/src."""
    all_issues = []
    files_checked = 0
    file_ips = {}  # bestand → IPv6

    for js_file in sorted(SRC.glob("**/*.js")):
        files_checked += 1
        rel = str(js_file.relative_to(SRC))
        file_ips[rel] = path_to_ipv6(js_file)
        all_issues.extend(validate_file(js_file))

    return all_issues, files_checked, file_ips


def to_audit_md(issues: list[dict], files_checked: int, file_ips: dict = None) -> str:
    """Converteer issues naar audit markdown."""
    lines = [
        "# Tool-00 Audit — NPR-Local Bestandssjabloon",
        "",
        f"**Bestanden gecheckt:** {files_checked}",
        f"**Issues gevonden:** {len(issues)}",
        "",
        "## IPv6 Wet-Ordnning",
        "",
        "Elk bestand heeft een IPv6 adres. Bij contradictie bepaalt dit de leiding.",
        "",
        "| Bestand | IPv6 | Autoriteit |",
        "|---|---|---|",
    ]

    if file_ips:
        for rel, ipv6 in sorted(file_ips.items()):
            auth = ipv6_authority(ipv6)
            lines.append(f"| `{rel}` | `{ipv6}` | {auth} |")

    lines.append("")
    lines.append("## Resultaten")
    lines.append("")

    # Groepeer per bestand
    by_file = {}
    for issue in issues:
        by_file.setdefault(issue["bestand"], []).append(issue)

    for fname, file_issues in by_file.items():
        lines.append(f"### {fname}")
        lines.append("")
        for i, issue in enumerate(file_issues, 1):
            lines.append(f"**{i}.** {issue['aandacht']}")
            lines.append(f"   - *Regel:* {issue['regel']}")
            lines.append(f"   - *Waarom:* {issue['waarom']}")
            lines.append(f"   - *Status:* {issue['status']}")
            lines.append("")

    if not issues:
        lines.append("✅ Alle bestanden voldoen aan de sjabloon.")
        lines.append("")

    lines.append("---")
    lines.append(f"**Tool-00: {len(issues)} issue(s) in {files_checked} bestand(en)**")
    return "\n".join(lines)


def to_json(issues: list[dict], files_checked: int, file_ips: dict = None) -> dict:
    """Converteer naar JSON output."""
    return {
        "issues": issues,
        "files": files_checked,
        "ipv6_mapping": file_ips or {},
        "authority": {k: ipv6_authority(v) for k, v in (file_ips or {}).items()},
    }


if __name__ == "__main__":
    issues, files_checked, file_ips = scan_all()

    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        print(json.dumps(to_json(issues, files_checked, file_ips), indent=2, ensure_ascii=False))
    else:
        print(to_audit_md(issues, files_checked, file_ips))
