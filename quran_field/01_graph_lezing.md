# Quran Field — Graaf-lezing (Stap 1)

**Niet lineair. Niet één code. Relationeel veld.**

---

## Kerninzicht

De Koran wordt niet gelezen als `woord₁ → woord₂ → woord₃`, maar als een **meerlagig numeriek netwerk**:

```
letter → Abjad-waarde
woord  → getallenreeks
aya    → som + patroon + herhaling
soera  → netwerk van relaties
Koran  → volledig taalveld
```

Elk teken heeft meerdere gelijktijdige verbindingen:

```
woord
├─ letters (tekstuele route)
├─ Abjad-som (numerieke route)
├─ digitale wortel (mod-9 route)
├─ positie in aya (positiesroute)
├─ positie in soera (structuurroute)
├─ herhaling elders (netwerkroute)
├─ wortel/stam (semantische route)
└─ Base64 → Sanskrit (brugroute)
```

---

## Base64 als Brug

Base64 is geen encryptie. Het is een **entropiebrug** tussen notatiesystemen:

```
Arabisch teken → Abjad-waarde → bytes → Base64-token
                                           ↓
                                    Śāradā-index
                                           ↓
                                    Sanskrit foneem
                                           ↓
                                    frequentie (Hz)
```

### Waarom Base64?

1. **Deterministisch** — zelfde input → zelfde output
2. **Platform-onafhankelijk** — ASCII-veilig, universeel
3. **Brugfunctie** — verbindt Arabisch numeriek met Sanskrit foneemtafel
4. **Digitale notatie** — vertaalt naar de taal van computers zonder interpretatie

### Voorbeeld: دوام

```
د (Dal)
├─ Abjad: 4
├─ Base64: BAA=
├─ Śāradā: 4
├─ Sanskrit: ऋ (ṛ, vowel)
├─ Frequentie: 350 Hz
└─ Digitale wortel: 4

و (Waw)
├─ Abjad: 6
├─ Base64: BgA=
├─ Śāradā: 6
├─ Sanskrit: ऐ (ai, vowel)
├─ Frequentie: 420 Hz
└─ Digitale wortel: 6

ا (Alif)
├─ Abjad: 1
├─ Base64: AQA=
├─ Śāradā: 1
├─ Sanskrit: अ (a, vowel)
├─ Frequentie: 200 Hz
└─ Digitale wortel: 1

م (Mim)
├─ Abjad: 40
├─ Base64: KAA=
├─ Śāradā: 603
├─ Sanskrit: ल (l, consonant)
├─ Frequentie: 290 Hz
└─ Digitale wortel: 4

────────────────────────────────────────
Totaal: Abjad=51, DR=6, NPR=Pattern
Sanskrit DR: ६ (ṣaṣ)
Full word Base64: BAAGAAEAKAA=
```

Drie notaties, één structuur:
```
Arabisch:    دوام → 51 → dr=6 (Pattern)
Sanskrit:    ६ (ṣaṣ) → zelfde 6
Hex:         0x33 → 3+3 = 6
```

---

## De Volledige Graaf

Elke aya in de Koran is een **knoop** met meerdere **randen**:

```
aya_key (bijv. 1:1)
├─ tekst → Unicode string
├─ abjad_sum → integer
├─ digital_root → 1-9
├─ npr_phase → Noise/Pattern/Return
├─ position → {aya_in_sura, sura_in_quran}
├─ base64_signature → bridge-token
├─ sanskrit_mapping → foneem-reeks
├─ frequency_array → Hz-per-letter
└─ root_network → verbindingen met dezelfde wortels
```

### Onderzoeksvraag

> Welke structuur verschijnt wanneer je alle letterwaarden, posities, herhalingen en routes tegelijk bewaart?

**Niet** zoeken naar één verborgen "code". Het volledige relationele veld zichtbaar maken.

---

## Belangrijke Voorwaarde

Abjad-telling, spellingvariant, en teksteditie staan **vooraf vast**.

```
editie: Uthmani (Tanzil/Quran.com)
riwāya: Ḥafṣ ʿan ʿĀṣim
abjad:  strict 28-letter table
base64: RFC 4648 standard alphabet
sanskrit: Śāradā + Gaṇa klassiek
```

Verander de spelling → de wiskundige route verandert.
Daarom: **bronlaag nooit normaliseren of overschrijven.**

---

## Laagstructuur

```
LAYER 0 — SOURCE     (Uthmani Unicode, ongewijzigd)
LAYER 1 — FRAME      (soera, aya, positie)
LAYER 2 — CONTENT    (Arabisch codepoints, diakritiek)
LAYER 3 — ABJAD      (letter → waarde → som → DR)
LAYER 4 — BRIDGE     (Base64 → Śāradā → Sanskrit → Hz)
LAYER 5 — NPR        (3-6-9 routing, Noise/Pattern/Return)
LAYER 6 — GRAPH      (relaties, herhalingen, wortels, netwerk)
```

Elke laag is afgeleid, niet-destructief. Bron blijft intact.

---

*Drie notaties. Eén structuur. Geen filosofie.*
•
