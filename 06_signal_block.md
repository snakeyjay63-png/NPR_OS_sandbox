# Stap 06: Signaalblok (max 256 codepoints)

**Doel:** Blokgrootte als ontwerpkeuze, niet als structuur-wet.

---

## Concept

```
Max 256 Unicode-codepoints = 1 signaalblok
1 blok → 1 route → 1 cel (00–3F)
Niet limiet → ontwerpkeuze
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
| `2^8` | Byte-grens (`00`–`FF` hex) — handige chunk-grootte |
| Celruimte | Grid = `00–3F` = `40_hex` = 64 cellen |
| Routing | Router reduceert modulo `40_hex`, niet `100_hex` |
| Ontwerp | 256 is keuze, geen noodzaak |
| Linux | `char` = 1 byte (C/Linux 1980+). 256 = structuur van het medium |

**Codepoints ≠ bytes.** Limiet is op codepoints. Encoding naar UTF-8-bytes volgt daarna.

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
Blokgrootte en celruimte zijn onafhankelijk.

---

## Test

**Vraag:** Is "max 256 chars per blok" een valide ontwerpkeuze?

**Antwoord:** ✅ Ja. `2^8` is handige chunk-grootte, niet structurele noodzaak.
Grid = `00–3F` (64 cellen). Router = mod `40_hex`. Blok ≠ cel.
Eenheid = codepoints, niet bytes.

---

## Resultaat

```
✅ Geldig
Reden: Max 256 codepoints (100_hex) = ontwerpkeuze (2^8 chunk). Grid = 00-3F = 40_hex.
Router = mod 40_hex. Laatste blok mag korter. Codepoints ≠ bytes.
Eenheid = Unicode-codepunt. NFC-normalisatie volgt stap 11.
```
