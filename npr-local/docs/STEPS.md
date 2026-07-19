# NPR Local — Implementatiestappen

## ✅ Gereed

### Stap 1: Tool Execution Layer
- `handleAgentChat` → `runAgentLoop` koppeling
- 13 tools: `scan`, `select`, `capabilities`, `workspace`, `read`, `write`, `edit`, `exec`, `web-fetch`, `echo`, `memory`, `hex_encode`, `npr_trace`
- Multi-format tool-call parser (legacy text, XML, JSON, fenced JSON)
- Tool loop guard (max 5, 30s, duplicate detectie)
- `/tools` endpoint
- System prompt met tool lijst

### Stap 2: Agent Loop Integration
- Conversation history tussen turns (geslagen in `session.history`)
- Tool call trace in history (voor context over meerdere turns)
- Model fallback (`MODEL_FALLBACKS` env var)
- History bounded (MAX_HISTORY * 2)
- Context Breath integratie
- Workspace scan injectie

### Stap 3: ✅ Persistent History + Session Management
- [x] Disk-backed sessies (`data/sessions/`, JSON per sessie)
- [x] History API endpoint (`/sessions/:id/history`)
- [x] `/sessions` list + `/sessions/:id` delete
- [x] Auto-cleanup (`SESSION_RETENTION_DAYS`, default 7d)
- [x] Context compressie (oldest messages merged op >50)
- [x] Graceful shutdown (`saveAllSessions`)
- [x] `processMessage` export (`loop.js` → `index.js`)
- [x] `autoActivate` — auto-tool-loop bij tool-mentions

### Stap 4: ✅ Model Router
- [x] Model discovery (automatisch detecteer beschikbare modellen)
- [x] Model selector UI (kiezen in chat, + /models/switch)
- [x] Performance metrics per model (/models/metrics, recordInference)
- [x] Load balancing bij meerdere instanties (round-robin, ENDPOINTS env)

### Stap 5: ✅ Streaming (SSE)
- [x] Token-by-token streaming via SSE (`/agent/chat-stream`)
- [x] Live progress (tokens/sec, dot pulse animatie)
- [x] Abort button (■) — stream stoppen tijdens gegenereer
- [x] AbortError handler — partial response opslaan
- [x] Retry on error (max 2, backoff)
- [x] Client disconnect detectie backend (`isClosed`)

### Stap 5.5: Model Router (geconsolideerd in Stap 4 ✅)

### Stap 6: ✅ Memory Layer
- [x] Dagelijkse memory files (`memory/YYYY-MM-DD.md`)
- [x] MEMORY_claw.md auto-promote (automatisch na agent loop, 1x/uur)
- [x] Auto-write daily entry (na elke agent turn)
- [x] Memory search (volledig geïmplementeerd, `/memory/search`)
- [x] Context-aware memory injectie (getDailyMemoryContext → sys prompt)
- [x] REST routes (`/memory/daily`, `/memory/promote`, `/memory/search`)

### Stap 7: ✅ Dashboard UI
- [x] Systeem status pagina (`/system` — HTML dashboard)
- [x] System data API (`/system/data` — JSON snapshot)
- [x] Token usage grafiek (hourly bar chart, `/system/metrics/timeseries`)
- [x] Hex grid visualisatie (64 slots 0x00–0x3F, `/system/hex-grid`)
- [x] Live session monitor (`/system/sessions`)
- [x] Tool call history viewer (`/system/tools`)
- [x] Auto-refresh (15s interval)

### Stap 5.5: ✅ Tool-Call Parser (v2)
- [x] `tool-call-parser.js` — JSON/codeblock parsing
- [x] `parseToolCalls` — fuzzy fallback, JSON.parse-safe
- [x] `tool-loop-guard.js` — `ToolLoopGuard` class (max 5, 30s, duplicate detect)
- [x] `autoActivate` — auto-tool-loop bij tool-mentions in LLM output
- [x] Chat UI: `getTools()` + tool badges (±)

### Stap 8: ✅ PLC Taalveld (0x38)
- [x] ST parser — tokenize, parse VAR sections + statements, expression parser
- [x] I/O mapping — inputs/outputs/state from VAR sections
- [x] REST endpoints — /plc/parse, /plc/io-map, /plc/trace, /plc/analyze, /plc/status
- [x] Queue processor — async plc_parse jobs
- [x] Ladder → ST converter — ladder-parser.cjs (DSL parser, AST, canoniek model, ST generator)
- [x] Fault tree analyzer — fault-tree.cjs (FTA, cut sets, Fussell-Vesely importance, recommendations)
- [x] /plc/parse-ladder — Ladder DSL → model
- [x] /plc/convert — Ladder → ST converter endpoint
- [x] /plc/fault-tree — Fault tree analysis endpoint

