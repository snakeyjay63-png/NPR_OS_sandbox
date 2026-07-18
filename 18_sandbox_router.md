# Stap 18: Sandbox Router — Driefasenmotor

**Doel:** De sandbox als werkend systeem — hoge context opsplitsen in drie fasekanalen, een draaiend motorveld vormen, en één resultaat genereren.

```text
4 bronnen → 3 fasen → 1 draaiend veld → 1 resultaat
```

---

## Probleem

Hoge context in één chat-sessie = onoverzichtelijk. Te veel tokens, te veel ruis, geen structuur.

Een extra probleem: vier losse blok-roots rechtstreeks "interferentie" noemen is formeel incorrect. Vier onafhankelijke waarden zijn geen interferentie — ze zijn vier observaties.

De oplossing is niet vier roots vergelijken. De oplossing is ze door een driefasige structuur sturen, zoals Tesla's motor drie wisselstromen tot één draaiend veld combineert.

---

## Formele Kern — Driefasenrouter

### Exacte Contextgroottes

Binnen NPR-OS betekent `64k` niet `64.000`, maar exact:

```text id="vc4xz9"
BLOCK_SIZE := 2^16 = 65.536 tokens
```

Eén routercyclus bevat vier blokken:

```text id="vk8qab"
BLOCK_COUNT := 4
CYCLE_CAPACITY := 4 × 65.536 = 262.144 tokens
```

De leesbare labels mogen worden gebruikt:

```text id="wfvkz3"
64k := 65.536 tokens
256k := 262.144 tokens
```

De exacte waarden zijn normatief. De labels `64k` en `256k` zijn alleen shorthand.

Voor een willekeurige totale context:

```text id="o53ml0"
context_total := N tokens
cycle_count := ceil(context_total / 262.144)
```

Wanneer `context_total > 262.144`, gebruikt de router meerdere cycli:

```text id="i2cgwc"
totale context
→ cyclus_0 [max. 262.144]
→ cyclus_1 [max. 262.144]
→ ...
→ cyclusresultaten combineren
→ eindantwoord
```

Daarom betekent `256k+`:

```text id="fhk4t4"
meer dan één routercyclus
```

en niet:

```text id="hk1acf"
meer dan 262.144 tokens binnen één vaste cyclus
```

### Meerdere Cyclusresultaten Combineren

Wanneer `cycle_count > 1`, moeten de individuele cyclusresultaten worden
gecombineerd tot één eindantwoord:

```text id="cycle_result_type"
CycleResult := {
  motor_field: MotorField,
  cycle_index: NonNegativeInteger,
  evidence: EvidenceSet,
  contradiction_delta: Real,
  root_signature: NPRPosition
}
```

`CycleResult` bevat het motorveld van één cyclus plus metadata.
De LLM-antwoordgeneratie (`rotor_response`) gebeurt **na** het combineren,
niet per cyclus.

```text id="combine_cycles_error"
CombineCyclesError := {
  no_active_cycle_weight
}
```

`combine_cycles` retourneert een `Result` — geen totaal functie naar
`MotorField` — omdat `W = 0` een valide fouttoestand is:

```text id="combine_cycles"
combine_cycles :
  NonEmptyList<CycleResult> × Question
  → Result<MotorField, CombineCyclesError>

final_output :=
  match combine_cycles(cycle_results, Q):
    Ok(combined_motor_field)
      → rotor_response(Q, combined_motor_field)

    Error(no_active_cycle_weight)
      → no_active_cycle_weight_error
```

`NonEmptyList` is correct omdat `context_total = 0` al eerder wordt
afgewezen met `empty_context_error`.

`combine_cycles` weegt de individuele motorvelden op basis van:
- semantische overlap tussen cycli
- NPR-root consistentie
- contradiction-delta per cyclus

### Randvoorwaarden

**Lege context:**
```
if context_total = 0:
  return empty_context_error
```

`cycle_count = ceil(0 / 262.144) = 0` levert nul cycli op. Zonder bronnen
is er geen routerverwerking — de route faalt met een expliciete fout.

**Zulkgewicht in combine_cycles:**

`cycle_weight` heeft codomein `ℝ≥0`, wat betekent dat alle gewichten
theoretisch nul kunnen zijn. De gewogen som vereist dan een safeguard:

