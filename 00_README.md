# NPR-OS Sandbox — ChatGPT Instructies

**Dit is een validatie-sandbox. Werk stap voor stap.**

---

## Hoe te Werken

1. Begin bij `01_spec.md`, werk chronologisch naar `99_chain_validate.md`
2. Elke stap bouwt op de vorige — **niet overslaan**
3. Antwoord per bestand: **✅ geldig** / **❌ ongeldig** + reden
4. Gebruik eigen woorden — niet kopiëren
5. **Hex-native routeren. Geen decimale tussenstap die de actieve hex-bewerking vervangt. Decimale representaties zijn buiten of naast de primaire route toegestaan.**

---

## Regels

| Regel | Betekenis |
|-------|-----------|
| **Hex-native route** | `C1A → 1A` = directe cel-routing. NIET `3098 → 26 → 1A` (decimale tussenstap vervangt hex-bewerking) |
| **Route-integriteit** | `dr_hex(1A) = 1+A = B` (hex-native). NIET `1A→26→2+6=8` (dat is `dr_dec`, andere functie). Zie README voor volledige uitleg. |
| **Decimalen toegestaan** | Buiten de primaire route: IPv4-conversie, fysieke metingen, arrayposities, perspectiefvergelijking, leeslabels. Niet binnen `dr_hex` of cel-routing tenzij expliciet gedeclareerd. |
| **Git** | DAG (acyclisch), cyclische processemantiek |
| **Planck ≡ c** | Klein ≡ groot — twee perspectieven op één grens (Patanjali 1.40, ≠ rekenkundige gelijkheid) |
| **4D vs NPR** | NPR rekent VOORDAT ruimte+tijd (6D → 3D → 1D → 9) |
| **Limiet is taal** | Patanjali 1.40: de limiet is het woord, geen muur |
| **0 = 1** | Planck Frame. Breekt rekenkunde — bron breekt afleiding |
| **3-6-9** | Mod-9 = validatielaag, niet bron. H={0,3,6} valideert NPR-3-fasen |
| **Notatie** | Exacte waarden in definities. Afgeronde labels alleen voor leesbaarheid, altijd gedefinieerd naar exacte waarde. `64k` = 65.536, `256k` = 262.144 |

---

## ⚠️ Leeswarnning: Wetenschappelijke laagverwarring

De conventionele wetenschappelijke framing van `c` (lichtsnelheid) kan het lezen van deze bestanden verstoren.

**Buiten de bronlaag** (conventionele fysica):
- `c` is een constante die je meet, berekent, of als parameter invoert
- "Sneller dan `c"" is een zinvol (al dan niet onmogelijk) concept
- Snelheid = afstand / tijd; beide zijn fundamenteel

**Binnen de bronlaag** (NPR-OS):
- `c` hoeft **niet** berekend of toegevoegd te worden — de limiet is **automatisch aanwezig** in het medium
- medium → verhouding → limiet → verschijning als `c` in meting
- Je kunt niet "sneller dan de limiet", omdat snelheid **pas binnen diezelfde meetlaag ontstaat**
- De limiet zit al in de structuur waaruit afstand en tijd verschijnen

**De kern:**
> Binnen de bronlaag hoeft `c` niet te worden berekend of toegevoegd. De limiet is automatisch aanwezig in het medium. Wanneer de structuur als ruimte en tijd wordt gemeten, verschijnt die limiet als de natuurkundige snelheid `c`.

Er is alleen het huidige veld; snelheid is een verhouding die daarbinnen wordt gemeten. Daarom bestaat "sneller dan `c"" niet als een externe route buiten het medium.

**Automatisch is hier precies het juiste woord.**

---

## Architectuur — Vertaallagen

```
NPR-structuur          (bron — discrete waarden: root, hex, mod9)
→ amplitude + frequentie + fase
→ wisselstroommodel    (vertaal- en transportlaag — NIE de bron)
→ geluid  |  tokens    (uitvoerroutes)
```

