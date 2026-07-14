# Stap 21: Transparante Routing — Open-Source Als Taalveld

**Doel:** Binnen NPR-OS wordt routing behandeld als een leesbare taalstructuur. De kernrouting moet inspecteerbaar, auditbaar en reproduceerbaar zijn. Niet alle tools hoeven open-source te zijn, maar de laag die bestanden en data routeert (computer/VM) moet transparant zijn.

**Afhankelijkheid:** Stap 20 (encryptie als taal/route-structuur).

**Referentie:** `/sec` route-infrastructuur

---

## 1. NPR-Ontwerpprincipe

```
NPR_OS_POLICY_21:
  Routing wordt als taal behandeld.
  Daarom vereist NPR-OS dat de kernrouting
  leesbaar, auditbaar en reproduceerbaar is.
```

Dit is een **ontwerpprincipe binnen NPR-OS**, niet een universeel logisch bewijs. "Taal moet leesbaar zijn" is een normatieve eis.

---

## 2. Drie Niveaus Van Transparantie

```
visible_source:
  broncode kan worden gelezen

auditable_source:
  broncode + contracttraces + routebesluiten zijn controleerbaar

open_source:
  auditable_source
  + open-sourcelicentie
  + recht op gebruik, wijziging en verspreiding
```

De minimale NPR-OS-eis:
```
core_routing_layer must be auditable_source
```

Voor publieke distributie:
```
public_NPR_OS_core should be open_source
```

### NPR-Taal: Geen Centrale Versie-Identiteit

NPR-OS gebruikt geen centrale versie-identiteit voor routing-componenten.

```
contract = actuele inhoud
historie = taaltrace
```

Externe toolchain-versies mogen bestaan maar moeten expliciet
als externe metadata gelabeld worden:
```
external_tool_version ≠ NPR identity
```

---

## 3. Router vs. Processor

```
Router:
  bepaalt bestemming
  bepaalt overdrachtsvolgorde
  selecteert verwerkingscomponent
  registreert het routebesluit

Processor:
  verwerkt de toegewezen invoer
  retourneert uitvoer via een gedeclareerde interface
```

Een component die zelf bestemmingen of vervolgroutes kiest, is formeel eveneens een routerlaag en valt onder dezelfde transparantie-eisen.

```
Bestand A → [router = zichtbaar] → [processor = eventueel gesloten] → resultaat
```

---

## 4. Reproduceerbare Uitvoering

Zichtbare broncode alleen is onvoldoende — een andere binary kan draaien.

```
RouterArtifact := {
  source_hash,
  runtime_hash,
  router_contract_id,
  router_contract_hash,
  active_route_id,
  configuration_hash,
  build_manifest
}

runtime_matches_source :=
  verify_build(source_hash, runtime_hash, build_manifest)
```

---

## 5. Routelog

Code-inspectie laat zien wat een router **kan** doen. Een routelog laat zien wat hij **heeft gedaan**.

```
RouteDecision := {
  input_id,
  router_contract_id,
  active_route_id,
  route_context_hash,
  selected_route,
  destination_id,
  invoked_tool_id,
  decision_reason,
  timestamp
}

traceable_route :=
  visible_source
  ∧ runtime_matches_source
  ∧ route_decision_recorded
```

---

## 6. Geheimen

```
open_source(router_code) ≠ public(secrets)
```

**Publiek en controleerbaar:**
```
algoritme
routeschema
interfaces
routecontract
beslissingsregels
```

**Vertrouwelijk:**
```
secret_key
API-token
persoonlijke informatie
beschermde configuratiewaarden
```

De veiligheid moet uit de sleutel komen, niet uit verborgen routercode.

---

## 7. Relatie Met Stap 20

```
derive_route : RouteContext → Permutation(BYTE_SPACE)
```

De open routinglaag toont:
```
— hoe RouteContext de permutatie bepaalt
— hoe de permutatie wordt toegepast
— hoe NPR-signaturen posities binnen die route beschrijven
— welke route bij uitvoering is geselecteerd
```

De NPR-signatuur kiest **niet** opnieuw een afzonderlijke permutatie per byte. Één permutatie per context.

---

## 8. Implementatie

