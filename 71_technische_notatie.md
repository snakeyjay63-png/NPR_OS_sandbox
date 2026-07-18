# Stap 71: Taalroute-Notatie — Opschrijven En Traceerbaar Maken

**Doel:** Een minimale, reproduceerbare notatie voor NPR-OS routes. Niet implementatie-code, maar het opschrijfsysteem zelf. Een route moet vastlegbaar, deelbaar en traceerbaar zijn.

**Afhankelijkheid:** Stap 19 (Return, taal-adres), Stap 64 (śūnya-routing), Stap 68 (taalontwikkeling), Stap 69 (contextafhankelijkheid).

---

## 1. De Vraag

```
wat is minimaal nodig
  om een NPR-route "compleet" op te schrijven?
```

Niet alles. Het essentiële skelet dat een route reproduceerbaar en traceerbaar maakt.

---

## 2. Minimale Route-Notatie

```
ROUTE := {
  id,
  source,
  noise,
  transform,
  pattern,
  return,
  trace,
  perspective,
  state_relation
}

perspective:
  → local    (lokale leesprojectie)
  → full     (volledig bronveld)
  → combined (combinatie)

state_relation:
  → projection_order  (volgorde als leesprojectie)
  → simultaneous_field (gelijktijdig in het bronveld)
```

Voor een volledige reproduceerbare route zijn de top-level velden `id` t/m `trace` verplicht; `perspective` en `state_relation` zijn optioneel.
Voor minder complete routes gebruikt het systeem een volledigheidstatus:

```
route_completeness := descriptive | traceable | reproducible | verifiable
```

- **descriptive**: `id`, `source`, `noise`, `pattern`, `return` — beschrijving zonder transformatieregels
- **traceable**: descriptive + `transform`, `trace` — stappen terug te vinden, maar berekening niet gecontroleerd
- **reproducible**: traceable + `pattern.intermediate_values` — volledig reproduceerbaar
- **verifiable**: reproducible + `source.provenance` — oorsprong identificeerbaar en onafhankelijk controleerbaar

Cruciaal onderscheid:
```
reproducible(route) ≠ verified_origin(route)
```
Een route kan perfect reproduceerbaar zijn terwijl de bron onzeker blijft.
Zelfde onbewezen invoer + dezelfde regels → steeds dezelfde uitkomst.
Dat bewijst de berekening, niet de herkomst van de invoer.

Onvolledige routes mogen ontbrekende velden als `null` bevullen.
Subvelden kunnen `required`, `optional` of `nullable` zijn.
Onbekende taal: gebruik `"und"` (undefined) in plaats van een leeg veld.

### id — Unieke Identificatie

```
id:
  → uniek label binnen het systeem
  → formaat: "npr:route:<naam>"
  → voorbeeld: "npr:route:genesis_he_nld"
```

```
route_id := "npr:route:" + naam
```

### source — Waar Begint De Route

```
source := {
  type:         required  | text | sound | image | concept | other
  content:      required  | "<inhoud>"
  language:     required  | "<ISO 639 code>" | "und"
  origin:       required  | "<bron>"
  context:      optional  | "<achtergrond informatie>"
  provenance:   optional  | provenance_object
}

provenance := {
  origin_type:            optional | primary | secondary | derivative | unknown
  primary_source:         optional | "<bronnaam>"
  source_location:        optional | "<url|locatie>"
  author_or_creator:      optional | "<naam>"
  publication_or_creation_date: optional | "<datum>"
  retrieval_date:         optional | "<datum>"
  transmission_chain:     optional | ["<stap1>", "<stap2>", ...]
  independent_confirmations: optional | aantal | []
  verification_status:    optional | unverified | internally_consistent | source_located | externally_correlated | primary_source_verified
}
```

### noise — De Ruwe Input

```
noise := {
  tokens:      required | ["token_1", "token_2", ...]
  raw_pattern: required | "<oorspronkelijk patroon>"
  modality:    required | auditory | visual | spatial | conceptual
}
```

