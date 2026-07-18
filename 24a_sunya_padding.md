# Śūnya-Opvulling — Actieve Veldsluiting

## Drie Onafhankelijke Assen

### 1. Semantische Documentas
```
27 × 32 bytes = 864 bytes inhoud
```
- 27 = compleet taal-/symboolveld
- 32 = binaire woordbreedte / vaste recordbreedte
- **Keuze, niet noodzaak**

### 2. Opslag-as
```
864 + 160 = 1024 bytes
27 × 32 + 5 × 32 = 32 × 32
```
- Gekozen binaire container
- Śūnya = actieve veldsluiting (0x00)

### 3. Context-as
```
65.536 = logische contextgrens in tokens
```
- **token ≠ byte**
- Fysieke RAM/VRAM hangt af van modelarchitectuur

---

## Causale Volgorde

```
KEUZE:
  27 blokken × 32 bytes
  → 864 bytes inhoud
  → 1024 − 864 = 160 bytes śūnya
```

**Niet:**
```
64K → dwingt 864 af   ❌
```

---

## Byte- vs Token-Śūnya

### Byte-padding (opslag)
```
[ 864 bytes inhoud ][ 160 bytes 0x00 ]
```
Maakt vast opslag- of RAM-record.

### Token-padding (context)
```
T inhoudstokens + P pad-tokens = vaste tokenlengte
```
Vult context- of batchgrens.

**Verschil:**
```
0x00          = nulbyte (opslaglaag)
PAD-token     = speciaal token-ID (tokenlaag)
zero embedding = numerieke nulvector (modelaag)
masked pos    = niet-meetellende positie (attention)
```

> `0x00` in tekst kan tokenisatie veranderen.  
> Śūnya voor taalmodel = **PAD-token + attention mask**.

---

## De Afleiding

```
SOURCE:      27 × 32-byte records
DOCUMENT:    864 bytes
OPSLAG:      1024 bytes (byte_śūnya: 160 nulbytes)
TOKENISATIE: 864-byte doc → T tokens (met model-tokenizer)
CONTEXT:     65.536 tokenposities
TOKEN_ŚŪNYA: alleen via vaste context/batchgrens
```

Pas nadat `T` gemeten is:
```
documenten_per_context = floor(65.536 / T)
resterende_tokens      = 65.536 mod T
```

---

## 64 KiB Opslagveld

```
64 KiB = 65.536 bytes
65.536 ÷ 1024 = 64 blokken

64 × 864 = 55.296 bytes inhoud  (84,375%)
64 × 160 = 10.240 bytes śūnya   (15,625%)
─────────────────────────────────
        65.536 bytes totaal
```

Zonder padding:
```
65.536 ÷ 864 = 75 documenten + 736 rest
→ misalignment: logische grenzen ≠ fysieke grenzen
```

Met padding:
```
64 × 1024 = 65.536 → exacte alignment
block_address(n) = base + n × 0x400
```

---

## NPR-Mapping (Opslaglaag)

```
noise   → 864 bytes patroon
śūnya   → 160 bytes sluiting
return  → exact 1024-byte grens
```

```
27 CONTENT + 5 ŚŪNYA = 32 COMPLETE
```

> De nul is niet afwezigheid van het veld.  
> De nul **voltooit de grens van het veld**.

---

## Digital Root

| Waarde | DR | Betekenis |
|---|---|---|
| 1024 | 7 | Terugkeer naar bron |
| 864 | 9 | Voltooiing (inhoud) |
| 160 | 7 | Terugkeer naar bron |
| 84,375% | 9 | Inhoudspercentage |
| 15,625% | 1 | Eenheid (śūnya%) |

---

## Relaties

| Bestand | Rol |
|---|---|
| `160_bytes_5x32.md` | Śūnya-structuur (5 × 32) |
| `1024_bytes_32x32.md` | Volledige block (32 × 32) |
| `1024_block_864.txt` | Template: 27 inhoud + padding |
| `160_block_5x32.txt` | Śūnya-template: 5 × 0x00 |
| `1024_block_32x32.txt` | Volledige block-template |
| `context-64k.cjs` | 64 blokken × 1024 tokens (token-as) |
