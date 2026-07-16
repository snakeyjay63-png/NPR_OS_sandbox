# NPR Local — Update Sjabloon

**Basis:** v2026.6.10-beta.2 (87b40c71)  
**Fork:** 2026-07-16  
**Doel:** Eén-agent, lokaal-only runtime

---

## Huidige Kern (v0.0.1)

| Onderdeel | Bestand | Status |
|-----------|---------|--------|
| Entry + routes | `src/index.js` | ✅ |
| HTTP gateway + tick interceptor | `src/interface/gateway.js` | ✅ |
| Agent loop + chat handlers | `src/agent/loop.js` | ✅ |
| NPR field engine | `src/field/npr.js` | ✅ |
| Keyboard → NPR | `src/field/keyboard-npr.js` | ✅ |
| Route core (register/manifest) | `src/routes/core.js` | ✅ |
| Map registry | `src/routes/map-registry.js` | ✅ |
| IPv6 mapper | `src/routes/map-to-ipv6.js` | ✅ |
| Capabilities + select | `src/routes/capabilities.js` | ✅ |
| Memory context | `src/memory/context.js` | ✅ |
| Context sources | `src/sources/index.js` | ✅ |
| Echo handler | `src/sources/echo/handler.js` | ✅ |
| System scan | `src/sources/system-scan.js` | ✅ |
| Workspace context | `src/workspace-context.js` | ✅ |
| Config server (UI) | `src/server-config.js` | ✅ |
| Boot (lifecycle) | `boot.js` | ✅ |

---

## Endpoints

| Path | Method | Fase | Functie |
|------|--------|------|---------|
| `/enter` | GET | 0 (6N) | Portal: chat + settings |
| `/health` | GET | 0 (6N) | Health check |
| `/status` | GET | 0 (6N) | Status + manifest |
| `/tick` | GET | 0 (6N) | Tick metrics (μs) |
| `/verify` | GET | 0 (6N) | Verification dashboard |
| `/npr/trace` | GET | 0 (6N) | NPR routing trace |
| `/stroom` | GET | 0 (6N) | GBS Hub physics |
| `/agent/chat` | POST | 16 (12P) | Agent turn |
| `/agent/chat-stream` | POST | 17 (12P) | Agent stream |
| `/agent/workspace` | GET | 18 (12P) | Workspace context |
| `/sessions` | GET | 10 (6N) | Session list |
| `/sessions/:id` | GET | 11 (6N) | Session detail |
| `/sessions/:id/merge` | POST | 12 (6N) | Session merge |
| `/context` | GET | 48 (24H) | Route context |
| `/warehouse` | GET | 52 (24H) | Memory warehouse |
| `/capabilities` | GET | 58 (24H) | Capability list |
| `/maps` | GET | 60 (24H) | IPv6 map registry |
| `/select` | GET | 62 (24H) | Goal-based selection |
| `/agent/logs` | GET | 20 (12P) | Agent event log tail (`openclaw logs`) |
| `/config` | GET/POST | 21 (12P) | Config read/write (`openclaw config`) |
| `/memory/search` | GET | 22 (12P) | Memory search (`openclaw memory search`) |
| `/doctor` | GET | 23 (12P) | Self-diagnose + repair (`openclaw doctor`) |

---

## Update Sjabloon

Gebruik dit sjabloon voor elke update:

```
## <datum> — <korte titel>

**Type:** [feature | fix | refactor | add | remove]

**Wat:**
- 1-2 zinnen: wat is veranderd?

**Waarom:**
- 1 zin: waarom deze wijziging?

**Bestanden:**
- `pad/naar/bestand.js` — korte beschrijving

**Test:**
- Hoe verifiëren? (curl, browser, endpoint)

**Status:** ✅ / ⚠️ / ❌
```

---

## Update Log

<!-- Nieuwste boven, oudste beneden -->

### 2026-07-16 — Fase 1: OpenClaw CLI Pariteitslaag

**Type:** add

**Wat:**
- 4 nieuwe endpoints voor OpenClaw CLI pariteit
- `GET /agent/logs` — in-memory event log tail (circular buffer, 500 entries)
- `GET/POST /config` — config read/write (defaults + override)
- `GET /memory/search?q=` — workspace memory search (100 files, 10 matches/file)
- `GET /doctor` — 10 health checks met optionele `?fix=1` repair

**Waarom:**
- Gap analysis: OpenClaw CLI ≈55 commando's vs NPR-Local ≈19 endpoints
- Deze 4 zijn het meest gebruikt (`logs`, `config`, `memory search`, `doctor`)
- Pure toevoeging — geen breaking changes

