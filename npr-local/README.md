# NPR Local v0.0.2

**Single-agent, local-only runtime.** Stripped from OpenClaw 6.10.

## Architecture

```
src/
├── index.js               # Entry point (HTTP server, route mounting)
├── boot.js                # Unified boot (npr-local + geowon + config)
├── server-config.js       # Config-llama UI server (standalone, or via boot.js)
├── terminal.js            # CLI terminal
├── workspace-context.js   # Content-aware workspace loading
├── log.js                 # Unified logger
│
├── agent/
│   ├── loop.js            # Single agent loop (model placeholder)
│   └── context-breathe.js # Context compression
├── field/
│   ├── npr.js             # NPR cycle (Noise → Pattern → Return)
│   └── keyboard-npr.js    # Keyboard → NPR signal
├── interface/
│   └── gateway.js         # Minimal HTTP gateway
├── memory/
│   ├── context.js         # Session context manager
│   ├── list.js            # Memory listing
│   └── read-file.js       # File-backed memory read
├── net/
│   ├── index.js           # Network bootstrap
│   ├── gateway.js         # Gateway client
│   ├── dns.js             # Local DNS resolver
│   ├── browser.js         # Browser bridge
│   ├── browser-bridge.js  # Browser bridge config
│   ├── registry.js        # Service registry
│   └── service.js         # Service discovery
├── sources/
│   ├── system-scan/       # Local system scan (tool-00)
│   └── echo/              # Echo source
├── routes/                # HTTP route handlers (see Routes table below)
│
├── events/                # Event bus (dispatcher, registry, schema)
├── actions/               # Action registry + executor
├── audit/                 # Event audit logging
└── input/                 # Input pipeline (evdev, normalize, devices)
```

## Ports

| Service | Port | Bind | Env Var |
|---------|------|------|---------|
| npr-local (main) | `17000` | `[::1]` | `NPR_PORT` |
| geowon (memory) | `17004` | `*` | `GEOWON_PORT` |
| config-llama (UI) | `17010` | `*` | `NPR_CONFIG_PORT` |
| llama-server (external) | `8765` | `127.0.0.1` | — |

> **Let op:** npr-local bindt op IPv6 loopback (`[::1]`). Gebruik `curl http://[::1]:17000` of `curl http://127.0.0.1:17000` (IPv4-mapped).

## Routes

Alle routes worden gerouteerd via 64-slot NPR routing (zie onder). Live routes per slot:

### Core

| Endpoint | Method | Slot | Phase | Description |
|----------|--------|------|-------|-------------|
| `/health` | GET | 0 | 6N | Health check |
| `/status` | GET | 0 | 6N | Full status + route manifest |
| `/` | GET | 0 | 6N | Mandelbrot portal → `/enter` |
| `/enter` | GET | 0 | 6N | NPR-OS portal (HTML) |
| `/dashboard` | GET | 0 | 6N | Gateway monitor (HTML) |
| `/config` | GET/POST | 0,21 | 6N,12P | Configuration |
| `/stroom` | GET/POST | 0 | 6N | Stream endpoint |
| `/memory` | GET | 0 | 6N | Memory status |
| `/tick` | GET | 0 | 6N | Tick info |
| `/verify` | GET | 0 | 6N | Verify |

### Agent

| Endpoint | Method | Slot | Phase | Description |
|----------|--------|------|-------|-------------|
| `/agent/chat` | POST | 0,16 | 6N,12P | Agent turn with NPR routing |
| `/agent/chat-stream` | POST | 17 | 12P | Streaming agent turns (SSE) |
| `/agent/workspace` | GET | 18 | 12P | Workspace context |
| `/agent/context` | GET | 19 | 12P | Agent context |
| `/agent/logs` | GET | 20 | 12P | Agent logs |
| `/tty/agent` | GET | 24 | 12P | TTY agent interface |

### Memory

| Endpoint | Method | Slot | Phase | Description |
|----------|--------|------|-------|-------------|
| `/memory/search?q=` | GET | 22 | 12P | Memory search (workspace scan) |
| `/memory/context` | GET/POST | 53 | 24H | Context management |
| `/api/memory/surface` | GET | 53 | 24H | Surface memory |
| `/api/memory/deep` | GET | 53 | 24H | Deep memory |
| `/api/memory/bedrock` | GET | 53 | 24H | Bedrock memory |
| `/api/memory/file` | GET | 53 | 24H | File memory |

