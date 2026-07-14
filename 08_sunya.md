# Stap 08: Śūnya-Zone Check

**Doel:** Bevestig dat cel 1A NIET in de Śūnya-zone ligt.

---

## Concept

```
30 31 32 33 34 35 36 37  → Śūnya 1-8
38 39 3A 3B 3C 3D 3E 3F  → Śūnya 9-16
```

Cel `1A_hex` ligt **niet** in de Śūnya-zone (`30_hex`–`3F_hex`).
Hash bepaalt locatie, niet input-naam.

**Śūnya = ruimte/potentie, niet leegte.**
Beschikbare ruimte voor toekomstige freq-mapping.

---

## Test

**Vraag:** Ligt cel 1A in de Śūnya-zone?
Bewijs met hex-berekening.

**Berekening:**
```
1A_hex < 30_hex  →  1A ligt onder Śūnya-zone
Śūnya-zone := {30_hex .. 3F_hex}
1A_hex ∉ Śūnya-zone
```

**Antwoord:** ❌ Nee, 1A ligt niet in Śūnya-zone.

---

## Resultaat

```
✅ Cel 1A niet in Śūnya
Reden: 1A_hex < 30_hex. Śūnya-zone = {30_hex .. 3F_hex}.
Directe hex-vergelijking, geen omzetting nodig.
Hash bepaalt cel, niet input-naam.
```