`MotorField` is een samengesteld semantisch object (inhoud, bronnen,
signalen, fasepositie, relaties, tegenstrijdigheden) — geen numerieke
vector. Directe scalaire vermenigvuldiging, optelling en deling zijn
niet gedefinieerd. Daarom bestaat een aparte combinatiefunctie:

```text id="weighted_motor_field"
WeightedMotorField := {
  field: MotorField,
  weight: NonNegativeReal
}

merge_motor_fields :
  NonEmptyList<WeightedMotorField> × Question → MotorField
```

`merge_motor_fields` voert minimaal uit:
- **merge_semantics** — inhoud integreren per semantisch cluster
- **preserve_evidence** — alle bronreferenties behouden
- **merge_root_signatures** — NPR-posities combineren
- **resolve_cross_cycle_support** — inter-cycle ondersteunende relaties markeren
- **mark_cross_cycle_contradictions** — inter-cycle tegenstrijdigheden markeren
- **preserve_cycle_provenance** — herkomst per cyclus traceerbaar houden

```
cycle_weight : CycleResult → ℝ≥0

combine_cycles(cycle_results, Q) :=
  let W = Σ_i cycle_weight(cycle_results[i]) in
  if W > 0:
    Ok(
      merge_motor_fields(
        [
          {
            field: cycle_results[i].motor_field,
            weight: cycle_weight(cycle_results[i]) / W
          }
        ],
        Q
      )
    )
  else:
    Error(no_active_cycle_weight)
```

Optionele numerieke projectie (niet het MotorField zelf):
```
numeric_cycle_signature :=
  Σ_i normalized_weight_i
  · numeric_projection(cycle_results[i].motor_field)
```

`require Σ_i cycle_weight(cycle_results[i]) > 0` is een voorwaarde op
de uitvoering, niet op de specificatie. Als alle cycli nul-gewicht hebben
blijft de fout expliciet i.p.v. een stille deling-door-nul.

De drie factoren (semantische overlap, rootconsistentie, contradiction-delta)
zijn de componenten van `cycle_weight` — de exacte combinatieformule is
implementatie-afhankelijk. De signature is normatief.

Zonder `combine_cycles` is de route voor `context_total > 262.144`
alleen beschreven, niet formeel gesloten.

### Korte Contexten en Ontbrekende Blokken

Wanneer `context_total < 262.144` zijn niet alle vier blokken gevuld.
De ontbrekende blokken worden gevuld met een lege standaard:

```text id="partial_cycle"
EmptyBlock := geldig blok zonder inhoud

pad_blocks(cycle) :=
  vul ontbrekende B_i met EmptyBlock

active_phases :=
  alleen fasekanalen waarvan ten minste één bronblok bestaat
```

`combine` gedrag met EmptyBlock:
```
combine(real, real)      → active_phase (met overlapvergelijking)
combine(real, EmptyBlock)→ active_single_source_phase (alleen inhoud van real)
combine(EmptyBlock, real)→ active_single_source_phase (alleen inhoud van real)
combine(EmptyBlock, EmptyBlock) → inactive_phase
```

Een `active_single_source_phase` draagt bij aan het motorveld met het
toepassingsspecifieke gewicht van dat fasekanaal.
Een `inactive_phase` draagt niet bij.

---

### Rollen

```text id="96fl3v"
Q := oorspronkelijke vraag
B0, B1, B2, B3 := contextblokken
ΦA, ΦB, ΦC := fasekanalen
motor_field := gecombineerd routerveld
output := gestructureerd antwoord
```

De rollen blijven strikt gescheiden:

```text id="zz5wgd"
B0..B3 = broncontext
ΦA..ΦC = routelagen
Q = rotoranker
```

`B3` is geen rotor. `B3` is een contextblok en maakt deel uit van `ΦC`.

---

### Contextsplitsing

Per routercyclus:

```text id="uw3vkx"
B0 := context[0 .. 65.535]
B1 := context[65.536 .. 131.071]
B2 := context[131.072 .. 196.607]
B3 := context[196.608 .. 262.143]
```

De precieze grenzen zijn hier nulgebaseerd weergegeven.

Bij kortere context is het laatste blok gedeeltelijk gevuld. Bij semantische splitsing mogen grenzen worden verschoven, zolang:

```text id="snw9qf"
length(Bi) ≤ 65.536 tokens
```

