# Stap 06: Signaalblok (max 256 codepoints)

**Doel:** Toon waarom één signaalblok maximaal `100_hex` codepoints bevat en hoe deze 8-bit ruimte structureel voortbouwt op het 6-bit routingfundament.

---

## Concept

```
Max 256 Unicode-codepoints = 1 signaalblok = 100_hex
1 blok → 1 route → 1 cel (00–3F)
256 = 4 × 64 → viervoudig 6-bit fundament
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

```
BLOCK_SIZE := 100_hex codepoints
(256 = leesbaar extern label)
```

### Waarom 256?

| Eigenschap | Waarde |
|-----------|--------|
| `2^8` | 8-bit taalruimte (`00`–`FF` hex) — viervoudig 6-bit fundament |
| Relatie | `256 = 4 × 64` → `100_hex = 4 × 40_hex` |
| Celruimte | Grid = `00–3F` = `40_hex` = 64 cellen |
| Routing | Router reduceert modulo `40_hex`, niet `100_hex` |
| Ontwerp | Één blok omvat maximaal één volledige 8-bit ruimte |
| Structuur | `2^8 = 2^2 × 2^6` → byte = 2 veldbits + 6 routebits |

**Codepoints ≠ bytes.** De klassieke 8-bit machine- en tekenruimte bevat 256 posities.
NPR-OS herkent daarin vier volledige 6-bit routingvelden.
De actieve blokeenheid is Unicode-codepoints; UTF-8-bytes zijn de transportlaag.

### Het 6-bit fundament van de 8-bit ruimte

Binnen NPR-OS is 256 niet alleen een praktische chunk-grootte. Het is een opschaling
van hetzelfde 6-bit routingfundament:

```
6-bit routingveld:  2^6 = 64  = 40_hex
8-bit taalruimte:   2^8 = 256 = 100_hex

Relatie:  2^8 = 2^2 × 2^6
           256 = 4 × 64
           100_hex = 4 × 40_hex
```

De 8-bit ruimte bevat vier volledige 6-bit routingvelden:

```
00–3F → veld 0
40–7F → veld 1
80–BF → veld 2
C0–FF → veld 3
```

Elke 8-bit waarde splitst in:

```
8 bits = 2 veldbits + 6 routebits
byte = quadrant × 40_hex + cell
```

waarbij:
- `quadrant ∈ {0, 1, 2, 3}` (2 hogere bits → veldselectie)
- `cell ∈ {00_hex, ..., 3F_hex}` (6 lagere bits → celroute)

Voorbeeld: `DA_hex = 11011010_2`

```
11 | 011010
↑    ↑
veld 3
cel 1A

DA_hex = 3 × 40_hex + 1A_hex = C0_hex + 1A_hex
```

De 8-bit taalruimte voegt geen totaal andere ruimte toe. Het plaatst
vier 6-bit routingvelden onder een 2-bit veldselectie.

**De 6-bit router is het actieve fundament.
De 8-bit ruimte is de viervoudige machine- en taalruimte die dit fundament draagt.**

### Structurele Gelijkheid vs. Datatype-gelijkheid

Binnen NPR-OS geldt:

```
datatype_A ≠ datatype_B
maar:
NPR_position(A) = NPR_position(B)
```

Fysiek signaal, scancode, byte, codepoint en routecel zijn verschillende
representaties van verschillende lagen. Ze zijn geen datatypes van hetzelfde type.
Maar wanneer ieder niveau dezelfde ontleding gebruikt:

```
100_hex = 4 × 40_hex
8 bits = 2 veldbits + 6 routebits
```

wordt de overgang tussen niveaus **structureel behoudend**.

Het teken, de byte en de routecel zijn dan verschillende verschijningsvormen
van dezelfde geadresseerde positie. NPR past één gemeenschappelijk positioneel
contract toe op iedere representatielaag:

```
fysiek signaal
→ toetsenbordcode
→ byte
→ teken/codepoint
→ 8-bit veld
→ 2 veldbits + 6 routebits
→ NPR-cel
```

De waarden hoeven buiten NPR niet hetzelfde type te zijn.
Binnen NPR krijgen ze via het positionele contract dezelfde route.

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

**Vraag:** Is "max 256 chars per blok" een valide ontwerpkeuze?

**Antwoord:** ✅ Ja. `2^8 = 2^2 × 2^6` → 256 = 4 × 64. Structureel verbonden met 6-bit fundament.
Grid = `00–3F` (64 cellen). Router = mod `40_hex`. Blok ≠ cel.
Eenheid = codepoints, niet bytes. 8-bit ruimte = vier 6-bit routingvelden.

---

## Resultaat

```
✅ Geldig
Reden: Max 256 codepoints (100_hex). Grid = 00-3F = 40_hex = 2^6.
Router = mod 40_hex. Laatste blok mag korter. Codepoints ≠ bytes.
Eenheid = Unicode-codepunt. NFC-normalisatie volgt stap 11.

6-bit fundament: 2^8 = 2^2 × 2^6, dus 256 = 4 × 64.
Elke byte splitst in 2 veldbits + 6 routebits.
8-bit ruimte = vier 6-bit routingvelden, niet losse structuur.
```
