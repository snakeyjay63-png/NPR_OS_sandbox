# Stap 26: Veld-Orchestrator

**Doel:** Actief veld dat alle vorige stappen verbindt in één werkend integratiepunt. De orchestrator is de "levende kern" van NPR-OS.

**Afhankelijkheid:** Stap 17–25 (volledige stack).

---

## 1. Wat De Orchestrator Is

Niet een framework. Niet een runtime. Een **actief veld** dat:

```
input → detect → encode → validate → route → project → return
```

Elke stap is optioneel. De orchestrator kiest de juiste modules based op input-type en context.

---

## 2. Kernprincipe: Actief Veld

```
veld_orchestrator := {
  modules: [step_17..25],
  state: NULL_STATE_TYPE,       // altijd begint/ends bij 0.0.0.0
  pipeline: dynamic,            // kiest route based op input
  modalities: [beeld, geluid, licht, wiskundig],  // stap 25 brug
}
```

Het veld is:
- **Actief** — verwerkt, niet pasief opslaan
- **Dynamisch** — kiest route based op input-type
- **Cyclisch** — Noise → Pattern → Return → NULL_STATE
- **Modal** — base64 brug naar beeld/licht/geluid/wiskundig

---

## 3. Pipeline Architectuur

```
┌─────────────────────────────────────────────────────────┐
│                   VELD-ORCHESTRATOR                      │
│                                                         │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐            │
│  │  INPUT  │ →  │  ROUTE   │ →  │  PROCESS│            │
│  └─────────┘    └──────────┘    └─────────┘            │
│       ↑                              │                  │
│       │                              ▼                  │
│  ┌─────────┐    ┌──────────┐    ┌─────────┐            │
│  │  RETURN │ ←  │  PROJECT │ ←  │  OUTPUT │            │
│  └─────────┘    └──────────┘    └─────────┘            │
│                                                         │
│  NULL_STATE_TYPE (0.0.0.0) als begin/einde              │
└─────────────────────────────────────────────────────────┘
```

**Routes:**
- `NPR_ENCODE` — stap 17: text/integer/ipv6/git → hex → NPR
- `NPR_ROUTE` — stap 20: context-gedreven permutatie
- `NPR_CIPHER` — stap 20: AES-256-GCM met AAD
- `NPR_VALIDATE` — stap 21: driefasen-validatie
- `NPR_POLYGLot` — stap 22: taalbeleid check
- `NPR_EVOLUTION` — stap 23: hardware-taal cyclus
- `NPR_NULL` — stap 24: 0.0.0.0 grensstaat
- `NPR_ART` — stap 25: betekenisdensiteit + base64 brug

---

## 4. Interface

```
orchestrator.process(input, context) → {
  route: string,           // gekozen route
  module: string,          // gebruikte module
  result: any,            // output
  cycle: {                // NPR-cyclus
    noise: any,
    pattern: any,
    return: any,
  },
  nullState: boolean,     // is begin/einde NULL_STATE
}
```

---

## 5. Implementatie

```
✅ field-orchestrator.cjs
✅ Dynamic route selection
✅ NPR cycle tracking
✅ Base64 bridge integration
✅ Module registry (stap 17-25)
✅ NULL_STATE enforcement
```

---

## Check: 2026-07-18
- Status: Stap 26 concept ✅
- Kern: actief veld, niet framework
- Routes: 8 dynamische routes
- Integratie: stap 17-25
- NULL_STATE: altijd begin/einde
- Base64 brug: stap 25 modaliteiten