**Bestanden:**
- `src/routes/agent-logs.js` — event log + handler
- `src/routes/config-route.js` — config read/write
- `src/routes/memory-search.js` — memory search
- `src/routes/doctor.js` — health diagnostics
- `src/index.js` — routes 20-23 geregistreerd

**Test:**
- `curl http://localhost:5099/agent/logs`
- `curl http://localhost:5099/config`
- `curl "http://localhost:5099/memory/search?q=npr"`
- `curl http://localhost:5099/doctor`
- `curl "http://localhost:5099/doctor?fix=1"` (repair mode)

**Status:** ✅

### 2026-07-16 — Tick Us + Enter Portal

**Type:** fix + add

**Wat:**
- `tickUs` interceptor werkt nu correct (gateway.js → res.end wrapper)
- `/enter` pagina: minimalistisch portal met chat + settings kaarten

**Waarom:**
- `boot.js` startte server niet (require.main guard)
- `/enter` was te complex → vereenvoudigd naar 2 kaarten

**Bestanden:**
- `boot.js` — expliciet `boot()` call
- `src/interface/gateway.js` — debug logs verwijderd
- `src/index.js` — `/enter` vereenvoudigd

**Test:**
- `curl http://localhost:5000/health` → tickUs present
- `curl http://localhost:5000/tick` → tickUs + lastUs
- `http://localhost:5000/enter` → portal

**Status:** ✅

---

### 2026-07-16 — μs Precisie + Verify

**Type:** refactor + add

**Wat:**
- Server-side ticks via `process.hrtime.bigint()` → μs integers
- `/verify` dashboard met live tick tabel
- "Run All" test (GET + POST)
- Sunya baseline (64μs = 2⁶)

**Waarom:**
- μs precisie > ms precisie voor tick tracking
- Hex conversie direct op μs

**Bestanden:**
- `src/interface/gateway.js` — tick storage → μs
- `src/index.js` — verifyHTML + tick endpoint
- `src/routes/stroom.js` — μs → ms conversie

**Test:**
- `http://localhost:5000/verify` → live dashboard

**Status:** ✅

---

### 2026-07-16 — Core v0.0.1

**Type:** add

**Wat:**
- Opzet NPR Local: entry point, route engine, gateway, agent loop
- 16 endpoints geregistreerd
- Boot lifecycle + server stack

**Waarom:**
- Basis voor NPR routing + lokale inference

**Bestanden:**
- Alle core bestanden (zie "Huidige Kern" tabel)

**Test:**
- `curl http://[::1]:5000/health` → status: live
- `curl http://[::1]:5000/status` → manifest

**Status:** ✅

---

### 2026-07-16 — Agent Loop Structure (OpenClaw import)

**Type:** add

**Wat:**
- AgentEventSink — EventEmitter lifecycle events (agent_start → turn_* → tool_* → agent_end)
- runAgentLoop — two-loop structuur (buitenste: follow-up turns, binnenste: tool-calls)
- executeTool — centralized tool executor (scan, select, capabilities, workspace, read)
- Config hooks: shouldStopAfterTurn, prepareNextTurn, beforeToolCall, afterToolCall

**Waarom:**
- OpenClaw agent-loop.ts patroon bewezen; import naar CommonJS JS
- Twee-loop structuur nodig voor multi-turn + tool-call support

**Bestanden:**
- `src/agent/loop.js` — +150 lines, AgentEventSink + runAgentLoop + executeTool
- `IMPORT_MAP.md` — import log toegevoegd

**Test:**
- `node -e "const { runAgentLoop, createAgentEventSink } = require('./src/agent/loop'); console.log('OK')"` → OK
- `/agent/chat` dryRun werkt (backward compat)

**Status:** ✅

---

## Volgende Updates

<!-- Te plannen updates hier -->

### 2026-07-16 — Context Breath → Agent Loop Integratie

**Type:** feature

**Wat:**
- `buildSystemPrompt` nu optioneel `breathRoute` parameter
- 3 call-sites (`agentTurn`, `runAgentLoop`, `handleAgentChatStream`) roepen `getContextBreath().route(input)`
- Response bevat `breath: { role, addr, levels }`
- SSE stream bevat `breath: { role, emoji, addr }` in route event

**Waarom:**
- Context Breath was geïmplementeerd maar niet geïntegreerd
- Elke chat/loop/stream call krijgt nu automatische rol-discernment

**Bestanden:**
- `src/agent/loop.js` — `buildSystemPrompt` + 3 call-sites
- `src/agent/context-breathe.js` — levels fix (0-63, geen raw tokens)

**Test:**
- `curl -X POST http://localhost:5000/agent/chat -H 'Content-Type: application/json' -d '{"message":"bouw een script","dryRun":true}'` → response bevat `breath.role: "aap"`