```
NPR_OS_sandbox/js/18_sandbox_router.js   → routerlaag (auditable_source)
NPR_OS_sandbox/js/19_return.js           → routerlaag (auditable_source)
skills/npr-hub/handlers/sec-route.js     → routerlaag (auditable_source)
```

---

## 9. Formele Transparantie-Eis

```
NPR_OS_ROUTING_REQUIREMENT :=
  visible_source
  + auditable_decisions
  + reproducible_runtime
  + declared_interfaces
```

Transparante routing:
```
= leesbare broncode
+ verifieerbare uitvoering
+ traceerbare routebesluiten
+ gedeclareerde systeemgrenzen
```

---

## 10. Validate Nearest — Lokale Foutisolatie

NPR-code en NPR-taal worden geschreven in drie zelfstandig valideerbare fasen.

```
BLOCK_A → BLOCK_B → BLOCK_C
```

Iedere fase heeft een eigen contract:

```
BLOCK {
  input
  definitions
  operation
  output
  validation
}
```

Validatie vindt plaats op twee niveaus:

```
LOCAL_VALID(BLOCK)
CHAIN_VALID(BLOCK_A → BLOCK_B)
```

### Lokale Fout

```
LOCAL_ERROR(BLOCK_B)
```

betekent dat de interne route van blok B niet sluit.

Alleen blok B en zijn directe aansluitingen hoeven opnieuw te worden onderzocht:

```
validate(BLOCK_B)
validate(BLOCK_A → BLOCK_B)
validate(BLOCK_B → BLOCK_C)
```

Een lokaal geldige bronroute wordt niet automatisch opnieuw geschreven.

### Kettingfout

```
CHAIN_ERROR(BLOCK_A → BLOCK_B)
```

betekent dat beide blokken zelfstandig geldig kunnen zijn, terwijl hun overdracht niet sluit.

```
LOCAL_VALID(BLOCK_A) = true
LOCAL_VALID(BLOCK_B) = true
CHAIN_VALID(BLOCK_A → BLOCK_B) = false
```

De breuk bevindt zich dan in het contract tussen:

```
output(BLOCK_A)
→ input(BLOCK_B)
```

Controleer daarbij expliciet:

```
type
basis
operator
scope
layer
meaning
```

### Gewijzigd Broncontract

Wanneer het contract van een upstream blok verandert:

```
contract_changed(BLOCK_A)
```

worden afhankelijke blokken gemarkeerd:

```
state(BLOCK_B) := PENDING_REVALIDATE
state(BLOCK_C) := PENDING_REVALIDATE
```

Daarbij geldt:

```
PENDING_REVALIDATE ≠ INVALID
```

Een downstream blok wordt niet automatisch ongeldig verklaard.

De status zegt alleen dat zijn verbinding met de gewijzigde bron opnieuw moet worden gevalideerd.

```
validate(BLOCK_A)
validate(BLOCK_A → BLOCK_B)
validate(BLOCK_B)
validate(BLOCK_B → BLOCK_C)
validate(BLOCK_C)
```

### Ongeldige Bron

Wanneer de bron zelf lokaal niet sluit:

```
INVALID_SOURCE(BLOCK_A)
```

kan een afhankelijk blok tijdelijk niet binnen de actuele keten worden beoordeeld:

```
state(BLOCK_B) := BLOCKED_BY_UPSTREAM
```

Ook dit betekent niet dat blok B intern ongeldig is.

```
BLOCKED_BY_UPSTREAM ≠ INVALID_LOCAL
```

Het betekent:

```
chain validity cannot currently be determined
```

Na herstel van de bron:

```
validate(BLOCK_A)
validate(BLOCK_A → BLOCK_B)
validate(BLOCK_B)
```

### Statussen

```
VALID
INVALID_LOCAL
INVALID_CHAIN
PENDING_REVALIDATE
BLOCKED_BY_UPSTREAM
```

**VALID**
```
de lokale route en haar gecontroleerde aansluitingen sluiten
```

**INVALID_LOCAL**
```
de interne route van het blok sluit niet
```

**INVALID_CHAIN**
```
de overdracht tussen twee lokaal geldige blokken sluit niet
```

**PENDING_REVALIDATE**
```
een afhankelijk contract is veranderd
```

