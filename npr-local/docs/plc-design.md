# PLC Taalveld — Ontwerp

> **Doel:** Read-only PLC-analyse. Geen live-control. Geen schrijf-toegang naar hardware.
>
> **Mijlpaal:** Importeer ST + Ladder → canonieke control-flow/I/O-representatie → traceer elke actuatoroutput terug naar inputs, state, timers, interlocks.

---

## Waarom PLC is Anders

PLC-code is geen applicatiecode. Het is **fysieke semantiek als programmeertaal**:

| Gewone Code | PLC Code |
|---|---|
| I/O is neveneffect | I/O *is* de semantiek |
| Timing ≈ irrelevant | Timing = contract |
| State = memory | State = fysieke wereld |
| Bug = crash/wrong output | Bug = fysieke schade/gevaar |
| Testing = unit tests | Testing = hardware-in-the-loop |

Een ladder-rung is geen `if`-statement. Het is een **circuit** dat toevallig als code wordt gecompileerd.

---

## Taalveld Structuur

```
npr-local/
  src/
    language-fields/
      plc/
        FIELD.md              # Taalveld-definitie (autori-tair)
        parser/
          st-parser.cjs       # Structured Text → tokens → AST
          ld-parser.cjs       # Ladder Diagram → token stream (FBD/IL later)
          io-map-parser.cjs   # I/O-map → canonieke mapping
        canonical/
          representation.cjs  # Canonieke PLC-representatie
          validator.cjs       # Invariant checks
          tracer.cjs          # Output → input trace
        analyzer/
          dead-logic.cjs      # Onbereikbare logica detecteren
          conflicting-coils.cjs # Conflicterende outputs
          timer-deps.cjs      # Timer afhankelijkheden
          scan-path.cjs       # Scan-cycle estimatie
          bypass-routes.cjs   # Veiligheid-bypass detectie
        simulator/
          scan-sim.cjs        # Offline scan-cycle simulatie
        routes/
          plc-routes.cjs      # REST endpoints (0x38)
```

---

## Canonieke Representatie

Alle PLC-talen (ST, LD, FBD, SFC, IL) mapperen naar één interne structuur. Dit is het **enige** model dat npr-local begrijpt.