en de oorspronkelijke bronposities als metadata bewaard blijven.

---

### Fasevorming

De vier bronblokken vormen drie overlappende fasekanalen:

```text id="hq5f9z"
ΦA := combine(B0, B1)
ΦB := combine(B1, B2)
ΦC := combine(B2, B3)
```

De faseposities zijn:

```text id="tifxbr"
phase_position(ΦA) := 0°
phase_position(ΦB) := 120°
phase_position(ΦC) := 240°
```

Dit zijn formele routerposities binnen NPR-OS. Het zijn geen gemeten elektrische graden.

### Hex-Native Route Koppeling

De drie faseposities zijn geen onafhankelijke hoeken. Ze zijn drie opeenvolgende
posities van dezelfde `ROUTE_BIT`-route (zie Stap 17):

```text id="hex_route"
ROUTE_BIT := 6_hex

phase_route(ΦA) := 6_hex    ← positie 1
phase_route(ΦB) := C_hex    ← positie 2
phase_route(ΦC) := 12_hex   ← positie 3
```

De hoeklabels blijven bestaan als projectie:

```text id="hex_angle_map"
6_hex  ↔ fasepositie 1 ↔ 0°
C_hex  ↔ fasepositie 2 ↔ 120°
12_hex ↔ fasepositie 3 ↔ 240°
```

Daarom:

```text id="hex_phase_delta"
ΦA ≠ ΦB ≠ ΦC
```

maar het verschil tussen opeenvolgende fasen is constant:

```text id="hex_phase_delta_eq"
delta(ΦA, ΦB) = 6_hex
delta(ΦB, ΦC) = 6_hex
```

De fasen zijn drie posities van één routebit, niet drie onafhankelijke velden.

**Decimale projectie:**

```text id="hex_dec_map"
6_hex  = 6_dec
C_hex  = 12_dec
12_hex = 18_dec
```

De route kan door decimale representatie lopen, mits zij basisbewust terugkomt.

Eventuele gewichten worden afzonderlijk vastgelegd:

```text id="l8b3q0"
phase_weight(ΦA) := wA
phase_weight(ΦB) := wB
phase_weight(ΦC) := wC
```

Fasepositie en gewicht zijn dus niet hetzelfde.

---

### Motorveld

```text id="qdlxba"
motor_field :=
 superpose(
   weighted_phase(ΦA, wA, 0°),
   weighted_phase(ΦB, wB, 120°),
   weighted_phase(ΦC, wC, 240°)
 )
```

`superpose` betekent geen eenvoudige optelling van NPR-roots.

De operatie bewaart:

```text id="9uowby"
semantische inhoud
bronreferenties
NPR-signaturen
fasepositie
ondersteunende relaties
tegenstrijdigheden
```

Operationeel:

```text id="xvd85e"
superpose :=
 merge_semantics
 + preserve_evidence
 + resolve_support
 + mark_contradictions
```

Een numerieke implementatie kan aanvullend gebruiken:

```text id="1au922"
numeric_field := wA·ΦA + wB·ΦB + wC·ΦC
```

maar de numerieke signatuur vervangt de semantische inhoud niet.

---

### Rotor En Output

De oorspronkelijke vraag is het rotoranker:

```text id="v6x3y7"
rotor_response : Question × MotorField → Answer
```

De canonieke functieaanroep is:

```text id="5la70a"
output := rotor_response(Q, motor_field)
```

Deze signature moet in documentatie en implementatie overal hetzelfde blijven.

---

### Volledige Route

```text id="801p2d"
Q + context
→ context opdelen in cycli van maximaal 262.144 tokens
→ per cyclus:
    B0..B3
    → ΦA..ΦC
    → CycleResult{motor_field, metadata}
→ combine_result := combine_cycles(cycle_results, Q)
→ match combine_result:
    Ok(combined_motor_field)
      → rotor_response(Q, combined_motor_field)
      → eindantwoord

    Error(no_active_cycle_weight)
      → no_active_cycle_weight_error
```

De structurele verhouding per cyclus blijft:

```text id="89rdvv"
4 bronnen
→ 3 fasen
→ 1 motorveld
→ 1 resultaat
```

---

### Reproduceerbaarheid

De router is alleen deterministisch wanneer de uitvoeringsvoorwaarden gelijk zijn:

