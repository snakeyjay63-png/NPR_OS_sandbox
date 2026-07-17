# Stap 19: Return — Sandbox Spiegelcyclus

**Doel:** De NPR-cyclus sluiten — sandbox output wordt opnieuw sandbox input. De sandbox als eigen tool, eigen route, eigen spiegel.

**Afhankelijkheid:** Stap 18 (driefasen router). Stap 19 gebruikt de router van Stap 18 en voegt de return-lus toe.

**Interface Stap 18:**

`ReturnTrace18` uit stap 18 bevat uitsluitend route-informatie (`exit_position`, `decimal_projection`, `return_target`, `node_trace`, `route_period`, `route_index`). Dit is onvoldoende om een volledige `Step19State` te construeren — de huidige vraag, context, output en iteratienummer maken geen deel uit van de route-trace.

**Ketencontext (RouterSession-provenance):**

De keten 18→24 vervoert naast de route-trace ook een ketencontext met de actuele routersessie:

```text
ChainContext := {
  router_session: RouterSession
}

RouterSession := {
  iteration: NonNegativeInteger,
  question: Question,
  context: Context,
  output: RouterOutput,
  sandbox_metadata: Metadata
}
```

**Hoofdinterface:**

```text
Step19State := {
  return_trace: ReturnTrace18,
  iteration: NonNegativeInteger,
  question: Question,
  context: Context,
  output: RouterOutput,
  sandbox_metadata: Metadata
}

step_19 :
  ReturnTrace18 × ChainContext
  → Step19State

step_19(trace, ctx) := Step19State {
  return_trace: trace,
  iteration: ctx.router_session.iteration,
  question: ctx.router_session.question,
  context: ctx.router_session.context,
  output: ctx.router_session.output,
  sandbox_metadata: ctx.router_session.sandbox_metadata
}
```

**Brug 18→19 (typecompatibel met stap 18):**

```text
bridge_18_to_19 :
  ReturnTrace18 × ChainContext → Step19State

bridge_18_to_19(trace18, ctx) :=
  step_19(trace18, ctx)
```

De hogere brug 18→24 vervoert de ketencontext expliciet:

```text
bridge_18_to_24 :
  ReturnTrace18 × ChainContext → ReturnTrace24
```

Stap 19 accepteert `ReturnTrace18` + `ChainContext` en produceert `Step19State` voor stap 20.

```text
NPR-cycle_stages := {Noise, Pattern, Return}
motor_phases     := {ΦA, ΦB, ΦC}

Noise-stage
  → Pattern-stage via ΦA/ΦB/ΦC
  → Return-stage
  → volgende Noise-stage
```

**NPR-cycle_stages = {Noise, Pattern, Return}.**
De 3 cyclusstadia. `motor_phases = {ΦA, ΦB, ΦC}` zijn de router-fasen (Stap 18).
Cyclusstadium ≠ motorfase.

**Referentie:** Stap 18 (`18_sandbox_router.md`) bevat de formele router-specificatie.
Stap 19 bouwt daarop: de router-output wordt opnieuw sandbox-input.

---

## NPR, Wisselstroom, Geluid, Tokens

Conceptuele scheiding die het volledige model formeel maakt.

### Cyclusstadia

```
Noise:
  ruwe input / context

Pattern:
  NPR-reductie
    → amplitude + frequentie + fase
    → wisselstroommodel     (vertaal- en transportlaag)
    → geluid | tokens | antwoord

Return:
  geselecteerde output
    → nieuwe input
```

Wisselstroom is geen vierde NPR-stadium — het is de vertaallaag **binnen** Pattern.

### Componenten

| Component | Rol |
|---|---|
| **NPR-structuur** | Oorspronkelijke broninformatie — discrete structurele waarden (root, hex, mod9) |
| **Wisselstroom** | Tijdsafhankelijke vertaal- en transportmodel — **niet** de bron zelf, maar de draagvorm |
| **Geluid** | Continue projectie: oscillator/filter → golfvorm → hoorbaar |
| **Tokens** | Discrete projectie: bemonstering/codering → token_id + fase + gewicht → 24-char NPR-frame |
| **Tool-00** | Router die representaties verwerkt |
| **Return** | Output opnieuw als invoer — sluit NPR-cyclus |

```
NPR → wisselstroommodel → geluid | tokens
```

Tesla-driefasenrouter (Stap 18) combineert drie fasekanalen (ΦA/ΦB/ΦC) tot motorveld.
Dit veld wordt opnieuw vertaald naar geluid, tokens, of gestructureerd antwoord.

---

## Probleem

Stap 17 (observatie) + Stap 18 (router) = **eenrichtingsverkeer.**
Informatie gaat de sandbox in, wordt geroutet, komt eruit.