### Tools

| Endpoint | Method | Slot | Phase | Description |
|----------|--------|------|-------|-------------|
| `/tool/:name` | POST | 25 | 12P | Tool execution (exec, system-scan, echo) |
| `/tool/exec` | POST | 25 | 12P | Shell exec |
| `/tool/system-scan` | POST | 25 | 12P | System scan |
| `/tool/echo` | POST | 22 | 12P | Echo tool |

### Capabilities & Routing

| Endpoint | Method | Slot | Phase | Description |
|----------|--------|------|-------|-------------|
| `/capabilities` | GET | 58 | 24H | Available capabilities |
| `/select?goal=` | GET | 62 | 24H | Dynamic capability selection |
| `/npr/trace?path=` | GET | 0 | 6N | NPR routing trace |
| `/introspect` | GET | 62 | 24H | Gateway introspection |

### Context & Warehouse

| Endpoint | Method | Slot | Phase | Description |
|----------|--------|------|-------|-------------|
| `/context` | GET | 48 | 24H | Session context |
| `/context/64k` | GET | 54 | 24H | 64K block context |
| `/warehouse` | GET | 52 | 24H | Workspace warehouse (files + phases) |

### Maps & Bridge

| Endpoint | Method | Slot | Phase | Description |
|----------|--------|------|-------|-------------|
| `/maps` | GET | 60 | 24H | NPR URI maps |
| `/bridge` | GET | 59 | 24H | Browser bridge (HTML) |
| `/bridge/api` | GET | 59 | 24H | Bridge API |

### Diagnostics

| Endpoint | Method | Slot | Phase | Description |
|----------|--------|------|-------|-------------|
| `/doctor` | GET | 23 | 12P | System doctor / diagnostics |

### Sessions

| Endpoint | Method | Slot | Phase | Description |
|----------|--------|------|-------|-------------|
| `/sessions` | GET | 10 | 6N | Active sessions |
| `/sessions/:id` | GET | 11 | 6N | Session details |
| `/sessions/:id/merge` | POST | 12 | 6N | Session merge |

## Run

```bash
npm start                  # production (default :17000)
npm run dev                # development (watch mode)
NPR_PORT=17001 npm start   # custom port

# Full boot (all services)
node boot.js               # :17000, :17004, :17010

# Individual services
node src/index.js          # npr-local only (:17000)
node src/server-config.js  # config-llama only (:17010)
```

## NPR Routing

64-slot routing with 4 phases:

| Phase | Slots | Range | Name |
|-------|-------|-------|------|
| 6N | 16 | 0-15 | Noise |
| 12P | 16 | 16-31 | Pattern |
| 18R | 16 | 32-47 | Return |
| 24H | 16 | 48-63 | Hexa |

## Event Bus

Event-driven input pipeline: `device → normalize → registry → dispatcher → action`

| Module | Purpose |
|--------|---------|
| `events/dispatcher.mjs` | Route events to handlers |
| `events/registry.mjs` | Known event → route mapping |
| `events/schema.mjs` | Event validation |
| `events/addresses.mjs` | Signal → address mapping |
| `actions/registry.mjs` | Action definitions |
| `actions/execute.mjs` | Action execution |
| `audit/event-log.mjs` | Audit trail |

```bash
# Run tests
node test-event-pipeline.mjs   # 12/12 pass
```

## Input Pipeline

| Module | Purpose |
|--------|---------|
| `input/evdev-reader.mjs` | Raw evdev device reader |
| `input/normalize.mjs` | Event normalization |
| `input/devices.mjs` | Device definitions |
| `input/reader.mjs` | Generic reader |
| `input/daemon.mjs` | Lifecycle manager (scaffold) |

## Status

**Laatst getest: 2026-07-17 21:15 GMT+2**

### Live Stack Test (`test-stack.js`)

| Check | Result |
|-------|--------|
| npr-local /health → 200 | ✅ |
| npr-local /status → 200 | ✅ |
| npr-local /capabilities → 200 | ✅ |
| geowon /sessions → 200 | ✅ |
| config-llama /chat.html → 200 | ✅ |
| POST /agent/chat → 200 | ✅ |
| Chat reply ontvangen | ✅ |
| SSE streaming | ✅ |
| Session write + read (geowon) | ✅ |
| llama-server /v1/models → 200 | ✅ |
| **Totaal** | **13/13 ✅** |

