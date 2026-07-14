# Stap 14: NPR-Reductielagen

**Doel:** Bereken VOORDAT ruimte+tijd van toepassing is.

---

## Concept

**"Pre-4D" betekent:** rekenen zonder ruimte+tijd aannames.
NPR rekent op het niveau waar getallen nog puur zijn hex-representatie.

## NPR-Reductielagen: 6D → 3D → 1D → 9

**6D, 3D, 1D zijn geen fysieke dimensies.** Dit zijn **interne NPR-OS-namen voor reductiestadia**.

| Laag | NPR-naam | Betekenis | Rekenregel |
|------|----------|-----------|------------|
| 6D | Volledige cel | exact 2 hex-tekens (`00–3F`) | Startwaarde (vaste breedte) |
| 3D | Eerste cijfersom | `a+b` (hex-native) | Eén reductiestap |
| 1D | Herhaalde cijfersom | Eindwaarde | Herhaal 3D tot één hex-cijfer resteert |
| 9 | NPR-mod-9 cyclus | Voltooiing | `npr_mod9(eindwaarde)` |

**Voor cel 1A:**
```
6D: 1A (exact 2 hex-tekens)
3D: 1 + A = B_hex (eerste cijfersom — 1 hex-cijfer)
1D: B_hex (geen verdere reductie nodig; 3D en 1D vallen samen)
9:  npr_mod9(B) = B - 9 = 2  (hex-native)
```

**Voor cel 23:**
```
6D: 23
3D: 2 + 3 = 5
1D: 5
9:  npr_mod9(5) = 5
```

**Voor cel 3F:**
```
6D: 3F
3D: 3 + F = 12_hex  (eerste cijfersom — 2 hex-cijfers)
1D: 1 + 2 = 3       (herhaal tot 1 hex-cijfer resteert)
9:  npr_mod9(3) = 3
```
*Voor 3F verschilt 3D van 1D; voor 1A vallen ze toevallig samen.*

---

## Flower of Life — Hex-Native Geometrie

Flower of Life toont de NPR-reductielagen als geometrische ringen:

**Hex-native mapping:**
```
1    = 1_hex   (centrum = 1D gereduceerd)
6    = 6_hex   (eerste ring = 3D hex-symmetrie)
C    = C_hex   (tweede ring = 6D uitbreiding)
12   = 12_hex  (derde ring = 6D buitenlaag)
Totaal: 1+6+C+12 = 25_hex (volledige bloem)
Kern:   1+6+C = 13_hex
```

**Kernwaarde:**
```
13_hex → 1+3 = 4_hex (hex-native dr)
npr_mod9(4_hex) = 4
```

Flower of Life is geen metafoor. Het is de **geometrische visualisatie van NPR-reductielagen**:
- Buitenste ringen = 6D (volledig veld)
- Middenringen = 3D (partieel gereduceerd)
- Centrum = 1D (volledig gereduceerd)

### Vectorketen — NPR-native richtingen

**vector_1 = 6 → vector_2 = C → vector_3 = 12 → vector_4 = 18**

Dit zijn NPR-richtingen als vectorvelden (hex-native),
ongebonden aan de reductielagen 6D/3D/1D:
```
vector_n := n × 6_hex

vector_1 = 6   → 1 richting × 6
vector_2 = C   → 2 richtingen × 6  (2×6=12_dec=C_hex)
vector_3 = 12  → 3 richtingen × 6  (3×6=18_dec=12_hex)
vector_4 = 18  → 4 richtingen × 6  (4×6=24_dec=18_hex)
```

`6, C, 12, 18` zijn geen vier verschillende basiseenheden,
maar vier posities van dezelfde vrije routestap `6_hex`.

**Flower of Life = Kaart Door De 5D Informatielaag**

Flower of Life is geen ornament. Het is de navigatiekaart.

**Kern: 13_hex cirkels (1+6+C) = 19_dec cirkels**
*13_hex is de telling (aantal cirkels in de kern), niet het geometrische object zelf.*

**18_hex halve oogjes (24_dec) = tellingsresultaat van het Flower of Life patroon**
*18_hex is de telling, niet het geometrische object zelf.*

**Verdeling per guna — labels én producten:**
```
guna_label(6_hex)  := prema   (sattva: liefde, zuiverheid)
guna_label(C_hex)  := viveka  (rajas: onderscheidingsvermogen, beweging)
guna_label(12_hex) := tamas   (rust, dichtheid)
```
*6 + C + 12 = 24_hex (totaal = 24_hex, niet 18_hex — dit zijn labels én producten tegelijk)*
*half_eye_count(Flower_of_Life_pattern) = 18_hex (24_dec halve oogjes in de bloem)*

**Flower of Life = 4 richtingen:**
```
3 × 24_dec + 1 × 18_dec
= 72_dec + 18_dec
= 90_dec = 5A_hex
```
*3 richtingen × 24_dec (volledige ringen) + 1 richting × 18_dec (innerste ring, geen kern — fol_core = 13_hex = 19_dec)*

**12_hex aan de buitenkant = onderdeel van tamas**
(18_dec)

**Totaal:** 3×18_hex + 12_hex = 5A_hex
(3×24_dec + 18_dec = 90_dec = 5A_hex)

## NPR-Priemrouter — Gedeclareerde Perspectiefmapping

De NPR-priemrouter is een afzonderlijke semantische functie.

Deze functie is niet gelijk aan:

```
dr_hex(x)
```

en ook niet aan:

```
x mod 9
```

De drie functies blijven gescheiden:

```
dr_hex(x) → hex-native cijfersom
npr_mod9(x) → NPR-validatielaag met 0 ↦ 9
prime_route(r) → gedeclareerde priemrepresentant
```

### Definitie

```
prime_route : {1,2,3,4,5,6,7,8,9} → priemgetallen
```

De router kent aan iedere NPR-positie een priemrepresentant toe.

```
prime_route(1) = 13_hex   (19_dec)
prime_route(2) = B_hex    (11_dec)
prime_route(3) = 3_hex    (3_dec)
prime_route(4) = D_hex    (13_dec)
prime_route(5) = 5_hex    (5_dec)
prime_route(6) = 3_hex    (3_dec)
prime_route(7) = 7_hex    (7_dec)
prime_route(8) = 11_hex   (17_dec)
prime_route(9) = 3_hex    (3_dec)
```

### Vortex- en oscillatorgroepen

```
Vortexgroep = {3,6,9}
Oscillatorgroep = {1,2,4,5,7,8}
```

De vortexgroep deelt één priemrepresentant:

```
prime_route(3) = prime_route(6) = prime_route(9) = 3_hex
```

**Vortex 3 = één perspectief, uniek voor iedereen die kijkt:**
- Posities 3, 6 en 9 zijn verschillend
- Maar hun priemrepresentant is identiek: 3_hex
- Het is het EENTOE-VEEL-principe: één perspectief dat voor alle drie geldt
- Oscillators hebben elk een eigen priem (6 verschillende)
- Vortex heeft er maar één — gedeeld door alle drie
- 3 is het enige punt dat voor iedereen hetzelfde blijft

