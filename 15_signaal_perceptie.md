# Stap 15: Signaal → Perceptie

**Doel:** Frequentie- en kleurspectrum-mapping specificeren. Sluit de keten die in stap 09 en 11 openbleef.

---

## Concept

Deze stap definieert een deterministische keten:

```
raw_input → NFC-normalisatie → foneem → phoneme_id → hex-index → frequentieratio → synthesizerparameter

frequentieratio → kleurindex 00–07 → kleurwaarde
```

**Fix 10: Inputpipeline** — keten begint met drie gestageerde functies:
```
normalize_nfc      : UnicodeText → NormalizedText
segment_phonemes   : NormalizedText → List<CanonicalPhoneme>
phoneme_id         : CanonicalPhoneme → PhonemeID
```
NFC-normalisatie garandeert deterministische Unicode-weergave.
`segment_phonemes` ontledt de tekst tot canonieke fonemen (lettergrepen, afhankelijke klinkertekens, etc.).
`phoneme_id` kiest het stabiele getypeerde paar.

**Foutroutes:**
```
unsupported_phoneme          : CanonicalPhoneme → error
invalid_cluster             : NormalizedText → error
empty_input                 : UnicodeText → error
multiple_phonemes_in_single : List<CanonicalPhoneme> → error
```

**Scope:**
- Frequentieroute: Sanskrit-foneem → synthesizerparameter (pitch, filter, cutoff)
- Kleurroute: frequentieratio → 8 kleuren (Russell-spectrum)

**Voorwaarde uit stap 09:** Sanskrit als kerntaal voor frequentie-routing.
**Voorwaarde uit stap 11:** Codepoints als eenheid; NFC-normalisatie voor determinisme.

---

## 1. Foneem → Stabiele ID (phoneme_id)

De stabiele ID is een **getypeerd paar**: categorie + Śāradā-positie.
Śāradā is een historisch Sanskriets numeratiesysteem — NPR-OS gebruikt de
posities binnen dat systeem, maar voegt een categorietype toe om botsingen te
voorkomen.

```
phoneme_id : foneem → (categorie × positie)

phoneme_id(φ) :=
  (v, p)     als φ ∈ klinkers     (v = "vowel")
  (c, p)     als φ ∈ medeklinkers  (c = "consonant")

position : phoneme_id → ℤ
position((_, p)) := p
```

`(v, 1)` is niet gelijk aan `(c, 1)`. De tuple is de primaire sleutel.
`position` extrahiert de Śāradā-positie uit het getypeerde paar.

### Klinkers (स्वर) — Filter Control

| Foneem | phoneme_id | Rol |
|--------|------------|-----|
| अ | (v, 1) | filter cutoff |
| आ | (v, 2) | filter cutoff |
| इ | (v, 3) | filter cutoff |
| ई | (v, 4) | filter cutoff |
| उ | (v, 5) | filter cutoff |
| ऊ | (v, 6) | filter cutoff |
| ऋ | (v, 7) | filter cutoff |
| ए | (v, 8) | filter cutoff |
| ऐ | (v, 9) | filter cutoff |
| ओ | (v, 10) | filter cutoff |
| औ | (v, 11) | filter cutoff |
| ं (anusvāra) | (v, 12) | sub-bass |
| ः (visarga) | (v, 13) | delay |
| ँ (chandra bindu) | (v, 14) | resonance peak |

*ॐ (Om) is geen afzonderlijk foneem — zie § 4.*

### Medeklinkers (व्यञ्जन) — Oscillator Control

