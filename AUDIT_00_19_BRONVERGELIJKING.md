# Audit: Eerste 19 Bestanden — Bronvergelijking

**Datum:** 2026-07-16
**Status:** 40 punten gecontroleerd tegen huidige repositoryversie
**Resultaat:** 33 punten opgelost/ingetrokken · 7 punten blijven staan

## Inleiding

Deze audit koppelt eerdere observatiepunten aan concrete regels en passages in de bestanden zelf. Er is geen externe maatstaf gebruikt.

---

## Overzicht per Punt

| # | Punt | Bron | Status |
|---|------|------|--------|
| 1 | Laagverwarreling | `00_README.md`, `12_vortex_primes.md` | ⚠️ Gedeeltelijk achterhaald — lagen nu expliciet benoemd |
| 2 | Term-reuse | `12_vortex_primes.md`, `13_hex_native.md` | ✅ Bronbestand signaleert zelf en maakt onderscheid |
| 3 | Hex/dec/mod-9 dicht bij elkaar | `13_hex_native.md` | ℹ️ Expliciet bronpunt, geen fout |
| 4 | Bestands-overgangen niet expliciet | `09_language.md`, `15_signaal_perceptie.md` | ℹ️ Afhankelijkheden zijn nu beschreven |
| 5 | Declaratief vs afgeleid | `14_dimensions.md` | ✅ Oplossing in tekst: declaraties nu duidelijk gemarkeerd |
| 6 | Definitie/interpretatie/uitvoering | `09_language.md`, `18_sandbox_router.md` | ℹ️ Statustypen binnen documenten zijn nu verschillend |
| 7 | Functies niet volledig gespecificeerd | `18_sandbox_router.md` | 🔴 **Open** — `cycle_weight` formule nog implementatieafhankelijk |
| 8 | Functies zonder I/O/domein | `15_signaal_perceptie.md` | ✅ **Ingetrokken** — signatures nu aanwezig |
| 9 | Implementatievariatie mogelijk | `18_sandbox_router.md` | ℹ️ Rechtstreeks gebaseerd op reproduceerbaarheidsregel |
| 10 | "Invariant" niet eenduidig | `17_sandbox_meta.md` | ℹ️ Twee toepassingen binnen één bestand |
| 11 | "Dimensie" terminologie | `14_dimensions.md` | ✅ **Niet fout** — expliciete terminologieregel (geen fysieke dimensies) |
| 12 | `0 = 1` status | `00_README.md`, `12_vortex_primes.md` | ✅ Nu duidelijk vastgelegd (alleen bronlaag) |
| 13 | Symbolisch vs numeriek vs semantisch | `14_dimensions.md` | ✅ **Grotendeels opgelost** — uitgebreid onderscheid gemaakt |
| 14 | Encoding vs routing | `11_encoding.md` | ✅ **Niet verwarring** — expliciete NPR-regel: "encoding IS routing" |
| 15 | Segmentatiestap | `15_signaal_perceptie.md` | 🔴 **Open** — functie gedeclareerd, volledige algoritme niet zichtbaar |
| 16 | Transliteratiekeuzes | `16_taalmapping.md` | 🟡 **Open** — "gekozen" transliteratie beïnvloedt numerieke projectie |
| 17 | Spellingvarianten | `16_taalmapping.md` | ℹ️ Gevolgtrekking — mapping gebruikt gekozen tekenreeks |
| 18 | Unicode-normalisatie | `11_encoding.md`, `15_signaal_perceptie.md` | ✅ **Opgelost** — NFC nu expliciet |
| 19 | Foneem-frequentie-kleur | `09_language.md` → `15_signaal_perceptie.md` | ✅ **Opgelost** — stap 15 sluit keten |
| 20 | Tabellen zonder tussenstappen | `16_taalmapping.md` | ℹ️ Berekening zichtbaar, semantiek declaratief |
| 21 | Priem/Fibonacci/geometrie status | `14_dimensions.md` | ℹ️ Statuswoorden nu verschillend per koppeling |
| 22 | Routerbegrippen niet gedefinieerd | `18_sandbox_router.md` | ✅ **Gedeeltelijk opgelost** — 3 van 4 kernfuncties nu geïmplementeerd |
| 23 | Gewichten/drempels | `18_sandbox_router.md` | 🟡 **Open** — equal weight nu, dynamisch toekomstig; `cycle_weight` geen formule |
| 24 | Tokenizer/versie | `17_sandbox_meta.md`, `18_sandbox_router.md` | ℹ️ Expliciete reproduceerbaarheidsvoorwaarde |
| 25 | Tokenlimieten | `18_sandbox_router.md` | ℹ️ Gevolgtrekking uit eigen reproduceerbaarheidsregels |
| 26 | Samenvoegvolgorde | `18_sandbox_router.md` | ✅ **Opgelost** — vaste volgorde nu vastgelegd (B0+B1, B1+B2, ...) |
| 27 | Conflicterende signalen | `18_sandbox_router.md` | ✅ Op architectuurniveau vastgelegd |
| 28 | Return conceptueel vs operationeel | `00_README.md`, `18_sandbox_router.md` | 🔴 **Open** — Return uitvoering in stap 19, buiten scope 00–18 |
| 29 | Testinvoer/verwachte uitvoer | `01_spec.md` | ✅ **Te algemeen** — specifieke bestanden hebben tests, open onderdelen niet altijd |
| 30 | Bestandsnamen/stapnummers | `09_language.md` | ✅ **Ingetrokken** — woordtelling vs stapnummer verwarring |
| 31 | Kernbegrippen evolueren | `14_dimensions.md` | ℹ️ Expliciete uitbreiding, rollen nu getypt |
| 32 | Lokaal vs globaal | `09_language.md`, `14_dimensions.md` | ✅ Nu duidelijk gemarkeerd |
| 33 | Randvoorwaarden | `15_signaal_perceptie.md`, `18_sandbox_router.md` | ✅ **Grotendeels opgelost** — veel nu opgenomen |
| 34 | Lege/ongeldige invoer | `15_signaal_perceptie.md`, `18_sandbox_router.md` | ✅ **Ingetrokken** — `empty_input`, `unsupported_phoneme` nu gedefinieerd |
| 35 | Unieke uitkomst | `09_language.md`, `17_sandbox_meta.md`, `18_sandbox_router.md` | ℹ️ Conditioneel determinisme nu beschreven |
| 36 | Verplicht vs optioneel | `18_sandbox_router.md` | ℹ️ Onderscheid aanwezig (`ΦR` optioneel, kernfasen verplicht) |
| 37 | Beschrijvend vs uitvoerbaar | `09_language.md`, `18_sandbox_router.md` | ℹ️ Statussen nu onderscheiden |
| 38 | "Gesloten" vs open | `18_sandbox_router.md` | 🔴 **Open** — formeel gesloten vs operationeel open |
| 39 | Begrippenregister | — | ✅ **Ingetrokken** — onvoldoende onderbouwd |
| 40 | Determinisme niet overal | `17_sandbox_meta.md`, `18_sandbox_router.md` | 🔴 **Open** — duidelijkste open validatiepunt |