**Vortex ontstaat uit 1+2+3:**
```
1 + 2 + 3 = 6
3 × 1 = 3
3 × 2 = 6
3 × 3 = 9
```
- 3 = eerste vortexpositie (3×1)
- 6 = som van eerste drie + tweede vortexpositie (1+2+3 = 6, ook 3×2)
- 9 = derde vortexpositie (3×3)
- De vortex 3;6;9 is de vermenigvuldiging van 3 door zichzelf: 3×{1,2,3}

De oscillatorgroep krijgt zes afzonderlijke priemrepresentanten:

```
1 ↦ 13_hex  (19_dec)
2 ↦ B_hex   (11_dec)
4 ↦ D_hex   (13_dec)
5 ↦ 5_hex   (5_dec)
7 ↦ 7_hex   (7_dec)
8 ↦ 11_hex  (17_dec)
```

### Belangrijk onderscheid

Bijvoorbeeld:

```
dr_hex(13_hex) = 4
prime_route(1) = 13_hex
```

Dit is geen tegenspraak.

`dr_hex(13_hex)` berekent de hex-native cijfersom van `13_hex` → 1+3=4.

`prime_route(1)` kiest `13_hex` (19_dec) als semantische priemrepresentant van NPR-positie `1`.

Ook:

```
dr_hex(3_hex) = 3
prime_route(6) = 3_hex
```

betekent niet dat `3` digitale wortel `6` heeft. Het betekent alleen dat NPR-positie `6` via de gedeclareerde router dezelfde priemrepresentant gebruikt als positie `3`.

### Selectieregel

De selectie is normatief en maakt deel uit van NPR-OS:

```
3,6,9 → gedeelde vortex-priem 3
1,2,4,5,7,8 → afzonderlijke oscillator-priemen
```

De term "eerste priem" wordt niet gebruikt, omdat de waarden niet door een standaard oplopende of digitale-wortelregel worden afgeleid.

### Resultaat

```
Vortex:
{3,6,9} → 3_hex

Oscillator:
1 → 13_hex  (19_dec)
2 → B_hex   (11_dec)
4 → D_hex   (13_dec)
5 → 5_hex   (5_dec)
7 → 7_hex   (7_dec)
8 → 11_hex  (17_dec)
```

Dit is een gedeclareerde NPR-perspectiefmapping, geen eigenschap van standaard priemgetaltheorie.

### Toetsbare route

```
dr_hex(1A_hex) = B_hex
npr_mod9(B_hex) = 2
prime_route(2) = B_hex
```

Dat zijn drie opeenvolgende, maar afzonderlijk gedefinieerde routes.

### Priemgetallen: 4D vs Pre-4D (hex-native)

**Niet concurrerend — complementair.**

| Domein | Type | Bereik | Eigenschap |
|--------|------|--------|------------|
| **4D-priemtheorie** | Lineaire rij | Oneindig | 2, 3, 5, 7, 11, 13, 17, 19, 23, ... |
| **pre-4D-priemrouter** | Eindige NPR-mapping | 9 posities | 7 unieke priemen (3,5,7,11,13,17,19) |

**Verschil:**
- 4D-priemtheorie = sequentiële ontdekking (ruimte+tijd, oplopend)
- pre-4D-priemrouter = simultane declaratie (NPR-semantiek, 0=1 bronidentiteit)

**Belangrijk:**
- `prime_route` is **geen priemtheorie** — het is NPR-semantiek
- De priemwaarde 2 komt niet voor in het bereik van `prime_route`
  (positie 2 bestaat wel en routeert naar `B_hex`)
- Het ontbreken van priemwaarde 2 is een ontwerpkeuze, geen domeinbeperking
- Priemen >19 ontbreken (niet in flower-kern)
- Dat is geen fout — het is de **eindige NPR-omvang**

**Domein vs bereik:**
```
domein = {1,2,3,4,5,6,7,8,9}

oscillatorbereik = {5,7,B,D,11,13}_hex
vortexbereik = {3}_hex
volledig uniek bereik = {3,5,7,B,D,11,13}_hex

aantal unieke oscillatorpriemen = 6
aantal unieke priemen totaal = 7
ontbrekende vroege priemwaarde = 2
```

**Relatie:**
```
4D-priemtheorie:   2, 3, 5, 7, 11, 13, 17, 19, 23, 29, ... (oneindig)
pre-4D-priemrouter:  {3,5,7,11,13,17,19} → 7 van de eerste 8 priemen
```

Pre-4D dekt de **eerste fractale laag**:

```
flower_domain := {1_dec ... 19_dec}
count(flower_domain) = 19_dec = 13_hex
upper_bound(flower_domain) = 19_dec = 13_hex
project_geometry(NPR_Flower) = Flower_of_Life
flower_domain ≡ Flower_of_Life  (gedeclareerde structuurrelatie)
```
Daarnaast = 4D-priemtheorie overneemt.

**Concreet:**
- `prime_route(r)` kiest een priem als **semantische representant** van NPR-positie `r`
- Het is niet afgeleid van priemtheorie — het is gedeclareerde mapping
- Dezelfde priemen als 4D, maar andere functie: semantiek vs wiskunde

### Flower Domain — Onderliggende NPR-structuur

```
flower_domain := {1_dec ... 19_dec}
             = {1_hex ... 13_hex}
```

Het `flower_domain` is niet afgeleid van een afzonderlijke priemrouter en is ook geen externe semantische toevoeging.

Het is de onderliggende hex-native structuur waaruit de NPR-aanzichten gelijktijdig worden gelezen:

```
NPR_Flower :=
{
  flower_domain,
  flower_geometry,
  prime_route,
  reduction_layers,
  fractal_projection,
  project_fibonacci
}
```

Daarom geldt op structuurniveau:

```
component_of(prime_route, NPR_Flower)
component_of(flower_geometry, NPR_Flower)
component_of(reduction_layers, NPR_Flower)
component_of(fractal_projection, NPR_Flower)
component_of(project_fibonacci, NPR_Flower)
```

De priemrouter en de Flower of Life zijn geen opeenvolgende functies:

```
prime_route → Flower_of_Life
```

maar gelijktijdige projecties van dezelfde structuur:

```
project_prime(NPR_Flower) = prime_route
project_geometry(NPR_Flower) = Flower_of_Life
project_hex(NPR_Flower) = {1_hex ... 13_hex}
```

Hierdoor vormt:

```
range: 1_dec t/m 19_dec
count: 19_dec = 13_hex
```

de volledige eerste Flower-laag.

**Grenswaarde:**

```
19_dec = 13_hex
```

is tegelijk:

