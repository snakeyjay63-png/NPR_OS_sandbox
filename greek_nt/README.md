# Greek New Testament — SBLGNT

SBL Greek New Testament v1.2 (CC BY 4.0)

## Bron
- https://www.sblgnt.com/download/
- SBLGNT v1.2 (10 juli 2023)
- CC BY 4.0 licentie
- Inclusief Johannes 7:53–8:11

## Structuur
```
source/     oorspronkelijke SBLGNT downloads
text/       platte tekst per boek
xml/        XML (indien beschikbaar)
derived/    gegenereerde data
scripts/    verwerkingscripts
```

## Isopsefia (ἰσοψηφία)
Griekse letterwaarden (1–800):

| Eenheid | α=1 | β=2 | γ=3 | δ=4 | ε=5 | ϛ=6 | ζ=7 | η=8 | θ=9 |
| Tiental | ι=10 | κ=20 | λ=30 | μ=40 | ν=50 | ξ=60 | ο=70 | π=80 | ϟ=90 |
| Honderd | ρ=100 | σ/ς=200 | τ=300 | υ=400 | φ=500 | χ=600 | ψ=700 | ω=800 |

## Regels
- Diakritiek bewaard in brontekst, gestript voor numerieke laag
- ς = σ = 200
- Leestekens niet geteld
- Critische marks (⸀⸂⸃) gestript

## Bridge
Grieks → isopsefia decimaal → mod-48 → Sanskrit hex-index → frequentie

Parallel aan:
- quran_field/bridge_v2.py (Arabisch → Abjad → Sanskrit)

## Scripts
- `isopsefia.py` — letterwaarden, woordwaarden, digitale reducties
- `bridge_greek.py` — Grieks → Sanskrit → frequentie
- `process_corpus.py` — volledige NT-corpus verwerking
- `npr_layer.py` — NPR-cycle per vers (Noise→Pattern→Return)
- `gen_structure.py` — NT structuur (per boek/hoofdstuk/vers)
- `token_bridge.py` — NT → Token Field (lens_3, tri-taal resonantie)

## Token Field Integratie
NT-verzen door het Griekse tokenveld:
- `token_bridge.py` → isopsefia → token_field → lens_3 → cross-field resonantie
- Patañjali 1.40: `3 ≐ lens(kleinst ↔ grootst)`
- Tri-taal: Grieks NT + Arabisch + Sanskriet tegelijk

## Boeken
27 boeken, Mt–Re (61–87)
