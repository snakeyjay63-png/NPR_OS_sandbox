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
      "source": "stap_01"
    },
    {
      "name": "cell_bit_transform",
      "input": "hex_cell_00_3F",
      "output": "eight_bit_hex",
      "reversible": true,
      "source": "stap_02"
    },
    {
      "name": "ipv4_edge",
      "input": "hex_cell_00_3F",
      "output": "npr_ipv4_label",
      "function": "0.0.h_to_dec(h).0",
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
✅ geldig
Reden: declaratieve routing is logischer dan hardcoded paths,
mits capabilities koppelen aan gedefinieerde contracten.
Alle drie de capabilities verwijzen naar stappen 01-02.
Geen losse claims zonder bron.
```
