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
  broncode + versies + routebesluiten zijn controleerbaar

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
  router_version,
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
  router_version,
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
routerversie
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

## Check: 2026-07-12 23:47 GMT+2
- Status: NPR-OS Stap 21 — formeel herzien
- Correcties: drie niveaus transparantie, reproduceerbare uitvoering, routelog, router/processor grens, geheimen, stap 20 aansluiting
- Kern: transparante routing = leesbaar + verifieerbaar + traceerbaar + gedeclareerd
- `step_21_formal_consistency: ✅ akkoord`
