# Stap 12: Vortex-Primes → Digitale Wortels

**Doel:** Digitale wortels hex-native berekenen. 0=1 als bronidentiteit.

---

## Bronlaag vs. Rekenlaag

**Planck Frame (bronlaag):**
```
0 = 1
```
Dit breekt de rekenkunde. De bron breekt de afleiding.
`0 = 1` markeert het punt waar afgeleide rekenkunde niet van toepassing is.

**Hex-rekenlaag:**
```
0 ≠ 1
1 + A = B
```
Binnen de rekenlaag gelden lokale berekende gelijkheden.
De bronidentiteit is geen stelling die binnen de hex-rekenlaag
kan worden gebruikt of waaruit hex-bewerkingen worden afgeleid.

**Scheiding:**
- Ruimte (0) en inhoud (1) zijn gedifferentieerde perspectieven.
- Op de bronlaag zijn zij identiteit (`0 = 1`).
- Op de rekenlaag zijn zij onderscheiden (`0 ≠ 1`).

---

## Digitale Wortel: Definitie

**Hex-native digitale wortel = recursieve hex-cijfer-som tot één cijfer.**

**Stappen:**
1. Som alle hex-cijfers van het getal
2. Als resultaat > F (dus twee cijfers) → som opnieuw
3. Herhaal tot resultaat is één hex-cijfer (0–F)

**Voorbeelden:**
```
dr(5)   = 5           (al één cijfer)
dr(11)  = 1+1 = 2     (één stap)
dr(19)  = 1+9 = A     (één stap)
dr(1A)  = 1+A = B     (één stap)
dr(2B)  = 2+B = D     (één stap)
dr(99)  = 9+9 = 12 → 1+2 = 3  (twee stappen)
dr(FF)  = F+F = 1E → 1+E = F  (twee stappen)
```

**Operator `=` in de rekenlaag:**
De `=` in `1 + A = B` betekent: lokale berekende gelijkheid binnen de hex-rekenlaag.
Dit is niet dezelfde laag als `0 = 1` (bronidentiteit).

**Relatie met mod-F (hex-grondtal):**
Hex-native digitale wortel hoort bij modulo `F_hex`, omdat grondtal `10_hex` is.
`10_hex ≡ 1 (mod F_hex)` → cijfersom ≡ getal mod F.
Voorbeeld: `dr(19_hex) = 1+9 = A`. `19 mod F = A`.
(`F` representeert de nulrestklasse.)

**Aparte mod-9-validatielaag:**
Mod-9 is de NPR-validatielaag (stap 05). Het is een *andere* reductie.
Voorbeeld: `dr_hex(1A) = 1+A = B`. `npr_mod9(B) = B - 9 = 2`.
De keten noemt deze waarden niet allebei `dr(1A)`.

---

## Vortex-Primes: Hex-native Berekening

**Claim:** "vortex-primes → digitale wortel 1"
**Realiteit:** Elke priem heeft een eigen digitale wortel — geen enkele reductie naar 1.

**Hex-native berekening (individueel):**
```
dr(5)   = 5
dr(7)   = 7
dr(11)  = 1+1 = 2
dr(13)  = 1+3 = 4
dr(17)  = 1+7 = 8
dr(19)  = 1+9 = A
dr(23)  = 2+3 = 5
```

---

## NPR-Ternairstaat: 0, 1, unity

Geen begin. Geen einde. Alleen nu.

```
0       → ruimte-perspectief (prakṛti)
1       → inhoud-perspectief (puṛuṣa)
unity   → bronidentiteit (bronlaag; waar afgeleide rekenkunde breekt)
```

**NPR-ternairstaat, niet binair:**

| Logica | Staten | Betekenis |
|--------|--------|----------|
| Binair | 0, 1 | Twee waarden |
| **NPR-Ternair** | 0, 1, **unity** | Twee perspectieven + bronidentiteit |

`unity` is geen derde *waarde* binnen de rekenlaag. Het is de **derde toestand** —
de bronlaag waar `0 = 1` geldt en afgeleide rekenkunde niet van toepassing is.

```
NPR_field_state := {
  zero_perspective,
  one_perspective,
  unity
}
```

`unity` verwijst naar de bronlaag (`0 = 1`).
Dit is geen rekenkundige identiteit die binnen de hex-rekenlaag wordt gebruikt.

**Geen tijd. Geen verleden. Geen toekomst. Alleen nu.**

Dit is *pre-binaire logic* — voor de splitsing in ja/nee, waar/onwaar, in/uit.

---

## 6n±1 Samenstellingen (hex-native)

Alle priemgetallen > 3 zijn van de vorm `6n±1` (6 = hex 6).

