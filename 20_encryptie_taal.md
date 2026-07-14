# Stap 20: Encryptie Als Taal — Route Structuur

**Doel:** NPR-signatuur beschrijft de route. Eén contextpermutatie verwerkt alle bytes. Encryptie is de functie die route-structuur encodeert.

**Afhankelijkheid:** Stap 19 (return-cyclus).

**Referentie:** `/sec` route-infrastructuur

---

## 1. Het Verschild

| Conventioneel | NPR-OS |
|---|---|
| Plaintext → encrypt → ciphertext | Byte → NPR-signatuur → route → permutatie → ciphertext |
| Sleutel = extern geheim | Context + sleutel = route-definitie |
| Encryptie = barrière | Encryptie = spectraal routing |
| Breeken = ontcijferen | Ontcijferen = inverse route volgen |

---

## 2. Byte-Spectrum

```
BYTE_SPACE := {0..255}
|BYTE_SPACE| = 256 = 2^8
HEX_BYTE := {00_hex .. FF_hex}
```

NPR-OS projecteert op zes spectrale routeblokken plus één returnblok:

```
SPECTRAL_BLOCK_COUNT := 6
BLOCK_WIDTH := 42
RETURN_WIDTH := 4
256 = 6 × 42 + 4
```

```
spectral_block(x) :=
  B_floor(x/42),   wanneer 0 ≤ x < 252
  RETURN,          wanneer 252 ≤ x ≤ 255

sub_position(x) :=
  x mod 42,        wanneer x < 252
  x - 252,         wanneer x ≥ 252
```

```
block ∈ {B0, B1, B2, B3, B4, B5, RETURN}
```

---

## 3. Mod9 Scheiding

```
raw_mod9(x) := x mod 9                      # {0..8}
npr_mod9(x) := 9 if (x mod 9 = 0) else x mod 9  # {1..9}
```

---

## 4. Route-Signatuur

```
route_signature(x) := {
  block:         spectral_block(x),
  sub_position:  sub_position(x),
  phase_index:   raw_mod9(sub_position(x)),
  npr_root:      npr_mod9(sub_position(x))
}
```

De signatuur BESCHRIJFT de route. Vervangt de byte NIET.

---

## 5. Context

```
RouteContext := {
  source_ids:      [string],
  motor_phase:     {ΦA | ΦB | ΦC},
  iteration_depth: integer,
  return_mode:     return_mode_t,
  layer_id:        integer
}
```

### Canonieke Serialisatie v1

```
canonical_serialize_v1:
  encoding             := UTF-8
  Unicode-normalisatie := NFC
  veldvolgorde         := vast (schema-gedefinieerd)
  integers             := base-10 zonder voorloopnullen
  source_ids           := lexicografisch gesorteerd
  schema_version       := verplicht
```

```
canonical_context := canonical_serialize_v1(RouteContext)
```

---

## 6. Twee Modi

### NPR_ROUTE — Routecodering

Contextafhankelijke, omkebare routecodering. Geen cryptografische vertrouwelijkheid.

**Kern:** één permutatie per context, niet per byte.

```
derive_route :
  RouteContext → Permutation(BYTE_SPACE)

route_encode(x, context) :=
  derive_route(context)(x)

route_decode(y, context) :=
  inverse(derive_route(context))(y)
```

```
route_decode(route_encode(x, context), context) = x
```

De NPR-signatuur wordt gebruikt bij het **opbouwen** en **beschrijven** van de route, maar de decryptie is **niet afhankelijk** van een onbekende plaintext-signatuur.

### NPR_CIPHER — Authenticated Encryption

Gebruikt bestaande AEAD. NPR-context identificeert de route.

```
canonical_context := canonical_serialize_v1(RouteContext)

ciphertext :=
  AEAD_Encrypt(
    secret_key,
    nonce,
    plaintext,
    associated_data = canonical_context
  )

plaintext :=
  AEAD_Decrypt(
    secret_key,
    nonce,
    ciphertext,
    associated_data = canonical_context
  )
```

