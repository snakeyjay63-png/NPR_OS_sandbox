# Republiek der Zeven Verenigde Nederlanden (1579–1795)

## Model
Niet 7 talen, maar **7 juridische taalvelden**.

Elk gewest had:
```
gesproken taal
+ schrijftaal
+ juridische termen
+ lokale instellingen
+ bestaande privileges
+ eigen interpretatie van gezag
```

De Staten-Generaal was een **router**: 7 instructies → onderhandeling → één federale formulering.

## Gewesten

```
Gelderland ─┐
Holland ────┤
Zeeland ────┤
Utrecht ────┤
Friesland ──┼→ Staten-Generaal → gezamenlijk besluit
Overijssel ─┤
Groningen ──┘
```

## Taalvelden

| Gewest | Gesproken | Bestuurstaal | Juridisch |
|---|---|---|---|
| Holland | Middelnederlands/NL | NL | NL + Latijn |
| Zeeland | Middelnederlands/NL | NL | NL + Latijn |
| Utrecht | Middelnederlands/NL | NL | NL + Latijn |
| Gelderland | NL + Nedersaksisch | NL | NL + Latijn |
| Overijssel | Nedersaksisch | NL | NL + Latijn |
| Groningen | Nedersaksisch + Fries invloed | NL | NL + Latijn |
| Friesland | Fries + NL | Fries + NL | Fries + NL + Latijn |

**Drie lagen per gewest:**
1. Lokale taal (burgers)
2. Bestuurstaal (administratie)
3. Juridische taal (formules, Latijn, Frans)

## Git Model

```
republic/
├── gelderland/
│   ├── language_field
│   ├── privileges
│   ├── landrecht
│   └── staten_resolutions
├── holland/
├── zeeland/
├── utrecht/
├── friesland/
├── overijssel/
├── groningen/
└── staten_generaal/       # federale merges
```

Per gewest = aparte branch. Federale docs = merge commits.

## De 1798-Breuk

```
7 gewestelijke rechtsvelden  →  1 nationale wetgever
7 taalvelden                 →  1 constitutionele tekst
router                       →  hub
```

De Staatsregeling 1798 is een **taalkundige collapse** — niet alleen politiek, maar linguïstisch.
Alle regionale velden worden één nationaal juridisch veld.