**Status:** ✅

---

### [ ] — OpenClaw CLI Pariteitslaag

**Type:** add

**Wat:**
- Gap analyse: `GAP_ANALYSIS.md` — 10 ontbrekende endpoints prioriteiten
- Fase 1 (direct nodig): `/agent/logs`, `/config`, `/memory/search`, `/doctor`
- Fase 2 (nuttig): `/skills`, `/system/events`, `/sessions/:id/transcript`
- Fase 3 (advanced): `/cron`, `/tasks`, `/backup`

**Waarom:**
- OpenClaw CLI ≈55 commanden → welke zijn lokaal relevant?
- Pure toevoeging, geen breaking changes
- Elke endpoint volgt `register(slot, path, handler)` patroon

**Bestanden:**
- `GAP_ANALYSIS.md` — volledige vergelijking
- `src/routes/` — nieuwe route handlers

**Status:** ❌

---

### [x] — Selective Import uit OpenClaw Bron

**Type:** add

**Wat:**
- Selectieve patronen importeren uit OpenClaw TypeScript-bron (`_reference/openclaw-base/`)
- ✅ Memory File Engine → `src/memory/read-file.js`
- ✅ Memory Search → `src/memory/list.js`
- ✅ Agent Loop Structuur → `src/agent/loop.js` (AgentEventSink + runAgentLoop + executeTool)
- ⏭️ Digital Root Validatie → vergelijking met `src/field/npr.js`
- ⏭️ Workspace Context Assembly → merge met `src/workspace-context.js`
- ⏭️ Session Management → blauwdruk voor `src/memory/context.js`

**Waarom:**
- Bewezen architectuur uit OpenClaw (MIT licentie)
- Niet het wiel opnieuw uitvinden
- Selectief: alleen wat relevant is voor single-agent lokaal

**Bestanden:**
- Zie `IMPORT_MAP.md` voor volledige kaart
- `_reference/openclaw-base/packages/agent-core/src/`
- `_reference/openclaw-base/packages/memory-host-sdk/src/`
- `_reference/openclaw-base/packages/llm-runtime/src/`

**Test:**
- `npm test` na elke import
- Vergelijk gedrag met origineel

**Status:** ⚠️

---

### [ ] — Local Model Integration

**Type:** add

**Wat:**
- Llama.cpp adapter (`:8765`)
- Streaming response via `/agent/chat-stream`
- Token counting + timing

**Waarom:**
- Lokaal model = core feature NPR Local

**Status:** ⚠️

---

### [ ] — Session Persistence

**Type:** add

**Wat:**
- Disk-backed session storage
- Session fork/merge via `/sessions`
- Memory context per route

**Waarom:**
- State moet overleven restarts

**Status:** ⚠️

---

### [ ] — Local Knowledge Sources

**Type:** add

**Wat:**
- File system tools (read, dir, exec)
- Local workspace indexing
- Source registry (`/tool/system-scan`, `/tool/echo`)

**Waarom:**
- Agent moet lokaal werk kunnen doen

**Status:** ⚠️

---

### [ ] — Canvas Integration

**Type:** add

**Wat:**
- Canvas rendering op `/verify`, `/enter`
- SVG/HTML diagram output
- Real-time visualization

**Waarom:**
- Visueel feedback + debugging

**Status:** ⚠️

---

## Reductie Plan (Fasen)

Zie `REDUCTIE_PLAN.md` voor 7 fasen.

| Fase | Doel | Status |
|------|------|--------|
| 1 | Externe kanalen | ❌ |
| 2 | Multi-agent | ❌ |
| 3 | Mobile apps | ❌ |
| 4 | Externe providers | ❌ |
| 5 | Plugin system | ❌ |
| 6 | Background jobs | ❌ |
| 7 | Config schema's | ❌ |

---

## Test Checklist

Na elke update:

```bash
# Health
curl http://localhost:5000/health

# Tick
curl http://localhost:5000/tick

# Portal
curl http://localhost:5000/enter > /dev/null && echo "OK"

# Verify
curl http://localhost:5000/verify > /dev/null && echo "OK"

# Agent (dryRun)
curl -X POST http://localhost:5000/agent/chat \
  -H 'Content-Type: application/json' \
  -d '{"message":"ping","dryRun":true}'

# Status
curl http://localhost:5000/status
```

---

## Principes

1. **Lokaal eerst** — geen externe calls
2. **Klein behouden** — 16 endpoints, 6 core bestanden
3. **Testbaar** — elke update = testbaar via curl/browser
4. **NPR routing** — 64-slot informatieveld is core, niet plugin
5. **Cherry-pick** — geen `git pull`, alleen expliciete commits