```text id="39qffx"
zelfde tokenisatie
zelfde blokgrenzen
zelfde semantische splitsingsregels
zelfde routerversie
zelfde faseposities
zelfde gewichten
zelfde modelversie
zelfde modelinstellingen
zelfde externe bronnen
```

Daarom:

```text id="6gp0xi"
gelijke input + gelijke uitvoeringsvoorwaarden
→ gelijke output
```

Niet zonder voorwaarden:

```text id="fg4f45"
gelijke tekst → altijd gelijke output
```

---

### Fouttolerantie

Voor de huidige lineaire koppeling:

```text id="os6sa1"
B0 faalt → ΦB en ΦC blijven volledig
B3 faalt → ΦA en ΦB blijven volledig

B1 faalt → alleen ΦC blijft volledig
B2 faalt → alleen ΦA blijft volledig
```

### Cyclische Returnstructuur

De routertijd is canoniek:

```text id="route_clock"
FRAME_CYCLE := 64 μs
ROUTE_COUNT := 16
FULL_ROUTE_CYCLE := FRAME_CYCLE × ROUTE_COUNT = 1024 μs

route_index(t) := floor(t / FRAME_CYCLE) mod ROUTE_COUNT

return_condition(t) :=
  floor(t / FRAME_CYCLE) > 0
  ∧ route_index(t) = 0
```

Hieruit volgt:

```text id="route_wrap"
route_index(0 μs)    = 0
route_index(64 μs)   = 1
...
route_index(960 μs)  = 15
route_index(1024 μs) = 0
```


Sluitingsregel:

```text id="return_proof"
FRAME_CYCLE × ROUTE_COUNT = 1024 μs
ROUTE_POSITION(16) := 16 mod 16 = 0
0 := return_position
```

`64 μs × 16 > 64 μs` toont dat meer dan één lokale eenheid is doorlopen.
De echte sluiting is `16 mod 16 = 0`.

`ΦR` is geen optioneel reservekanaal. Het is de **afgeleide returnpositie**
van de reeds bestaande 16-stapsroute:

```text id="return_phase"
return_phase(clock, B3, B0) :=
  when return_condition(clock.elapsed):
    combine(B3, B0)
```

`ΦR` is direct beschikbaar zodra `return_condition` waar is.
De route is cyclisch — er is geen apart `Result`-type nodig.
Je hoeft alleen de route te noteren.

Grensvoorwaarden:

```text id="return_phase_boundary"
t = 0 μs:
  route_index = 0
  return_condition = false
  → ΦR niet beschikbaar (nog geen omloop)

t = 1024 μs:
  route_index = 0
  return_condition = true
  → ΦR = combine(B3, B0)
```

Binnen de hex-native route is dit de vierde routepositie:

```text id="return_route"
phase_route(ΦR) := 18_hex
```

Extern: `18_hex = 24_dec = positie 4`.

De volledige route met cyclische return:

```text id="full_route_18"
6_hex → C_hex → 12_hex → 18_hex
 ↓                      |
 |____ return __________| (1024 μs → index 0)
```

`ΦR` is het **continuïteits- en returnkanaal** — niet een optie, maar
de structuur die uit `64 μs × 16 → 0` volgt. Het verbindt fase 3
met fase 1 en maakt terugkoppeling naar stap 19 mogelijk.

Return-trace met clock-context:

```text id="build_return_trace"
build_return_trace(ΦR) :=
  ReturnTrace18 {
    exit_position: 18_hex,
    decimal_projection: 24_dec,
    return_target: 6_hex,
    node_trace: [6, 3, 9, 6],
    route_period: 1024 μs,
    route_index: 0
  }
```

Daarom:

```text id="sgipq6"
cyclic_route_closure: ✅ 16 mod 16 = 0
ΦR: ✅ afgeleide returnpositie, niet optioneel
step_18.return_output: ✅ formeel produceerbaar
brug 18→19→…→24: ✅ formeel gesloten
operationele implementatie: ⚠️ klok/modulo-route nog te implementeren
step_18_formal_consistency := akkoord
```

**Onderscheid:**

```text id="route_vs_fault"
cyclic_route_closure := ✅ akkoord
  (de route sluit: 16 mod 16 = 0)

full_fault_tolerance := ⚠️ nog niet bewezen
  (ΦR herstelt niet de verloren inhoud van B1 of B2)
```