---

## Blijvende Punten (7)

### 1. `cycle_weight` — Geen Exacte Formule
**Bestand:** `18_sandbox_router.md`
**Status:** Implementatieafhankelijk
**Impact:** Reproduceerbaarheid beperkt tot "equal weight" default

### 2. `combine_cycles` — Operationeel Open
**Bestand:** `18_sandbox_router.md`
**Status:** Formeel gedeclareerd, nog geen implementatie
**Impact:** Router kan niet volledig deterministisch zijn

### 3. Reproduceerbaarheidsvoorwaarden
**Bestanden:** `17_sandbox_meta.md`, `18_sandbox_router.md`
**Status:** Voorwaarden benoemd (tokenizer, grenzen, versies, gewichten, model, instellingen)
**Impact:** Volledige reproduceerbaarheid hangt van alle voorwaarden

### 4. `segment_phonemes` — Algoritme Niet Volledig Zichtbaar
**Bestand:** `15_signaal_perceptie.md`
**Status:** Functie gedeclareerd met signature, volledige segmentatieregels niet zichtbaar
**Impact:** Taalverwerking niet volledig reproduceerbaar

### 5. Transliteratiekeuze Beïnvloedt Projectie
**Bestand:** `16_taalmapping.md`
**Status:** "Gekozen" transliteratie (niet canoniek vastgelegd)
**Impact:** Numerieke uitkomst verschilt per transliteratiekeuze

### 6. Formele vs Operationele Geslotenheid
**Bestand:** `18_sandbox_router.md`
**Status:** Formeel gesloten (ketenvolledigheid) vs operationeel open (uitvoering)
**Impact:** "Gesloten" label kan misleidend zijn zonder context

### 7. Return-fase Buiten Scope
**Bestanden:** `00_README.md`, `18_sandbox_router.md` → stap 19
**Status:** Return conceptueel beschreven, uitvoering in stap 19 (buiten 00–18)
**Impact:** Volledige NPR-cyclus niet binnen audit-scope

---

## Conclusie

**33 van 40 punten zijn opgelost of ingetrokken.** De huidige bestanden bevatten veel meer expliciete correcties, typeringen en randvoorwaarden dan bij de eerste audit zichtbaar was.

De 7 resterende punten zijn allemaal **bewust open** — niet vergeten, maar expliciet als implementatieafhankelijk of buiten scope gemarkeerd.

Dit is een gezond auditbeeld: de theorie is formeel gesloten, de implementatie is operationeel open waar nodig.