```
prime_route(1) = 13_hex       (priemrepresentant)
flower_core = 1 + 6 + C = 13_hex  (kernwaarde)
flower_domain = {1_hex ... 13_hex}  (verzameling)
upper_bound(flower_domain) = 13_hex  (scalaire grens)
```

Dit zijn geen drie toevallige gelijkheden. De scalaire waarde `13_hex` is de:
- priemrepresentant van NPR-positie 1
- som van de Flower-kern (1+6+C)
- bovengrens van de Flower-verzameling

Het zijn drie projecties van één hex-native Flower-structuur.

**Flower of Life kern — driedeling:**
```
1  → Planck frame   → śūnya/eka   → informatie (bron)
6  → product_mapping(6×6) → 24_hex ↦ water → stroming  (medium)
C  → 12_dec         → energie      → verhouding(kracht)
```

*1 + 6 + C = 13_hex. Niet opeenvolgend — tegelijk.*
*Informatie stroomt door water, gedreven door energie.*

### Fractale projectie

De Flower of Life wordt binnen NPR als fractaal behandeld:

```
fractal_projection(NPR_Flower) ↦ zelfgelijke herhaling
```

De Mandelbrotverwijzing benoemt het structurele principe:

```
volledige vorm
→ lokale herhaling
→ dezelfde verhouding op een volgende schaal
```

Daarom geldt binnen NPR:

```
Flower_of_Life ≡ hex-native fractale kaart
```

Dit is geen bewering dat de Flower of Life rekenkundig identiek is aan de klassieke Mandelbrotverzameling.

Het betekent dat beide binnen het model hetzelfde organisatieprincipe zichtbaar maken: een lokale structuur die de globale structuur opnieuw draagt.

### project_fibonacci — Declaratieve Fibonacci-correspondentie

Fibonacci is een bestaande wiskundige reeks. NPR declareert geen nieuwe reeks — het maakt een structurele correspondentie zichtbaar.

```
project_fibonacci(NPR_Flower) :=
{
  seed:              {0, 1},
  recurrence:        F(n) = F(n-1) + F(n-2),
  flower_correspondence:  positie_369 ↦ gulden_snede
}
```

**Correspondentie:**
- `seed = {0, 1}` — śūnya/eka (NPR-anker)
- `recurrence` — telregel (extern, niet afgeleid)
- `flower_correspondence` — NPR-positionering 3;6;9 op bloem-circumferentie
  correspondeert met gulden-snede-verhouding in bloem-arrangement

**Dit is geen afleiding van Fibonacci uit NPR.**
Fibonacci bestaat onafhankelijk. NPR observeert dat 3;6;9-posities op de Flower-circumferentie
structureel overeenkomen met gulden-snede-verhouding in natuur-arrangementen.

**Structuur ≠ afleiding.**
De correspondentie is gedeclareerd, niet bewezen als causaal.

### Gelijktijdigheid

```
flower_domain
≡ flower_geometry
≡ prime_route
≡ fractal_projection
≡ project_fibonacci
```


`≡` betekent hier structuur-equivalentie binnen NPR, niet rekenkundige gelijkheid.

De onderdelen ontstaan niet na elkaar. Zij bestaan tegelijk als perspectieven van dezelfde informatievorm. Dit is de toepassing van:

```
0 = 1
```

**0 = 1 is geen afleiding.** Het is het ANKER.
Het is niet iets waar je rekening naar toe leidt. Het is de bronidentiteit die alles in beweging zet.
Zonder 0=1 is er geen gelijktijdigheid — alleen opeenvolging.

Het nog niet geprojecteerde veld en de volledig zichtbare Flower-structuur zijn twee toestanden van hetzelfde NPR-object.

**Conclusie:**
```
Flower of Life volgt niet uit prime_route alleen.
prime_route en Flower of Life volgen beide uit NPR_Flower.
```

De hele hex-structuur **is** de Flower-of-Life-mapping. De priemrouter is slechts één perspectief ervan, net zoals de fractale-projectie een ander perspectief is.

---

### Priemgolf — Dec↔Hex Brug (Symboolniveau)

De brug tussen decimaal en hexadecimaal is geen fout — het is de golf zelf.
Twee talen, één symbool. 0=1 in actie: bronidentiteit met gelijktijdige perspectieven.

**Golfcyclus — waarde-identiteit en perspectief:**
```
19_dec = 13_hex    (dezelfde priemwaarde, andere basis)
13_dec = D_hex     (dezelfde priemwaarde, andere basis)
25_dec = 19_hex    (dezelfde samengestelde waarde, andere basis)
```

Deze regels gebruiken `=`, omdat iedere regel dezelfde getalswaarde in twee talstelsels weergeeft.

Binnen NPR geldt daarnaast op perspectiefniveau:
```
decimal_view(value) ≡ hexadecimal_view(value)
```
Hier betekent `≡` dat de twee views binnen NPR structuur-equivalente perspectieven zijn.
De waarden binnen die views blijven met `=` verbonden.

**Kerninzicht:**
Het symbool `19` is basis-afhankelijk:
- Als decimaal: `19_dec` = priem ✅
- Als hexadecimaal: `19_hex = 25_dec` = samengesteld (5×5) ✅

```
symbool "19" ⊃ {priem, samengesteld}
```

Niet: `priem ≡ samengesteld` (op getalniveau — wiskundig fout)
Wel: `symbool 19 ⊃ {priem, samengesteld}` (op symboolniveau — basis-afhankelijk)

**25_dec als EERSTE brug:**
- `25_dec = 5×5` is het EERSTE vierkant dat de cyclus sluit
- `5² = 25_dec`, dr_dec(25_dec) = 7
- `7² = 49_dec`, dr_dec(49_dec) = 4

**Iteratieve lus (4↔7):**
```
seed:  5² = 25_dec  → dr_dec(25_dec) = 7
lus:   7² = 49_dec  → dr_dec(49_dec) = 4
        4² = 16_dec  → dr_dec(16_dec) = 7
        7² = 49_dec  → dr_dec(49_dec) = 4
        ...
```
Dus: 4 ↔ 7 (oneindige iteratieve cyclus)

**Ondersteunend voorbeeld:**
- `13² = 169_dec`, dr_dec(169_dec) = 7
  → 13 landt ook op 7, maar is geen stap in de 4↔7-lus

**Andere symbool-herinterpretaties:**
- `"31" ⊃ {31_dec, 31_hex = 49_dec = 7²}`
- `"79" ⊃ {79_dec, 79_hex = 121_dec = 11²}`
- Conversieverschil: `31_dec = 1F_hex ≠ 31_hex`, `79_dec = 4F_hex ≠ 79_hex`
- Maar 25_dec is het EERSTE — de bron van de lus

**Priemgolf als NPR-cyclus:**
- Noise: 5 (priem, ruwe vorm)
- Pattern: 25_dec = 5² (vierkant, gestructureerd)
- Return: dr_dec(25) = 7 → 7² = 49 → dr_dec(49) = 4 → herhaal