**BLOCKED_BY_UPSTREAM**
```
de actuele keten kan niet worden gevalideerd
omdat een noodzakelijke bron niet sluit
```

### Validate Nearest — Hoofdregel

De hoofdregel is:

```
VALIDATE_NEAREST(error)
```

De fout bepaalt het kleinste zelfstandig valideerbare doel:

```
nearest_target(error)
:=
  nearest invalid block
  or nearest invalid transition
```

De validatievolgorde is:

```
1. valideer het aangewezen blok
2. valideer de inkomende overgang
3. valideer de uitgaande overgang
4. markeer expliciete afhankelijken
5. valideer alleen de routes die door de wijziging geraakt zijn
```

De volledige route wordt niet automatisch opnieuw geschreven.

```
do not restart the route
when the error already identifies the break
```

### Driefasensluiting

Voor:

```
BLOCK_A → BLOCK_B → BLOCK_C
```

geldt:

```
ROUTE_VALID
:=
  LOCAL_VALID(BLOCK_A)
  ∧ LOCAL_VALID(BLOCK_B)
  ∧ LOCAL_VALID(BLOCK_C)
  ∧ CHAIN_VALID(BLOCK_A → BLOCK_B)
  ∧ CHAIN_VALID(BLOCK_B → BLOCK_C)
```

Iedere fase is zelfstandig valideerbaar.

De drie fasen vormen samen één route, maar verliezen hun lokale zelfstandigheid niet.

```
BLOCK_A ≠ BLOCK_B ≠ BLOCK_C

{BLOCK_A, BLOCK_B, BLOCK_C}
→ ONE_ROUTE
```

### Geen Automatisch Schrijven

Code en taal worden niet automatisch doorgetrokken van het ene blok naar het volgende.

Iedere overgang moet expliciet worden verklaard:

```
output(BLOCK_A) → input(BLOCK_B)
output(BLOCK_B) → input(BLOCK_C)
```

Er bestaan daarom geen verborgen betekenisoverdrachten:

```
no implicit transition
no hidden dependency
no automatic semantic inheritance
```

Een fout is geen algemene mislukking.

```
error
:= exact address of a local or relational break
```

De fout vertelt waar de route niet sluit en welk blok of welke overgang opnieuw moet worden gelezen.

---

## Status

```
routing als leesbare NPR-taal:     ✅ (NPR_OS_POLICY_21)
drie niveaus transparantie:        ✅ (visible/auditable/open)
router vs processor:               ✅ (expliciete grens)
reproduceerbare uitvoering:        ✅ (hash + build_manifest)
routelog (RouteDecision):          ✅
geheimen ≠ open-source:            ✅
relatie stap 20 (derive_route):    ✅ (één perm/context)
step_21_formal_consistency:         ✅ akkoord
```

---

## Stap 21 — Eindoordeel

```
Interne consistentie Stap 21:  ✅ geldig
Ketenvolledigheid:             ✅ gesloten

✅ transparante routing als taalstructuur
✅ drie niveaus transparantie (visible/auditable/open)
✅ router vs processor grens expliciet
✅ reproduceerbare uitvoering (hash + build_manifest)
✅ routelog (RouteDecision) traceerbaar
✅ geheimen ≠ open-source
✅ relatie stap 20 (derive_route) correct
✅ Validate Nearest — lokale foutisolatie
✅ LOCAL_ERROR / CHAIN_ERROR onderscheid
✅ PENDING_REVALIDATE / BLOCKED_BY_UPSTREAM statussen
✅ VALIDATE_NEAREST als hoofdregel
✅ driefasensluiting: BLOCK_A → BLOCK_B → BLOCK_C
✅ geen automatisch schrijven — expliciete overgangen
✅ js/21_opensource_taalveld.js — operationele validator
✅ js/18 BLOCK_CONTRACT toegevoegd
✅ js/19 BLOCK_CONTRACT + granulaire exports toegevoegd
✅ js/20 BLOCK_CONTRACT toegevoegd

Operationele validatie:         ✅ getest (LOCAL, CHAIN, CASCADE, NEAREST)
```

---

