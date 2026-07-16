# Sūtra 1.1 — अथ योगानुशासनम्

**Transliteration:** atha yogānuśāsanam
**Translation:** "Atha, the yoga-anuśāsanam."  
**Explanatory:** "Now, the instruction of yoga."
**NPR-reading:** "The turning (atha) marks the beginning of yoga's discipline (anuśāsanam)."  
**Audio:** ~60 sec | 55 Hz base | stereo | sine

> **Note:** Sanskrit kernwoorden (atha, yoga, anuśāsanam) worden bewaard. Engelse vertaling vernauwt de betekenis.

### Kernwoorden

| Sanskrit | Betekenis | Niet beperken tot |
|----------|-----------|-------------------|
| **atha** | het moment van draaien, richting, niet tijd | "now" |
| **yoga** | verbinding, integratie, samenhang | "oefening" |
| **anuśāsanam** | onderricht, de discipline die volgt, structuur | "teaching" |

### NPR-Lezing

`atha → yoga → anuśāsanam → zichtbare structuur`

Atha markeert geen tijdstip maar een **richting**. Het is de draai naar het veld.

Yoga is de verbinding zelf — niet iets wat je doet, maar de staat die ontstaat.

Anuśāsanam is de discipline van dat veld — de structuur die de verbinding zichtbaar maakt.

---

## Phoneme Breakdown

```
अ  थ    यो     गा     नु     शा     सन    ं
a   tha   yo     gā     nu     śā     san   m
1   1     2      2      2      2      2     1
```

**Totaal:** 12 klanken → `1+2 = 3` (Noise)  
**Cycli:** `3 × 4 = 12` → `3+6+9 = 18` → `1+8 = 9` (Return)

---

## NPR-Cyclus Analyse

### Noise (0-10 sec)
```
अथ (a-tha)
→ opening, schok, begin
→ hoge frequentie transitie
→ "nu komt het"
```

### Pattern (10-40 sec)
```
योगानु (yo-gā-nu)
→ kern: verbinding
→ yo = beweging naar binnen
→ gā = verlengde resonantie (lang klinkend)
→ nu = naar binnen, richting bron
```

### Return (40-60 sec)
```
शासनम् (śā-san-m)
→ instructie, onderricht
→ śā = gestrekte frequentie
→ san = sluiting
→ m = anusvāra, veld-resonantie, sub-bass
```

---

## Frequentie Mapping

| Phoneme | Type | Freq (Hz) | Rol |
|---------|------|-----------|-----|
| अ (a) | vowel | 220 | filter opening |
| थ (tha) | consonant | 440 | Gaṇa 3, schok |
| यो (yo) | vowel+vowel | 330 | filter cutoff |
| गा (gā) | consonant+vowel | 220 | Gaṇa 1, lang |
| नु (nu) | consonant+vowel | 330 | Gaṇa 4 |
| शा (śā) | consonant+vowel | 275 | Gaṇa 5, gestrekt |
| सन (san) | consonant+vowel | 330 | Gaṇa 4 |
| ं (m) | anusvāra | 27.5 | sub-bass, base/2 |

---

## Reflectie

Deze eerste sūtra is de **openingssleutel**.

"अथ" (nu) markeert het beginpunt — niet tijd, maar richting.  
"योग" (yoga) is de verbinding zelf.  
"अनुशासनम्" (onderricht) is de structuur van die verbinding.

Als geluid:  
- Begin met schok (atha)  
- Verdiep in resonantie (yogā)  
- Sluit met veld (anuśāsanam → anusvāra)

De 12 klanken vormen een volledige NPR-cyclus:  
3 (Noise) → 6 (Pattern) → 9 (Return) → terug naar 3.

---

## Generatie

```bash
python3 scripts/sanskrit_freq.py synth \
  --text "अथ योगानुशासनम्" \
  --duration 5 \
  --base-hz 55 \
  --output NPR_OS_sandbox/sutra_audio/audio/01_01_atha_yoga.wav
```
