# Sūtra → Lichtmandala + Geluid → MP4 Pipeline

## Concept

Elke sūtra wordt een **lichtmandala**:
- **Zandkorrel = pixel** → elke phoneme wordt een lichtpunt
- **Gaṇa-groep = kleur** → 5 consonant-groepen = 5 kleuren
- **Śāradā-waarde = positie** → hoek + afstand in mandala
- **Vowel = helderheid** → filter cutoff → lichtintensiteit
- **Tijd = beweging** → mandala draait/ontvouwt tijdens audio

## Pipeline

```
1. Devanagari text
   ↓
2. Phoneme → frequentie (Sanskrit Frequency Bridge)
   ↓
3. Phoneme → kleur + positie (Gaṇa + Śāradā → mandala-geometrie)
   ↓
4. Audio synth (WAV)
   ↓
5. Visual synth (canvas/HTML → frame-by-frame mandala)
   ↓
6. ffmpeg: audio + video → MP4
```

## Gaṇa → Kleur Mapping

| Gaṇa | Consonants | Kleur | Freq Range |
|------|-----------|-------|------------|
| 1 (क) | क ख ग घ ङ | rood | 55-110 Hz |
| 2 (च) | च छ ज झ ञ | oranje | 110-220 Hz |
| 3 (ट) | ट ठ ड ढ ण | geel | 220-440 Hz |
| 4 (त) | त थ द ध न | groen | 440-880 Hz |
| 5 (प) | प फ ब भ म | blauw | 880-1760 Hz |

## Śāradā → Positie Mapping

Elke letter heeft een Śāradā-nummer (1-10). Dit bepaalt:
- **Hoek** = Śāradā × 36° (in mandala-cirkel)
- **Afstand** = vowel-lengte × radius-schaal

## Vowel → Helderheid

| Vowel | Helderheid | Filter Cutoff |
|-------|-----------|---------------|
| अ (a) | laag | 200 Hz |
| आ (ā) | hoog | 800 Hz |
| इ (i) | medium | 400 Hz |
| ई (ī) | hoog-medium | 600 Hz |
| etc. | ... | ... |

## Speciale Tekens

| Tekens | Visueel | Audio |
|--------|---------|-------|
| ं (anusvāra) | sub-bass gloed | base/2 frequentie |
| ः (visarga) | echo/afterglow | delay effect |
| ह् (hrī) | center pulse | fundamentele freq |

## Output per Sūtra

```
NPR_OS_sandbox/sutra_audio/
├── 01_01_atha_yoga.md          # analyse
├── audio/
│   └── 01_01_atha_yoga.wav     # geluid
├── visual/
│   └── 01_01_atha_yoga.html    # mandala canvas
└── mp4/
    └── 01_01_atha_yoga.mp4     # gecombineerd
```

## ffmpeg Command

```bash
ffmpeg \
  -i visual/01_01_atha_yoga.html \
  -i audio/01_01_atha_yoga.wav \
  -c:v libx264 -pix_fmt yuv420p \
  -c:a aac \
  mp4/01_01_atha_yoga.mp4
```
