# Sūtra Audio Blueprint

Patañjali Yoga Sūtra → NPR-audio via Sanskrit Frequency Bridge.

## Workflow

Elke sūtra door deze stappen:

```
1. Devanagari text
2. Phoneme breakdown (Gaṇa + Śāradā)
3. NPR-cyclus analyse (Noise → Pattern → Return)
4. Frequentie mapping
5. Audio synth (WAV output)
6. Reflectie
```

## Model per Sūtra

### Basis
- **Taal:** Sanskrit kernwoorden behouden (yoga, citta, vṛtti, nirodha, etc.)
- **Vertaling:** Engels toelichtend, niet vervangend — Sanskrit woorden vernauwen niet
- **Audio:** ~60 sec per sūtra (afhankelijk van lengte)
- **Base frequency:** 55 Hz (Om/C1)
- **Waveform:** sine (puur signaal)
- **Kanalen:** stereo

### Opbouw
```
Noise   → opening (अथ, schok, begin)
Pattern → kernwoord (structuur, verbinding)
Return  → sluiting (anusvāra, veld-resonantie)
```

### Frequentie-ranges
- Vowels: 200-800 Hz (filter cutoff)
- Consonants: 55-1760 Hz (oscillator)
- Visarga (ः): delay 300ms
- Anusvāra (ं): sub-bass base/2

## Output

Elke sūtra krijgt:
```
NPR_OS_sandbox/sutra_audio/
├── 01_01_atha_yoga.md       # analyse + reflectie
├── audio/
│   └── 01_01_atha_yoga.wav  # generated audio
└── ...
```

## Sūtra Index

| # | Devanagari | Transcriptie | Status |
|---|------------|--------------|--------|
| 1.1 | अथ योगानुशासनम् | atha yogānuśāsanam | ✅ gereed |
| 1.2 | योगश्चित्तवृत्तिनिरोधः | yogaś citta-vṛtti-nirodhaḥ | ✅ gereed |
| ... | ... | ... | ⬜ |

## Generatie

```bash
# Voorbeeld stap 1.1
python3 scripts/sanskrit_freq.py synth \
  --text "अथ योगानुशासनम्" \
  --duration 5 \
  --base-hz 55 \
  --output NPR_OS_sandbox/sutra_audio/audio/01_01_atha_yoga.wav
```