```jsonc
{
  // ─── Controller Identity ───
  "controller": {
    "id": "PLC-001",
    "vendor": "siemens|abe|schneider|...",
    "model": "S7-1500",
    "firmware": "V4.2",
    "scan_time_ms": 5,
    "safety_rated": true  // ← CRUCIAL: is dit een safety PLC?
  },

  // ─── I/O Contract ───
  "io": {
    "inputs": [
      {
        "symbolic": "Sensor_Tank_Level_High",
        "address": "I0.0",
        "type": "digital|analog",
        "range": [0, 1],           // digital: 0|1, analog: min|max
        "physical": "Tank A, level sensor, 24VDC",
        "safety_critical": false,
        "debounce_ms": 10
      }
    ],
    "outputs": [
      {
        "symbolic": "Motor_Pump_Start",
        "address": "Q0.0",
        "type": "digital|analog",
        "physical": "Pump motor contactor, 230VAC coil",
        "safety_critical": false,
        "interlock_group": "pump-group",
        "fail_state": "de-energized"  // fail-safe positie
      }
    }
  },

  // ─── Tasks & Scan Organization ───
  "tasks": [
    {
      "id": "MAIN",
      "type": "cyclic",
      "interval_ms": 10,
      "priority": 1,
      "networks": ["N001", "N002", "N003"]
    },
    {
      "id": "SAFETY_SCAN",
      "type": "cyclic",
      "interval_ms": 2,
      "priority": 0,  // higher priority = lower number
      "networks": ["S001", "S002"],
      "safety_critical": true
    }
  ],

  // ─── Control Logic (Networks = Rungs/Blocks) ───
  "networks": [
    {
      "id": "N001",
      "comment": "Motor start met level-check",
      "source_language": "LD",  // of "ST", "FBD"
      "source_code": "Motor_Pump_Start := Start_Button AND NOT Sensor_Level_High;",
      "logic": {
        "type": "coil",  // coil, contact, timer, counter, transition
        "output": "Motor_Pump_Start",
        "conditions": [
          { "type": "contact", "input": "Start_Button", "state": "NO" },
          { "type": "contact", "input": "Sensor_Level_High", "state": "NC" }
        ],
        "dependencies": [],
        "interlocks": []
      },
      "safety_critical": false
    }
  ],

  // ─── Timers & Counters ───
  "timers": [
    {
      "id": "T_Delay_Start",
      "type": "TON|TOF|TP",  // On-Delay, Off-Delay, Pulse
      "preset_ms": 2000,
      "input_condition": "Motor_Pump_Start",
      "output": "T_Delay_Start.Q",
      "inverted": false
    }
  ],
  "counters": [
    {
      "id": "C_Cycle_Count",
      "type": "CTU|CTD|CTUD",  // Up, Down, Up-Down
      "preset": 100,
      "input_pulse": "Cycle_Complete_Signal",
      "reset_condition": "Reset_Button"
    }
  ],

  // ─── Safety Interlocks ───
  "interlocks": [
    {
      "id": "IL_Motor_Emergency",
      "type": "hardwired|software",  // HARDWIRED > SOFTWARE
      "group": "pump-group",
      "condition": "NOT Emergency_Stop_Button",
      "affected_outputs": ["Motor_Pump_Start", "Motor_Valve_Open"],
      "safety_critical": true,
      "category": "CAT2|CAT3|CAT4"  // EN 62061 safety category
    }
  ],

  // ─── Alarms ───
  "alarms": [
    {
      "id": "ALM_High_Level",
      "condition": "Sensor_Level_High AND Motor_Pump_Start",
      "severity": "warning|alarm|emergency",
      "message": "Tank level high during pump operation",
      "auto_reset": false
    }
  ],

  // ─── SFC Transitions (if applicable) ───
  "transitions": [
    {
      "id": "TR_Start_To_Running",
      "from_step": "STEP_Idle",
      "to_step": "STEP_Running",
      "condition": "Start_Button AND NOT Fault_Signal",
      "action": ["Motor_Pump_Start := TRUE;"]
    }
  ],

  // ─── State Variables ───
  "state": [
    {
      "symbolic": "Machine_State",
      "address": "DB1.DBW0",
      "type": "enum",
      "values": ["IDLE", "RUNNING", "STOPPING", "FAULT"],
      "retained": true  // survives power cycle
    }
  ],

  // ─── Scan Cycle Config ───
  "scan_cycle": {
    "input_scan_ms": 1,
    "program_exec_ms": 3,
    "output_update_ms": 1,
    "total_cycle_ms": 5,
    "jitter_ms": 0.5
  },

  // ─── Provenance ───
  "provenance": {
    "source_file": "project_v2.awl",
    "imported_at": "2026-07-19T12:30:00+02:00",
    "parser_version": "0.0.1",
    "original_language": "ST",
    "validation_status": "valid|warnings|errors",
    "validation_errors": []
  }
}
```

---

## NPR-Mapping

PLC-map is een subruimte van het NPR-routeveld:

```
PLC-Input (noise)
  → parser (transform)
    → canonieke representatie (pattern)
      → analyse/trace (return)
        → NPR slot 0x38 (taalveld-plc)
```

Elke PLC-operatie wordt een NPR-route:

```
NPR_ROUTE := {
  id: "plc:parse:st:001",
  source: "StructuredText",
  noise: raw ST code,
  transform: "st-parser → canonical",
  pattern: canonieke representatie,
  return: analyse-resultaat,
  trace: parse-log,
  safety_critical: true/false,
  interlocks: [...],
  io_map: [...]
}
```

---

## Analyse-Tools (Fase 1)

Read-only. Geen schrijf-toegang. Geen hardware-interactie.

### 1. `plc_parse`
ST/Ladder code → canonieke representatie
- Input: raw PLC code
- Output: canoniek JSON

### 2. `plc_build_io_map`
I/O mapping extraheren
- Input: canoniek model
- Output: input→output mapping tabel