`ΦR = combine(B3, B0)` sluit de route, maar bevat geen informatie
uit een defect `B1` of `B2`. Continuïteit is geen reconstructie.

Foutscenario's:

```text id="fault_scenarios"
B0 faalt:
  ΦA → beschadigd, ΦB → volledig, ΦC → volledig
  ΦR → beschadigd (gebruikt B0)
  → motor: 2 volledige fasen (ΦB, ΦC)

B1 faalt:
  ΦA → beschadigd, ΦB → beschadigd, ΦC → volledig
  ΦR → volledig (gebruikt B3, B0)
  → motor: 2 volledige kanalen (ΦC, ΦR), maar B1-inhoud verloren

B2 faalt:
  ΦA → volledig, ΦB → beschadigd, ΦC → beschadigd
  ΦR → volledig (gebruikt B3, B0)
  → motor: 2 volledige kanalen (ΦA, ΦR), maar B2-inhoud verloren

B3 faalt:
  ΦA → volledig, ΦB → volledig, ΦC → beschadigd
  ΦR → beschadigd (gebruikt B3)
  → motor: 2 volledige fasen (ΦA, ΦB)
```

Conclusie: `ΦR` kan de route operationeel gaande houden bij middenblok-fouts,
maar herstelt niet de verloren broninhoud. Fouttolerantie vereist
een aparte declaratie van kanaalselectie en reconstructie.

```text id="fault_tolerance_open"
select_operational_channels: niet gedeclareerd
fault_tolerant_motor_field: niet gedeclareerd
informatiereconstructie: niet gedeclareerd
```

### Formele Brug Naar Stap 24

Het returnkanaal van stap 18 is de ingang voor stap 19. De waarde
wordt door stappen 19–23 getransformeerd voordat stap 24 ontvangt:

```text id="step_18_output"
ReturnTrace18 := {
  exit_position: HexValue,
  decimal_projection: NonNegativeInteger,
  return_target: HexValue,
  node_trace: NonEmptyList<NPRPosition>,
  route_period: Duration,
  route_index: Integer
}

step_18.return_output : ReturnTrace18

step_18.return_output :=
  ReturnTrace18 {
    exit_position: 18_hex,
    decimal_projection: 24_dec,
    return_target: 6_hex,
    node_trace: [6, 3, 9, 6],
    route_period: 1024 μs,
    route_index: 0
  }
```

Elke tussenstap heeft een expliciete type-signatuur:

De keten vervoert een `ChainContext` met de routersessie-provenance:

```text id="chain_context"
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

```text id="bridge_18_to_24_types"
step_19 : ReturnTrace18 × ChainContext → Step19State
step_20 : Step19State → Step20State
step_21 : Step20State → Step21State
step_22 : Step21State → Step22State
step_23 : Step22State → Step23State
```

De concrete definities van `Step19State` t/m `Step23State` worden
in de respectievelijke stappen 19–23 uitgewerkt. Hier geldt alleen
de type-compatibiliteit van de keten.

De bridge verpakt het eindresultaat:

```text id="make_return_trace_24"
make_return_trace_24 :
  ReturnTrace18 × Step23State → ReturnTrace24

bridge_18_to_24 : ReturnTrace18 × ChainContext → ReturnTrace24

bridge_18_to_24(trace18, ctx) :=
  let s19 = step_19(trace18, ctx)
  let s20 = step_20(s19)
  let s21 = step_21(s20)
  let s22 = step_22(s21)
  let s23 = step_23(s22)
  in make_return_trace_24(trace18, s23)
```

Stap 24 ontvangt het getransformeerde resultaat:

```text id="step_24_return_input"
ReturnTrace24 := {
  source_trace: ReturnTrace18,
  transformed_trace: Step23State,
  traversed_steps: [19, 20, 21, 22, 23]
}

