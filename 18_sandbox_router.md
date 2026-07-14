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

```text id="combine_cycles"
combine_cycles :
  List<CycleResult> × Question → MotorField

final_output :=
  rotor_response(Q, combine_cycles(cycle_results, Q))
```

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

```
cycle_weight : CycleResult → ℝ≥0

combine_cycles(cycle_results, Q) :=
  let W = Σ_i cycle_weight(cycle_results[i]) in
  if W > 0:
    Σ_i cycle_weight(cycle_results[i]) · motor_field(cycle_results[i]) / W
  else:
    status := no_active_cycle_weight
```

`require Σ_i cycle_weight(cycle_results[i]) > 0` is een voorwaarde op
de uitvoering, niet op de specificatie. Als alle cycli nul-gewicht hebben
blijft de fout expliciet i.p.v. een stilte deling-door-nul.

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
→ per cyclus: B0, B1, B2, B3
→ ΦA, ΦB, ΦC
→ faseposities 0° / 120° / 240°
→ motor_field
→ rotor_response(Q, motor_field)
→ cyclusresultaat
→ cyclusresultaten combineren
→ eindantwoord
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

Een reservekanaal kan worden toegevoegd:

```text id="ke8d3k"
ΦR := combine(B3, B0)
```

`ΦR` is geen vierde motorfase. Het is een failover-route.

Daarom:

```text id="sgipq6"
step_18_formal_consistency := akkoord
full_fault_tolerance := nog niet voltooid
```

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
⚠ fouttolerantie: eindblok=2 fasen, middenblok=1 fase (reservekanaal ΦR nodig voor volledige tolerantie)
⚠ reproduceerbaarheid: conditioneel (zelfde grenzen + routerversie + gewichten + model + settings)
```

**Geïmplementeerd (`js/18_sandbox_router.js`):**
- `combine(B_j, B_k)` — semantische overlap + NPR-reductie + faseverschil
- `superpose(ΦA, ΦB, ΦC)` — fase-superpositie + interferentie-analyse
- `rotor_response(Q, motor_field)` — vraag + veld → gestructureerd antwoord
- `npr_reduce(text)` — hex_encode → dr_hex → npr_mod9

**Open:**
- Live test: echte hoge-context vraag door router sturen
- `combine()`: semantische vergelijkingsfunctie (nu keyword-gebaseerd; toekomst: embedding/LLM-gebaseerd)
- `superpose()`: gewogen superpositie (nu equal-weight; toekomst: dynamisch)
- `rotor_response()`: antwoord-generatie (nu template; toekomst: LLM-geïntegreerd)
- `ΦR`: reservekanaal implementeren (`combine(B3, B0)`)

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
⚠️ combine_cycles implementatie open (interface formeel correct)
⚠️ volledige fouttolerantie blijft open

Operationele uitvoering:       ⚠️ open
- combine_cycles: semantische vergelijkingsfunctie nog keyword-gebaseerd
- superpose: gewogen superpositie nog equal-weight

Open afhankelijkheden:
- combine_cycles moet deterministische cycle_weight-implementatie krijgen.

depends_on(implementation.combine_cycles)
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
- Fouttolerantie: ΦR als failover (niet vierde motorfase)
- Notatieregel: exacte waarden in definities, labels voor leesbaarheid
- `step_18_formal_consistency: ✅ akkoord`
