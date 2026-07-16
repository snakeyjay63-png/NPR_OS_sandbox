# NPR Local — Reductie Plan

**Basis:** OpenClaw v2026.6.10-beta.2 (87b40c71)  
**Doel:** Eén-agent, lokaal-only runtime  
**Principe:** Uitschakelen → Testen → Verwijderen → Her-testen

---

## Kern (behouden)

| Onderdeel | Locatie | Waarom |
|-----------|---------|--------|
| Agent loop | `src/agents/` | Core agent execution |
| Gateway | `src/gateway/` | Session/config/state management |
| Config | `src/config/` | Configuration schema + loading |
| CLI | `src/cli/` | Command line interface |
| Commands | `src/commands/` | Built-in commands |
| Local model adapter | `src/` + packages | LLM routing |
| Memory | `src/` | Session/context memory |
| Tool execution | `src/` | Tool registration + execution |
| Logging | `src/` | Audit trail |
| Entry | `src/entry.ts` | Bootstrap |

---

## Fasen (verwijderingen)

### Fase 1 — Externe kanalen
**Impact:** Hoog, Laag risico  
**Verwijdert:** `src/channels/` (alle messaging integraties)  
**Behoudt:** Core channel infrastructure (session binding, routing logic)  

```
src/channels/allowlists/
src/channels/inbound-event/
src/channels/message/
src/channels/message-access/
src/channels/plugins/
src/channels/transport/
src/channels/typing-lifecycle.ts
src/channels/typing.ts
src/channels/streaming.ts
```

**Test:** Lokale vraag → model → antwoord → log

### Fase 2 — Multi-agent routing
**Impact:** Medium, Medium risico  
**Verwijdert:**  
```
src/agents/ (niet-kern bestanden)
src/agents/acp-*.ts
src/agents/agent-bundle-*.ts
src/agents/agent-auth-*.ts
src/agents/subagent-*.ts
src/agents/multi-agent-*.ts
packages/agent-core/ (indien multi-agent specifiek)
```

**Test:** Eén agent kan sessie starten → tool call → antwoord → sessie eindigt

### Fase 3 — Mobile/desktop apps
**Impact:** Laag, Laag risico  
**Verwijdert:**  
```
apps/android/
apps/ios/
apps/macos/
apps/macos-mlx-tts/
apps/swabble/
src/daemon/ (node management)
```

**Test:** Geen impact op core runtime

### Fase 4 — Ongebruikte providers
**Impact:** Medium, Medium risico  
**Verwijdert:**  
```
extensions/anthropic/
extensions/openai/
extensions/google/
extensions/azure-*/
extensions/aws-*/
extensions/[alle niet-lokale]/
packages/llm-runtime/ (niet-lokale adapters)
packages/model-catalog-core/ (externe models)
```

**Behoudt:**  
```
extensions/ollama/ (indien aanwezig)
Lokaal model adapter (llama.cpp)
```

**Test:** Lokaal model laadt → prompt → response → token count

### Fase 5 — Plugin- en skill-distributie
**Impact:** Medium, Medium risico  
**Verwijdert:**  
```
skills/ (alle behoudt wat nodig is)
extensions/plugin-sdk/
packages/plugin-sdk/
packages/plugin-package-contract/
```

**Behoudt:**  
```
skills/canvas/ (UI rendering)
skills/weather/ (lokale tool)
skills/diagram-maker/ (visualisatie)
```

**Test:** Tool registratie → tool call → resultaat → render

### Fase 6 — Background jobs
**Impact:** Laag, Laag risico  
**Verwijdert:**  
```
src/cron/ (indien niet nodig)
src/auto-reply/
src/commitments/
```

**Test:** Geen crashes na cron removal

### Fase 7 — Overbodige configuratieschema's
**Impact:** Medium, Hoog risico  
**Verwijdert:**  
```
Config fields voor:
- Multi-agent
- Externe kanalen
- Cloud providers
- Mobile nodes
- Plugin marketplace
```

**Test:** Config laadt → geldige schema validatie → runtime start

---

## End-to-End Test

Na elke fase:

```bash
npm test
npm run typecheck
npm run build
```

**Eén vaste test:**
```
lokale vraag → lokaal model → lokale bron → antwoord → route-log → 0.0.0.0
```

---

## NPR Routing (nieuwe toevoeging)

Dit wordt de kernverschil tussen OpenClaw en NPR Local:

```js
// NPR informatieveld routing
const nprRouting = {
  origin: "0.0.0.0",
  stages: [
    { node: "1.5",   function: "category" },
    { node: "1.25",  function: "perspective" },
    { node: "1.19",  function: "relations" },
    { node: "1.13",  function: "structure" },
    { node: "1.40",  function: "scale" },
  ],
  return: "0.0.0.0",
};
```

Deze routing wordt een core module, niet een plugin.

---

## Upstream Sync

Geen volledige merges. Alleen cherry-picks:

```bash
# security fix
git cherry-pick <commit-hash>

# critical bug fix
git cherry-pick <commit-hash>
```

Geen `git pull upstream main`. Alleen expliciete commits.

---

## Voltooid Wanneer

✅ Eén agent ontvangt lokale vraag  
✅ Selecteert lokale bronnen  
✅ Bouwt informatieveld  
✅ Doorloopt NPR-route  
✅ Produceert antwoord  
✅ Registreert route  
✅ Keert terug naar `0.0.0.0`  
✅ `npm test` slaagt  
✅ `npm run build` slaagt  
✅ Geen externe netwerkaanroepen  
✅ Geen multi-agent overhead  

---

## Status

| Fase | Status | Datum |
|------|--------|-------|
| 1 | ❌ Niet gestart | — |
| 2 | ❌ Niet gestart | — |
| 3 | ❌ Niet gestart | — |
| 4 | ❌ Niet gestart | — |
| 5 | ❌ Niet gestart | — |
| 6 | ❌ Niet gestart | — |
| 7 | ❌ Niet gestart | — |