**4↔7 is de fundamentele structurele oscillatie.**
*"Frequentie" impliceert tijd; dit is een dimensieloze numerieke oscillatie.
Hz-manifestatie vereist een aparte tijdschaal (post-4D)*

**≡ op drie niveaus:**
```
element-niveau:  0 = 1      (bronidentiteit; lege inhoud = volledige vorm)
```

```
symbool-niveau:  "19" ⊃ {19_dec, 19_hex}
  symbol_view("19", dec) = 19_dec  (priem)
  symbol_view("19", hex) = 19_hex = 25_dec  (composite)
```

```
basis-niveau:    value(x_dec) = value(y_hex)
  wanneer y de hex-representatie van x is
  voorbeelden:
    19_dec = 13_hex
    13_dec = D_hex
    25_dec = 19_hex
```

**Drie symbolen, drie betekenissen:**
```
=  → gelijkheid volgens de actieve laag:
        bronlaag:   0 = 1        (absolute bronidentiteit; breekt afleiding)
        rekenlaag:  19_dec = 13_hex  (zelfde getalswaarde, andere basis)
⊃  → hetzelfde ongetagde symbool heeft meerdere basisinterpretaties ("19" ⊃ {19_dec, 19_hex})
≡  → structurele overeenkomst tussen perspectieven (patroon, geen gelijkheid)
```

Analoog, maar niet identiek. Structuur is vergelijkbaar; inhoud verschilt per niveau.
inhoud verschilt per niveau.

De golf beweegt door het schakelen van perspectief:
- **dec → hex**: compressie (basis 16, compactere notatie)
- **hex → dec**: expansie (basis 10, lineaire uitleg)

Geen richting is "juister". De beweging zelf is de structuur.

**Golf als NPR-equivalent:**
- Noise: 19_dec (priem, ruwe lineaire vorm)
- Pattern: 13_hex (gecomprimeerde hex-vorm)
- Return: 19_hex→25_dec (terugkeer via composite vierkant)

Drie fasen, één cyclus. Net als NPR.

**Beperking:**
Dit is geen universele wiskundige wet.
Het is een fractale eigenschap van de 19-cyclus binnen basis 10/16.
Buiten deze context geldt het niet.

### Basis-overlappedomein: 1-9_dec = 1-9_hex

In het bereik 1 t/m 9 zijn decimale en hexadecimale representaties identiek:

```
1_dec = 1_hex
2_dec = 2_hex
...
9_dec = 9_hex
```

**Gevolg:** de NPR-posities {1..9} — inclusief vortex {3,6,9} en oscillators {1,2,4,5,7,8} — hebben identieke notatie in beide talstelsels.

De vortex/oscillator-structuur {1..9} heeft toevallig glyph-identieke representaties in beide talstelsels.

Bij 10_dec (= A_hex) stopt de glyph-identiteit. Van daar af divergeren de representaties.

### Flower Domain — 1 t/m 19_dec

```
1_dec ... 9_dec  = 1_hex ... 9_hex   (basis-overlap, vortex + oscillators)
10_dec ... 19_dec = A_hex ... 13_hex  (divergentie, priemrouter neemt over)
```

De flower-kernwaarden 1-9 zijn als getalswaarden onafhankelijk van representatie.
Binnen basis 10 en basis 16 zijn hun representaties bovendien glyph-identiek.

`prime_route` neemt NPR-posities {1..9} als invoer en produceert de eindige verzameling:
```
range(prime_route) = {3, 5, 7, B, D, 11, 13}_hex
                   = {3, 5, 7, 11, 13, 17, 19}_dec
```
Deze waarden zijn gedeclareerde priemrepresentanten — geen berekening, geen afleiding.
Vier daarvan vallen in de divergentiezone 10-19_dec: {11, 13, 17, 19}.

### 6-bit Volledige Cyclus

Het zesbitveld bevat:

```
state_domain := {00_hex ... 3F_hex}
aantal toestanden = 40_hex = 64_dec
minimum = 00_hex
maximum = 3F_hex
```

**40_hex is niet een toestand binnen het veld.**
40_hex is de eerste tellerwaarde na 3F_hex en activeert Return:

```
cycle_next(3F_hex) = 00_hex
```

Equivalent als modulo-operatie:

```
40_hex mod 40_hex = 00_hex
```

**Toestanden vs ordinale telling:**

```
toestanden:    00_hex → 01_hex → ... → 3F_hex → 00_hex
ordinale:      1      → 2      → ... → 64      → terugkeer
```

- De 64 toestanden zijn `00_hex ... 3F_hex` (waarden 0–63)
- De ordinale telling `1 ... 64` is het AANTAL stappen door de cyclus
- `40_hex = 64_dec` is de wrapgrens, geen toestand

**Binnen NPR:**

```
00_hex = bron
40_hex ↦ Return naar 00_hex
```

- 64 = 2^6 — de macht van de 6-structuur
- 0 is geen eindpunt — het is de bron waar de cyclus terugkeert
- 0 = 1: het einde is het begin (bronidentiteit)

```
00 → 01 → ... → 13_hex (flower) → ... → 3F → 00 → ...
```

De 64-cyclus dekt de volledige 6-bit representatie (00-3F = 64 toestanden).
40_hex is de wrapgrens — niet een toestand.

---

*Keten stopt hier. Verdere uitbreiding vereist expliciete fractale routing-functie.*

*De priemrouter is geen willekeurige mapping. Het is de hex-native uitdrukking van de eerste fractale laag.*
*Zie: `project_fibonacci` (declaratieve correspondentie, geen afleiding).*

**6 ≡ 1 (Planck frame — perspectief-equivalentie):**

**Context:**
- `6 = 1 + 2 + 3` — cumulatieve som vormt de vortex 3;6;9
- `6 ≡ 1` is een gedeclareerde perspectiefrelatie, niet afgeleid
- Geen rekenkundige afleiding nodig — het ANKER (`0 = 1`) maakt dit mogelijk

*6 → 64_dec ↦ 00_hex (full-cycle wrap) ≡ 0 = 1 (śūnya = eka) — perspectief, geen berekening.
64_dec = 40_hex = 2^6 (6-bit veld).*

**3 is invariant. 5 ontstaat in de frame.**

**3** is altijd hetzelfde — de vortex (3;6;9), het prisma, de structuur die zichzelf weergeeft.
Geen frame nodig. Geen perspectief. 3 = 3.

**5** is geen fundamenteel getal — het ontstaat binnen de NPR-frame als resultaat:

**De 5 elementen = de stabiele punten in de 6-bit routing.**

6-bit = de route die constant is. (`2^6 = 64`, domein {00..3F}).

**Route 1 — de 5 elementen:**
```
element_set := {ether, water, vuur, aarde, lucht}
count(element_set) = 5_dec
```