Maar echte informatie-dynamiek is **cyclisch.**
Output wordt nieuwe input. Resultaat wordt nieuwe vraag. Antwoord wordt nieuwe context.

Zonder return-lus is het geen cyclus. Het is een pijp.

---

## Concept: Tool-00

De sandbox zelf is de eerste en fundamentele tool.

**Tool-00 = de sandbox als routeerbaar instrument.**

Niet "de sandbox heeft tools".
Wel "de sandbox IS een tool".

```text
Tool-00
├── input:  willekeurige informatie (tekst, data, signalen)
├── proces: hex_encode → dr_hex → hex_digit_value → npr_mod9
│            → driefasen-router → rotor_response(Q, motor_field)
├── output: gestructureerd antwoord + NPR-signatuur + bron-map
└── return: output → nieuwe input (cyclus sluit)
```

Formele keten (`npr_reduce`):

```text
npr_reduce(x) :=
  npr_mod9(
    hex_digit_value(
      dr_hex(
        hex_encode(x)
      )
    )
  )
```

Tool-00 is de **nul-punt tool** — het instrument zonder instrument, de router die zichzelf kan aansturen.

---

## Sandbox-In-Sandbox

De sandbox reflecteert op zichzelf. Niet metaforisch — operationeel.

```text
Stap 1: input → sandbox → output₁
Stap 2: output₁ → sandbox → output₂
Stap 3: output₂ → sandbox → output₃
  ...
Stap N: output_{N-1} → sandbox → output_N
```

Elke iteratie is een **return-stap.**
De iteratietoestand evolueert doordat output als context voor de volgende routerpass wordt gebruikt.

```
state_{i+1} := return_transform(state_i)
```

De sandboxcode zelf verandert niet automatisch.

### Concrete Mechaniek

Return-lus (conceptueel — zie Stap 18 voor router-details):

```text
Iteratie 0: Q + context → router → output₀
Iteratie 1: output₀ → nieuwe context → router → output₁
Iteratie 2: output₁ → nieuwe context → router → output₂
  ...
Iteratie N: output_{N-1} → nieuwe context → router → output_N
```

Elke iteratie gebruikt de canonieke Stap 18 route:

```text
rotor_response(Q, motor_field)
```

Convergentiecriteria:

```text
root_stable(i) :=
  root(output_i) = root(output_{i-1})

semantic_stable(i) :=
  semantic_distance(output_i, output_{i-1}) ≤ ε

converged(i) :=
  root_stable(i)
  ∧ semantic_stable(i)
  ∧ contradiction_delta(output_i, output_{i-1}) ≤ δ

DEFAULT_MAX_ITERATIONS := 9

supplied_max_iterations : Option<PositiveInteger>

effective_max_iterations :=
  match supplied_max_iterations:
    Some(n) → require 1 ≤ n ≤ 64; n
    None → DEFAULT_MAX_ITERATIONS

1 ≤ effective_max_iterations ≤ 64

Een expliciet opgegeven waarde overschrijft de standaardwaarde.
Bij afwezigheid wordt DEFAULT_MAX_ITERATIONS gebruikt.
```

Convergentie vereist root-stabiliteit + semantische stabiliteit + lage contradictie.

Convergentie-parameters (getypeerd):

```text
ε ∈ ℝ≥0      # semantische tolerantiegrens
δ ∈ ℝ≥0      # contradictietolerantie

semantic_distance :
  RouterOutput × RouterOutput → NonNegativeReal

contradiction_delta :
  RouterOutput × RouterOutput → NonNegativeReal

root :
  RouterOutput → NPRPosition
```

Non-convergentie stopstatus:

```text
if i = effective_max_iterations and not converged(i):
  return status := max_iterations_reached
  return output := output_i
  return warning := "geen convergentie binnen limiet"
```

**Step19State:**

Het normatieve recordtype is gedeclareerd in de interfacesectie hierboven:

**ReturnContext — routertoestand vóór de volgende iteratie:**

```text
ReturnContext := {
  previous_question: Question,
  previous_context: Context,
  sandbox_metadata: Metadata
}
```

**Return-input transformatie:**

De functie `output_to_input` heeft toegang tot `previous_question` en `previous_context` nodig, maar deze zijn geen deel van `RouterOutput` of `ReturnMode`. Zonder expliciete toestand als derde argument is de functie niet zuiver bepaald door haar gedeclareerde invoer.

