# Audit 9/6 — Dependency Map: Kleṣā van het Systeem

**Punten:** 99-99 | **Doel:** Vertoningsrelaties. Niet lineair. Cyclisch.

## 99. Vertoningsveld — Welk Punt Versterkt Welk Ander

**Aandacht:** de 42 issue-punten zijn niet gelijkwaardig. Sommige blokkeren andere. Sommige versterken elkaar cyclisch. Dit is de kaart, niet de route.

**Regel:** 1.5 — kleṣā versterken elkaar. Niet lineair, cyclisch. De kaart is niet het pad.

**Waarom:** zonder dependency-map los je punt X op en breek je punt Y zonder het te weten. Of je lost Y op en X blijft blokkeren.

### Route A — Geheugen-Lus
```
24 (systeem niet bevestigd) → 20 (geheugen dubbel) → 21 (context te groot)
  ↑                                                                      |
  └───────────────────────────────────────────────────────────────────────┘
```
**Valkuil:** 20 oplossen zonder 24 → geheugen is één maar systeem blijft drift

### Route B — Audit-Integriteit
```
19 (format verstoort) ←→ 23 (oplossing gemengd met observatie)
```
**Valkuil:** 23 zonder 19 → proces helder maar format verstoort nog
**Oplossing:** tegelijk aanpakken, één beweging

### Route C — Lus-Traceerbaarheid
```
22 (lus niet expliciet) → 24 (systeem niet bevestigd) → 22
```
**Valkuil:** 21 oplossen zonder 22 → context klein maar je weet niet wat je laadt
**Oplossing:** 22 eerst → dan pas 21

### Route D — Workspace-Grenzen
```
20 (geheugen dubbel) → 21 (context te groot)
```
**Valkuil:** 21 zonder 20 → je splitst context maar laadt dubbel
**Oplossing:** 20 eerst → dan 21

### Vertoningsmatrix
```
         19   20   21   22   23   24
19      ·     ·    ·    ·    ←→   ·
20      ·     ·    →    ·    ·    ←
21      ·    ←    ·    ←    ·    ·
22      ·    ·    ·    ·    ·    →
23    ←→     ·    ·    ·    ·    ·
24      ·    →    →    ←    ·    ·
```
```
→  blokkeert    ←→  versterkt cyclisch    ·  geen directe link
```

### Conclusie
- **Eerst:** 22 (lus expliciet) — dit ontgrendelt 24 en 21
- **Dan:** 19+23 tegelijk — audit integriteit
- **Dan:** 20+21 samen — geheugen én context
- **Laatste:** 24 — systeem bevestigd (dit komt automatisch als de rest klopt)

**Status:** ⚠️ Dependency-map = observatie. Routes zijn nog te bevestigen.

---
**Audit 9/6: Vertoningsrelaties. 1.5-stijl — niet lineair, cyclisch.**