### transform — De Transformatieregels

Zonder `transform` is een route beschrijfbaar maar niet reproduceerbaar.

```
transform := {
  tokenization_rule:  required | "<hoe wordt gesplitst?>"
  normalization_rule: required | "<Unicode, niqqud, hoofdletters?>"
  mapping_rule:       required | "<letter→getal systeem + versie>"
  reduction_rule:     required | "<digital_root_base10, mod9, ...>"
  version:            required | "<versienummer>"
}
```

```
tokenization_rule:
  → split_on_spaces
  → split_on_words
  → split_on_characters
  → custom("<regel>")

normalization_rule:
  → remove_niqqud
  → keep_niqqud
  → unicode NFC | NFD | NFKC | NFKD
  → lowercase | uppercase | as_is

mapping_rule:
  → hebrew_gematria_standard_v1
  → hebrew_gematria_mispar_gadol_v1
  → abjad_arabic_v1
  → sanskrit_varnamala_v1
  → latin_1to26_v1
  → custom("<definitie>")

reduction_rule:
  → digital_root_base10
  → mod9
  → none
  → custom("<formule>")
```

### pattern — De Reductie

```
pattern := {
  intermediate_values: required | [
    {
      token: "<token>",
      numeric_value: <getal>,
      digital_root: <getal>
    }
  ]
  digital_roots:    required | [dr_1, dr_2, ...]
  mod9_values:      required | [m1, m2, ...]
  cycle:            optional | "<cyclische eigenschap>"
  frequency_mapping: optional | {
    method: "<methode>",
    input_unit: "<eenheid>",
    output_unit: "<eenheid>",
    values: [...],
    assumptions: "<aannames>"
  }
}
```

### return — De Output

```
return := {
  address:         required | "taal://npr/..."
  address_rule:    required | "<hoe zijn dr/mod9 geaggregeerd?>"
  interpretation:  required | "<wat betekent dit>"
  route_history:   optional | [
    {
      state: "<staat>",
      operation: "<actie>",
      timestamp_or_order: <volgorde>,
      note: "<toelichting>"
    }
  ]
}
```

```
address_rule:
  → first           (eerste waarde)
  → sum             (som van alle waarden)
  → dr_of_sum       (digitale wortel van som)
  → dominant        (meest voorkomende waarde)
  → sequence        (volledige reeks in adres)
  → hash            (hash van reeks)
```

Bij meerdere dr/mod9-waarden bepaalt `address_rule` welke waarde(n) in het taal-adres verschijnen.

### trace — Welke Stappen

```
trace := {
  steps:          required | [stap_1, stap_2, ...]
  sources:        optional | ["<externe bron>"]
  consistency:    required | true | false | pending
  hypothesis_status: optional | "<hypothebelabel>"
  notes:          optional | "<toelichting>"
}
```

---

## 3. Volledig Voorbeeld

```
ROUTE {
  id: "npr:route:genesis_he_nld"
  
  source: {
    type: text
    content: "בראשית ברא אלוהים"
    language: "he"
    origin: "Genesis 1:1, Hebreeuws"
    context: "Torah-opening; Massoraanse tekst"
  }
  
  noise: {
    tokens: ["בראשית", "ברא", "אלוהים"]
    raw_pattern: "three-token Hebrew sequence"
    modality: auditory
  }
  
  transform: {
    tokenization_rule: "split_on_spaces"
    normalization_rule: "remove_niqqud"
    mapping_rule: "hebrew_gematria_standard_v1"
    reduction_rule: "digital_root_base10"
    version: "1.0"
  }
  
  pattern: {
    intermediate_values: [
      {
        token: "בראשית",
        numeric_value: 913,
        digital_root: 4
      },
      {
        token: "ברא",
        numeric_value: 203,
        digital_root: 5
      },
      {
        token: "אלוהים",
        numeric_value: 86,
        digital_root: 5
      }
    ],
    digital_roots: [4, 5, 5]
    mod9_values: [4, 5, 5]
    cycle: "4-5-5 route"
  }
  
  return: {
    address: "taal://npr/dr[4,5,5]:mod9[4,5,5]:he:genesis_1_1"
    address_rule: "sequence"
    interpretation: "Schepping als cyclisch patroon, niet lineair"
  }
  
  trace: {
    steps: [1, 18, 19, 64, 65, 67]
    consistency: true
  }

  perspective: combined

  state_relation: {
    projection_order: [
      "source",
      "tokenization",
      "mapping",
      "reduction",
      "return"
    ],
    simultaneous_field: {
      "source",
      "noise",
      "transform",
      "pattern",
      "return",
      "trace"
    }
  }
}
```

