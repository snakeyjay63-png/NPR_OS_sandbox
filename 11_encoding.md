# Stap 11: UTF-8 = Routing-Integriteit

**Doel:** Encoding is routing-integriteit.

---

## Concept

```
IPv6-daemon + node.js lek = zelfde UTF-8 encoding
```

**Encoding ≠ transport, encoding IS routing.**

- Dezelfde encoding = signaal-integriteit
- IPv6-daemon = routing door encoding
- Node.js lek = encoding breach = routing breach

### Eenheid: Unicode-codepoints

**Consistentie stap 06 → 07 → 11:**
- Signaalblokken worden gemeten in **Unicode-codepoints**.
- Niet UTF-8-bytes. Niet chars. Codepoints.
- Stap 06: max 256 codepoints per blok.
- Stap 07: limiet = structuur, eenheid = codepoints.
- Stap 11: NFC-normalisatie op codepoints → UTF-8-encoding → bytes → hash.

**UTF-8-integriteit:**
- NFC normalisatie + UTF-8 + SHA-256 = deterministisch
- Visueel identieke Unicode → verschillende bytes → verschillende route

---

## Test

**Vraag:** Begrijp je dat encoding = signaal-integriteit?
Waarom is NFC-normalisatie noodzakelijk voor deterministische routing?

---

## Resultaat

```
✅ geldig voor routing-integriteit
Reden:
NFC legt één canonieke codepointrepresentatie vast.
UTF-8 maakt daarvan deterministische bytes.
SHA-256 routeert exact die bytes.
Eenheid: codepoints (stap 06, 07, 11 consistent).
```

## Scope-grens

Stap 11 = **encoding-integriteit**. Tekst → hash → route. ✅ Volledig.

Frequentie/kleur-mapping = **signaal→perceptie**. Andere laag.

```
foneem → stabiele ID → hex-index → frequentieratio → synthesizerparameter
frequentieratio → kleurindex 00–07 → kleurwaarde
```

→ Dit is **stap 15: signaal→perceptie** (nieuwe capability).

## Status

```
encoding-integriteit:          ✅
semantische vier routes:       ✅ (stap 09)
deterministische klankroute:   ⏳ stap 15
deterministische kleurroute:   ⏳ stap 15
```