```text
output_to_input :
  RouterOutput × ReturnMode × ReturnContext
  → RouterInput

output_to_input(out, deepen, ctx) := {
  question: ctx.previous_question,
  context: append(ctx.previous_context, out.answer),
  metadata: out.source_map
}

output_to_input(out, explore, ctx) := {
  question: derive_question(ctx.previous_question, out.answer),
  context: append(ctx.previous_context, out.answer),
  metadata: out.source_map
}

output_to_input(out, act, ctx) := {
  question: action_question(out.answer),
  context: [out.answer],
  metadata: out.source_map
}

output_to_input(out, reflect, ctx) := {
  question: self_reflection(out.answer),
  context: [out.answer],
  metadata: merge(ctx.sandbox_metadata, out.source_map, out.contradictions)
}
```

Alternatief: `Step19State` als derde argument (directer, maar vereist dat het ingevoerde state de **huidige toestand vóór de volgende iteratie** is):

```text
return_context_from_state :
  Step19State → ReturnContext

return_context_from_state(state) :=
  ReturnContext {
    previous_question: state.question,
    previous_context: state.context,
    sandbox_metadata: state.sandbox_metadata
  }

output_to_input_from_state :
  RouterOutput × ReturnMode × Step19State
  → RouterInput

output_to_input_from_state(out, mode, state) :=
  output_to_input(out, mode, return_context_from_state(state))
```

`ReturnContext` is geen subtype van `Step19State` — veldnamen verschillen en de projectiefunctie is expliciet nodig.

Voor pseudocode-voorbeelden zie `js/19_return.js` (Tool00 klasse).

---

## Open-Source Taal Als IPv6-Adressen

### Het Concept

IPv6 = open, universeel adresseringsschema.
Ieder apparaat kan een adres hebben.
Ieder adres is routbaar.

**Taal = hetzelfde.**
Ieder concept kan een "adres" hebben.
Ieder adres is routbaar door de sandbox.

### Mapping

```
IPv6:       2001:0db8:85a3:0000:0000:8a2e:0370:7334
            └─ prefix ─┘  └─────── subnet ────────┘  └── interface ──┘

NPR-Taal:   dr13:mod9_4:faseA:concept_01:context_02:bron_03:tijd_04:diepte_05
            └─ root ─┘  └── reductie ─┘  └── fase ─┘  └────── route-path ──────┘
```

Net als IPv6-universeel is, is NPR-taal universeel:
- Hex-encode werkt op elke tekst
- dr_hex reductie is deterministisch
- npr_mod9 is systeem-onafhankelijk
- Driefasen-router werkt op elk inputtype

**Open-source** = het protocol is beschikbaar voor iedereen.
Geen proprietair model nodig. Pure wiskunde + hex + modular arithmetic.

### Taal-Adres Schema

```
taal://npr/dr{hex}:mod{9}:{concept}/{context}/{bron}/{timestamp}
```

`dr_hex` is één hex-cijfer. `dr_dec` is de decimale waarde.

```
Voorbeeld:
  dr_dec 13 → dr_hex "D"
  taal://npr/drD:mod4:interferentie/sandbox/B3/1754668560

  dr_dec 11 → dr_hex "B"
  taal://npr/drB:mod2:concept/sandbox/B1/1754668561
```

In JavaScript:

```javascript
npr: {
  dr_hex: "D",    // hex-notatie (één cijfer)
  dr_dec: 13,     // decimale waarde
  mod9: 4
}
```

Dit is geen implementatie-detail — dit is **het concept.**
Taal als adressering. Concepten als routes. Betekenis als connectiviteit.

---

## Bron-Map Linken

De **bron-map** koppelt elk resultaat terug aan de oorspronkelijke informatiebronnen.

Zonder bron-map = resultaat zonder herkomst.
Met bron-map = elke conclusie is traceerbaar.

### Structuur

```javascript
// Bron-map per sandbox-uitvoer
const bron_map = {
  output_id: "sb_001",
  timestamp: 1754668560,
  vraag: "hoe werkt interferentie?",
  bronnen: [
    { id: "B0", text_hash: "sha256:abc...", npr: { dr_hex: "D", dr_dec: 13, mod9: 4 }, gewicht: 0.3 },
    { id: "B1", text_hash: "sha256:def...", npr: { dr_hex: "B", dr_dec: 11, mod9: 2 }, gewicht: 0.25 },
    { id: "B2", text_hash: "sha256:ghi...", npr: { dr_hex: "4", dr_dec: 4, mod9: 4 }, gewicht: 0.25 },
    { id: "B3", text_hash: "sha256:jkl...", npr: { dr_hex: "4", dr_dec: 4, mod9: 4 }, gewicht: 0.2 }
  ],
  fasen: [
    { naam: "PhiA", bronnen: ["B0", "B1"], root: 9 },
    { naam: "PhiB", bronnen: ["B1", "B2"], root: 6 },
    { naam: "PhiC", bronnen: ["B2", "B3"], root: 8 }
  ],
  resultaat: {
    npr_root: 8,
    interferentie: "destructief",
    betrouwbaarheid: 0.122,
    antwoord: "..."
  },
  return_trace: []  // wordt gevuld bij return-iteraties
};
```