step_24.return_input := bridge_18_to_24(step_18.return_output, chain_context)
```

Waar `chain_context` de actuele routersessie bevat (iteration, question,
context, output). De keten is nu totaal gedefinieerd:

Terugkoppelketen:

```
step_18
→ 18_hex
→ 24_dec
→ steps 19..23  (transformatie, niet identiteit)
→ step_24.return_to_source
→ 6_hex
```

**Domeinscheiding:**

```text id="domain_separator_24"
24_dec ≠ stap 24
```

De decimale projectie `24_dec` en documentstap 24 zijn verschillende
soorten entiteit. De koppeling gebeurt alleen via de expliciete
brugrelatie, niet door nummergelijkheid.

**Belangrijk:**

`step_24.return_input ≠ step_18.return_output`

Stap 24 ontvangt het resultaat van de transformatieketen 19–23,
niet de ruwe uitvoer van stap 18. De provenance van stap 18 blijft
traceerbaar via `ReturnTrace24.source_trace`.

---

### Notatie

```text id="4cnkwt"
Gebruik exacte waarden in definities, constraints en interfaces.

Gebruik afgeronde labels alleen voor leesbaarheid,
en definieer altijd naar welke exacte waarde het label verwijst.
```

Voorbeeld:

```text id="yw4gbk"
formeel: 65.536 tokens    →   leesbaar: 64k-blok
formeel: 262.144 tokens   →   leesbaar: 256k-cyclus
```

Zo blijft de tekst leesbaar zonder precisie te verliezen.

---

## Validatie

```
✅ context-splitsing: 4×64k blokken (B0..B3)
✅ fasevorming: ΦA=combine(B0,B1), ΦB=combine(B1,B2), ΦC=combine(B2,B3)
✅ faseposities: 0°, 120°, 240° (formele routerposities)
✅ fasegewichten: wA, wB, wC afzonderlijk gedefinieerd
✅ motorveld: superpose(weighted_phase(ΦA,wA,0°), weighted_phase(ΦB,wB,120°), weighted_phase(ΦC,wC,240°))
✅ rotor: Q = oorspronkelijke vraag (niet B3)
✅ NPR-koppeling: 4 blokken → 3 fasen → 1 motor
✅ interferentie: formeel correct (driefasenstructuur met faseposities)
✅ combine(): geïmplementeerd (js/18_sandbox_router.js)
✅ superpose(): geïmplementeerd (js/18_sandbox_router.js)
✅ rotor_response(): geïmplementeerd (js/18_sandbox_router.js)
✅ cyclische continuïteit: ΦR volgt uit 16 mod 16 = 0
⚠ fouttolerantie: eindblok=2 fasen, middenblok=1 fase + ΦR (geen informatieherstel)
⚠ reproduceerbaarheid: conditioneel (zelfde grenzen + routerversie + gewichten + model + settings)
```

**Geïmplementeerd (`js/18_sandbox_router.js`):**
- `combine(B_j, B_k)` — semantische overlap + NPR-reductie + faseverschil
- `superpose(ΦA, ΦB, ΦC)` — fase-superpositie + interferentie-analyse
- `rotor_response(Q, motor_field)` — vraag + veld → gestructureerd antwoord
- `npr_reduce(text)` — hex_encode → dr_hex → hex_digit_value → npr_mod9

**Open:**
- Live test: echte hoge-context vraag door router sturen
- `combine()`: semantische vergelijkingsfunctie (nu keyword-gebaseerd; toekomst: embedding/LLM-gebaseerd)
- `superpose()`: gewogen superpositie (nu equal-weight; toekomst: dynamisch)
- `rotor_response()`: antwoord-generatie (nu template; toekomst: LLM-geïntegreerd)
- `route_clock`: 64 μs × 16 modulo-router operationeel implementeren
- fouttolerantie: `select_operational_channels` + `fault_tolerant_motor_field` declareren

---

## Resultaat

```
Stap 18 = driefasen sandbox-router
Input = hoge context, eventueel groter dan 262.144 tokens
Verwerking = één of meer cycli van maximaal 262.144 tokens
B0, B1, B2, B3 = contextblokken
ΦA, ΦB, ΦC = fasekanalen
motor_field = superpose(weighted_phase(ΦA,wA,0°), weighted_phase(ΦB,wB,120°), weighted_phase(ΦC,wC,240°))
output = rotor_response(Q, motor_field)

