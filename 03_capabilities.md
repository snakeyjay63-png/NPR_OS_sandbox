# Stap 03: Capabilities.json — Declaratieve Routing Basis

**Doel:** Kan een JSON-file als routing-declaratie dienen?

---

## Concept

```json
{
  "router": "npr-signal-to-thought",
  "mode": "route",
  "capabilities": [
    {
      "name": "sha256_cell_route",
      "input": "utf8_text",
      "output": "hex_cell_00_3F",
      "function": "upper(sha256(utf8_nfc(input))[0:3]) mod 40_hex",
      "errors": ["INVALID_UTF8", "NORMALIZATION_FAILURE", "HASH_FAILURE", "MOD_REDUCTION_FAILURE"],
      "source": "stap_01"
    },
    {
      "name": "cell_bit_transform",
      "input": "hex_cell_00_3F",
      "output": "eight_bit_hex",
      "function": "hex(left_pad(bin(cell), 8, \"0\"))",
      "errors": ["INVALID_HEX_CELL", "OUT_OF_RANGE_00_3F"],
      "reversible": true,
      "source": "stap_02"
    },
    {
      "name": "ipv4_edge",
      "input": "hex_cell_00_3F",
      "output": "npr_ipv4_label",
      "function": "0.0.h_to_dec(h).0",
      "errors": ["INVALID_HEX_CELL", "CONVERSION_FAILURE", "IP_OVERFLOW"],
      "boundary": "external",
      "source": "stap_02"
    }
  ]
}
```

**Principe:** Declaratief > hardcoded paths.
Router leest capability-contracten → bepaalt routing → geen hardcoded routes.

**Voorwaarden:** elke capability moet verwijzen naar een gedefinieerde
functie in de keten (source = stapnummer). Geen capability zonder contract.

---

## Test

**Vraag:** Is declaratieve routing logischer dan hardcoded paths?

**Antwoord:** Ja, mits elke capability een formeel contract heeft:
- inputtype, outputtype, functie, foutconditie.
- Zonder contract = intentie, geen routering.

---

## Resultaat

```
✅ geldig (na herstel)
Reden: declaratieve routing is logischer dan hardcoded paths,
mits capabilities koppelen aan gedefinieerde contracten.
Elke capability heeft nu: input, output, function, errors, source.
Alle drie verwijzen naar stappen 01-02.
Geen losse claims zonder bron.
```