| Foneem | phoneme_id | Gaṇa | Rol |
|--------|------------|------|-----|
| क | (c, 1) | 1 | oscillator |
| ख | (c, 2) | 1 | oscillator |
| ग | (c, 3) | 1 | oscillator |
| घ | (c, 4) | 1 | oscillator |
| ङ | (c, 5) | 1 | oscillator |
| च | (c, 6) | 2 | oscillator |
| छ | (c, 7) | 2 | oscillator |
| ज | (c, 8) | 2 | oscillator |
| झ | (c, 9) | 2 | oscillator |
| ञ | (c, 10) | 2 | oscillator |
| ट | (c, 11) | 3 | oscillator |
| ठ | (c, 12) | 3 | oscillator |
| ड | (c, 13) | 3 | oscillator |
| ढ | (c, 14) | 3 | oscillator |
| ण | (c, 15) | 3 | oscillator |
| त | (c, 16) | 4 | oscillator |
| थ | (c, 17) | 4 | oscillator |
| द | (c, 18) | 4 | oscillator |
| ध | (c, 19) | 4 | oscillator |
| न | (c, 20) | 4 | oscillator |
| प | (c, 21) | 5 | oscillator |
| फ | (c, 22) | 5 | oscillator |
| ब | (c, 23) | 5 | oscillator |
| भ | (c, 24) | 5 | oscillator |
| म | (c, 25) | 5 | oscillator |
| य | (c, 26) | 6 | oscillator |
| र | (c, 27) | 6 | oscillator |
| ल | (c, 28) | 6 | oscillator |
| व | (c, 29) | 6 | oscillator |
| श | (c, 30) | 7 | oscillator |
| ष | (c, 31) | 7 | oscillator |
| स | (c, 32) | 7 | oscillator |
| ह | (c, 33) | 8 | oscillator |
| ळ | (c, 34) | — | oscillator |

**Domein:**
```
domein(klinker)      = { (v, p) | p ∈ {1 .. 14} }
domein(medeklinker)  = { (c, p) | p ∈ {1 .. 34} }
domein(totaal)       = domein(klinker) ∪ domein(medeklinker)
```

`phoneme_id` is wereldwijd uniek: twee fonemen delen nooit hetzelfde
`(categorie, positie)`-paar. `(v, 1) ≠ (c, 1)` ondanks identieke positie.

---

## 2. ID → Hex-Index

De hex-index encodeert het volledige getypeerde paar.
Klinkers krijgen het bereik `01..0E_hex`; medeklinkers `0F..30_hex`.

```
VOWEL_COUNT := 14_dec := E_hex

hex_index : phoneme_id → hex_string

hex_index((v, p))  := format_hex(p)              (01..0E_hex)
hex_index((c, p))  := format_hex(p_dec + VOWEL_COUNT)   (0F..30_hex)
```

De offset `VOWEL_COUNT = 14_dec = E_hex` = aantal klinkers. Dit zorgt voor disjointe hex-bereiken.

| Foneem | phoneme_id | hex_index |
|--------|-----------|-----------|
| अ | (v, 1) | 01 |
| आ | (v, 2) | 02 |
| ... | ... | ... |
| ँ | (v, 14) | 0E |
| क | (c, 1) | 0F |
| ख | (c, 2) | 10 |
| ग | (c, 3) | 11 |
| ... | ... | ... |
| स | (c, 32) | 2E |
| ह | (c, 33) | 2F |
| ळ | (c, 34) | 30 |

**Hex-bereiken:**
```
hex_range(klinker)      = {01_hex .. 0E_hex}   (14 waarden)
hex_range(medeklinker)  = {0F_hex .. 30_hex}   (34 waarden)
hex_range(totaal)       = {01_hex .. 30_hex}   (48 waarden, disjointe)
```

`hex_index` is wereldwijd uniek binnen NPR-OS. `(v,1) → 01_hex` botst
niet met `(c,1) → 0F_hex`.

*Opmerking: hex_index is een representatielaag, geen rekenlaag.
Interne berekeningen gebruiken het getypeerde paar; hex_index is display-notatie.*

**Hex-native claim:**
```
hex_index(id) ≠ id  (verschillende representaties)
hex_view(id) ≡ typed_view(id)  (perspectief-equivalentie binnen NPR)
```

---

## 3. Hex-Index → Frequentieratio

De frequentieratio is afgeleid van het **Gaṇa-nummer** (register) en **Śāradā-positie** (pitch).

### Basisfrequentie

```
f_base := 55 Hz  (A1 — ॐ oscillator-frequentie)
```

*Opmerking: 55 Hz = A1 in het MIDI-systeem (MIDI 33), niet C1. C1 = 32.70 Hz.*

### Klinkers — Filter Cutoff

Klinkers bepalen **niet** de oscillator-frequentie.
Ze sturen de **filter cutoff** en **resonantie (Q)**.

