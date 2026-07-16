# NPR Patañjali Blueprint

De Patañjali-loop als NPR-informatieblueprint.

De route begint en eindigt in `0.0.0.0`.

`0.0.0.0` is geen passieve leegte. Het is het open eiland waarin informatie kan verschijnen, de actieve ruimte waardoor informatie tussen vormen wordt gerouteerd, en het returnveld waarin de afgelegde route behouden blijft.

---

## 1.5 - Vijfvoudigheid

> वृत्तयः पञ्चतय्यः क्लिष्टाऽक्लिष्टाः

Vijf vṛtti, elk *kliṣṭa* of *akliṣṭa*.

**Data:**
- working_unaccented: 104 bytes, hex 68, DR 5
- source_accented: 116 bytes, hex 74, DR 8
- accent_cost: 12 bytes

DR van bytes (5) = sūtranummer (5).

```yaml
vṛtti_type:
  pramāṇa | viparyaya | vikalpa | nidrā | smṛti

route_quality:
  kliṣṭa | akliṣṭa
```

## 1.25 - Perspectief

> तत्र निरतिशयं सर्वज्ञबीजम्

De vijf routes zijn niet het perspectief dat ze waarneemt.

**Data:**
- working_unaccented: 74 bytes, hex 4A, DR 2
- source_accented: 92 bytes, hex 5C, DR 2
- accent_cost: 18 bytes

DR blijft 2 in beide lagen - accenten veranderen de structuur niet.

```yaml
vṛtti = route van informatie
ātman = positie van waaruit de route zichtbaar is
```

## 1.19 - Relationeel patroonveld

> भवप्रत्ययो विदेहप्रकृतिलयानाम्

Informatie bestaat niet los van haar omgeving.

**Data:**
- working_unaccented: 88 bytes, hex 58, DR 7
- source_accented: 103 bytes, hex 67, DR 4
- accent_cost: 15 bytes

DR verschuift van 4 → 7 tussen lagen. Accenten veranderen de digitale structuur hier.

```yaml
1.19 = context graph
relations:
  source
  context
  overlaps
  dependencies
  perspectives
  previous_routes
```

## 1.13 - Stabiele structuur

> तत्र स्थितौ यत्नोऽभ्यासः

Een patroon wordt bruikbaar wanneer het herhaalbaar en navigeerbaar wordt.

**Data:**
- working_unaccented: 68 bytes, hex 44, DR 5
- source_accented: 80 bytes, hex 50, DR 8
- accent_cost: 12 bytes

DR verschuift van 8 → 5. Dezelfde verschuiving als 1.5 (8 → 5).

## 1.40 - Schaal

> परमाणु परममहत्त्वान्तोऽस्य वशीकारः

Iedere informatieroute kan worden gevolgd van het kleinste tot het grootste.

**Data:**
- working_unaccented: 98 bytes, hex 62, DR 8
- source_accented: 122 bytes, hex 7A, DR 5
- accent_cost: 24 bytes (hoogste van alle route-knooppunten)

DR verschuift van 5 → 8 - omgekeerde richting van 1.5 en 1.13.

```yaml
vṛtti = informatiedimensie
1.40 = schaalas
```

---

## DR-Verschiving per Knooppunt

| Sūtra | DR (unaccented) | DR (accented) | Richting |
|-------|----------------:|--------------:|----------|
| 1.5   | 5              | 8             | ↑        |
| 1.25  | 2              | 2             | -        |
| 1.19  | 7              | 4             | ↓        |
| 1.13  | 5              | 8             | ↑        |
| 1.40  | 8              | 5             | ↓        |

1.25 is het enige knooppunt waar DR ongewijzigd blijft tussen lagen.

---

## Boek 1 - Volledige DR-Reeks

Som boek 1 (unaccented): **267** → DR 2+6+7 = 15 → 1+5 = **6**

