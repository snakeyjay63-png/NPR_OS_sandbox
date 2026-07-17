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

| Service | Port | Env Var |
|---------|------|---------|
| npr-local (main) | `17000` | `NPR_PORT` |
| geowon (memory) | `17004` | `GEOWON_PORT` |
| config-llama (UI) | `17010` | `NPR_CONFIG_PORT` |
| llama-server (external) | `8765` | — |

## Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Mandelbrot portal (`/enter`) |
| `/health` | GET | Health check |
| `/status` | GET | Full status + manifest |
| `/capabilities` | GET | Available capabilities |
| `/select?goal=` | GET | Dynamic capability selection |
| `/npr/trace?path=` | GET | NPR routing trace |
| `/doctor` | GET | System doctor / diagnostics |
| `/agent/chat` | POST | Agent turn with NPR routing |
| `/agent/chat-stream` | POST | Streaming agent turns (SSE) |
| `/config` | GET/POST | Configuration |
| `/memory/search` | GET | Memory search |
| `/memory/context` | GET/POST | Context management |
| `/sessions` | GET | Active sessions |
| `/warehouse` | GET | Warehouse status |
| `/sessions/:id/logs` | GET | Session logs |
| `/gateway/introspect` | GET | Gateway introspection |
| `/tool/:name` | POST | Tool execution |
| `/stroom` | GET/POST | Stroom (stream) endpoint |
| `/map/registry` | GET | IPv6 map registry |
| `/map/registry/:name` | POST | Register IPv6 map |
| `/map/to-ipv6` | GET | Map name → IPv6 |
| `/block/registry` | GET | Block registry |
| `/policy` | GET | Capability policy |
| `/npr/trace` | GET | NPR trace |

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

| Component | Status |
|-----------|--------|
| Route engine | ✅ 64-slot, O(1) hash |
| HTTP gateway | ✅ 24 endpoints |
| Agent loop | ✅ (placeholder model) |
| NPR field | ✅ |
| Event bus | ✅ dispatcher + registry + schema |
| Input pipeline | ✅ evdev + normalize (scaffold) |
| Actions | ✅ registry + execute |
| Audit log | ✅ |
| Memory context | ✅ |
| Workspace context | ✅ content-aware |
| Security P0 | ✅ injection, traversal, CORS, auth |
| Tests | ✅ 12/12 pass |
| Local model | ❌ (TODO — llama.cpp / ollama) |
| Disk-backed session memory | ❌ (TODO) |
| Canvas integration | ❌ (TODO) |
| Skill loader | ❌ (TODO) |

## Capabilities (Wiskundige Selectie)

Dynamische tool selectie via digitale root → 0.0.0.0.
Geen decimale routes. Alles gaat terug naar het eiland.

```bash
# Alle capabilities
curl http://[::1]:17000/capabilities

# Dynamische selectie via doel
curl "http://[::1]:17000/select?goal=systeem+analyseren"

# Via agent chat
curl -X POST http://[::1]:17000/agent/chat \
  -d '{"message":"tool:capabilities"}'
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

## Private Storage

Scan results are saved to `~/.openclaw/npr-local/scans/` (mode 700, files mode 600).

```bash
curl -X POST http://[::1]:17000/agent/chat \
  -d '{"message":"tool:scan --save"}'
```

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