**Route 2 — 6n±1 composieten + śūnya (aparte verzameling):**
Van alle waarden van de vorm `6n±1` binnen {00..3F} zijn er precies 4 composieten:
```
19_hex = 25_dec  = 5×5
23_hex = 35_dec  = 5×7
31_hex = 49_dec  = 7×7
37_hex = 55_dec  = 5×B
```

Deze 4 composieten = de stabiele punten (opslag, recursie).

**Partitie van 6n±1 binnen {0..63}:**
```
six_n_pm_one := {1, 5, 7, 11, 13, 17, 19, 23, 25, 29, 31, 35,
                  37, 41, 43, 47, 49, 53, 55, 59, 61}  (21_dec)

six_n_pm_one = primes_6n_pm1 ∪ composites_6n_pm1 ∪ {1_dec}

composites_6n_pm1 = {25, 35, 49, 55}  (4_dec)
primes_6n_pm1     = {5, 7, 11, 13, 17, 19, 23, 29, 31,
                      37, 41, 43, 47, 53, 59, 61}  (16_dec)
{1_dec}           = noch priem, noch samengesteld

6 × 10 + 1 = 61 → laatste 6n+1 binnen 63
6 × 11 - 1 = 65 > 63 → stop
```

Totaal: 16 + 4 + 1 = 21 ✅

1_dec (`6×0+1`) is noch priem, noch samengesteld — net als 0.

- 4 composieten = `{25, 35, 49, 55}` dec
- `+ śūnya (0)` = het lege veld dat recursie mogelijk maakt
- `0` is noch priem noch samengesteld — apart veld

```
stable_composites := {19, 23, 31, 37}  (hex)
stable_composites_dec := {25, 35, 49, 55}
count(stable_composites) = 4_dec
storage_set := stable_composites ∪ {śūnya_numeric}
count(storage_set) = 5_dec
```

**Twee verzamelingen, één cardinaliteit:**
```
count(element_set) = 5_dec
count(storage_set) = 5_dec
```

Dit is een **coïncidentie van cardinaliteit**, geen identiteit van verzamelingen:
- `element_set = {ether, water, vuur, aarde, lucht}` — semantische labels
- `storage_set = {19, 23, 31, 37, 00_hex}` — hex-waarden (00_hex = śūnya_numeric)
- Ze hebben elk 5 elementen, maar zijn inhoudelijk verschillend
- Er is geen gedeclareerde mapping tussen element_set en storage_set

**Faalpunt vermijden:**
- `{25, 35, 49, 55, 0}` ≠ {alle niet-priem in 0..63}
- Dit zijn de 6n±1 composieten — de enige composieten van vortex-vorm
- śūnya is noch priem noch samengesteld — apart veld

5 is niet "uniek" of "fundamenteel" — het is een consequentie van de 64-cyclus-structuur.

**Śūnya — twee rollen, één symbool:**
```
type śūnya_semantic : status      (leeg, uit, veld, onzichtbaar)
type śūnya_numeric  : value = 00_hex  (null, minimum, wrap-doel)
```
- `śūnya` als semantische status ≠ `śūnya` als hex-waarde `00`
- `00_hex` als eindmarker (token-pos 24) ≠ `00_hex` als padding-char
- Decodeerregel: `decode6(00_hex)` kijkt naar positie:
  - eerste 00_hex na data → śūnya_eindmarker
  - volgende 00_hex-waarden → śūnya_padding

**Verschil:**
| | 3 | 5 |
|---|---|---|
| Status | Invariant | Frame-afgeleid |
| Oorzaak | NPR-core (vortex) | Cyclus-resultaat (composites + śūnya) |
| Perspectief | Geen — altijd hetzelfde | Afstand-afhankelijk — Planck bij C_hex |

*3 is de bron. 5 is het echo.*

**1 is niet statisch:** `1 ≡ 3`, `1 ≡ 6`, `1 ≡ 9` — afhankelijk van perspectief.

*Deze zijn perspectief-equivalenties, geen rekenkundige gelijkheden. NPR is geen statisch model.*

**Perspectief-transformatie (NPR-perspectiefcodes, geen rekenkundige producten):**

Waarden zijn NPR-perspectiefcodes (1→Noise, 2→Pattern, 3→Return),
getransformeerd per 3-6-9 perspectief. Resultaten zijn decimale labels —
zie `369_table` in 05_physics_369.md voor de hex-native tabel.

```
perspectief_1 (basis):   1→1   2→2   3→3
perspectief_3:           1→3   2→6   3→9
perspectief_6:           1→6   2→12  3→18
perspectief_9:           1→9   2→18  3→27
```
*Labels zijn perspectief-indexen, geen vermenigvuldiging. De waarden komen toevallig overeen met ×3/×6/×9 maar dat is perspectief, niet berekening.*

Alle outputwaarden: `_dec` (decimale labels).
Hex-native equivalenten: 12_dec=C_hex, 18_dec=12_hex, 27_dec=1B_hex.

**Machten van 2:**
```
2 → 4 → 8 → 16 → 32 → 64
64_dec ↦ 00_hex (full-cycle wrap) ≡ śūnya ≡ eka ≡ 1  (perspectief: volledige cyclus → basis-eenheid)
64_dec = 40_hex = 2^6 = 6-bit veld
```

**4 perspectieven samen → 1:**

De 3 perspectieven (3, 6, 9) + perspectief 1 = 4 perspectieven.

Aggregatieregel:
```
npr_unify(perspectief_1, perspectief_3, perspectief_6, perspectief_9) := 1
```

Dit is geen som of product. Het is een NPR-unificatie:
vier perspectieven op dezelfde structuur reduceren naar één eenheid.

`npr_unify` is een gedeclareerde aggregatiefunctie — niet afgeleid van rekenkunde. De uitkomst is een NPR-eenheid, geen rekenkundig resultaat.

**Patanjali Yoga Sūtra 1.33 (brug naar NPR):**

De vier houdingen uit Yoga Sūtra 1.33 corresponderen
binnen NPR met de vier perspectieven:

```
ys_1_33_attitudes := {maitrī, karuṇā, muditā, upekṣā}
npr_perspective_correspondence : ys_1_33_attitudes → four_perspectives
```

- Maitrī (vriendelijkheid/welwillendheid)
- Karuṇā (mededogen)
- Muditā (medevreugde)
- Upekṣā (gelijkmoedigheid/niet-achtendheid)

```
bhāvanātāś citta-prasādanam
(cultiveren → geest/helderheid)
```

*Deze correspondentie is een gedeclareerde NPR-interpretatie.*
*Yoga Sūtra 1.33 zelf definieert geen NPR-perspectiefcodes.*

**Prema — woord, frequentie en betekenisveld:**

`Prema` is geen exacte vertaling van *liefde*. Het is een Sanskrietwoord
naar een ervaringsveld dat niet volledig in één Nederlands woord past.
*Liefde* is een benaderend label.

Deze zijn gelijktijdige perspectieven, geen opeenvolging:
```
prema
  ↕ klank/woordstructuur
  ↕ Sanskrit-codering
  ↕ spectrale NPR-waarde
  ↕ NPR-perspectief
  ↕ benaderend label: liefde
```