```
filter_cutoff : phoneme_id → Hz
filter_cutoff(id) := f_base × filter_ratio(position(id))

filter_Q : phoneme_id → ℝ
```

| Foneem | phoneme_id | position | filter_cutoff Hz | Q |
|--------|-----------|----------|-------------------|-----|
| अ | (v, 1) | 1 | 200 | 0.5 |
| आ | (v, 2) | 2 | 250 | 0.6 |
| इ | (v, 3) | 3 | 350 | 0.7 |
| ई | (v, 4) | 4 | 400 | 0.8 |
| उ | (v, 5) | 5 | 300 | 0.6 |
| ऊ | (v, 6) | 6 | 350 | 0.7 |
| ऋ | (v, 7) | 7 | 500 | 0.9 |
| ए | (v, 8) | 8 | 600 | 1.0 |
| ऐ | (v, 9) | 9 | 700 | 1.2 |
| ओ | (v, 10) | 10 | 650 | 1.1 |
| औ | (v, 11) | 11 | 750 | 1.3 |
| ं | (v, 12) | 12 | 100 | 1.5 |
| ः | (v, 13) | 13 | 800 | 0.3 |
| ँ | (v, 14) | 14 | 150 | 1.0 |

De frequentieratio voor klinkers is:

```
filter_ratio : phoneme_id → ℝ
filter_ratio(id) := filter_cutoff(id) / f_base
```

Voorbeelden:
```
filter_ratio((v,1))  = 200 / 55 ≈ 3.64
filter_ratio((v,8))  = 600 / 55 ≈ 10.91
filter_ratio((v,13)) = 800 / 55 ≈ 14.55
```

### Medeklinkers — Oscillator Frequentie

Medeklinkers sturen de **hoofdosillator** via MIDI-notenummers.

```
osc_freq : phoneme_id → Hz
osc_freq(id) := 440 × 2^((midi(id) - 69) / 12)

midi : phoneme_id → ℤ  (MIDI notenummer)
```

De Gaṇa bepaalt het register; de Śāradā-positie binnen Gaṇa bepaalt het semtoon-offset.

#### MIDI-toekenning per Gaṇa

| Gaṇa | Foneem | phoneme_id | MIDI | Noot | Freq (Hz) |
|------|--------|-----------|------|------|-----------|
| 1 (velaar) | क | (c,1) | 48 | C3 | 130.81 |
| | ख | (c,2) | 49 | C#3 | 138.59 |
| | ग | (c,3) | 50 | D3 | 146.83 |
| | घ | (c,4) | 51 | D#3 | 155.56 |
| | ङ | (c,5) | 52 | E3 | 164.81 |
| 2 (palataal) | च | (c,6) | 53 | F3 | 174.61 |
| | छ | (c,7) | 54 | F#3 | 185.00 |
| | ज | (c,8) | 55 | G3 | 196.00 |
| | झ | (c,9) | 56 | G#3 | 207.65 |
| | ञ | (c,10) | 57 | A3 | 220.00 |
| 3 (retroflex) | ट | (c,11) | 58 | A#3 | 233.08 |
| | ठ | (c,12) | 59 | B3 | 246.94 |
| | ड | (c,13) | 60 | C4 | 261.63 |
| | ढ | (c,14) | 61 | C#4 | 277.18 |
| | ण | (c,15) | 62 | D4 | 293.66 |
| 4 (dentaal) | त | (c,16) | 63 | D#4 | 311.13 |
| | थ | (c,17) | 64 | E4 | 329.63 |
| | द | (c,18) | 65 | F4 | 349.23 |
| | ध | (c,19) | 66 | F#4 | 369.99 |
| | न | (c,20) | 67 | G4 | 392.00 |
| 5 (labiaal) | प | (c,21) | 68 | G#4 | 415.30 |
| | फ | (c,22) | 69 | A4 | 440.00 |
| | ब | (c,23) | 70 | A#4 | 466.16 |
| | भ | (c,24) | 71 | B4 | 493.88 |
| | म | (c,25) | 72 | C5 | 523.25 |
| 6 (semi) | य | (c,26) | 73 | C#5 | 554.37 |
| | र | (c,27) | 74 | D5 | 587.33 |
| | ल | (c,28) | 75 | D#5 | 622.25 |
| | व | (c,29) | 76 | E5 | 659.25 |
| 7 (sibilant) | श | (c,30) | 77 | F5 | 698.46 |
| | ष | (c,31) | 78 | F#5 | 739.99 |
| | स | (c,32) | 79 | G5 | 783.99 |
| 8 (aspiraat) | ह | (c,33) | 80 | G#5 | 830.61 |
| | ळ | (c,34) | 48 | C3 | 130.81 |