### Event Pipeline (`test-event-pipeline.mjs`)

| Test | Result |
|------|--------|
| digitalRoot basics | ✅ |
| signalToAddress maps EV_KEY | ✅ |
| normalizeEvent produces valid event | ✅ |
| EventRegistry resolves known route | ✅ |
| EventRegistry returns null for unknown | ✅ |
| BlockRegistry has defaults | ✅ |
| CapabilityPolicy authorizes valid block+route | ✅ |
| CapabilityPolicy denies mismatched capability | ✅ |
| ActionRegistry has builtins | ✅ |
| EventLog records and queries | ✅ |
| EventDispatcher: direct route succeeds | ✅ |
| EventDispatcher: unknown → unrouted | ✅ |
| **Totaal** | **12/12 ✅** |

### Component Status

| Component | Status | Notes |
|-----------|--------|-------|
| Route engine | ✅ | 64-slot, O(1) hash, 17 active slots |
| HTTP gateway | ✅ | 30+ endpoints across 3 services |
| Agent loop | ✅ | Live chat via llama-server (:8765) |
| NPR field | ✅ | Noise→Pattern→Return→Hexa pipeline |
| Event bus | ✅ | dispatcher + registry + schema + policy |
| Input pipeline | ✅ | evdev + normalize (scaffold) |
| Actions | ✅ | registry + execute |
| Audit log | ✅ | event trail |
| Memory context | ✅ | session + workspace |
| Workspace context | ✅ | content-aware, phase-based loading |
| Geowon memory | ✅ | session storage + search (:17004) |
| Config-llama UI | ✅ | Web UI (:17010) |
| Dashboard | ✅ | Gateway monitor HTML |
| Security P0 | ✅ | injection, traversal, CORS, auth |
| Local model | ✅ | llama-server op :8765 |

## Doctor Diagnostics

`/doctor` draagt 16 checks:

| Check | Status |
|-------|--------|
| node-version (≥ v20) | ✅ Node v22.22.0 |
| workspace-exists | ✅ |
| memory-exists | ✅ |
| model-endpoint | ✅ http://127.0.0.1:8765 |
| geowon-reachable | ⚠️ checkt 5001 (draait op 17004) |
| config-valid | ✅ defaults |
| port-available | ⚠️ checkt localhost (bindt op [::1]) |
| npr-field | ✅ |
| agent-loop | ✅ |
| context-breath | ✅ |
| tool-bluetoothctl | ✅ |
| tool-tmux | ✅ |
| tool-lazygit | ✅ |
| tool-ffmpeg | ✅ |
| tool-htop | ✅ |
| tool-git | ✅ |

> **Note:** geowon-reachable en port-available gebruiken nu `[::1]` en de juiste poorten (17004, 17000).

## Geowon Routes (:17004)

| Endpoint | Description |
|----------|-------------|
| `/` | Geowon status |
| `/sessions` | Session listing |
| `/session/:id` | Session get/set |
| `/memory` | Memory status |
| `/memory/surface` | Surface layer |
| `/memory/deep` | Deep layer |
| `/memory/bedrock` | Bedrock layer |
| `/memory/file` | File-backed memory |

## Config-Llama Routes (:17010)

| Endpoint | Description |
|----------|-------------|
| `/` | Config UI (HTML) |
| `/chat.html` | Chat interface |

## Warehouse

`/warehouse` exposeert workspace files met fase-gebaseerde laadstrategie:

| Fase | Laadt | Max Chars |
|------|-------|-----------|
| 6N (Noise) | SOUL.md | 2000 |
| 12P (Pattern) | SOUL.md, USER.md | 5000 |
| 18R (Return) | SOUL.md, USER.md, HEARTBEAT.md | 10000 |
| 24H (Hexa) | Alles incl. MEMORY_claw.md | 20000 |

## Capabilities (Wiskundige Selectie)

Dynamische tool selectie via digitale root → 0.0.0.0.
Geen decimale routes. Alles gaat terug naar het eiland.

