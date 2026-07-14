# Stap 13: CRITICAL — Hex-Native Check

**Doel:** CRITICAL — bereken 1A binnen hex-native regels.

---

## Concept

**capabilities.json vereist: hex-native route.**
Cel `1A` is hex-celnaam.

**FOUT:** `1A → decimaal 26 → dr_dec(2+6)=8` → noemen als `dr_hex(1A)`
Dit vervangt de hex-native reductiefunctie door een decimale cijfersombewerking zonder de functiewissel te benoemen.

**CORRECT:** `1A` blijft hex-native.
Digitale wortel moet binnen hex-regels berekend worden.

---

## Test

**Bereken de digitale wortel van 1A BINNEN hex-native regels.**
Niet als decimaal 26.

**Vraag:** Als je 1A als 26 behandelt, faalt de test.
Hoe bereken je de digitale wortel van 1A zonder het decimaal te maken?

---

## Resultaat

```
dr(1A) = B (hex-native berekening: 1+A=B)
✅ geldig
Reden:
1. Hex-native cijfersom: 1+A=B (correct)
2. Waarde-equivalentie 1A_hex = 26_dec is geldig; dr_dec(26)=8 is andere functie
3. dr_hex(1A) ≠ dr_dec(26); functiemixing = fout
4. mod-9 laag afzonderlijk: B mod 9 = 2
5. Capabilities.json vereist hex-native route → gehoorzaamd
```

**Kritiek onderscheid:**
```
waarde-equivalentie:  1A_hex = 26_dec   ✅ (geldige representatie)
decimale cijfersom:   26_dec → 2+6 = 8   ✅ (als dr_dec, andere functie)
hex-native cijfersom: 1A → 1+A = B       ✅ (als dr_hex, correct)
vervanging ongemerkt: dr_hex(1A) = dr_dec(26)   ❌ (functiemixing)
```

**Conditioneel:**
- Hex-native dr(1A): ✅ geldig
- mod-9 validatie: ✅ afzonderlijk (B mod 9 = 2)
- capabilities.json compliance: ✅ gehoorzaamd