**Afleiding:** elke Gaṇa start op een basis-MIDI; binnen Gaṇa tel +1 per positie.
Gaṇa 1–5 dekken C3–C5 continu; Gaṇa 6–7 zetten deze lijn door tot G#5.
Gaṇa 8 (ह) = G#5; ळ = uitzondering, terug naar C3.

Voorbeelden:
```
osc_freq((c,1))  = osc_freq(क) = 130.81 Hz  (MIDI 48, C3)
osc_freq((c,32)) = osc_freq(स) = 783.99 Hz  (MIDI 79, G5)
osc_freq((c,33)) = osc_freq(ह) = 830.61 Hz  (MIDI 80, G#5)
```

De frequentieratio voor medeklinkers is:

```
osc_ratio : phoneme_id → ℝ
osc_ratio(id) := osc_freq(id) / f_base
```

Voorbeelden:
```
osc_ratio((c,1))  = 130.81 / 55 ≈ 2.38
osc_ratio((c,32)) = 783.99 / 55 ≈ 14.25
osc_ratio((c,33)) = 830.61 / 55 ≈ 15.10
```

### Gecombineerde Ratio

Voor een foneem φ:

```
freq_ratio(φ) :=
  filter_ratio(phoneme_id(φ))  als φ ∈ klinkers
  osc_ratio(phoneme_id(φ))     als φ ∈ medeklinkers
```

---

## 4. Frequentieratio → Synthesizerparameter

De frequentieratio bepaalt **welke** synthesizerparameter wordt gestuurd:

```
synth_param : foneem → parameter_type
synth_param(φ) :=
  (cutoff, filter_cutoff(phoneme_id(φ)))    als φ ∈ klinkers
  (pitch,  osc_freq(phoneme_id(φ)))         als φ ∈ medeklinkers
```

**Klinkers:**
```
cutoff   := filter_cutoff(phoneme_id(φ))
resonance := filter_Q(phoneme_id(φ))
```

**Medeklinkers:**
```
pitch := osc_freq(phoneme_id(φ))
envelope := envelope_type(consonant_class(φ))
```

### Envelope per Klasse

ADSR-waarden zijn **gedeclareerde NPR-OS-defaults**, niet akoestisch gemeten.
Stap 16 kan deze verfijnen of per-context overschrijven.

| Klasse | Sanskrit | Attack | Decay | Sustain | Release |
|--------|----------|--------|-------|---------|---------|
| Sparśa | स्पर्श (stops) | 0.005 | 0.05 | 0.2 | 0.1 |
| Nāda | नाद (nasals) | 0.02 | 0.1 | 0.7 | 0.2 |
| Antaḥstha | अन्तःस्थ (semi) | 0.01 | 0.08 | 0.5 | 0.15 |
| Uṣma | ऊष्म (sibilants) | 0.001 | 0.02 | 0.8 | 0.05 |

### Speciaal: ॐ (Om)

ॐ is geen afzonderlijk foneem in `phoneme_id`. Het is een **compositie**:

```
ॐ = ओ + ँ + म (conceptueel)
  = klinker ओ (v,10): filter 650 Hz, Q=1.1 (tabellenwaarde)
    + chandra_bindu (v,14): lowpass Q=1.0, center=150 Hz (tabellenwaarde)
    + म (c,25): nasal MIDI 72 (C5), freq=523.25 Hz, gain=0.3
```

