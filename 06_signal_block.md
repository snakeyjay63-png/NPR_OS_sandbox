# Stap 06: Signaalblok (max 256 codepoints)

**Doel:** Toon waarom één signaalblok maximaal `100_hex` codepoints bevat en hoe deze 8-bit ruimte structureel voortbouwt op het 6-bit routingfundament.

---

## Concept

```
BLOCK_SIZE := 256 Unicode-codepoints
1 blok → 1 route → 1 cel (00–3F)
```

**Blokgrootte = maximaal 256 Unicode-codepoints.** Laatste blok mag korter zijn.

Als input > 256 codepoints: **split in nieuwe signalen, niet afkappen.**
Elk signaal → 1 route → 1 cel binnen `00-3F`.

### Eenheid: Unicode-codepoints (niet bytes)

**De gekozen eenheid: Unicode-codepoints.**
- Consistent door stap 06, 07 en 11.
- 1 codepoint = 1 Unicode-codepunt (U+XXXX)
- 1 zichtbaar teken kan uit één of meer codepoints bestaan
- UTF-8-encoding = transportlaag (1–4 bytes per codepoint)
- `ū` = 1 codepoint (U+0169) = 2 bytes UTF-8
- `😀` = 1 codepoint (U+1F600) = 4 bytes UTF-8

**Belangrijk:** de bloklengte (0–256 codepoints) is een andere grootheid dan
de waarde van elk codepoint (U+0000–U+10FFFF).
Een blok met maximaal 256 codepoints betekent *niet* dat elk codepoint in `00–FF` past.

```
BLOCK_SIZE := 256 codepoints    ← 8×8×4 blokstructuur
codepointwaarde := U+0000–U+10FFFF  ← inhoudsruimte
```

### Waarom 256?

**256 is geen willekeurige chunk-grootte — het is de vierde dimensie van het 8×8 grid.**

```
8 × 8     = 64   ← routinggrid (6-bit, cellen 00–3F)
8 × 8 × 4 = 256  ← volledige blokruimte (8-bit, quad-state uitbreiding)
```

| Dimensie | Structuur | Functie |
|----------|-----------|--------|
| 8 | eerste as | rij |
| 8 | tweede as | kolom |
| 64 = 8×8 | 6-bit grid | routingfundament (`00–3F`) |
| 4 = 2² | derde as | quad-state / veldmultiplier |
| 256 = 64×4 | 8-bit ruimte | volledige blokstructuur (`00–FF`) |

```
64  = 2^6  ← 6-bit routingfundament
256 = 2^8  ← 8-bit blokruimte
256 = 4 × 64 = (2^2) × (2^6) = 2^(2+6) = 2^8
```

De factor-4 is geen toeval. Het is de natuurlijke uitbreiding van 6-bit → 8-bit:
- 2 extra bits = 4× meer ruimte per dimensie
- 4 velden van 64 cellen elk (`00–3F`, `40–7F`, `80–BF`, `C0–FF`)
- Dit sluit naadloos aan bij stap 07: **256 = structuur van het medium**

**De eenheid is de keuze — de structuur is 256:**
- De bloklengte (256) volgt uit de 8×8×4-structuur
- De *gekozen eenheid* is Unicode-codepoints (niet bytes)
- UTF-8-encoding = transportlaag (1–4 bytes per codepoint)
- Codepoints ≠ bytes (zie onder)

**Codepoints ≠ bytes.** De actieve blokeenheid is Unicode-codepoints;
UTF-8-bytes zijn de transportlaag.

### De Sandbox Pipeline

De routing van blok naar cel verloopt via expliciete lagen:

```
blok (≤256 cp)
→ NFC-normalisatie
→ UTF-8-bytearray
→ SHA-256
→ eerste drie hextekens
→ mod 40_hex
→ cel 00–3F
```

Elke laag transformeert naar een nieuw datatype. De output van de vorige laag
is de input van de volgende. Geen impliciete tussenstappen.

### Het 6-bit Fundament (Per Byte)