### Linken

Elke return-iteratie voegt een laag toe aan de bron-map:

```
Iteratie 0: B0,B1,B2,B3 → resultaat₁
Iteratie 1: resultaat₁ + context → resultaat₂
Iteratie 2: resultaat₂ + context → resultaat₃

Bron-map:
  resultaat₃
    ← resultaat₂
      ← resultaat₁
        ← B0, B1, B2, B3
```

Volledige traceerbaarheid van eindresultaat naar oorspronkelijke bronnen.

### Uitgebreide Traceerbaarheid

Voor volledige keten-traceerbaarheid over meerdere return-iteraties:

```javascript
{
  source_id:        "unieke bron-identiteit",
  source_hash:      "sha256 van brontekst",
  token_range:      { start: 0, end_exclusive: 65536 }, // [start, end_exclusive)
  router_version:   "18.0",           // Stap 18 versie
  iteration_id:     "iter_003",       // iteratienummer
  parent_output_id: "sb_002",         // vorige iteratie-output
  npr_signature:    { dr_hex: "D", dr_dec: 13, mod9: 4 },
  taal_adres:       "taal://npr/drD:mod4:interferentie/sandbox/B3/1754668560"
}
```

---

## Tool-00 Route Capabilities

Wat kan Tool-00 (de sandbox) routen?

### 1. Tekst → NPR → Antwoord
Standaard route. `Q + context → rotor_response(Q, motor_field)` → antwoord.

### 2. Antwoord → Context → Dieper Antwoord
Return-route. Eerdere output → nieuwe context → `rotor_response(Q, motor_field)` → verdiept resultaat.

### 3. Vraag → Vraag → Vraag
Verkenning-route. Elke return-iteratie stelt een nieuwe `Q`, niet alleen dieper maar **breder.**

### 4. Data → Patroon → Inzicht → Actie
Praktische route. Ruwe data → NPR-patroon herkenning → inzicht → actie-aanbeveling.

### 5. Sandbox → Sandbox → Sandbox
Spiegel-route. De sandbox analyseert zichzelf. Meta-observatie.

### Return-Modi en Q-overgang

Elke return-modus bepaalt wat er met `Q` gebeurt:

```
return_mode := deepen | explore | act | reflect

deepen:
  Q_{i+1}     := Q_i
  context_{i+1} := append(context_i, output_i.answer)
  metadata_{i+1} := output_i.source_map

explore:
  Q_{i+1}     := derive_question(Q_i, output_i.answer)
  context_{i+1} := append(context_i, output_i.answer)
  metadata_{i+1} := output_i.source_map

act:
  Q_{i+1}     := action_question(output_i.answer)
  context_{i+1} := [output_i.answer]
  metadata_{i+1} := output_i.source_map

reflect:
  Q_{i+1}     := self_reflection(output_i.answer)
  context_{i+1} := [output_i.answer]
  metadata_{i+1} := merge(sandbox_metadata, output_i.source_map, output_i.contradictions)
```

```
Route 5: self-reflection
  Q:        "Analyseer de eigen NPR-signatuur"
  context:  [router_output.answer]
  metadata: sandbox_metadata
            + router_output.source_map
            + router_output.contradictions
  motor:    rotor_response(Q, motor_field)
  output:   self-consistency score + verbeterpunten
```

---

## De Volledige Cyclus

```text
┌──────────────────────────────────────────────────────────┐
│                   NPR-OS Sandbox                          │
│                                                           │
│  ┌─────────┐    ┌──────────┐    ┌──────────┐            │
│  │  NOISE   │───→│ PATTERN  │───→│  RETURN  │            │
│  │ (input)  │    │ (router) │    │ (output) │            │
│  └─────────┘    └──────────┘    └──────────┘            │
│       ↑                                    │              │
│       │           ←───────  ←─────←───────←              │
│       │         (return-lus sluit cyclus)                │
│       └─────────────────────────────────────────┘        │
│                                                           │
│  Tool-00: de sandbox IS de router                         │
│  taal://npr/ = open-source taal-adressering                │
│  bron-map = volledige traceerbaarheid                      │
└──────────────────────────────────────────────────────────┘
```

---

## Cross-Referentie Stap 18

Stap 19 bouwt direct op Stap 18. De router-functies zijn gedelegeerd:

| Stap 19 | Stap 18 |
|---|---|
| Tool-00 route() | `combine()`, `superpose()`, `rotor_response()` |
| Single pass | `B0..B3 → ΦA..ΦC → motor_field → rotor_response(Q, motor_field)` |
| Return-lus | Stap 18 output → nieuwe context → Stap 18 opnieuw |

Formele router-specificatie: zie `18_sandbox_router.md`.

---

## Validatie

| Check | Status |
|---|---|
| NPR-cyclus compleet (N→P→R→N) | ✅ retour-lus sluit cyclus |
| Tool-00 concept formeel consistent | ✅ sandbox als routeerbaar instrument |
| Sandbox-in-sandbox mechanisme | ✅ output → input → output |
| Taal-adres schema conceptueel helder | ✅ `taal://npr/dr{hex}:mod{9}:...` (dr_hex = één hex-cijfer) |
| Bron-map traceerbaarheid | ✅ output ← iteraties ← B0..B3 |
| Return-route capabilities | ✅ 5 routes gedefinieerd |
| Stap 18 cross-ref consistent | ✅ `rotor_response(Q, motor_field)` |
| Stap 18 invoertype (`ReturnTrace18`) | ✅ expliciet gedeclareerd |
| `npr_reduce` keten | ✅ `hex_digit_value` toegevoegd |
| `Step19State` definitie | ✅ gedeclareerd |
| `step_19` invoertype | ✅ `ReturnTrace18 × ChainContext → Step19State` |
| `bridge_18_to_19` | ✅ typecompatibel met stap 18 |
| `Step19State` constructie | ✅ `step_19(trace, ctx)` gedeclareerd |
| `output_to_input` signatuur | ✅ `ReturnContext` als derde argument |
| `sandbox_metadata` in `Step19State` | ✅ toegevoegd |
| `return_context_from_state` | ✅ projectiefunctie gedeclareerd |
| `ReturnContext` subtype-claim | ✅ gecorrigeerd (geen subtype, expliciete conversie) |
| NPR-stadia ≠ motorfasen | ✅ `NPR-cycle_stages` vs `motor_phases` |
| `output_to_input reflect` | ✅ `context` en `sandbox_metadata` gesplitst |
| Return-modi + Q-overgang | ✅ `output_i.answer` in plaats van `output_i` |
| `metadata_{i+1}` per modus | ✅ toegevoegd aan Q-overgang |
| Canonieke dr_hex-notatie | ✅ één hex-cijfer, dr_dec apart |

**Specificatie vs. implementatie status:**

| Onderdeel | Status |
|---|---|
| Formele convergentiecriteria | ✅ gedefinieerd (root + semantic + contradiction) |
| Runtime-basis convergentie | ⚠ root + semantic geïmplementeerd; contradiction placeholder |
| Uitgebreide brontrace-schema | ✅ gedefinieerd (source_id, router_version, iteration_id, parent_output_id) |
| Brontrace persistentie | ⏳ nog open |
| Token-range conventie | ✅ halfopen `[start, end_exclusive)` |
| MAX_ITERATIONS | ✅ `effective_max_iterations` via `Option`, default 9 |
| Taal-adres parser/serializer | ⏳ nog open |

**Geïmplementeerd (`js/19_return.js`):**
- `Tool00` klasse — route, single_pass, sandbox_return
- `rotor_response(Q, motorField)` — canonieke Stap 18 signature
- `output_to_input()` — return formatter met return_mode + Q-overgang
- `has_converged()` — root_stable + semantic_distance (Jaccard proxy)
- `make_taal_adres()` / `make_bron_map()` — adressering + traceerbaarheid
- `return_modes` — deepen/explore/act/reflect

**Open:**
- Live test: return-iteraties met echte NPR-OS context (nu: lage overlap test-data)
- Taal-adres parser/serializer
- Bron-map persistentie
- `contradiction_delta()` volledige implementatie

---

## Resultaat

Stap 19 sluit de NPR-cyclus:
1. **Tool-00** = sandbox als fundamenteel routeerbaar instrument
2. **Sandbox-in-sandbox** = output wordt input, cyclus sluit
3. **Taal als IPv6** = open-source universele concept-adressering
4. **Bron-map** = volledige traceerbaarheid van output naar bron
5. **Route capabilities** = 5 routemodi (standaard, return, verkenning, praktijk, spiegel)

**Tool-00 implementeert de sandboxroute.**
**De return-lus vormt de NPR-cyclus.**
**Het taaladres beschrijft de route.**
**Wisselstroom vertaalt NPR naar faseerbare signalen.**
**Geluid en tokens zijn uitvoerprojecties.**