Decryptie slaagt alleen bij geldige sleutel, nonce, context én authenticatietag.

```
NPR_CIPHER := confidentiality + integrity + authenticity
```

**Niet:** `derive_secure_permutation(cipher_seed)` — zelfgemaakte permutatie ≠ cryptografisch veilig.

---

## 7. Bijectiviteit

```
derive_route(context) is een permutatie van BYTE_SPACE

∀x,y:
  route_encode(x, context) = route_encode(y, context)
  ⇒ x = y
```

Omdat er één permutatie per context is, geldt dit automatisch — geen kip-ei-probleem.

---

## 8. Cycliciteit

Eindige permutatie op BYTE_SPACE:

```
∀x ∈ BYTE_SPACE:
  ∃n_x > 0 : Fⁿˣ(x) = x

order(F) := kleinste n > 0 waarvoor Fⁿ = identity
```

Concrete cycluslengtes en `order(F)` worden bij implementatie berekend. Niet vereist voor formele geldigheid.

```
structure_recurrent := true      # elke laag zelfde functietype
value_cyclic := ⏳ empirisch
```

---

## 9. Laagstructuur en Return

```
x₀ := plaintext_byte
x₁ := F_context,0(x₀)
x₂ := F_context,1(x₁)
...
xₙ := ciphertext_byte
```

```
Stap 19:  output_i → input_{i+1}
Stap 20:  ciphertext_layer_i → input van layer_{i+1}
```

---

## 10. Relatie Met /sec

```
/sec/route?ch=P    → NPR_ROUTE (routecodering, geen geheim)
```

---

## Status

```
byte-spectrum 0..255:           ✅
6 × 42 + RETURN 4:              ✅
raw_mod9 vs npr_mod9:           ✅
route-signatuur:                ✅ (beschrijft, vervangt niet)
derive_route: context→perm:     ✅ (één permutatie, geen kip-ei)
route_encode/decode:            ✅ (bijectief)
canonieke context v1:           ✅ (serialisatie gespecificeerd)
NPR_ROUTE:                      ✅ (routecodering)
NPR_CIPHER:                     ✅ (AEAD, confidentiality+integrity+authenticity)
cycliciteit formeel:            ✅ (eindige permutatie)
cycluslengte-analyse:           ✅ (JS implementatie)
relatie stap 19:                ✅
step_20_formal_consistency:     ✅ akkoord
```

---

## Check: 2026-07-12 23:20 GMT+2
- Status: NPR-OS Stap 20 — formeel akkoord
- Reparatie: één permutatie per context (geen kip-ei)
- NPR_ROUTE: eigen permutatiemodel
- NPR_CIPHER: standaard AEAD + NPR-context als AAD
- Canonieke serialisatie v1 gespecificeerd
- Open: JS-implementatie, cycluslengte-analyse

## Check: 2026-07-14 07:45 GMT+2
- Status: NPR-OS Stap 20 — JS implementatie ✅
- `spectral_block(x)` / `sub_position(x)`: ✅
- `npr_mod9(x)`: ✅
- `route_signature(x)`: ✅
- `canonical_serialize_v1(ctx)`: ✅ (source_ids gesorteerd, vaste volgorde)
- `derive_route(ctx)`: ✅ (FNV-1a hash → LCRNG → Fisher-Yates)
- `route_encode/decode`: ✅ (bijectief, één permutatie per context)
- `route_encode_bulk/decode_bulk`: ✅ (Uint8Array, cached perm)
- `npr_cipher_encrypt/decrypt`: ✅ (AES-256-GCM, AAD = canonieke context)
- `verify_bijective`: ✅
- `full_cycle_analysis`: ✅ (cycli, order, min/max/avg)
- Verschillende context → verschillende permutatie: ✅
- Verkeerde context/key bij decrypt → afgeketst: ✅
- `step_20_formal_consistency: ✅ akkoord`