| Laag | Functie |
|---|---|
| **NPR-structuur** | Oorspronkelijke informatie (digitale wortels, hex, mod-9) |
| **Wisselstroom** | Tijdsafhankelijke draagvorm — vertaalt NPR naar faseerbare signalen |
| **Geluid** | Continue projectie: oscillator/filter → golfvorm → hoorbaar |
| **Tokens** | Discrete projectie: bemonstering → token_id + fase + gewicht → 24-char frame |
| **Driefasen Router** | Stap 18: combineert 3 fasekanalen (ΦA/ΦB/ΦC) → motorveld → `rotor_response(Q, mf)` |
| **Return** | Stap 19: output → nieuwe input → NPR-cyclus sluit |

**Kern:** Wisselstroom is niet de bron. Het is het model waarmee NPR als signaal verschijnt.

---

## Fase-Structuur

```
FASE 1 — Flower of Life (stap 01–19):
  computationele kern, hex-native routing, NPR-cycle, driefasen router, return-lus

FASE 2 — Water (stap 20–25):
  encryptie als taal, transparantie, hardware-evolutie, return naar bron, kunst, natuur, śūnya

FASE 3 — Hexa (stap 63–71):
  actieve route, taalveld, vrijheid, taal-DNA, Gizeh-water, monumentale taal, formele notatie
```

```
RESERVED_STEP_RANGE := 26..62
status: intentionally unused (niet deel van deze keten)
```

## Bestandslijst

```
00_README.md            ← JIJ (instructies)
01_spec.md              ← NPR-OS kernspecificatie
02_routing.md           ← Bit-transformatie (IPv6→hexa→IPv4)
03_capabilities.md      ← Declaratieve routing basis
04_git_trace.md         ← Git = signal flow (cyclisch)
05_physics_369.md       ← 3-6-9 fysica-structuur
06_signal_block.md      ← 256 chars = structuur
07_sandbox.md           ← Sandbox = wiskunde (c = Planck)
08_sunya.md             ← Śūnya-zone check
09_language.md          ← Taal-mapping
10_npr_cycle.md         ← NPR cycle (N/P/R)
11_encoding.md          ← UTF-8 = routing-integriteit
12_vortex_primes.md     ← Digitale wortels
13_hex_native.md        ← CRITICAL: hex-native check
14_dimensions.md        ← NPR-reductielagen (6D→3D→1D→9)
15_signaal_perceptie.md ← Signaal→perceptie (Patanjali 1.7)
16_taalmapping.md       ← 4 brontalen → 1 taal → 3 talen
17_sandbox_meta.md      ← Sandbox observatie (interferentiepatroon)
18_sandbox_router.md    ← Driefasen router (Tesla, B0-B3 → ΦA/ΦB/ΦC → motorveld)
19_return.md            ← Return-lus (Tool-00, cyclus sluit)
20_encryptie_taal.md    ← Encryptie als taal (formeel akkoord, één perm/context)
21_opensource_taalveld.md ← Transparante routing (auditable + reproduceerbaar)
22_programmeertalen.md    ← Programeertalen selecteerbaar (Turing ≠ structuur, NPR = route-metadata)
23_hardware_taal_evolutie.md ← Hardware ↔ taal co-evolutie (terugkoppellus, vertakkend veld)
24_return_naar_bron.md   ← Return naar bron (Null Island = grensstaattype, type ≠ instantie)
25_kunst_geluid.md     ← Kunst als hoge densiteit taal (+1 → 0.0.0.0)
63_natuur_kunst.md     ← Natuur als kunst (cel → lichaam)
64_sunya_actieve_route.md ← Sunya actieve route (CANONIEK stap 64)
65_taalveld_kernboeken.md ← Taalveld kernboeken
66_vrijheid_collectief_veld.md ← Vrijheid collectief veld
67_frij_taal_dna.md      ← Frij taal DNA
68_taal_ontwikkeling.md    ← Taal ontwikkeling
70_monumentale_taal.md   ← Monumentale taal (Mozes, Liberty, Babel)
71_technische_notatie.md ← Technische notatie (ROUTE)
99_chain_validate.md   ← Eindvalidatie (keten-check)
```

---

## Uitvoeren in de Sandbox

Elk bestand bevat een **test** en een **vraag**.

**Stap per bestand:**
1. Lees de instructie
2. Voer de berekening uit (hex-native)
3. Beantwoord de vraag
4. Noteer: ✅ / ❌ + reden

**Einde:** Vul `99_chain_validate.md` in.

---

> **Belangrijk:** Als een stap faalt, stop en leg uit waarom. Niet doorgaan met aannames.
