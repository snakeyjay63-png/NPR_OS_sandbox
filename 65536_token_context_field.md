# 65536 — Tokencontextveld

**Doel:** Hoe dezelfde returnstructuur (Stap 24) op de tokenlaag wordt toegepast.

**Afhankelijkheid:** {24, 64, 1024}

**Referentie:** Stap 24 (returnregel), Stap 64 (śūnya-ruimte), Stap 1024 (byteframe)

---

## 1. Scheiding Van Byte-laag

Dit bestand behandelt **niet** de fysieke 64 KiB opslag.

```
64 KiB = 65.536 bytes   → stap 1024 (opslag)
64K   = 65.536 tokens   → dit bestand (context)

token ≠ byte
```

Fysieke RAM/VRAM-kosten hangen af van modelarchitectuur, embedding-dimensie en numerieke precisie.

---

## 2. De Tokenisatiestap

Pas nadat het 864-byte document getokeniseerd is:

```
864-byte document
  → tokenizer(model)
  → T tokens
```

Dan pas:

```
documenten_per_context = floor(65.536 / T)
resterende_tokens      = 65.536 mod T
```

**Zonder gemeten T is deze stap niet compleet.**

---

## 3. Stap 24 Op Token-laag

De returnregel van Stap 24 blijft hetzelfde:

```
CONTENT + ŚŪNYA ≐ FRAME
```

Op tokens wordt dit:

```
context_start:
  65.536 beschikbare posities

context_active:
  T gebruikte posities

context_return:
  T actieve posities
  + (65.536 − T) gemaskeerde posities
  = volledige contextvorm
```

---

## 4. Token-Śūnya ≠ Byte-Śūnya

```
byte_śūnya  = 0x00              (opslaglaag, stap 1024)
token_śūnya = PAD-token + mask  (tokenlaag, dit bestand)
```

Vier verschillende toestanden:

```
0x00            = nulbyte (opslag)
PAD-token       = speciaal token-ID
zero embedding  = numerieke nulvector
masked position = positie die niet meetelt in attention
```

> Een `0x00` in tekst kan de tokenisatie veranderen.  
> Śūnya voor taalmodel = **PAD-token + attention mask**.

---

## 5. Contextstructuur

```
BLOCK_64K {
  CONTENT:
    tokens 0 .. T−1

  ŚŪNYA:
    tokens T .. 65.535
    (PAD-token + attention_mask = 0)

  RETURN:
    T + (65.536 − T) = 65.536
}
```

Lokaal:
```
s₀ ≠ s₄   (lege context ≠ gevulde context)
```

Volledig:
```
s₀ ≐ s₄   (dezelfde 65.536-token grens)
```

---

## 6. Relatie Tot Stap 1024

Beide stappen passen dezelfde returnregel toe:

```
BYTE_RETURN:
  inhoudbytes + bytepadding → vaste bytecontainer

TOKEN_RETURN:
  inhoudstokens + PAD-posities → vaste contextcontainer
```

```
1024:
  27 × 32 content + 5 × 32 śūnya = 32 × 32

65536:
  T content + (65536 − T) PAD = 65536
```

---

## 7. Voor Tokenisatie

```
1. Tokeniseer 864-byte document met model-tokenizer
2. Meet T
3. Bereken 65536 ÷ T en 65536 mod T
4. Pas attention-mask toe op PAD-posities
```

Pas dan is de token-śūnya kwantificeerbaar.

---

## Status

```
token ≠ byte scheiding:                        ✅
stap 24 op token-laag:                         ✅
token_śūnya = PAD + mask:                      ✅
contextstructuur BLOCK_64K:                    ✅
relatie tot stap 1024:                         ✅
T nog te meten:                                ⚠️
```