`prema ↦ benaderend betekenisveld`  (niet: `prema = liefde`)
`prema ↦ NPR-structuur`            (niet: `prema = 6`)

De spectrale NPR-waarde is één structureel perspectief — geen definitie.
De Hz-waarde is de tijdgebonden, meetbare weergave daarvan.
Het woord blijft groter dan het getal.

*Grieks: hēdonē, agapē, ēthos — verschillende ervaringdimensies*
*Geen verwisselbare vertalingen, maar aspecten van hetzelfde veld*

**NPR-structuur 6:**

6 is geen priem-invariant — het is een **structuurwaarde**:
- NPR: 1(Noise) + 2(Pattern) + 3(Return) = 6
- 6-bit: veldgrootte per char (0..63)
- `6 ≡ 1` in Planck frame (cyclus voltooiing = basis)

**6 (pre-4D) ≠ 6 Hz (4D):**
```
spectral_position(6) := structuurwaarde   (dimensieloos, tijdloos)
frequency_view(6)     := 6 Hz             (tijdschaal, 4D-manifestatie)
```
*spectral_position ≠ frequency_view.*
*Het spectrum bestaat vóór de meting, maar de Hz-waarde vereist een tijdschaal.*
*Pre-4D / 4D / tijd / tijdloos — gelijktijdig, niet opeenvolgend.*
*Invarianten: π, φ — onafhankelijk van stelsel.*
*6 is NPR-structuur — stelsel-afhankelijk maar intern consequent.*

**Analogie (perspectief, niet gelijkheid):**
```
perspective_shift(prema) := karuna
*Gerichte perspectiefverschuiving, geen symmetrische dualiteit.*
C_hex ≡ planck_frame_position  (NPR-positionering, niet rekenkundige gelijkheid)
```

**5D (NPR-informatielaag — niet fysieke dimensie):**
```
5D_layer := NPR-informatielaag
  (geen fysieke dimensie, geen metriek, geen tijdcoördinaat,
   structuurlaag waar Flower_of_Life als kaart fungeert)
```

**5D-laag → Flower of Life → elementen (via productmapping):**
```
fol_outer_ring := 12_hex    (tamas-positie, 18_dec cirkels)
fol_half_petals := 18_hex   (24_dec halve oogjes — geen elementwaarde)
product_mapping(6×6) := 24_hex ↦ water  (36_dec = 6×6, hex-native)
fol_total := 25_hex        (1+6+C+12 = 37_dec cirkels totaal)
fol_core := 13_hex         (1+6+C = 19_dec cirkels kern)
```
*Deze drie waarden (12_hex, 18_hex, 24_hex) zijn onderscheiden.
De tokenroute 5D→water→token is nog te definiëren: de mapping van
5D_layer → product_mapping → element_label → token-encoding is conceptueel
maar niet formeel als functie uitgeschreven.*

**NPR-char = 6-bit veld:**

1 NPR-char = 1 zesbit-cel = 6 raw bits = `{00_hex ... 3F_hex}`
aantal waardes per char = 40_hex = 64_dec

**Char-toestanden (deterministisch):**
```
encode6(status) → zesbitpatroon
  śūnya_origin  → 00_hex = 000000  (absolute leegte, nul-toestand)
  eka           → 3F_hex = 111111  (volledige activatie, eenheid)
  data          → 01..3E_hex       (62 datawaardes)

decode6(patroon) → status
  00 → śūnya_origin
  3F → eka
  01..3E → data
```

**Śūnya-typing (geen botsing):**
```
śūnya_origin := 00_hex        (absolute leegte, eindmarker, nul-toestand)
śūnya_zone   := {30..3F_hex}  (actieve route-zone; zie Stap 08)
```

- `00` is de oorsprong — de leegte waaruit alles volgt
- `30–3F` is de zone — het actieve routing-gebied binnen het 6-bit veld
- `3F` is het eindpunt van de zone — de volledige activatie (eka)
- Beide zijn geldig, maar op verschillende niveaus: oorsprong vs. actieve zone
```

**Token-structuur (canoniek: 18 hex-chars = 24 decimaal chars):**
```
token = 23 chars + 1 śūnya-char = 24 decimaal chars
  char 1..23 → data (01..3E_hex)
  char 24    → śūnya_eindmarker (00_hex)
```
*Elke NPR-char = 6 raw bits. Token = 24 × 6 = 144 raw bits.*

**Token-routing (stap 16 concept):**
Vaste tokenlengte: 24 chars (18_hex). Data-aantal is variabel; marker en padding vullen aan.
```
token_length := 24 chars = 18_hex   (vaste totale lengte)
data_count := 1..23 chars           (variabel, 01..3E_hex)
marker_count := 1 char              (altijd 00_hex, eerste 00_hex in token)
padding_count := token_length - data_count - marker_count

token_layout := [data_chars...] + [00_hex : eindmarker] + [00_hex... : padding]
```
*Elke token is exact 24 chars. Minder data → meer padding.
Canoniek: 23 data + 1 marker + 0 padding = 24.
Minimaal: 1 data + 1 marker + 22 padding = 24.
Śūña-char als eindmarker ≠ śūña-char als padding.
Datachars zijn 01..3E_hex; 00_hex is uitsluitend eindmarker/padding.*

**Decodeerregel marker vs padding (niet-circulair):**
```
decode_śūnya_position(token, pos) :=
  terminator_pos := first position containing 00_hex in the token
  if pos == terminator_pos then śūnya_eindmarker
  else if pos > terminator_pos then śūnya_padding
  else data
```
*Omdat data alleen 01..3E_hex bevat, is de eerste 00_hex altijd de terminator.
Geen circulair verleden: terminator_pos wordt bepaald door scan, niet door bekende datalengte.*
*Beide gebruiken de waarde `00_hex`, maar hebben verschillende semantische rollen.*

### Zichtbaar vs Onzichtbaar Spectrum

**EM spectrum:**
- Zichtbaar licht = klein deel (400-700 nm)
- Niet-zichtbaar = grootste deel (radio → gamma)

**NPR 64-cyclus:**
- Zichtbaar = geactiveerde chars (focus)
- Onzichtbaar = śūnya-veld (00)

```
              00_hex ← śūnya-veld (grootste deel)
             /    |    \
   radio-golf  → zichtbaar → γ-straling
  (onzichtbaar)  (focus)   (onzichtbaar)
```

**Focus = energie:**
- Focus hoog = γ-straling (hoogste frequentie)
- Focus laag = radio-golf (laagste frequentie)
- Focus midden = zichtbaar (wat wij zien)

**Taalveld als prisma:**
```
śūnya-veld → focus (energie) → taal (zichtbaar spectrum)
                     ↑
              dit is de filter
              dit is de lens
              dit is de vraag die je stelt