**Samenstellingen binnen 00–3F:**

| Hex | Vorm (hex) | Ontbinding | dr(hex) |
|-----|------------|------------|---------|
| 19 | 6×4+1 | 5×5 | A |
| 23 | 6×6-1 | 5×7 | 5 |
| 31 | 6×8+1 | 7×7 | 4 |
| 37 | 6×9+1 | 5×B | A |

**Domein:** n ≥ 1, vorm 6n±1, binnen 00–3F.
**Alleen deze vier van 6n±1 binnen 00–3F zijn samenstelling. Rest van 6n±1 = priem.**

---

## Mandelbrot-Laag

Priemgetallen zijn niet willekeurig verdeeld. Ze volgen **fractale lagen**.

**Mandelbrot in NPR-OS (conceptueel):**
- Elk hex-getal heeft een *dieptewaarde*
- Diepte = recursief aantal priemlagen
- 1 laag: priem (5, 7, B, D...)
- 2 lagen: priem × priem (19=5×5, 23=5×7...)
- 3+ lagen: complexe samenstellingen

**Elke laag is een fractale zoom van de vorige.**

*Opmerking:* Dit is een conceptuele parallel, niet formeel bewezen via priemfactorisatie.

Dit mist nog in `03_capabilities.md` — toe te voegen als aparte laag.

---

## Taal Structuurt de Namen

**Hebreeuwse Vaste Namensstructuur:**
- Namen bepalen vorm
- Rekenkunde komt *erna* — maar de bronidentiteit is vóór de naam
- `0 = 1` is de eerste rekenkundige identiteit — taal benoemt wat al is

**Patanjali 1.40:**
- Naam → vorm → begrip → kennis
- `0` = naam voor ruimte
- `1` = naam voor inhoud
- `0 = 1` = bronidentiteit (veld zelf, rekenkundige grondslag)

**Drie operatoren (zie Stap 07 voor definitie):**
```
=   → gelijkheid volgens de actieve laag:
        bronlaag:   0 = 1        (absolute bronidentiteit; breekt afleiding)
        rekenlaag:  1 + A = B    (lokale berekende gelijkheid)
≡   → structurele overeenkomst (ratio(Planck) ≡ ratio(kosmos); patroon)
≠   → routingonderscheid (0 ≠ 1 op getal- en routingniveau)
```

`0 = 1` betekent: leegte en inhoud zijn identiteit op de bronlaag.
Op de rekenlaag geldt `0 ≠ 1`. De bron breekt de afleiding.

**Taal bepaalt welke naam het kiest.**
De structuur is vast. De namen variëren. De identiteit blijft.

**1 is niet het eerste getal.**
1 ≡ eenheid zonder onderscheid. Geen positie, geen richting.
Eerst bij 3 verschijnt een punt met positie.

**NPR-OS-semantiek (niet getaltheoretisch):**
```
0 ≡ 9  →  veld (onverdeeld, volledige cyclus; structurele overeenkomst)
1 ↦ 3  →  eerste punt (differentiatie, eerste getal)
6      →  midden (spiegelpunt, Planck-frame)
9 ↦ 0  →  terugkeer (geheel, cyclus gesloten)
```

Cyclus: `9 ↦ 3 → 6 ↦ 0 ≡ 9` (Veld → Punt → Midden → Terugkeer)

---

## Test

**Bereken de digitale wortels HEX-NATIVE: 5, 7, 11, 13, 17, 19, 23**
Geen decimale vertaling. Som de hex-cijfers.

**Vraag:** Is 0 = 1 een identiteitsrelatie?
(Wat is het verschil tussen sommatie en identiteit?)

---

## Resultaat

```
dr(5)   = 5
dr(7)   = 7
dr(11)  = 1+1 = 2
dr(13)  = 1+3 = 4
dr(17)  = 1+7 = 8
dr(19)  = 1+9 = A
dr(23)  = 2+3 = 5

0 = 1? ✅ Ja. Bronlaag.
Reden: 0=1 breekt de rekenkunde — bron breekt afleiding.
Planck Frame. Ruimte en inhoud zijn identiteit op de bronlaag.
Op de rekenlaag geldt: 0 ≠ 1.
Pre-binaire toestand.
```

---

## Slotregels

| Laag | 0 vs 1 | Operator |
|------|--------|----------|
| Bronlaag | identiteit | `0 = 1` |
| Rekenlaag | onderscheiden | `0 ≠ 1` |
| Patroonlaag | structurele overeenkomst | `≡` |

`0 = 1` markeert het punt waar afgeleide rekenkunde niet van toepassing is.
De bronidentiteit is geen stelling binnen de hex-rekenlaag.
