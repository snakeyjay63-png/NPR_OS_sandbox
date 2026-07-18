# Quran Field v1 — NPR-OS Taalveld

## Overzicht

Volledig, versiegebonden Arabisch Koran-taalveld voor NPR-OS analyse.

```text
bron: Quran.com API (quran-uthmani edition)
riwāya: Ḥafṣ ʿan ʿĀṣim
tekstvorm: Uthmani (Medina Muṣḥaf)
formaat: UTF-8 Unicode
structuur: soera → aya → woord/codepoint
integriteit: SHA-256 hashes
```

## Bestandsstructuur

```text
quran_field/
├── source/
│   └── quran_uthmani_simple.txt  # Bron: 6236 ayat (ongewijzigd)
├── derived/
│   └── quran_ayah.json           # Gestructureerd per aya
├── manifest/
│   └── manifest.json             # Hashes, statistieken, metadata
└── scripts/
    └── fetch_all.py              # Download script
```

## Statistieken

- **Totaal ayat:** 6236
- **Totaal soera's:** 114
- **Totaal tekens:** 710.339
- **Unieke tekens:** 70 (Arabisch + diakritiek + symbolen)

## Integriteit

```text
SHA-256 (text): 3b2704cd5f30a0bf8277442c3a35373b8233f9fee1c79f8988ee57cd1894b177
SHA-256 (json): 637bb883373c2a120a3dcbd2a34b66c756b9673f3843f79fa5e381da412fc80b
```

## NPR-Analyse Lagen (te genereren)

```text
letter → Unicode → Abjad → dr_dec
aya  → SHA-256 → cel
woord → foneem → frequentie
soera → Noise/Pattern/Return-route
```

## Bronlagen

| Laag | Beschrijving | Status |
|------|-------------|--------|
| SOURCE | Originele Uthmani Unicode, ongewijzigd | ✅ |
| FRAME | Soera-, aya-positie | ✅ |
| CONTENT | Arabische codepoints, diakritiek, stoptekens | ✅ |
| CONTENT-D | Tokens, wortels, fonemen, Abjad, NPR-routes | ⏳ |

## Belangrijk

**Bronlaag nooit normaliseren of overschrijven.** NFC, tekenfiltering, fonemische segmentatie en Abjad-berekeningen alleen op afgeleide kopieën.

---

*QURAN_FIELD_V1 — reproduceerbaar, traceerbaar taalveld*