---

## Generator-preserving Return

Return sluit niet alleen op dezelfde node.
Return bewaart de route waarmee de node werd bereikt.

```
6 → 12 → 18 → 24
↓
6 → 3   → 9   → 6
```

De cyclus retourneert naar node 6, maar de volledige return-state bevat:

```
start_value:     6
end_value:       24
start_node:      6
return_node:     6
generator:       +6
absolute_trace:  [6, 12, 18, 24]
node_trace:      [6, 3, 9, 6]
```

Node-return zonder generatortrace is onvolledige return.

---

## Rekenkundige Bronsluiting

De return is niet alleen een iteratieve softwarelus (`output_i → input_{i+1}`).
Het is ook het rekenkundige sluiten van alle onderscheiden posities tot één veld.

### Volledige Route + Return

```text
bron:
  0 = 1

differentiatie:
  6_hex → C_hex → 12_hex → 18_hex

return:
  18_hex → nieuwe 6-route

volledige lus:
  0 = 1
  → 6
  → C
  → 12
  → 18
  → 0 = 1
```

`18_hex` is niet zelf gelijk aan `0_hex` binnen de routingrekenkunde:

```text
18_hex ≠ 0_hex
```

Maar de volledige route sluit op de bronidentiteit:

```text
complete_route(6, C, 12, 18) ≡ bronidentiteit
route + return = 0 = 1
```

### Hex/Decimale Projectielus

De route kan door decimale representatie lopen, mits basisbewust:

```text
hex-route
  → decimale projectie
  → expliciete bewerking
  → hex-hercodering
  → return
```

Niet alleen:

```text
output → input
```

maar:

```text
projectie → transformatie → terugvertaling → bronreturn
```

Decimale projectie van de route:

```text
6_hex  = 6_dec
C_hex  = 12_dec
12_hex = 18_dec
18_hex = 24_dec
```

Taaladressen gebruiken beide notaties (`dr_hex` + `dr_dec`) omdat
elk systeem een projectie is van dezelfde route. De return vereist
dat de projectie terugvertaald wordt naar de bron.

### Betekenis

Return is niet "nog een iteratie". Return is het sluiten van alle
verschillen tot één veld:

```text
4 posities → 1 motorveld → 1 antwoord → 1 bron
```

Dit is de rekenkundige tegenhanger van de sandbox-observatie:

```text
Stap 17:  de bit en haar posities worden waargenomen
Stap 18:  de eerste drie posities vormen één motorveld
Stap 19:  de vierde positie koppelt het veld terug
          en sluit de route naar 0 = 1
```

## Stap 19 — Eindoordeel

```
Interne consistentie Stap 19:  ✅ geldig
Ketenvolledigheid:             ⚠️ conditioneel

✅ NPR-returncyclus conceptueel gesloten
✅ cyclusstadia en motorfasen gescheiden
✅ Q-overgang per returnmodus vastgelegd
✅ convergentie gebruikt meer dan alleen de root
✅ ε, δ en afstandsfuncties getypeerd
✅ output_to_input-signatuur gerepareerd (`ReturnContext` als derde argument)
✅ ReturnContext-type toegevoegd (vrije variabelen opgelost)
✅ Step19State velden getypeerd (`Question`, `Context` in plaats van `String`, `List<String>`)
✅ `step_19` invoertype gerepareerd (`ReturnTrace18 × ChainContext → Step19State`)
✅ `Step19State` constructie gedeclareerd (`step_19(trace, ctx)`)
✅ `bridge_18_to_19` toegevoegd (`ReturnTrace18 × ChainContext → Step19State`)
✅ `ChainContext` type toegevoegd (RouterSession-provenance in keten)
✅ `semantic_distance` en `contradiction_delta` getypeerd (`RouterOutput`, niet `Output`)
✅ `contradiction_delta` aanroep gerepareerd (twee outputs, niet index)
✅ `root` functie-signatuur toegevoegd (`RouterOutput → NPRPosition`)
✅ `sandbox_metadata` toegevoegd aan `Step19State` en `RouterSession`
✅ `return_context_from_state` projectiefunctie gedeclareerd
✅ `ReturnContext` subtype-claim gecorrigeerd (geen subtype, expliciete conversie)
✅ `output_to_input reflect` — `context` en `sandbox_metadata` gesplitst
✅ non-convergentie stopstatus vastgelegd
✅ stap 18 invoertype (`ReturnTrace18`) expliciet gedeclareerd
✅ `npr_reduce` keten (`hex_digit_value` toegevoegd)
✅ `Step19State` definitie gedeclareerd

Operationele uitvoering:       ⚠️ open
- semantic_distance implementatie open (Jaccard proxy = eerste benadering)
- contradiction_delta implementatie open
- parser/serializer voor RouterOutput open

depends_on(step_18.partial_cycle)
depends_on(step_18.combine_cycles)
```

