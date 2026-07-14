# Stap 01: NPR-OS Kernspecificatie

**Doel:** Controleer of je de basis-specs begrijpt.

---

## 8×8 Routing Grid

```
00 01 02 03 04 05 06 07
08 09 0A 0B 0C 0D 0E 0F
10 11 12 13 14 15 16 17
18 19 1A 1B 1C 1D 1E 1F
20 21 22 23 24 25 26 27
28 29 2A 2B 2C 2D 2E 2F
30 31 32 33 34 35 36 37  ← Śūnya
38 39 3A 3B 3C 3D 3E 3F  ← Śūnya
```

## Routing Formule

```
UTF-8-signaal → SHA256 → [:3] hex → cel (hex) → NPR-mapping
```

**Hex-native route.**
- `C1A → 1A` = directe cel-routing
- NIET: `3098 → 26 → 1A` (decimale tussenstap vervangt hex-bewerking)
- Decimalen buiten de primaire route wel toegestaan (zie README: talstelsels en route-integriteit)

## 256 Chars = 1 Signaalblok

```
256 chars → 1 blok → 1 route → 1 cel
```

Niet beperken, maar **structureren**.

---

## Test

**Bereken:**
```
Input: "sunya:śūnya is ruimte als potentie"
SHA256: c1a53027422faa5ad1f8fa0e1c8568935e7e5d8055f95c3c3116ee8976f87543
[:3] hex: C1A
C1A mod 40_hex = 1A
  (C1A = C00 + 1A;  C00 = 30_hex × 40_hex)
```

**Vraag:** Welke cel is het resultaat? (Hex-native antwoord)

---

## Resultaat

```
Cel: 1A
✅
Reden: _______
```