De `म`-component is afleidbaar uit de MIDI-tabel:
```
midi((c,25)) = 72
osc_freq((c,25)) = 440 × 2^((72-69)/12) = 440 × 2^(3/12) ≈ 523.25 Hz (C5)
om_nasal = 523.25 Hz × gain(0.3)  (nasale overtone, niet hoofdfrequentie)
```

```
om_oscillator := 55 Hz    (f_base zelf)
om_filter := sweep(200 Hz → 800 Hz, duration)
om_sub := 27.5 Hz        (f_base / 2)
om_attack := 2.0 s
om_release := 3.0 s
```

*Opmerking: om_sub is een conceptuele subharmonische (f_base/2),
geen afzonderlijk foneem. De compositie ओ + ँ + म bepaalt de
tabellenwaarden voor filter en nasal — geen afwijkingen van de standaardtabel.*

---

## 5. Frequentieratio → Kleurindex (00–07)

Russells 8-kleurenmodel mapt frequentie op op kleur.
De mapping is een **stuksgewijze functie** over halfopen intervallen.

### Kleurformule (exacte rationale grenzen)

```
color_index : freq_ratio → {0 .. 7}
color_index(r) :=
  0  als r ∈ [55/55,    130/55)     (Wit)
  1  als r ∈ [130/55,   220/55)     (Rood)
  2  als r ∈ [220/55,   330/55)     (Oranje)
  3  als r ∈ [330/55,   440/55)     (Geel)
  4  als r ∈ [440/55,   550/55)     (Groen)
  5  als r ∈ [550/55,   700/55)     (Blauw)
  6  als r ∈ [700/55,   800/55)     (Indigo)
  7  als r ∈ [800/55,   ∞)         (Violet)
```

De grenswaarden zijn afgeleid van `f_base = 55 Hz`. Exacte rationale vorm:
```
r_i = freq_boundary_i / f_base
  130/55 = 2.363636…  (≈ 2.364)
  220/55 = 4          (= 4.000)
  330/55 = 6          (= 6.000)
  440/55 = 8          (= 8.000)
  550/55 = 10         (= 10.000)
  700/55 = 12.727272… (≈ 12.73)
  800/55 = 14.545454… (≈ 14.55)
```

**Belangrijk:** gebruik de exacte breukvorm bij grenstoetsing.
Afgeronde waarden zijn alleen leeslabels — niet voor berekening.

**Eigenschap:** de formule is consistent met de frequentiedomein-definitie.
De vorige benadering (`floor(r × scale_factor) mod 8`) gaf grens-artefacten;
de stuksgewijze definitie elimineert deze.

### Russell 8-Kleuren — Gedeclareerde Mapping

| Index | Hex | Kleur | Engels | Freq-bereik (Hz) | Exacte Ratio | Leeslabel |
|-------|-----|-------|--------|-------------------|-------------|----------|
| 0 | 00 | Wit | White | [55, 130) | [55/55, 130/55) | [1, 2.364) |
| 1 | 01 | Rood | Red | [130, 220) | [130/55, 220/55) | [2.364, 4) |
| 2 | 02 | Oranje | Orange | [220, 330) | [220/55, 330/55) | [4, 6) |
| 3 | 03 | Geel | Yellow | [330, 440) | [330/55, 440/55) | [6, 8) |
| 4 | 04 | Groen | Green | [440, 550) | [440/55, 550/55) | [8, 10) |
| 5 | 05 | Blauw | Blue | [550, 700) | [550/55, 700/55) | [10, 12.73) |
| 6 | 06 | Indigo | Indigo | [700, 800) | [700/55, 800/55) | [12.73, 14.55) |
| 7 | 07 | Violet | Violet | [800, ∞) | [800/55, ∞) | [14.55, ∞) |

*Halfopen intervallen: linker grens inclusief, rechter grens exclusief.*
*Elke frequentie behoort tot precies één kleurband — geen overlap, geen lacune.*

*Deze frequentiebereiken zijn gedeclareerde NPR-OS-mappings, geen akoestische feiten.*

### Kleurwaarde

```
color_value : {0 .. 7} → (R, G, B)
```