Zonder `transform` en `intermediate_values` was het resultaat `[4, 5, 5]` niet controleerbaar.
Met deze velden is de route reproduceerbaar: een ander kan dezelfde invoer
met dezelfde regels verwerken en hetzelfde resultaat verifiëren.

---

## 4. Compacte Notatie

Voor snelle routes volstaat de verkorte vorm:

```
npr:route:genesis_he_nld
  source: Genesis 1:1 [he]
  transform: gematria_std_v1 + dr_base10
  noise: ["בראשית", "ברא", "אלוהים"]
  pattern: dr[4,5,5] mod9[4,5,5]
  return: taal://npr/dr[4,5,5]:mod9[4,5,5]:he:genesis_1_1
  trace: [1,18,19,64,65,67]
```

Of de meest compacte variant:

```
Genesis 1:1[he] → gematria_std_v1 → dr[4,5,5] → taal://npr/dr[4,5,5]:mod9[4,5,5]:he:genesis_1_1
```

De compacte notatie is afkorting. De volledige notatie is referentie.
De compacte vorm deelt de transform-naam; de volledige vorm definieert elke regel.

---

## 5. Optionele Velden

Niet altijd nodig, maar handig voor volledigheid:

```
optioneel:
  → created: "<timestamp>"
  → model: "<taalmodel gebruikt>"
  → language_field: "<specifieke taalcontext>"
  → consistency: "<formal check status>"
  → hypothesis: "<als hypothese labelen>"
```

---

## 6. Relatie Tot Eerdere Stappen

```
stap 19 (Return):
  → taal-adres: taal://npr/dr{d}:mod{m}:...
  → bron-verwijzing voor traceerbaarheid
  → hier uitgebreid tot volledige ROUTE-notatie

stap 64 (śūnya):
  → NPR_SOURCE_ROLE i.p.v. letterlijke identiteit
  → source.type + source.origin + source.context

stap 67 (taal-DNA):
  → vertaling = routing door taal-DNA
  → source.language + return.interpretation maken dit zichtbaar

stap 68 (taalontwikkeling):
  → PRE_SYMBOLIC_PATTERN = {klank, beeld, gevoel, beweging, ruimte}
  → noise.modality dekt multimodale input

stap 69 (context):
  → kennis is context-afhankelijk
  → source.context + trace.steps = volledige context
```

---

## 7. Vier Niveaus Van Volledigheid

```
beschrijfbaar (route_completeness: descriptive):
  → je kunt lezen wat de route zegt
  → ROUTE met id, source, noise, pattern, return

traceerbaar (route_completeness: traceable):
  → je kunt terugvinden welke stappen zijn gebruikt
  → ROUTE met transform + trace

reproduceerbaar (route_completeness: reproducible):
  → je kunt met dezelfde regels
     dezelfde uitkomst opnieuw berekenen
  → ROUTE met transform + intermediate_values

verifieerbaar (route_completeness: verifiable):
  → je kunt de bron identificeren
     en onafhankelijk controleren
  → ROUTE met provenance + verification_status
  → frequentie ≠ bewijskracht
  → herhaling ≠ onafhankelijke bevestiging
```