```

**Zonder śūnya:** geen ruimte voor focus.
**Zonder focus:** geen zichtbaar spectrum.
**Zonder taal:** geen naam voor wat je ziet.

**Verhouding (analogie, geen numerieke verhouding):**
```
taal : śūnya  ≠  1 : 0  (niet numeriek)
taal ∝ śūnya  ~  zichtbaar ∝ onzichtbaar  (analogie, geen exacte verhouding)
                ~  klein deel ∝ groot deel
                ~  prisma-uitgang ∝ prisma-ingang
```
*Deze zijn kwalitatieve analogieën, geen berekenbare verhoudingen.*

**Taal is niet de realiteit. Taal is het zichtbare deel.**

Het grootste deel blijft śūnya — onzichtbaar, maar aanwezig.

**Taalveld = prisma. Fysica = licht.**

### Zien > Berekenen

```
Sanskrit-getal ↦ spectrale NPR-waarde  (mapping, geen rekenkundige gelijkheid)
spectrale_NPR_waarde :: structuur      (type: structureel perspectief, geen "wiskunde")
```
*De Sanskrit-getalregel is een mappingregel, geen rekenkundige identiteit.
Het woord "wiskunde" is een label, geen type.*

De spectrale waarde is één structureel perspectief.
De Hz-waarde is de gemeten, tijdgebonden weergave daarvan.
Dat kun je moeilijk vertalen.
**Dat moet je zien.**

Flower of Life = visuele navigatie. Het patroon is de taal.
Het getal is het resultaat. De volgorde is anders.

3 gunas = {sattva, rajas, tamas}
4e anker = śūnya (0)
Totaal = 4 posities (3 richtingen + 1 anker)

**5 Elementen — Labels en Productmapping:**

**1 hexa** = NPR-cyclus (3,6,9) — het prisma
**5 elementen** = het spectrum dat uit het prisma komt

```
element_set := {ether, water, vuur, aarde, lucht}
count(element_set) = 5

element_labels:
  ether = 0      (śūnya, het onzichtbare veld)
  water = vloeibaar  (medium, de golf)
  vuur = transformatie  (zichtbaar spectrum)
  lucht = beweging  (frequentie)
  aarde = stabiliteit  (structuur)

focus_state := eka  (1 — focus, de energie)
```
*Eka is geen element — het is de focus-status.*
*Elementen = 5, eka = aparte focus-state.*

De productmapping berekent elementposities.
element_label koppelt deze posities aan semantische elementnamen.
Label én product zijn geen tegenstelling — ze zijn tegelijk.

**Zonder 0 (ether):** geen ruimte voor spectrum.
**Zonder 1 (eka):** geen focus, geen zichtbaar.
**Zonder hexa (3,6,9):** geen prisma, geen taal.

**Labels (perspectief-indexen, niet rekenkundig):**
```
element_label(00_hex) := ether   (ākāśa)  [leegte/ruimte]
element_label(24_hex) := water    (jal)    [stroming]
element_label(30_hex) := vuur     (tejas)  [transformatie]
element_label(36_hex) := aarde    (pṛthvī) [stabiliteit]
element_label(48_hex) := lucht    (vāyu)   [beweging]
```

**Hex-native producten (productmapping, elementpositie × 6):**
```
0 × 6 = 0_dec  = 00_hex ↦ ether (śūnya, geen product)
6 × 6 = 36_dec = 24_hex ↦ water
8 × 6 = 48_dec = 30_hex ↦ vuur
9 × 6 = 54_dec = 36_hex ↦ aarde
C × 6 = 72_dec = 48_hex ↦ lucht
```
*Hex en dec zijn representaties van dezelfde productwaarde.
Elementlabels zijn semantische mappings (↦), geen rekenkundige gelijkheden (=).*
*Elementlabels gebruiken de hex-representatie.*

**Elementen-namespace:**
```
char_domain := {00_hex ... 3F_hex}  (64 waardes)
element_value_domain := niet beperkt tot char_domain
  - 00_hex, 24_hex, 30_hex → binnen char_domain
  - 36_hex, 48_hex → buiten char_domain (functie-posities)
```

**Element-relatie (NPR, niet rekenkundig):**
```
element_label(24_hex) := water
element_label(30_hex) := vuur
npr_element_relation(vuur, water) := transformatie
  (verschillende labels, dezelfde onderliggende structuur)
```
*Vuur ≠ water (verschillende labels/waarden)*
*`npr_element_relation(vuur, water) = transformatie` is een gedeclareerde relatie — geen symmetrische equivalentie*

### Bit-Niveau — Śūnya-veld en Focus

**6-bit veld:**
```
aantal toestanden = 40_hex (64 decimaal)
minimaal = 00 = 000000 (śūnya, onzichtbaar)
maximaal = 3F = 111111 (eka, zichtbaar)
```

**Niet:** `40_hex = 000000`. Wel: `40_hex` = aantal mogelijke waarden.

**Spectrum-model:**
```
śūnya-veld  = 00_hex   → grootste deel, onzichtbaar
focus       = energie  → selecteert welk spectrum zichtbaar wordt
taal        = resultaat → zichtbaar spectrum (klein deel)

taal : śūnya  ≡  zichtbaar : onzichtbaar
              ≡  klein deel : groot deel
              ≡  prisma-uitgang : prisma-ingang
