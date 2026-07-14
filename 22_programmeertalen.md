# Stap 22: Programmeertalen Als Selecteerbaar Taalveld

**Doel:** Binnen NPR-OS geldt een selectiebeleid voor programmeertalen. De taaltoolchain die de kernlaag ondersteunt moet open-source en auditbaar zijn. Dit sluit aan op Stap 21: transparante kernrouting vereist transparante taalimplementaties.

**Afhankelijkheid:** Stap 21 (transparante routing — auditable + reproduceerbaar).

---

## 1. NPR-Selectiebeleid

```
NPR_OS_LANGUAGE_POLICY:

Alle programmeertalen en taalimplementaties
die binnen NPR-OS als kerncomponent worden geselecteerd,
moeten open-source zijn.
```

Dit is een **selectiecriterium binnen NPR-OS**, niet een universele claim over alle programmeertalen.

---

## 2. Tussen Taal En Implementatie

```
taalspecificatie:
  → moet publiek leesbaar zijn
  → grammatica, semantiek, standaard

compiler / interpreter / runtime:
  → moet open-source zijn
  → broncode, build-proces, versiegeschiedenis

gesloten externe tool:
  → mag alleen buiten de kernrouting vallen
  → via gedeclareerde interface
  → zonder verborgen kernrouting
```

Een taal kan theoretisch meerdere implementaties hebben. Binnen NPR-OS geldt:

```
SELECTED_LANGUAGE_FIELD :=
 {
   language_i |
     specification_visible(language_i)
     ∧ implementation_open_source(language_i)
     ∧ license_compatible(language_i)
 }
```

---

## 3. Formele Opsomming

```
NPR-OS claimt niet dat alle programmeertalen open-source zijn.

NPR-OS selecteert uitsluitend open-source taalimplementaties
voor zijn kern, routing en reproduceerbare uitvoering.
```

---

## 4. Aansluiting Stap 21

```
Stap 21:
  kernrouting moet auditbaar en open zijn

Stap 22:
  de geselecteerde taaltoolchain voor die kern
  moet eveneens open-source zijn
```

Zonder open-source taalimplementatie is reproduceerbare uitvoering (Stap 21, §4) niet verifieerbaar binnen het NPR-OS-beleid:

```
reproducible_runtime :=
  visible_source(code)
  ∧ visible_source(toolchain)
  ∧ runtime_matches_source(hash)

missing_toolchain_source
→ not_compliant_with_NPR_OS_core_policy
```

---

## 5. Kern vs. Extern

```
NPR-OS kern:
  open-source talen en implementaties
  auditbare routing
  reproduceerbare builds

externe processor:
  eventueel gesloten
  via gedeclareerde interface
  zonder verborgen kernrouting
```

Een gesloten tool mag een processorrol vervullen, mits:

```
externe_tool_ok :=
  buiten_kernrouting(tool)
  ∧ interface_gedeclareerd(tool)
  ∧ geen_verborgen_routing(tool)
```

---

## 6. Voorbeelden

```
Open-source taalimplementaties:
  — C: GCC, Clang
  — JavaScript: V8, SpiderMonkey, QuickJS
  — Python: CPython
  — Rust: rustc
  — Assembly: NASM, YASM
  — Shell: bash, zsh

Taalspecificatie zonder open implementatie:
  → niet selecteerbaar voor NPR-OS kern

Gesloten tool als externe processor:
  → toegestaan mits buiten kernrouting
```

---

## 7. Gedeelde Berekenbaarheid, Verschillende Structuur

Veel algemene programmeertalen zijn Turing-compleet. Dit betekent dat zij in beginsel dezelfde klasse van Turing-berekenbare functies kunnen uitdrukken.

```
computational_equivalence
≠ structural_identity
```

Talen hoeven daarvoor niet dezelfde concrete constructies te bevatten. Selectie, herhaling, toestand en abstractie kunnen onder andere worden uitgedrukt via:

```
if/else
iteratie
recursie
functie-applicatie
pattern matching
term rewriting
unificatie
continuations
```

De talen verschillen niet alleen in syntax, maar ook in:

```
typesysteem
geheugenmodel
effectmodel
concurrency-model
veiligheidsgaranties
terminatie-eigenschappen
uitvoeringsomgeving
```

Voorbeelden van perspectief:

```
C:
  directe systeem- en geheugentoegang

Python:
  leesbaarheid en hoge abstractie

Rust:
  statisch gecontroleerde geheugenveiligheid

JavaScript:
  event-driven uitvoering en browserintegratie
```

Deze perspectieven vertegenwoordigen werkelijke ontwerpkeuzes. Zij zijn geen bewijs dat de talen structureel identiek zijn.

Het selectiebeleid uit §1 gaat uitsluitend over transparantie, auditbaarheid en licentiecompatibiliteit.

---

## 8. NPR-Projectie

Alle geselecteerde taalimplementaties kunnen als bronartefact naar het NPR-taalveld worden geprojecteerd:

```
source_artifact
  → byte/hex-representatie
  → NPR-reductie
  → route-signatuur
  → taalveld-positie
```

De NPR-signatuur is route-metadata:

```
npr_signature(source)
  ≠ volledige broncode
  ≠ volledige programmasemantiek
```

De NPR-reductie vervangt daarom niet:

```
parser
AST
typesysteem
compiler of interpreter
control-flow analyse
semantische evaluatie
```

Omdat de reductie informatie verliest, kunnen verschillende bronartefacten dezelfde NPR-signatuur opleveren:

```
gelijke NPR-signatuur
  → gelijke projectiepositie

gelijke NPR-signatuur
  ↛ gelijk programma of gelijk gedrag
```

Verschillende syntax kan verschillende NPR-signaturen opleveren. Verschillende broncode kan echter ook op dezelfde gereduceerde NPR-signatuur uitkomen.

Het NPR-taalveld is daarmee een gedeelde route- en classificatieruimte, niet een volledige semantische representatie van iedere programmeertaal.

---

## Status

```
NPR_OS_LANGUAGE_POLICY:              ✅ (selectiecriterium, niet universeel)
taalspecificatie vs implementatie:    ✅ (onderscheid)
SELECTED_LANGUAGE_FIELD:              ✅ (formeel gedefinieerd)
aansluiting stap 21:                  ✅ (toolchain = reproduceerbaar)
kern vs extern:                       ✅ (gesloten = processor, niet router)
voorbeeld-implementaties:             ✅
Turing-compleetheid ≠ structuur:      ✅ (gecorrigeerd)
NPR-reductie als route-metadata:      ✅ (expliciet begrensd)
step_22_formal_consistency:            ✅ akkoord
```

---

## Check: 2026-07-13 00:00 GMT+2
- Status: NPR-OS Stap 22 — definitieve herziening
- Correcties:
  1. Turing-compleetheid ≠ gelijke constructies (recursie, pattern matching, continuations, etc.)
  2. Talen verschillen wezenlijk in typesysteem, geheugenmodel, effectmodel, etc. (niet alleen perspectief)
  3. NPR-reductie = route-metadata, vervangt niet parser/AST/typesysteem/compiler
  4. Gelijke signatuur ↛ gelijk programma of gedrag
  5. `missing_toolchain_source → not_compliant_with_NPR_OS_core_policy` (niet universeel `verifiable = false`)
  6. Typo: `selecriterium` → `selectiecriterium`
- Kern: NPR-OS selecteert open-source talen; talen computationeel equivalent maar structureel verschillend; NPR = gedeelde route-ruimte, niet semantische representatie
- `step_22_formal_consistency: ✅ akkoord`
