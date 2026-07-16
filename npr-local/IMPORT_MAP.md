# IMPORT_MAP.md — Selectieve Import uit OpenClaw Bron

**Doel:** Welke bewezen patronen uit OpenClaw's TypeScript-bron (MIT) kunnen we selectief importeren naar npr-local?

**Referentie:** `_reference/openclaw-base/` (commit `87b40c71`, v2026.6.10-beta.2)

---

## ✅ Direct Importeerbaar (MIT, geen aanpassing nodig)

### 1. Digital Root / Hexa Logic
**Bron:** `packages/agent-core/src/validation.ts`
**Wat:** Validatie- en routing-logica die digital root patronen gebruikt.
**Waarom:** Dit is precies de NPR-routing core die we al hebben.
**Actie:** Vergelijk met onze `src/field/npr.js` — mogelijk kunnen we de TS-implementatie als referentie gebruiken.

### 2. Memory File Engine
**Bron:** `packages/memory-host-sdk/src/runtime-files.ts`
**Wat:** Bestandsgebaseerde memory engine (lezen, schrijven, indexeren).
**Waarom:** Dit is het "filesystem-as-memory" patroon dat we willen.
**Actie:** Lees `runtime-files.ts` en `host/read-file.ts` voor het patroon.

### 3. Agent Loop Structuur
**Bron:** `packages/agent-core/src/agent-loop.ts`
**Wat:** Generieke agent-loop met event streaming, tool calls, reasoning.
**Waarom:** De basisstructuur is bewezen; we hoeven het wiel niet opnieuw te vinden.
**Actie:** Gebruik als architectuur-template voor onze eigen `src/agent/loop.js`.

---

## ⚠️ Adapteren (concept behouden, implementatie aanpassen)

### 4. Workspace Context Assembly
**Bron:** `packages/agent-core/src/agent.ts` + `packages/agent-core/src/types.ts`
**Wat:** Hoe bootstrap-bestanden (SOUL.md, USER.md, AGENTS.md) samengevoegd worden met memory.
**Waarom:** Dit patroon hebben we al in `src/workspace-context.js` — maar de TS-versie is rijper.
**Actie:** Vergelijk en merge patronen waar van toepassing.

### 5. Session Management
**Bron:** `packages/agent-core/src/node.ts`
**Wat:** Sessie-state, transcript beheer, compaction.
**Waarom:** Sessies zijn lastig goed te bouwen; OpenClaw heeft dit al opgelost.
**Actie:** Gebruik als blauwdruk voor `src/memory/context.js`.

### 6. Tool Schema Validation
**Bron:** `packages/agent-core/src/validation.ts`
**Wat:** JSON Schema validatie voor tool calls.
**Waarom:** Type-safe tool calls zijn belangrijk voor NPR-routing.
**Actie:** Importeer validatie-logic als `src/agent/tool-validate.js`.

---

## ❌ Niet Importeren (te groot, te specifiek, of niet nodig)

### 7. Gateway Protocol
**Bron:** `packages/gateway-protocol/`
**Waarom:** OpenClaw's gateway is complex en kanale-specifiek. Wij hebben `src/interface/gateway.js` die lokaal blijft.
**Actie:** Behoud onze eigen gateway.

### 8. LLM Runtime
**Bron:** `packages/llm-runtime/`
**Waarom:** API registry, provider abstraction, stream handling — te complex voor onze single-agent scope.
**Actie:** Gebruik onze eigen `src/agent/loop.js` met directe `llama.cpp` connectie.

### 9. Media/Generation Core
**Bron:** `packages/media-core/`, `packages/media-generation-core/`
**Waarom:** Niet relevant voor NPR Local's huidige scope.
**Actie:** Skip.

### 10. Plugin SDK
**Bron:** `packages/plugin-sdk/`, `packages/plugin-package-contract/`
**Waarom:** Plugin-architectuur is te zwaar voor single-agent runtime.
**Actie:** Skip.

---

## 🎯 Prioriteiten

### Fase 1: Direct Importeerbaar
1. **Memory File Engine** — Lees `runtime-files.ts`, importeer patroon naar `src/memory/`
2. **Digital Root Validation** — Vergelijk met `src/field/npr.js`, merge waar nuttig

### Fase 2: Adapteren
3. **Agent Loop Structuur** — Gebruik `agent-loop.ts` als template, herschrijf naar CommonJS JS
4. **Workspace Context** — Merge patronen uit `agent.ts` met onze `workspace-context.js`
5. **Session Management** — Blauwdruk uit `node.ts` voor `context.js`

### Fase 3: Optioneel
6. **Tool Validation** — Importeer als aparte module indien nodig

---

## 📋 Import Proces

Voor elke import:
1. Lees bronbestand in `_reference/openclaw-base/packages/...`
2. Analyseer welke patronen relevant zijn
3. Herschrijf naar CommonJS JS (geen TypeScript dependency)
4. Voeg toe aan `src/` met duidelijke herkomst-commentaar
5. Behoud MIT-licentie tekst
6. Test met `npm test`

---

## ⚖️ Licentie

OpenClaw broncode = MIT licentie.
- Wij mogen code kopiëren, aanpassen, herverdelen
- Wij moeten copyright- en licentietekst behouden
- Wij moeten `THIRD_PARTY_NOTICES.md` updaten met bronreferenties

---

## 📝 Import Log

| Datum | Bestand | Status | Notities |
|---|---|---|---|
| 2026-07-16 21:15 | `src/memory/read-file.js` | ✅ | Secure file reader, path validation, MIT patroon |
| 2026-07-16 21:15 | `src/memory/list.js` | ✅ | Memory search, keyword extractie EN+NL, MIT patroon |
| 2026-07-16 21:35 | `src/agent/loop.js` | ✅ | AgentEventSink, runAgentLoop, executeTool, two-loop structuur |
| 2026-07-16 21:50 | `src/agent/context-breathe.js` | ✅ | Context Breath Engine, 6-bit routing, Patanjali 1.5 viveka |

---

**Laatst bijgewerkt:** 2026-07-16 21:35 GMT+2
