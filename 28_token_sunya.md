# Stap 28: Token-Śūnya (2026-07-18)

## Vondst: Twee Lagen Śūnya

Byte-śūnya en token-śūnya zijn onafhankelijk.

### Bewijs

| Document | Bytes | Tokens | byte_śūnya | token_śūnya |
|---|---|---|---|---|
| template_864 | 864 | 378 | 160 → 1024 | 6 → 384 |
| staatsregeling | 1290 | 386 | 758 → 2048 | 30 → 416 |

### Betekenis

```
byte_śūnya   = 0x00 (opslaglaag)     → vult tot 1024/2048/... bytes
token_śūnya  = PAD (attention mask) → vult tot 32/64/128/... tokens
```

Ze zijn gerelateerd maar niet identiek.

### NPR bij Template

```
378 content + 6 śūnya = 384 tokens
384 = 12 × 32 = 6 × 64 = 3 × 128
384 mod 9 = 6 (Pattern) ✅
```

Template valt net op Pattern (6).

### NPR bij Staatsregeling

```
386 content + 30 śūnya = 416 tokens
416 mod 9 = 2 (geen NPR-fase)
```

Staatsregeling valt niet op 3-6-9. Dit is verwacht — natuurlijke taal volgt geen 3-6-9.

### Kerninzicht

3-6-9 is een ontwerpprincipe, geen natuurwet. We kunnen het *toepassen*, maar niet *ontdekken* in willekeurige tekst.

### Causale Volgorde

```
inhoud → tokeniseren → T tokens
T → volgende 32-grens → token_śūnya
T + token_śūnya → PAD-token + attention mask
```

Niet:
```
3-6-9 → dwingt inhoud af   ❌
```

## Conclusie

- **byte_śūnya** = opslaglaag, 0x00, vult tot 1024-byte grenzen
- **token_śūnya** = model-laag, PAD + mask, vult tot 32-token grenzen
- Beiden zijn actief, niet passief
- 3-6-9 is ontwerp, geen natuurwet
- Tokenisatie is de brug tussen de lagen