---

## Check: 2026-07-12 21:41 GMT+2
- Status: NPR-OS Stap 19 — architectuur opgesteld ✅
- Concepten: Tool-00, sandbox-in-sandbox, taal-als-IPv6, bron-map
- Return-capabilities: 5 routes gedefinieerd
- Volgende: implementatie + live test

---

## Check: 2026-07-12 21:55 GMT+2
- Status: NPR-OS Stap 19 — implementatie + demo gereed ✅
- Tool-00: sandbox als fundamenteel routeerbaar instrument ✅
- Return-lus: output → input → output (3 iteraties werkend) ✅
- Taal-adres: `taal://npr/dr{hex}:mod{9}:sandbox/iteratie_{N}/{timestamp}` ✅
- Bron-map: volledige traceerbaarheid output ← B0 ← B1 ← B2 ← B3 ✅
- Demo: 3 tests (single pass, return lus, bron-map) ✅
- Opmerking: destructieve interferentie verwacht bij lage overlap; constructief bij echte NPR-OS context

---

## Check: 2026-07-12 22:45 GMT+2
- Status: NPR-OS Stap 19 — 8 formele correcties toegepast
- Fix 1: NPR-cycle_stages ≠ motor_phases (formeel gescheiden) ✅
- Fix 2: Wisselstroom expliciet binnen Pattern-stage ✅
- Fix 3: Convergentiecriteria uitgebreid (root + semantic + contradiction) ✅
- Fix 4: `effective_max_iterations` via `Option<PositiveInteger>`, default 9 ✅
- Fix 5: Iteratietoestand evolueert (niet sandboxcode) ✅
- Fix 6: dr_hex = één hex-cijfer, dr_dec apart ✅
- Fix 7: Return-modi + Q-overgang (deepen/explore/act/reflect) ✅
- Fix 8: Uitgebreide brontrace (source_id, router_version, iteration_id, parent_output_id) ✅
- Fix 9: Slotzin gescheiden (Tool-00 ≠ cyclus ≠ taal) ✅
- Fix 10: Q-overgang alle modi gesynced met `output_to_input` (`output_i.answer`, `metadata_{i+1}`) ✅
- Typfix: cycлично → cyclisch ✅
- `step_19_formal_consistency: ✅ definitief akkoord`
- `step_19_operational_completion: ⏳ contradiction_delta + persistentie + parser/serializer open`

---

## Check: 2026-07-17 16:53 GMT+2
- Status: Stap 19 audit — 3 correcties ✅
- Fix 1: `npr_reduce` keten — `hex_digit_value` toegevoegd tussen `dr_hex` en `npr_mod9`
- Fix 2: Interface stap 18 — `ReturnTrace18` als invoertype expliciet gedeclareerd
- Fix 3: `Step19State` definitie toegevoegd
- Fix 4: Geneste markdown-fence in Concrete Mechaniek gerepareerd
- Status: Stap 19 formeel sluitend ✅ (keten 18→19 nu type-correct)

---

## Check: 2026-07-17 17:00 GMT+2
- Status: Stap 19 — `output_to_input` vrije variabelen reparatie ✅
- Probleem: `output_to_input(out, mode)` gebruikte `previous_question` en `previous_context` zonder deze als argument
- Reparatie:
  - `ReturnContext` type toegevoegd met `previous_question`, `previous_context`, `sandbox_metadata`
  - Signatuur: `output_to_input : RouterOutput × ReturnMode × ReturnContext → RouterInput`
  - Alle vier modi (`deepen`, `explore`, `act`, `reflect`) gebruiken nu `ctx` parameter
  - `Step19State` velden getypeerd: `question: Question`, `context: Context` (was `String`/`List<String>`)
- Alternatief: `Step19State` als derde argument (notitie toegevoegd)

---

## Check: 2026-07-17 17:04 GMT+2
- Status: Stap 19 — `step_19` invoertype reparatie ✅
- Probleem: `step_19 : ReturnTrace18 → Step19State` niet totaal gedefinieerd — route-trace bevat geen vraag, context, output, iteratie
- Reparatie:
  - `ChainContext` type toegevoegd (RouterSession-provenance in keten)
  - Signatuur: `step_19 : ReturnTrace18 × ChainContext → Step19State`
  - `step_19(trace, ctx)` constructiefunctie gedeclareerd
  - `bridge_18_to_19 : ReturnTrace18 × ChainContext → Step19State`
  - `bridge_18_to_24 : ReturnTrace18 × ChainContext → ReturnTrace24`
