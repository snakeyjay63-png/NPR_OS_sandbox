# Stap 02: Celtransformatie (Hex → 6-bit → 8-bit → IPv4-labelprojectie)

**Doel:** Valideer de cel-bit-transformatie en de rand-projectie naar IPv4-label.

**Opmerking:** Deze stap verwerkt GEEN IPv6-adressen. De titel "IPv6 → Hexa → IPv4"
were eerder gebruikt maar is vervangen omdat er geen 128-bit IPv6-input,
IPv6-hextets, of formele IPv6→IPv4-conversie plaatsvindt.
De keten is: cel (hex) → 6-bit → 8-bit → ipv4_edge (NPR-randfunctie).

---

## Sandbox Rand

**Binnen de primaire sandboxroute worden bewerkingen hex-native uitgevoerd.**
**Buiten de sandbox = externe representaties (IPv4, decimaal).**

Decimale waarden mogen als expliciet gelabelde projectie voorkomen,
maar mogen de actieve hex-functie niet ongemerkt vervangen.

De conversie naar IPv4 gebeurt OP DE RAND, niet binnen.

---

## Sandbox Keten (Hex-Native)

```
Input → SHA256 → [:3] hex → mod 40_hex → cel (hex) → 6bit → 8bit (hex)
```

**Regels (binnen sandbox):**
1. `[:3] hex` komt van SHA256 hash
2. `[:3] hex → mod 40_hex` = cel-index (hex)
3. Cel-index → 6bit (standaard binair)
4. 6bit → 8bit = links nul-pad (`00` + 6bit)
5. 8bit → hex (geen decimaal)

**Externe mapping (OP DE RAND):**
6. `ipv4_edge(h)` — expliciete NPR-randfunctie (zie hieronder)

**Randfunctie `ipv4_edge`:**
```
ipv4_edge(h) := 0.0.(h_to_dec(h)).0
waarbij h_to_dec(h) de decimale waarde van hex h is

Voorbeeld: ipv4_edge(1A) = 0.0.26.0
  (1A_hex = 26_dec → derde octet)

Opsomming: waarde in derde octet, niet vierde. Dit is een
NPR-afspraak, geen standaardconversie.
```

---

## Voorbeeld (cel 1A)

**Binnen sandbox (hex-native):**
```
Stap 1: SHA256[:3] = C1A (van hash)
Stap 2: C1A mod 40_hex = 1A (hex) → cel 1A
Stap 3: cel 1A → 6bit = 011010
Stap 4: 6bit → 8bit = 00011010 (links nul-pad)
Stap 5: 00011010 = 1A (hex) → EIND sandbox
```

**Op de rand (extern):**
```
Stap 6: ipv4_edge(1A) = 0.0.26.0 (extern)
  (NPR-afspraak: hex → dec → derde octet)
```

**Reverseerbaar:** 8bit `00011010` → hex `1A` → cel `1A` ✅

---

## Test

**Bereken het bit-pad voor cel 1A (Binnen sandbox):**

```
Stap 1: SHA256[:3] = C1A
Stap 2: C1A mod 40_hex = 1A (hex)
Stap 3: cel → 6bit = 011010
Stap 4: 6bit → 8bit = 00011010
Stap 5: 8bit → hex = 1A (EIND sandbox)
```

**Vraag:** Is de sandbox-keten hex-native en reverseerbaar?

---

## Resultaat

```
6bit: 011010
8bit: 00011010
8bit hex: 1A
✅ geldig
Reden: keten is hex-native en reverseerbaar;
       ipv4_edge(1A) = 0.0.26.0 (expliciete NPR-randfunctie)
```