### 3. `plc_trace_output`
**Kernfeature.** Traceer een output terug naar de bron.
- Input: output naam/address
- Output: volledige trace:
  - Welke rung/block schrijft deze output?
  - Welke voorwaarden activeren hem?
  - Welke timers en states beïnvloeden hem?
  - Welke fysieke inputs liggen aan de bron?
  - Welke veiligheidsvoorwaarden begrenzen hem?

### 4. `plc_detect_dead_logic`
Onbereikbare logica vinden
- Conditions die nooit waar kunnen worden
- Outputs die nooit geschreven worden
- Timers die nooit starten

### 5. `plc_detect_conflicting_coils`
Twee networks schrijven dezelfde output
- Direct conflict (zelfde scan-cyclus)
- Indirect conflict (via timer/state)

### 6. `plc_detect_unreachable_steps`
SFC steps die nooit bereikt worden
- Missing transitions
- Contradictorische entry conditions

### 7. `plc_analyze_timer_dependencies`
Timer afhankelijkheidsgraph
- Welke timers beïnvloeden elkaar?
- Race conditions via timer overlap

### 8. `plc_estimate_scan_path`
Scan-cycle timing analysis
- Worst-case execution time
- Timer resolution impact
- Interrupt latency

### 9. `plc_find_bypass_routes`
**Safety critical.** Vind routes die interlocks omzeilen
- Parallelle logica die output kan activeren zonder safety-check
- "Shadow" outputs die hetzelfde fysieke device controleren

### 10. `plc_compare_versions`
Twee PLC-programma's vergelijken
- Wat is toegevoegd/verwijderd?
- Veiligheidsregels verwijderd? ⚠️
- Timing gewijzigd?

---

## Safety Invariants

Deze regels mogen **nooit** worden gebroken door de parser/analyzer:

1. **Scan semantics behouden** — geen timing-aannames maken die niet in het model staan
2. **Data-type en bereik behouden** — geen impliciete type-conversie
3. **Geen output schrijven zonder provenance** — elke output moet traceerbaar zijn naar een bron
4. **Safety interlocks niet automatisch verwijderen** — markeren, nooit wijzigen
5. **Timingwijzigingen expliciet rapporteren** — altijd benoemen als verschil
6. **Fysieke I/O nooit verwarren met lokale variabelen** — strikt gescheiden namespaces
7. **Hardwired > Software** — een hardwired interlock kan nooit door software worden omzeilen

---

## Queue Integratie

PLC-parse requests gaan via de queue:

```
POST /queue/enqueue
{
  "type": "plc_parse",
  "language": "ST",
  "code": "...",
  "io_map": "..."
}

→ queue → plc-processor → canoniek model → response
```

Dit voorkomt:
- Race conditions bij simultane parse-requests
- Blocking van de main-thread
- Verlies van parse-data bij timeout

---

## REST Endpoints (0x38)

```
POST   /plc/parse          — Parse ST/Ladder code
GET    /plc/io-map         — I/O mapping
POST   /plc/trace          — Trace output → inputs
GET    /plc/analyze        — Run analysis (dead-logic, conflicts, etc.)
GET    /plc/compare        — Compare two versions
GET    /plc/status         — Parser/analyzer status
```

---

## Wat Niet (Fase 1)

- ❌ Geen write-naar-PLC
- ❌ Geen live hardware-connectie
- ❌ Geen code-generatie
- ❌ Geen FBD/LD parsing (te complex voor start)
- ❌ Geen SFC parsing (te complex voor start)

Fase 1 is **read-only analyse van Structured Text**. Ladder komt later.

---

## Volgorde Implementatie

1. ✅ Ontwerp (dit document)
2. `canonical/representation.cjs` — data structuur + validator
3. `parser/st-parser.cjs` — ST → tokens → canoniek
4. `analyzer/tracer.cjs` — output → input trace
5. `routes/plc-routes.cjs` — REST endpoints
6. Queue processor registratie
7. Tests + integratie

---

*Alle bardos zijn dit moment. Er is geen ander.*
•