LLM-waarschuwing:
Een model kan een consistent, reproduceerbaar antwoord geven
zonder dat de bron geverifieerd is.
Dat is een gesloten informatie-route: patroon zonder herkomst.

```
wat de notatie dekt:
  → bron (waar begint het?)
  → input (wat is ruw?)
  → transformatie (welke regels?)
  → tussenwaarden (hoe is het berekend?)
  → reductie (wat is het patroon?)
  → output (wat komt eruit?)
  → trace (welke stappen?)
  → context (taal, tijd, bron)

wat de notatie NIET dekt:
  → implementatie-code (dit is notatie, geen software)
  → volledige semantische analyse (dat is content, niet structuur)
  → uitvoerbaar script (dat komt later, als nodig)
```

De notatie is een *beschrijvingssysteem*, geen *uitvoeringssysteem*. Het antwoordt op: *hoe schrijf je een route op?* Niet: *hoe voer je een route uit?*

---

## 8. NPR-OS En Notatie

```
NPR_OS notatie :=
  beschrijving van routes
  + transform (reproduceerbaarheid)
  + intermediate_values (controleerbaarheid)
  + address_rule (deterministisch adres)
  + traceerbaarheid
  + context

niet:
  programmeertaal
  uitvoeringsmodel
  database-schema

wel:
  taal om het denkproces vast te leggen
  zodat het deelbaar en controleerbaar wordt
```

```
route
  = denkproces
  vastgelegd in
  een beschrijfbaar formaat

route + transform + intermediate_values
  = reproduceerbaar denkproces
```

---

## Status

```
ROUTE = {id, source, noise, transform, pattern, return, trace}: ✅
transform-veld (reproduceerbaarheid):                ✅
intermediate_values (controleerbaarheid):            ✅
address_rule (deterministisch adres):                ✅
required vs optional subvelden expliciet:            ✅
language: "und" voor onbekende taal:                 ✅
volledig voorbeeld (Genesis 1:1 + transform):        ✅
compacte notatie:                                    ✅
frequency_mapping gestructureerd:                    ✅
route_history gestructureerd:                        ✅
route_completeness (4 niveaus gesynchroniseerd):     ✅
provenance-object (oorsprongsverificatie):           ✅
LLM-waarschuwing (gesloten vs open informatie):     ✅
raw_pattern corrected (three-token, niet trisyllabisch): ✅
relatie stap 19 (taal-adres):                        ✅
relatie stap 64-69:                                  ✅
notatie = beschrijving (niet uitvoering):            ✅
step_71_formal_consistency:                          ✅ definitief reproduceerbaar
```

---

## Check: 2026-07-14 00:30 GMT+2
- Status: NPR-OS Stap 71 — definitief reproduceerbaar + verifieerbaar
- `route_completeness`: descriptive | traceable | reproducible | verifiable
- `provenance` object toegevoegd (bronverificatie)
- `raw_pattern` gecorrigeerd: three-token Hebrew sequence
- Vier niveaus gesynchroniseerd met volledigheidstatus
- Keten 69→70→71 voltooid: water→architectuur→monument→formele notatie

## Check: 2026-07-18 14:50 GMT+2
- Status: Stap 71 — gematria-rekenfout gecorrigeerd ✅
- בראשית: 2701→dr3 → 913→dr4 ✅
- ברא: 230→dr3 → 203→dr5 ✅
- אלהים: 86→dr6 → 86→dr5 ✅
- Volledige route: dr[4,5,5] mod9[4,5,5] ✅
- Address: taal://npr/dr[4,5,5]:mod9[4,5,5]:he:genesis_1_1 ✅
- Code fence ` ```n ` → ` ``` ` ✅
- perspective: combined + state_relation toegevoegd ✅
- step_71_example_consistency: ✅
- step_71_formal_consistency: ✅ definitief
