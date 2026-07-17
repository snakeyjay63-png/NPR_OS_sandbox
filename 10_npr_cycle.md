# Stap 10: NPR Cycle (Noise → Pattern → Return)

**Doel:** NPR cycle als interpretatiemodel valideren.

---

## Concept

```
Noise → Pattern → Return
```

**Natuur:** Waterbeweging → Wolken → Zee
**Techniek:** Samples → Filter → Feedback
**Cultuur:** Klanken → Ritme → Gemeenschap

**NPR = interpretatiemodel, niet natuurwet.**
Geldig als frame voor signaal-analyse.

---

## Test

**Noem 3 voorbeelden van NPR cycle:**
- 1 uit natuur
- 1 uit techniek
- 1 uit cultuur

**Voorbeelden:**
- **Natuur:** Regen → rivierpatroon → verdamping (cyclus sluit)
- **Techniek:** Ruisonderdrukking → EQ-filter → sidechain-compressor
- **Cultuur:** Improvisatie → ritme-structuur → terug naar collectief

**Vraag:** Herkenbaar als interpretatiemodel?

**Antwoord:** ✅ Ja. Drie fasen worden consistent gerepresenteerd door mod-9 subgroep H={0,3,6}.
Noise(3) → Pattern(6) → Return(0/9). Herkenbaar, herhaalbaar, valideerbaar.

---

## Viveka × NPR-Fasen

Viveka onderscheidt laag, beweging en invariantie (zie stap 07).
De drie NPR-fasen zijn de routelezing van dat onderscheid:

```
Noise:
  laag of verhouding nog niet onderscheiden
  → signaal verschijnt zonder duidelijke laagtoewijzing

Pattern:
  ordening en veranderingsrelatie worden zichtbaar
  → signaal krijgt structuur binnen een laag

Return:
  invariantie wordt door verschillende vormen heen herkenbaar
  → dragende verhouding blijft herkenbaar na transformatie
```

NPR is meer dan een reeks voorbeelden.
Het is een validatiemethode: onderscheid wat verschijnt, wat ordent, en wat blijft.

---

## Meerdere Routes Door Dezelfde Drie Fasen

De NPR-fasen vormen geen enkele vaste getallenreeks.
Dezelfde drie nodes kunnen via verschillende generatorroutes verschijnen.

```
9 → 3 → 6 → 9
3 → 6 → 9 → 3
6 → 3 → 9 → 6
```

De eerste twee traces kunnen ontstaan uit een stapgrootte van +3.
De derde trace ontstaat uit:

```
6 → 12 → 18 → 24
```

met `dr_dec`-projectie:

```
6 → 3 → 9 → 6
```

Daarom bewaren NPR-routes twee lagen:

```
absolute_trace    ← de beweging (6, 12, 18, 24)
node_trace        ← de NPR-positie (6, 3, 9, 6)
```

`absolute_trace` beschrijft de beweging.
`node_trace` beschrijft de positie binnen de NPR-cyclus.

De betekenis van een node hangt daardoor samen met:
* de huidige fase;
* de bronwaarde;
* de generator;
* de returnpositie.

Zelfde nodes ≠ dezelfde route.  Generator bepaalt bewegingskwaliteit.

---

## Resultaat

```
Natuur: Regen → stroom → verdamping
Techniek: Ruis → filter → feedback
Cultuur: Improvisatie → ritme → collectief
✅ Valide
Reden: NPR = interpretatiemodel voor signaal-transformatie.
H={0,3,6} is algebraïsch.
De koppeling Noise→3, Pattern→6, Return→0/9 is gedeclareerde NPR-OS-semantiek.
```