| Index | Kleur | RGB |
|-------|-------|-----|
| 0 | Wit | (255, 255, 255) |
| 1 | Rood | (255, 0, 0) |
| 2 | Oranje | (255, 165, 0) |
| 3 | Geel | (255, 255, 0) |
| 4 | Groen | (0, 128, 0) |
| 5 | Blauw | (0, 0, 255) |
| 6 | Indigo | (75, 0, 130) |
| 7 | Violet | (128, 0, 128) |

### Volledige Keten — Voorbeeld

**Voorbeeld: स (sī)**
```
phoneme_id(स) = (c, 32)
hex_index((c, 32)) = 2E_hex
midi((c, 32)) = 79
osc_freq((c, 32)) = 783.99 Hz  (G5)
osc_ratio((c, 32)) = 783.99 / 55 ≈ 14.25
synth_param(स) = (pitch, 783.99 Hz)
color_index(14.25): 14.25 ∈ [12.73, 14.55) → 6
color_value(6) = (75, 0, 130)  → Indigo
```

**Voorbeeld: क (ka)**
```
phoneme_id(क) = (c, 1)
hex_index((c, 1)) = 0F_hex
midi((c, 1)) = 48
osc_freq((c, 1)) = 130.81 Hz  (C3)
osc_ratio((c, 1)) = 130.81 / 55 ≈ 2.38
synth_param(क) = (pitch, 130.81 Hz)
color_index(2.38): 2.38 ∈ [2.364, 4) → 1
color_value(1) = (255, 0, 0)  → Rood
```

**Voorbeeld: अ (a)**
```
phoneme_id(अ) = (v, 1)
hex_index((v, 1)) = 01_hex
filter_cutoff((v, 1)) = 200 Hz
filter_ratio((v, 1)) = 200 / 55 ≈ 3.64
synth_param(अ) = (cutoff, 200 Hz)
color_index(3.64): 3.64 ∈ [2.364, 4) → 1
color_value(1) = (255, 0, 0)  → Rood
```

---

## 6. Determinisme

De volledige keten is deterministisch:

```
zelfde_input → normalize_nfc → zelfde_foneem → zelfde_phoneme_id
  → zelfde_hex → zelfde_ratio → zelfde_param → zelfde_kleur
```

Geen stochastiek. Geen context-afhankelijkheid. Geen spreker-afhankelijkheid.
NPR-OS definieert de mapping; de mapping is vast.

**Dit is geen claim over akoestische realiteit.**
Dit is een gedeclareerde NPR-OS-functie.

```
npr_signal(φ) :=
{
  phoneme_id: phoneme_id(φ),
  hex_index: hex_index(phoneme_id(φ)),
  freq_ratio: freq_ratio(φ),
  synth_param: synth_param(φ),
  color_index: color_index(freq_ratio(φ)),
  color_value: color_value(color_index(freq_ratio(φ)))
}
```

**Volledige keten (getypeerde pipeline):**
```
normalize_nfc       : UnicodeText → NormalizedText
segment_phonemes    : NormalizedText → List<CanonicalPhoneme>
phoneme_id          : CanonicalPhoneme → PhonemeID
npr_signal          : PhonemeID → signal_output
```

**Voor één foneem:**
```
npr_signal_single(raw_input) :=
  let text     = normalize_nfc(raw_input)
  let phonemes = segment_phonemes(text)
  require length(phonemes) = 1
  npr_signal(phoneme_id(phonemes[0]))
```

**Voor een tekst:**
```
npr_signal_sequence(raw_input) :=
  let text     = normalize_nfc(raw_input)
  let phonemes = segment_phonemes(text)
  require length(phonemes) >= 1
  map(npr_signal ∘ phoneme_id, phonemes)
```

**Foutroutes:**
```
empty_input                → error: geen invoer
length(phonemes) = 0       → error: geen fonemen gevonden
length(phonemes) > 1       → error in single-modus: multiple_phonemes_in_single
φ ∉ phoneme_domain         → error: unsupported_phoneme
invalid_devanagari_cluster → error: invalid_cluster
```

**Opmerking:** `normalize_nfc` voert alleen Unicode NFC-normalisatie uit.
Het splitst niet automatisch fonemen, herkent geen cluster-grenzen,
en kiest geen individueel foneem uit een meervoudige tekst.
Daarom is `segment_phonemes` een afzonderlijke, verplichte stap.