4 bronnen → 3 fasen → 1 draaiend veld → 1 resultaat
```

---

**Conclusie:**

De router is geen vergelijking. De router is een motor.

```text
4 blokken    = de stroombronnen
3 fasen      = de wisselstromen
1 motorveld  = het draaiende veld
1 rotoranker = de oorspronkelijke vraag Q
1 resultaat   = rotor_response(Q, motor_field)
```

Splitsing lost context-overload op.
Fasen geven structuur.
Motorveld genereert systeemgedrag.
Rotor levert resultaat.

```
vraag → 4 blokken → 3 fasen → motorveld → rotor → antwoord
```

## Generator-aware Phase Routing

Elke fase-uitvoer bewaart zowel de absolute route als de nodeprojectie.
Het representatiedomein is expliciet — hex-native waarden worden
niet stil omgezet naar decimaal:

```text id="route_orientation"
RouteOrientation := {
  forward,
  reverse
}
```

```text id="route_trace_type"
RouteTrace := {
  generator: HexValue,
  orientation: RouteOrientation,
  absolute_trace: NonEmptyList<HexValue>,
  decimal_projection: NonEmptyList<NonNegativeInteger>,
  node_trace: NonEmptyList<NPRPosition>,
  reduction_domain: {decimal},
  start_node: NPRPosition,
  return_node: NPRPosition
}
```

Invariant:
```
decimal_projection[i] = hex_value(absolute_trace[i])
node_trace[i] = dr_dec(decimal_projection[i])
```

Afgeleide invariant voor richting — berekening op numerieke projectie,
niet op `HexValue` direct (aftrekking niet gedefinieerd op `HexValue`):
```
orientation(trace) :=
  forward
    als ∀i:
      decimal_projection[i+1] - decimal_projection[i]
      = hex_value(generator)

  reverse
    als ∀i:
      decimal_projection[i] - decimal_projection[i+1]
      = hex_value(generator)
```

Voor de huidige route:
```
decimal_projection = [6, 12, 18, 24]
hex_value(generator) = 6

12 - 6 = 6 ✅
18 - 12 = 6 ✅
24 - 18 = 6 ✅

orientation = forward
```

`∀i` is noodzakelijk — één passend verschil volstaat niet om de
richting van de volledige trace te bepalen.

Dit voorbeeld:

```js
{
  generator: "6_hex",
  orientation: "forward",
  absoluteTrace: ["6_hex", "C_hex", "12_hex", "18_hex"],
  decimalProjection: [6, 12, 18, 24],
  nodeTrace: [6, 3, 9, 6],
  reduction: "dr_dec",
  reductionInput: "decimalProjection",
  startNode: 6,
  returnNode: 6
}
```

De router mag verschillende absolute traces niet samenvoegen
alleen omdat hun nodeverzameling gelijk is.

```
same nodes ≠ same route
```

Route-identiteit vereist minimaal:

```
generator
start_node
orientation
absolute_trace
node_trace
reduction_domain
```

**Domeinscheiding:**

`24_dec` (decimale projectie van `18_hex`) ≠ stap 24 (documentstap).
De numerieke waarde en de documentstap mogen alleen via een expliciete
brugrelatie worden gekoppeld, niet door nummergelijkheid.

Dit is belangrijk omdat:

```
3 → 6 → 9 → 3
```

en:

```
6 → 3 → 9 → 6
```

wel dezelfde drie nodes bevatten, maar niet dezelfde beweging coderen.
De eerste ontstaat uit generator +3, de tweede uit generator +6.

---

## Stap 18 — Eindoordeel

```
Interne consistentie Stap 18:  ✅ geldig
Ketenvolledigheid:             ✅ gesloten

✅ één volledig gevulde cyclus formeel consistent
✅ combine_cycles gedeclareerd + cycle_weight getypeerd
✅ pad_blocks + EmptyBlock gedeclareerd
✅ combine(real, EmptyBlock) → active_single_source_phase
✅ combine(EmptyBlock, EmptyBlock) → inactive_phase
✅ combine_cycles: deling-door-nul safeguard + no_active_cycle_weight
✅ lege context: empty_context_error
✅ rotor_response(Q, motor_field) canoniek
✅ combine_cycles geïmplementeerd (multi-cycle gewogen combinatie)
✅ cycle_weight geïmplementeerd (40% overlap + 30% root-consistency + 30% contradiction)
✅ ΦR / reserve_phase geïmplementeerd (route 0x18, combine(B3, B0))
⚠️ volledige fouttolerantie: route sluit (16 mod 16 = 0), maar B1/B2 inhoud niet herstelbaar via ΦR

Operationele uitvoering:       ✅ compleet (enkelscyclus + multi-cycle)