*≡ = perspectief-equivalentie binnen één frame, geen rekenkundige gelijkheid*
```

**8-bit veld:**
```
aantal toestanden = 100_hex (256 decimaal)
minimaal = 00
maximaal = FF
```

**Tantrische structuur:**
```
śūnya = 000000 (volledig leeg)  → 00_hex
eka   = 111111 (volledig vol)   → 3F_hex
```

Dit koppelt aan het NPR-hexveld:
```
bit6 = 6-bit = 00-3F  (40_hex states, NPR-char domein)
bit8 = 8-bit = 00-FF  (100_hex states, extern byte)
mod9 = NPR-mod-9 = {1..9}  (9-cyclus)
npr_mod9(x) := 9, als x mod 9 = 0;  x mod 9, anders
(standaard mod-9 → {0..8}, NPR normaliseert 0→9)
```

**0 = 1** (bronidentiteit — zie Stap 07 en Stap 12)
śūnya ≡ eka (onzichtbaar ≡ zichtbaar — zonder het een, geen ander)

### Verhouding Inhoud/Perspectief

De verhouding tussen inhoud en perspectief blijft altijd hetzelfde:

```
1 → 3 → 9
```

**1** = definitie van eenheid (wat eigenlijk 3 is in NPR-semantiek — zie stap 05)
**6** = laat zien in NPR-perspectief (geen rond getal)
**Inhoud/perspectief** = constante verhouding, onafhankelijk van definitie van 1

**Flower of Life totaal (hex-native):**
```
1 centrum  + 6 ring1 + C ring2 + 12 ring3 = 25_hex
kern: 1 + 6 + C = 13_hex
```

**Niet:** `19 totaal → 13_hex`. Wel: `13_hex` is de kernwaarde direct.

---

## Verschil: decimale vs hex-native cijfersom

| Systeem | Operatie | Resultaat 1A |
|---------|----------|---------------|
| **Decimale cijfersom** | 1A_hex → 26_dec → 2+6=8 | 8 |
| **Hex-native cijfersom** | 1A → 1+A = B_hex → npr_mod9(B_hex) = 2 | **B** (1D), **2** (npr_mod9) |

Dit zijn **twee representatie-afhankelijke cijfersomoperaties**. Geen "4D-wetenschap" vs "pre-4D".

**NPR-notatie is hex-native; decimale conversies zijn display-laag.**
*Interne NPR-berekeningen gebruiken hex-representatie.
Decimale waarden zijn conversies voor leesbaarheid — geen afzonderlijke NPR-structuur.*

---

## Test

**Bereken de route voor cel 1A:**
```
6D: _______
3D: _______
1D: _______
9:  _______
```

**Vraag:** Wat is het verschil tussen 4D-rekenen en NPR-rekenen?

**Antwoord:**
- 4D = lineair, sequentieel, oneindig (priemtheorie, ruimte+tijd)
- NPR = tegelijk, eindig, gedeclareerd (priemrouter, 0=1, hex-native)
- NPR-decimaal = twee representatie-afhankelijke operaties, niet "4D vs pre-4D"

---

## Resultaat

```
6D: 1A
3D: B
1D: B
9:  2
✅ geldig
Reden:
1. Hex-native cijfersom correct (1+A=B)
2. NPR-mod-9-laag afzonderlijk, met 0 ↦ 9 (npr_mod9(B_hex) = 2)
3. 6D/3D/1D = NPR-reductielagen (geen fysieke dimensies)
4. Flower of Life = geometrische visualisatie reductielagen
5. Decimaal vs hex-native = twee representatie-afhankelijke operaties
```

**Flower of Life mapping (hex-native):**
```
1 centrum    → 1D (volledig gereduceerd)
6 ring 1     → 3D (hex-symmetrie)
C ring 2     → 6D (uitbreiding)
12 ring 3    → 6D (buitenlaag)
totaal: 1+6+C+12 = 25_hex
kern:   1+6+C = 13_hex → dr_hex(13_hex)=4_hex → npr_mod9(4_hex)=4
```

**Vectorketen (hex-native):**
```
vector_n := n × 6_hex

vector_1 = 6    (1×6)
vector_2 = C    (2×6)
vector_3 = 12   (3×6)
vector_4 = 18   (4×6)
```

**5 elementen (hex-native labels):**
```
element_set := {ether(00), water(24), vuur(30), aarde(36), lucht(48)}
focus_state := eka(3F)
```

**NPR-char (hex-native):**
```
bit6: 40_hex states (00-3F), 00=śūnya, 3F=eka
bit8: 100_hex states (00-FF)
mod9: NPR-mod-9 cyclus ({1..9})
6×6=36_dec=24_hex, 8×6=48_dec=30_hex, 9×6=54_dec=36_hex, C×6=72_dec=48_hex
```

**Sandbox:** `8×8 = 40_hex` cellen. **Niet** 5×5.

**Verhouding inhoud/perspectief:**
```
1 → 3 → 9 (constante verhouding)
```

**Conditioneel:**
- Hex-native berekening: ✅ geldig
- NPR-reductielagen: ✅ geldig
- Vectorketen: ✅ vector_1=6, vector_2=C, vector_3=12, vector_4=18 (hex-native)
- Flower of Life: ✅ patroon (13_hex cirkels, 18_hex halve oogjes)
- 5D→water→token: ⚠️ 3 waarden + productmapping gedefinieerd; formeel als functie nog te schrijven
- Token: ✅ 24 chars = 144 raw bits (23 data + 1 śūnya)
- NPR-char: ✅ 1 NPR-char = 6 raw bits (00..3E data, 3F=eka)
- NPR-Priemrouter: ✅ gedeclareerde perspectiefmapping (dr_hex ≠ npr_mod9 ≠ prime_route)
- Vortex/Oscillator: ✅ {3,6,9}→3, {1,2,4,5,7,8}→{13,B,D,5,7,11_hex}
- Priemgolf: ✅ 19_dec=13_hex, 19_hex=25_dec (glyph-shift, niet gelijkheid)
- Perspectief-equivalentie: ✅ 6≡1 (Planck frame), 0=1 (bronidentiteit)
- Twee routes naar 5: ✅ element_set en storage_set hebben dezelfde cardinaliteit (5_dec), geen verzameling-identiteit
- Perspectief-equivalentie: ✅ vertalingstabel (perspectief_3, _6, _9) + machten (64↦1)
- 4 perspectieven: ✅ samen = 1 (Patanjali 1.33)
- perspective_shift(prema): ✅ karuna (gerichte perspectiefverschuiving, formeel gedefinieerd)
- planck_frame_position: ✅ C_hex ≡ planck_frame_position (NPR-positionering)
- NPR-char (40_hex states): ✅ geldig
- Productmapping: ✅ 6×6=36_dec=24_hex, etc. (hex=representatie, niet Dimensie×6)
- 5 elementen: ✅ hex-native labels, aparte namespace (eka ≠ element)
- Sandbox: ✅ 8×8=40_hex (geen 5×5)
- 4D-claim: ✅ gecorrigeerd (niet verwijderd — complementair aan pre-4D)
- 4D vs pre-4D: ✅ 4D=lineair/oneindig, pre-4D=eindige NPR-mapping
- prime_route: ✅ geen priemtheorie — NPR-semantiek (7 unieke priemen)
- Fysieke dimensie-claim: ✅ gecorrigeerd (complementair aan pre-4D, niet verwijderd)

---

**Stap 14 — Eindoordeel:**

```
Kernreductie:                  ✅ geldig
Priemrouter:                   ✅ intern gedefinieerd
Flower- en elementmapping:     ✅ intern gedefinieerd
Tokenlayout en decodering:     ✅ lokaal consistent

Interne consistentie Stap 14:  ✅ geldig
Ketenvolledigheid:             ⚠️ conditioneel

Open afhankelijkheden:
- Stap 15 moet de signaal→perceptieroute valideren.
- Stap 16 moet de 5D→element→tokenroute operationeel sluiten.

depends_on(step_15.signal_perception)
depends_on(step_16.token_encoding)
```

---

## Check: 2026-07-12 10:27 GMT+2
- Status: NPR-OS Stap 14 — intern gevalideerd, keten conditioneel ⚠️
- `depends_on(step_15.signal_perception)` → nog open
- `depends_on(step_16.token_encoding)` → nog open
- 5D→token formeel gedefinieerd in stap 16 (nog niet gevalideerd)
- 5D_source somtype (Element | Field) expliciet
- project_5D + token_encoding keten wacht op stap 15+16 validatie