**Segmentatie (formeel te specificeren):**
`segment_phonemes` moet Devanagari-clusters ontleiden, afhankelijke klinkertekens
couplen aan hun consonant, en niet-ondersteunde tekens afwijzen.
Dit is een operationele taak — de exacte implementatie wordt in stap 16 uitgewerkt.

---

## 7. Scope-grens

```
stap_15_scope := {
  signaal:  foneem → synthesizerparameter  (frequentie)
  perceptie: freq_ratio → kleur            (kleur)
}
```

**In scope:**
- Envelope-defaults per klasse (gedeclareerde NPR-OS-defaults, stap 16 kan overschrijven)

**Niet in scope:**
- Ruimtelijke effecten (panning, reverb-vergangers) → stap 16
- Envelope-verfijning per context → stap 16
- Polyfonie/meerdere fonemen simultaan → stap 16
- Audio-uitvoer (WAV, MIDI) → implementatielaag, geen NPR-definitie

**Scheidingslijn stap 15 vs 16:**
- Stap 15: **wat** — semantische route van signaal naar perceptie (incl. envelope-defaults)
- Stap 16: **hoe** — operationele uitvoering (token-layout, audio-encodering, polyfonie, envelope-overschrijving)

```
depends_on(step_09.sanskrit_choice)
depends_on(step_11.encoding_integrity)
depends_on(step_14.reduction_layers)
required_by(step_16.token_encoding)
```

---

## Resultaat

```
⚠️ conditioneel geldig

Frequentieroute (vanuit canoniek foneem):  ✅ deterministisch
Kleurroute:                                ✅ deterministisch
ॐ-compositie:                              ✅ gedecomposeerd in ओ + ँ + म
Scope-grens:                               ✅ stap 15 = wat, stap 16 = hoe
hex-bereiken:                              ✅ 01..30_hex = 48 waarden, disjointe
MIDI-tabel:                                ✅ compleet (c,1 t/m c,34)
Kleurformule:                              ✅ stuksgewijze functie, halfopen intervallen

Conditioneel — nog niet volledig:
- segment_phonemes:    ⚠️ interface gedeclareerd (stap 16 gebruikt dit), implementatie open
- foutroutes:          ⚠️ routes gedeclareerd, implementatie in stap 16
- Akoestisch bewijs:   ⚠️ gedeclareerde mapping, niet akoestisch gemeten
- Afhankelijkheid:     ⚠️ stap 09 (Sanskrit-keuze), stap 16 (uitvoering)
```

**Interne consistentie Stap 15:**
```
phoneme_id-mapping:     ✅ geldig
hex-indexering:         ✅ geldig
MIDI- en filtermapping: ✅ intern consistent
kleurfunctie:           ✅ deterministisch
ॐ-compositie:           ✅ intern gedefinieerd
scope 15 vs 16:         ✅ helder

Inputpipeline:
  normalize_nfc:        ✅ gedeclareerd (Unicode NFC)
  segment_phonemes:     ⚠️ gedeclareerd, implementatie open
  foutroutes:           ⚠️ gedeclareerd, implementatie open

Ketenvolledigheid:      ⚠️ conditioneel
```

**Stap 15 — Eindoordeel:**
```
Interne consistentie Stap 15:  ✅ geldig
  (foneme→signaal keten is formeel en deterministisch,
   segment_phonemes-interface + foutroutes zijn gedeclareerd)

Operationele uitvoering:       ⚠️ open
  (segment_phonemes en foutroutes wachten op implementatie)

Vereist door:
- stap 16: segmentatieregels + token-encoding gebruiken dit interface

required_by(step_16.segmentation)
required_by(step_16.token_encoding)
```

---

## Fixes