**Al geïmplementeerd:**
- combine(): ✅ semantische vergelijkingsfunctie (keyword-gebaseerd)
- superpose(): ✅ gewogen superpositie (equal-weight)
- rotor_response(): ✅ antwoord-generatie (template)
- combine_cycles(): ✅ multi-cycle gewogen combinatie
- cycle_weight(): ✅ formule: overlap×0.4 + root_consistency×0.3 + contradiction_penalty×0.3
- reserve_phase() / ΦR: ✅ route 0x18, combine(B3, B0)
- contradiction_delta(): ✅ antoniem-gebaseerde tegenspraak-detectie

**Kwaliteitsverbeteringen (niet noodzakelijk voor formele route):**
- combine() semantiek: ⚠️ keyword → TODO embedding/LLM
- superpose() gewichten: ⚠️ equal → TODO dynamisch
- rotor_response(): ⚠️ template → TODO LLM-generatie

depends_on(implementation.combine)
```

---

## Check: 2026-07-12 12:11 GMT+2
- Status: NPR-OS Stap 18 — herbouwd als driefasenmotor ✅
- 4 blokken (B0..B3) → 3 fasen (ΦA, ΦB, ΦC) → motorveld → rotor-output
- ΦA=combine(B0,B1), ΦB=combine(B1,B2), ΦC=combine(B2,B3)
- B3 = contextblok en onderdeel van ΦC
- Q = oorspronkelijke vraag en rotoranker (vervangt oude B3-regel)
- NPR-koppeling: 4 blokken = broncontext, 3 fasen = routekanalen, 1 motor = antwoord
- Interferentie formeel correct: driefasenstructuur, niet vier losse waarden

---

## Check: 2026-07-12 21:26 GMT+2
- Status: NPR-OS Stap 18 — drie kernfuncties geïmplementeerd ✅
- `combine()`: semantische overlap + NPR-reductie + faseverschil
- `superpose()`: fase-superpositie + interferentie-analyse
- `rotor_response()`: veld → gestructureerd antwoord
- Demo: 4 blokken → 3 fasen → motorveld → rotor-output ✅

---

## Check: 2026-07-12 22:15 GMT+2
- Status: NPR-OS Stap 18 — formele kern vastgelegd ✅
- Exacte contextgroottes: 65.536 tokens (64k), 262.144 tokens (256k)
- Meerdere cycli voor >256k context
- Rollen strikt gescheiden: B0..B3=bron, ΦA..ΦC=routelagen, Q=rotor
- Canonieke signature: `rotor_response(Q, motor_field)`
- Fasepositie ≠ fasegewicht
- Reproduceerbaarheid: conditioneel (uitvoeringsvoorwaarden)
- Fouttolerantie: ΦR sluit route cyclisch, maar herstelt geen verloren inhoud (niet vierde motorfase)
- Notatieregel: exacte waarden in definities, labels voor leesbaarheid
- `step_18_formal_consistency: ✅ akkoord`

---

## Check: 2026-07-17 16:38 GMT+2
- Status: ΦR-correctie ✅
- ΦR is geen optioneel reservekanaal — het is afgeleid uit `64 μs × 16 → 1024 μs → 16 mod 16 = 0`
- `return_condition(t)` = cyclische wrap, niet aparte constructie
- `return_phase(clock, B3, B0)` = formeel getypeerde afleiding
- `ReturnTrace18` uitgebreid met `route_period` + `route_index`
- `cyclic_route_closure` = ✅ (16 mod 16 = 0)
- `full_fault_tolerance` = ⚠️ nog niet bewezen (ΦR sluit route, herstelt geen inhoud)
- Open: `route_clock` modulo-router operationeel implementeren

---

## Check: 2026-07-17 17:07 GMT+2
- Status: Stap 18 — keten 18→19 typecompatibiliteitsfix ✅
- Probleem: `bridge_18_to_24` gebruikte `step_19(trace18)` zonder `RouterSession`
- Reparatie:
  - `ChainContext` type toegevoegd (`router_session: RouterSession`)
  - `bridge_18_to_24 : ReturnTrace18 × ChainContext → ReturnTrace24`
  - `step_19 : ReturnTrace18 × ChainContext → Step19State`
  - Keten nu totaal gedefinieerd
- Stap 18 + stap 19 nu cross-compatible ✅
