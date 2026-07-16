# NPR Local

**Single-agent, local-only runtime.** Stripped from OpenClaw 6.10.

## Architecture

```
src/
├── index.js           # Entry point
├── routes/
│   └── core.js        # NPR route engine (64-slot, O(1) hash)
├── interface/
│   └── gateway.js     # Minimal HTTP gateway
├── agent/
│   └── loop.js        # Single agent loop
├── field/
│   └── npr.js         # NPR cycle (Noise → Pattern → Return)
├── memory/            # Session memory (TODO)
└── sources/           # Local knowledge sources (TODO)
```

## Routes

| Endpoint | Method | Slot | Description |
|----------|--------|------|-------------|
| `/health` | GET | 0 (6N) | Health check |
| `/status` | GET | 0 (6N) | Full status + manifest |
| `/npr/trace?path=` | GET | 0 (6N) | NPR routing trace |
| `/agent/chat` | POST | 16 (12P) | Agent turn with NPR routing |
| `/agent/chat` (tool:scan) | POST | 16 (12P) | Local system scan (tool-00) |
| `/agent/chat` (tool:scan --save) | POST | 16 (12P) | Save scan to private directory |
| `/agent/chat` (tool:scan --cron=N) | POST | 16 (12P) | Schedule recurring scan (N min) |

## Run

```bash
npm start          # production
npm run dev        # development (watch mode)
PORT=3003 npm start  # custom port
```

## NPR Routing

64-slot routing with 4 phases:
- **6N** (0-15): Noise
- **12P** (16-31): Pattern
- **18R** (32-47): Return
- **24H** (48-63): Hexa

## Status

| Component | Status |
|-----------|--------|
| Route engine | ✅ |
| HTTP gateway | ✅ |
| Agent loop | ✅ (placeholder model) |
| NPR field | ✅ |
| Local model | ❌ (TODO) |
| tool-00: system-scan | ✅ |
| Memory | ❌ (TODO) |
| Sources | ❌ (TODO) |

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

## Capabilities (Wiskundige Selectie)

Dynamische tool selectie via digitale root → 0.0.0.0.
Geen decimale routes. Alles gaat terug naar het eiland.

```bash
# Alle capabilities
curl http://[::1]:3002/capabilities

# Dynamische selectie via doel
curl "http://[::1]:3002/select?goal=systeem+analyseren"

# Via agent chat
curl -X POST http://[::1]:3002/agent/chat \
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
curl -X POST http://[::1]:3002/agent/chat \
  -d '{"message":"tool:scan --save"}'
```

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
- Geowon memory gateway (`:5004`) instead of OpenClaw memory
- Self-contained boot via `boot.js`