- Stap 19 nu intern formeel sluitend ✅ (geen blokkerende typefouten meer)

---

## Check: 2026-07-17 17:07 GMT+2
- Status: Stap 19 — keten 18→19 typecompatibiliteitsfix ✅
- Probleem: `initialize_step_19` vroeg `RouterSession` die stap 18 niet doorgeeft
- Reparatie:
  - `ChainContext := { router_session: RouterSession }` als ketencontext
  - `bridge_18_to_19` en `bridge_18_to_24` vervoeren nu expliciet `ChainContext`
  - Stap 18 interface gesynced: `step_19 : ReturnTrace18 × ChainContext → Step19State`
- Keten 18→19 nu volledig typecompatibel ✅

---

## Check: 2026-07-17 17:20 GMT+2
- Status: Stap 19 — convergentie-type reparatie ✅
- Probleem: `semantic_distance` en `contradiction_delta` gebruikten ongedefinieerd type `Output`
- Reparatie:
  - Signatuur: `RouterOutput × RouterOutput → NonNegativeReal`
  - `contradiction_delta(i)` → `contradiction_delta(output_i, output_{i-1})`
  - `root : RouterOutput → NPRPosition` toegevoegd
- Stap 19 nu intern formeel sluitend ✅ (geen blokkerende typefouten meer)

---

## Check: 2026-07-17 17:22 GMT+2
- Status: Stap 19 — Markdown-fence reparatie ✅
- Probleem: Genest codeblok (bare ``` met daarin ```text blocks) in Concrete Mechaniek
- Reparatie: alle codeblokken nu afzonderlijk met ```text fences
- Stap 19 nu intern formeel sluitend ✅

---

## Check: 2026-07-17 17:25 GMT+2
- Status: Stap 19 — subtype-claim reparatie ✅
- Probleem: `ReturnContext` ten onrechte subtype van `Step19State` genoemd
- Reparatie:
  - `sandbox_metadata: Metadata` toegevoegd aan `Step19State` en `RouterSession`
  - `return_context_from_state` projectiefunctie gedeclareerd
  - `output_to_input_from_state` via projectiefunctie
  - Claim gecorrigeerd: geen subtype, expliciete conversie nodig
- Stap 18 ook gesynced (`RouterSession.sandbox_metadata`) ✅
- Stap 19 nu intern formeel sluitend ✅

## Check: 2026-07-17 17:33 GMT+2
- Status: Stap 19 — MAX_ITERATIONS configuratiemodel reparatie ✅
- Probleem: `DEFAULT_MAX_ITERATIONS` gedeclareerd én `MAX_ITERATIONS must be supplied` verplicht — tegenspraak
- Reparatie:
  - `supplied_max_iterations : Option<PositiveInteger>` gedeclareerd
  - `effective_max_iterations` afgeleid via match (`Some(n)` → gevalideerd, `None` → default 9)
  - Lus-conditie: `if i = effective_max_iterations` (niet `MAX_ITERATIONS`)
  - Normatieve declaratie: "expliciet overschrijft default"
- Validatietabel + Eindoordeel gesynced ✅

## Check: 2026-07-17 17:36 GMT+2
- Status: Stap 19 — `output_to_input reflect` typefout reparatie ✅
- Probleem: `reflect`-tak gebruikte `ctx.sandbox_metadata` (type `Metadata`) in `append(...)` als `context` (type `Context`)
- Reparatie:
  - `context: [out.answer]` (consistent met `act`-tak)
  - `metadata: merge(ctx.sandbox_metadata, out.source_map, out.contradictions)` — metadata blijft in metadata
  - Q-overgang `reflect` gesynced: `context_{i+1} := [output_i.answer]`
- Type-scheiding context vs. metadata nu consistent over alle vier de modi ✅

## Check: 2026-07-17 17:39 GMT+2
- Status: Stap 19 — Q-overgang synchronisatie ✅
- Probleem: latere samenvatting gebruikte `output_i` (RouterOutput) waar `output_i.answer` (Answer) nodig; `metadata_{i+1}` ontbrak
- Reparatie: alle vier de modi nu type-consistent met `output_to_input`
  - `deepen`: `output_i.answer`, `metadata_{i+1}` toegevoegd
  - `explore`: `output_i.answer`, `metadata_{i+1}` toegevoegd
  - `act`: `output_i.answer`, `[output_i.answer]`, `metadata_{i+1}` toegevoegd
  - `reflect`: `output_i.answer` (was al `[output_i.answer]`), `metadata_{i+1}` toegevoegd
- Validatietabel + Eindoordeel gesynced ✅