### Stap 10: ✅ Dynamic Capabilities + Tool Registry
- [x] `capability-registry.cjs` — `ToolRegistry` class
- [x] 15 capabilities met risk levels (low/medium/high)
- [x] 14 built-in tools met capability requirements
- [x] Dynamic tool loading from `tools/` directory
- [x] Policy allow/deny lists
- [x] `canUseTool()` authorization in agent loop (`loop.js`)
- [x] Shared registry instance (`loop.js` → `index.js`)
- [x] REST endpoints — `GET/POST /tools`, `GET/DELETE/PATCH /tools/:name`
- [x] `GET /tools/available` (authorized tools only)
- [x] `GET/POST /capabilities/policy` (policy management)
- [x] Verified: deny `process.exec` → `exec` verdwijnt uit available ✅

### Stap 9: ✅ Real-time Events (SSE + REST)
- [x] `runtime-monitor.cjs` — EventEmitter-based pub/sub (publish/subscribe/snapshot)
- [x] SSE stream — `GET /api/runtime/stream` (live event push, initial snapshot + subscriber)
- [x] REST endpoints — `/api/runtime/snapshot`, `/api/runtime/events`, `/api/runtime/sessions`, `/api/runtime/slots`
- [x] Event emission — `chat:inbound`, `chat:outbound`, `chat:stream-start`, `model:switch`, `queue:enqueue`, `plc:parse`, `session:fork`
- [x] Session tracking — `trackSession`/`untrackSession` on fork/delete
- [x] Event history — ring buffer (max 200 events, ISO timestamps)
- [x] Slot 0x39 — runtime event routes registered in index.js
- [x] Koppeling — orphaned `runtime-events.js` nu actief gekoppeld
- [x] Fix: `_events` → `_history` (conflict met EventEmitter intern _events)
- [x] Fix: `publish()` i.p.v. `emit()` (subklasse recursie voorkomen)
- [x] Fix: handler wrapper op slot 0x00 fallback (0x10 werd bypassed)

### Stap 11: ✅ Architectuur Features (6 nieuwe modules)
- [x] **Session Manager** — `src/agent/session-manager.js` (287 lines)
  - State machine: `init → connecting → running → paused → reconnecting → stopped`
  - Events: start, connect, pause, resume, stop, error, reconnect
  - Auto-reconnect met configurable delay + max attempts
  - Heartbeat timer, lifecycle hooks, serializable state
- [x] **FTS5 Memory Search** — `src/memory/fts5-search.js` (317 lines)
  - BM25 in-memory index (pure JS, zero deps)
  - Optional SQLite FTS5 backend (better-sqlite3, auto-detect)
  - Sources: daily memory, MEMORY_claw, identity files
  - Search with context lines, recency boost, source filter
- [x] **Context Compression** — `src/agent/context-compression.js` (871 lines)
  - 3 modes: `summarize`, `truncate`, `compress` (hybrid)
  - Śūnya compression — aggressive condensation to anchors
  - Anchor protection (SOUL.md, USER.md, tool results, directives)
  - Token estimation, auto-compress on breath overload
- [x] **Model Provider Abstraction** — `src/model-provider/` (5 files, ~400 lines)
  - `LlamaCppProvider` — llama.cpp HTTP API
  - `OllamaProvider` — Ollama `/api/chat`
  - `HttpProvider` — generic OpenAI-compatible API
  - `ModelRouter` — register, route, health-check, config-driven
- [x] **Skill System** — `src/skills/` (5 files, ~500 lines)
  - `SkillRegistry` — discover, find, validate, execute
  - `SKILL.md` parser — NPR cycle semantics (Noise→Pattern→Return)
  - Step executor: read, write, exec, template, prompt
  - Example skill: `skills/examples/hello/SKILL.md`
- [x] **Cron/Scheduler** — `src/scheduler/` (4 files, ~600 lines)
  - Job types: systemEvent, agentTurn, script, http, nprCycle
  - Scheduling: `at` (one-shot), `every` (interval), `cron` (expression)
  - Cron parser (simple 5-field), job runner, persistence (JSON)
  - NPR cycle integration — Noise→Pattern→Return automation
  - Zero external dependencies, pure Node.js