```bash
# Alle capabilities
curl http://[::1]:17000/capabilities

# Dynamische selectie via doel
curl "http://[::1]:17000/select?goal=systeem+analyseren"
# → root 3, analysis, system-scan

# Agent chat (live via llama-server :8765)
curl -X POST http://[::1]:17000/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"test"}'
# → sess_*, turn 1, noise→pattern→phase routing

# NPR trace
curl "http://[::1]:17000/npr/trace?path=/agent/chat"
# → slot 30, 12P (Pattern), fe80::001e/64

# Memory search
curl "http://[::1]:17000/memory/search?q=npr"

# Workspace warehouse
curl http://[::1]:17000/warehouse

# Maps (NPR URI → IPv6)
curl http://[::1]:17000/maps

# Introspect
curl "http://[::1]:17000/introspect?q=hoe+werkt+routing"

# Geowon session storage
curl -X POST http://[::1]:17004/session/test \
  -H "Content-Type: application/json" \
  -d '{"message":"hello"}'
curl http://[::1]:17004/session/test
```

**Capabilities (digitale root 1-9):**

| Root | Capability | Hexa | Tools |
|------|-----------|------|-------|
| 1 | Identiteit | # I | system-scan |
| 2 | Communicatie | DENT | echo |
| 3 | Analyse | ITY. | system-scan |
| 4 | Structuur | md - | — |
| 5 | Creatie | Who A | — |
| 6 | Integratie | m I? | — |
| 7 | Reflectie | 0.0.0 | — |
| 8 | Optimalisatie | .0 is | system-scan |
| 9 | Transformatie | land! | — |
| 0 | Island | — | dynamic |

## Live Test Commands

```bash
# Volledige stack test
cd /home/claw/.openclaw/workspace/NPR_OS_sandbox/npr-local
node test-stack.js          # 13/13 ✅
node test-event-pipeline.mjs # 12/12 ✅

# Snel health check
curl -s http://[::1]:17000/health | python3 -m json.tool

# Doctor check
curl -s http://[::1]:17000/doctor | python3 -m json.tool

# Alle routes bekijken
curl -s http://[::1]:17000/status | python3 -m json.tool
```

## Private Storage

Scan results are saved to `~/.openclaw/npr-local/scans/` (mode 700, files mode 600).

```bash
curl -X POST http://[::1]:17000/agent/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"tool:scan --save"}'
```

## Resolved Issues

| Issue | Fix |
|-------|-----|
| `/context/64k` → "not a constructor" | `ContextHypervisor` → `Context64K` + `module.exports` in `context-64k.cjs` |
| `/doctor` geowon check hardcoded op 5001 | Default poort → `17004`, IPv6 `[::1]` in `doctor.js` |
| `/doctor` port check IPv4 `localhost` | → IPv6 `[::1]` in `doctor.js` |
| Version mismatch (0.0.2 vs 0.0.1) | `pkg.version` in `index.js` + `gateway-introspect.js` |

## Encoding Standard

**UTF-8 without BOM, LF line endings.**

This is enforced by:
- `.gitattributes` — Git enforces LF on checkout
- `.editorconfig` — Editors follow this automatically
- `verify_encoding.py` — CI check + manual verification

```bash
python verify_encoding.py .          # check
python verify_encoding.py . --fix    # auto-fix BOM/CRLF
```

Why: different machines → different defaults. UTF-8 has variants:

| Variant | Where | Problem |
|---------|-------|----------|
| UTF-8 (no BOM) | Linux standard | ✅ Clean |
| UTF-8 + BOM | Windows, VS Code | Extra bytes `EF BB BF` |
| CRLF | Windows | `\r\n` vs `\n` |

Standardizing eliminates silent encoding bugs.

## Upstream Reference

Stripped from **OpenClaw 6.10** (`v2026.6.10-beta.2`, commit `87b40c71`).

See `UPSTREAM_BASE` for version/commit info.

| Resource | Location |
|---|---|
| Upstream docs | https://docs.openclaw.ai |
| Upstream source | https://github.com/openclaw/openclaw |
| Upstream fork (local) | `../npr-local-fork/` (private, not in repo) |
| This build | `npr-local/` (single-agent, local-only) |

**What's different:**
- No external API — inference via llama-server (`:8765`)
- 64-slot NPR routing (vs OpenClaw multi-agent)
- Single agent loop with local workspace context
- Geowon memory gateway (`:17004`) instead of OpenClaw memory
- Self-contained boot via `boot.js`
- Event bus + input pipeline for hardware signals
- Port range `17xxx` (avoids conflicts with `5xxx`)