Route-som (DR's): **27** → 2+7 = **9**

DR-verdeling boek 1:
- DR1: 3 × | DR2: 4 × | DR3: 6 × | DR4: 8 × | DR5: 7 ×
- DR6: 4 × | DR7: 9 × | DR8: 6 × | DR9: 4 ×

DR7 is de meest voorkomende in boek 1. DR1 komt het minst voor (3×).

## De Iteratieve Hexadecimale Projectie

De route door Boek 1 volgt een iteratieve projectieregel (decimaal → hexadecimaal → nieuwe decimale invoer).

Twee ketens lopen parallel:

### Keten A - Vijfvoudigheid (5 × 5)

| Stap | Operatie | Resultaat | Sūtra |
|------|----------|-----------|-------|
| begin | vijfvoudigheid | 5 | 1.5 |
| expansie | 5 × 5 | 2510 | 1.25 |
| projectie | 2510 = 1916 | 19 | 1.19 |
| projectie | 1910 = 1316 | 13 | 1.13 |
| terminaal | 1310 = D16 | D | einde numeriek |

**Data:**

| Sūtra | Sanskrit | Bytes | DR |
|-------|----------|------:|---:|
| 1.5   | वृत्तयः पञ्चतय्यः क्लिष्टाऽक्लिष्टाः | 104 | 5 |
| 1.25  | तत्र निरतिशयं सर्वज्ञबीजम् | 74 | 2 |
| 1.19  | भवप्रत्ययो विदेहप्रकृतिलयानाम् | 88 | 7 |
| 1.13  | तत्र स्थितौ यत्नोऽभ्यासः | 68 | 5 |

DR-reeks: [5, 2, 7, 5] → som 19

### Keten B - Zevendigheid (7 × 7)

| Stap | Operatie | Resultaat | Sūtra |
|------|----------|-----------|-------|
| begin | pramāṇa | 7 | 1.7 |
| expansie | 7 × 7 | 4910 | 1.49 |
| projectie | 4910 = 3116 | 31 | 1.31 |
| terminaal | 3110 = 1F16 | 1F | einde numeriek |

**Data:**

| Sūtra | Sanskrit | Bytes | DR |
|-------|----------|------:|---:|
| 1.7   | प्रत्यक्षानुमानागमाः प्रमाणानि | 88 | 7 |
| 1.49  | श्रुतानुमानप्रज्ञाभ्यामन्यविषया विशेषार्थत्वात् | 139 | 4 |
| 1.31  | दुःखदौर्मनस्याङ्गमेजयत्वश्वासप्रश्वासा विक्षेपसहभुवः | 154 | 1 |

DR-reeks: [7, 4, 1] → som 12

### Spiegelrelatie 1.7 ↔ 1.19

Beide sūtra's hebben identieke computationele handtekening:

| | 1.7 | 1.19 |
|---|----:|----:|
| bytes | 88 | 88 |
| hex | 58 | 58 |
| DR | 7 | 7 |

1.7 start keten B. 1.19 ligt in keten A. Dezelfde bytes, verschillende routes.

### Terminale Vergelijking

- Keten A → `D`₁₆ (13) — hex-letter D, symbolisch terminaal
- Keten B → `1F`₁₆ (31) — hex-grens, routeringsbesluit
- Verschil: 31 − 13 = 18

### NPR-Routeringsregel: 1F → 0x40 → 1.40

`1F` is geen gewone hexconversie. Het is een representatiegrens.

> `0–F` = zestien posities
> na `F` volgt een nieuwe plaatswaarde

Niet: `1F = 40`
Maar: **`1F` bereikt een representatiegrens; `0x40` opent het 64-veld.**

De regel:

> Wanneer een sūtraroute in hex op `1F` eindigt en niet langer rechtstreeks als sūtra-index kan worden gelezen, wordt zij via het `0.0.0.0`-eiland naar `0x40` gerouteerd. `0x40` vertegenwoordigt het 64-veld (`64 = 2⁶`) en activeert Sūtra 1.40 als schaalpoort.

Compact:

> `1.7 → 1.49 → 1.31 → 1F | 0x40 → 1.40`

Beide ketens convergeren naar 1.40 (schaalas):

```
Keten A: 1.5 → 1.25 → 1.19 → 1.13 → D₁₆
Keten B: 1.7 → 1.49 → 1.31 → 1F₁₆ → 0x40 → 1.40
```

Keten A eindigt in het symbolische (`D`). Keten B loopt door de grens (`1F`) via `0.0.0.0` naar het veld (`0x40 = 64`) en activeert 1.40 als tekstueel knooppunt.

---

## De Volledige NPR Patañjali-Loop

### Keten A - Vijfvoudigheid

> `0.0.0.0` - open bronveld
> → `1.5` - vijf vṛtti
> → `1.25` - dragend perspectief
> → `1.19` - relationeel patroonveld
> → `1.13` - stabiele structuur
> → `1.40` - schaal
> → `0.0.0.0` - return

### Keten B - Zevendigheid

> `0.0.0.0` - open bronveld
> → `1.7` - pramāṇa (validatielaag)
> → `1.49` - alternatieve validatiebronnen
> → `1.31` - lichamelijke verstoring
> → `0.0.0.0` - return

### Spiegel

1.7 en 1.19 delen bytes/hex/DR. Keten A en B zijn twee routes door dezelfde tekst, gestart vanuit verschillende sūtra-indices.

### Compact

> **Keten A:** veld → categorie → perspectief → relatie → structuur → schaal → return
> **Keten B:** veld → validatie → alternatief → verstoring → return

---

Dit model vervangt geen klassieke uitleg van Patañjali, maar vertaalt geselecteerde sūtra's naar een operationeel informatiemodel. De Sanskrittekst levert de knooppunten; de computationele lagen maken de route. Vertaling is niet nodig - de bytes en hex-projectie volgen de structuur zelf.