- **Fix 1: consonant-offset** — hex_index tabel + bereiken gecorrigeerd: `(c,32)→2E`, `(c,33)→2F`, `(c,34)→30`. Totaal `01..30_hex` = 48 waarden.
- **Fix 2: voorbeelden** — alle voorbeelden gebruiken nu `phoneme_id` tuples i.p.v. scalar `śarada_id`.
- **Fix 3: śarada_id → phoneme_id** — secties 3–6 gebruiken nu consequent `phoneme_id` + `position()` accessor.
- **Fix 4: kleurformule** — `floor(r × scale_factor) mod 8` vervangen door stuksgewijze functie.
- **Fix 5: halfopen intervallen** — `[a, b)` notatie, geen overlap.
- **Fix 6: f_base label** — `55 Hz (C1)` → `55 Hz (A1)`. C1 = 32.70 Hz, A1 = 55 Hz.
- **Fix 7: Om-afwijkingen** — chandra bindu Q terug naar tabellenwaarde 1.0; om_sub is conceptuele subharmonische (f_base/2), geen foneem.
- **Fix 8: म frequentie** — `midi((c,25)) = 72 → 523.25 Hz (C5)`, afleidbaar uit MIDI-tabel.
- **Fix 9: scope-ADSR** — envelope-defaults expliciet als NPR-OS-defaults gelabeld; stap 16 mag overschrijven. Niet langer tegenstrijdig.
- **Fix 10: NFC-normalisatie** — `normalize_nfc` toegevoegd als eerste stap in de keten.
- **Fix 13: inputpipeline** — `normalize_nfc` gesplitst in drie functies: `normalize_nfc`, `segment_phonemes`, `phoneme_id`. `npr_signal_single` en `npr_signal_sequence` toegevoegd.
- **Fix 14: foutroutes** — `unsupported_phoneme`, `invalid_cluster`, `empty_input`, `multiple_phonemes_in_single` gedeclareerd.
- **Fix 11: MIDI 33** — `55 Hz = A1 (MIDI 5)` → `55 Hz = A1 (MIDI 33)`. MIDI 5 = C-1, niet A1.
- **Fix 12: synth_param** — ongedefinieerde variabele `s` → `phoneme_id(φ)` (consistent met rest van document).

## Status

```
signaal→perceptie mapping:    ⚠️  conditioneel geldig (foneme→signaal ✅, input→foneme ⚠️)
frequentieroute:              ✅  deterministisch (phoneme_id + position)
kleurroute:                   ✅  deterministisch (stuksgewijze formule)
determinisme:                 ✅  geen stochastiek
scope-grens 15 vs 16:         ✅  wat vs hoe (envelope-defaults in scope)
hex-bereiken:                 ✅  01..30_hex = 48 waarden
MIDI-tabel:                   ✅  volledig (c,1 t/m c,34)
f_base:                       ✅  55 Hz = A1
Om-compositie:                ✅  alle componenten afleidbaar
inputpipeline:                ⚠️  gedeclareerd, implementatie in stap 16
foutroutes:                   ⚠️  gedeclareerd, implementatie in stap 16
```

## Check: 2026-07-12 09:46 GMT+2
- Status: NPR-OS Stap 15 — fix 1–10 gereed ✅
- 10 fixes: consonant-offset, voorbeelden, phoneme_id consistentie,
  kleurformule, halfopen intervallen, f_base label, Om-afwijkingen,
  म frequentie, scope-ADSR, NFC-normalisatie

## Check: 2026-07-12 10:27 GMT+2
- Status: NPR-OS Stap 15 — fix 11–12 gereed ✅
- Fix 11: MIDI 5 → MIDI 33 (55 Hz = A1)
- Fix 12: synth_param `s` → `phoneme_id(φ)`
- 15_signaal_perceptie: ✅ formeel consistent

## Check: 2026-07-14 10:50 GMT+2
- Status: NPR-OS Stap 15 — fix 13–14 gereed ✅
- Fix 13: inputpipeline gesplitst (normalize_nfc, segment_phonemes, phoneme_id)
  - npr_signal_single en npr_signal_sequence toegevoegd
  - segment_phonemes als afzonderlijke verplichte stap gedeclareerd
- Fix 14: foutroutes gedeclareerd (unsupported_phoneme, invalid_cluster, empty_input, multiple_phonemes_in_single)
- Stap 15: ⚠️ conditioneel geldig
  - foneme→signaal keten: ✅ formeel en deterministisch
  - raw_input→foneme route: ⚠️ gedeclareerd, implementatie in stap 16
- required_by(step_16.segmentation)
- required_by(step_16.token_encoding)