Binnen NPR-OS is de 2+6-bit ontleding van toepassing op **iedere afzonderlijke
UTF-8 byte**, niet op de codepointwaarde zelf:

```
voor byte b:
  field = b >> 6          ← 2 veldbits
  cell  = b & 0x3F        ← 6 routebits
```

Voorbeeld: `DA_hex = 11011010_2`

```
11 | 011010
↑    ↑
veld 3
cel 1A

DA_hex = 3 × 40_hex + 1A_hex = C0_hex + 1A_hex
```

De 8-bit ruimte bevat vier volledige 6-bit routingvelden:

```
00–3F → veld 0
40–7F → veld 1
80–BF → veld 2
C0–FF → veld 3
```

Eén codepoint kan echter uit één tot vier van zulke bytes bestaan.
De byte-ontleding geldt *per byte*, niet per codepoint.

### Structurele Gelijkheid vs. Datatype-gelijkheid

Binnen NPR-OS geldt:

```
datatype_A ≠ datatype_B
maar:
NPR_position(A) = NPR_position(B)
```

Fysiek signaal, scancode, byte, codepoint en routecel zijn verschillende
representaties van verschillende lagen.

De keten:
```
fysiek signaal → toetsenbordcode → byte → codepoint → 8-bit veld → NPR-cel
```
is **niet** algemeen één-op-één of omkeerbaar:
- één teken kan meerdere codepoints bevatten;
- één codepoint kan meerdere UTF-8-bytes bevatten;
- een toets kan nul, één of meerdere tekens produceren;
- dezelfde tekst kan verschillende codepointreeksen hebben vóór normalisatie.

De structurele gelijkheid ontstaat niet door datatypes gelijk te stellen,
maar door de *transformatiepijplijn* deterministisch te houden:
NFC-normalisatie → UTF-8 → SHA-256 → mod 40_hex.

**De 6-bit router is het actieve fundament.
De pipeline is de deterministische weg daar naartoe.**

### Split-regel

```
Input 512 cp → 2 signalen (256 + 256) → 2 routes → 2 cellen
Input 300 cp → 2 signalen (256 + 44)  → 2 routes → 2 cellen
Input 255 cp → 1 signaal  (255)       → 1 route  → 1 cel
Input   1 cp → 1 signaal  (1)         → 1 route  → 1 cel
```

Elk blok = maximaal 256 codepoints. Laatste blok mag korter. Geen data-verlies.

### Route → Cel

```
Blok → hash → hex → mod 40_hex → cel 00–3F
```

Router reduceert modulo `40_hex` (64 cellen), niet `100_hex` (256).
Blokgrootte en celruimte hebben verschillende functies, maar zijn structureel verbonden via:
`100_hex = 4 × 40_hex`

---

## Test

**Vraag:** Is 256 een willekeurige chunk-grootte of volgt het uit de structuur?

**Antwoord:** ✅ 256 volgt uit 8×8×4.
- 8×8 = 64 cellen (routingfundament, 6-bit)
- 4 = quad-state uitbreiding (2² = 2 extra bits)
- 256 = 64 × 4 = 2⁸ (volledige 8-bit blokruimte)
- De *eenheid* is keuze (Unicode-codepoints), de *structuur* is 256
- Sluit aan op stap 07: 256 = structuur van het medium
Pipeline: blok → NFC → UTF-8 bytes → SHA-256 → [:3] hex → mod 40_hex → cel.
Byte-ontleding (2+6) geldt per UTF-8 byte, niet per codepoint.

---

## Resultaat

```
✅ Geldig (na herstel)
Reden: BLOCK_SIZE = 256 codepoints (8×8×4 structuur).
De eenheid is keuze (Unicode-codepoints); de structuur is 256.
Codepointwaarde = U+0000–U+10FFFF (inhoudsruimte).
Pipeline: blok → NFC → UTF-8 → SHA-256 → [:3] → mod 40_hex → cel.
Byte-ontleding (2 veld + 6 route) geldt per UTF-8 byte.
Laatste blok mag korter. Geen data-verlies.
Compatibel met stap 07: 256 = structuur van het medium.
```