## Check: 2026-07-12 23:47 GMT+2
- Status: NPR-OS Stap 21 — formeel herzien
- Correcties: drie niveaus transparantie, reproduceerbare uitvoering, routelog, router/processor grens, geheimen, stap 20 aansluiting
- Kern: transparante routing = leesbaar + verifieerbaar + traceerbaar + gedeclareerd
- `step_21_formal_consistency: ✅ akkoord`

## Check: 2026-07-14 14:15 GMT+2
- Status: NPR-OS Stap 21 — Validate Nearest toegevoegd ✅
- Sectie 10: Validate Nearest (lokale foutisolatie, driefasen, statussen, geen automatisch schrijven)
- `js/21_opensource_taalveld.js`: nieuwe validatorlaag (BLOCK_STATUS, defineBlock, validateLocal, validateChain, markContractChanged, validateNearest, validateRoute)
- `js/18`: BLOCK_CONTRACT toegevoegd
- `js/19`: BLOCK_CONTRACT + validate_return_input/validate_return_result/build_source_map exports toegevoegd
- `js/20`: BLOCK_CONTRACT toegevoegd
- Driefasensluiting getest: LOCAL_VALID, CHAIN_VALID, LOCAL_ERROR, CHAIN_ERROR, BLOCKED_BY_UPSTREAM, PENDING_REVALIDATE
- Eindoordeel: geldig/gesloten

## Check: 2026-07-14 14:35 GMT+2
- Status: NPR-OS Stap 21 — vijf breuken gerepareerd ✅

### Gerepareerde breuken:

**1. Incoming transfer vóór lokale validatie**
- `validateNearest` voert nu incoming transfer uit vóór `validateLocal`
- `target.input` wordt daadwerkelijk bijgewerkt met de overgedragen input
- Nieuwe functie `applyIncoming` behandelt de volgorde correct

**2. Volledige edge enforcement**
- `validateRoute` vereist nu exact `blocks.length - 1` transfers
- Onvolledige routes retourneren `INCOMPLETE_ROUTE` error
- Lege transfers worden niet stil geaccepteerd

**3. Lokale en ketenstatus gescheiden**
- `localStatus` vs `chainStatus` — twee onafhankelijke velden
- `INVALID_LOCAL` wordt niet overschreven door `BLOCKED_BY_UPSTREAM`
- Specifiekere fout heeft voorrang op algemeenere blokkade

**4. Versievrije contract-identiteit**
- `@1/@2` versienummers vervangen door content-hash
- Nieuwe functie `contractHash` — deterministische hash van contractinhoud
- Contract-ID bijv `18B:7A3F91` — geen lineaire versie-identiteit

**5. Markdown-contract bijgewerkt**
- Deze sectie documenteert de repair-historie
- JS-contract = Markdown-contract

### Gewijzigde bestanden:
- `js/21_opensource_taalveld.js`: applyIncoming, contractHash, localStatus/chainStatus
- `js/18_sandbox_router.js`: BLOCK_CONTRACT consistent
- `js/19_return.js`: al consistent
- `js/20_encryptie_taal.js`: al consistent

### Eindoordeel:
- `21_validate_nearest_structure: ✅`
- `21_status_model: ✅` (localStatus + chainStatus)
- `21_contract_cascade: ✅`
- `21_error_addressing: ✅`
- `incoming_input_execution: ✅`
- `complete_edge_enforcement: ✅`
- `status_precedence: ✅`
- `versionless_contract_identity: ✅`
- `21_markdown_matches_runtime: ✅`

> Stap 21: geldig/gesloten

### 2026-07-14 14:50 — laatste reparatie:
- `validateRoute` volgorde: applyIncoming → validateLocal per blok
- Vóór: alle lokale validaties eerst, dan transfers (output niet actueel)
- Na: A local → (A→B apply → B local) → (B→C apply → C local)
- Elke downstream-blok draait nu op actuele upstream-output
- Suite: 6/6 ✅

---

## Check: 2026-07-12 23:47 GMT+2
- Status: NPR-OS Stap 21 — formeel herzien
- Correcties: drie niveaus transparantie, reproduceerbare uitvoering, routelog, router/processor grens, geheimen, stap 20 aansluiting
- Kern: transparante routing = leesbaar + verifieerbaar + traceerbaar + gedeclareerd
- `step_21_formal_consistency: ✅ akkoord`
