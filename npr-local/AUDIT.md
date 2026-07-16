# NPR Local — Audit & Scope

**Datum:** 2026-07-16  
**Basis:** v2026.6.10-beta.2 (87b40c71)  
**Branch:** `npr-local-1agent`

---

## Huidige OpenClaw

| Metric | Waarde |
|--------|--------|
| Totale bestanden | 20,391 |
| TypeScript bestanden (src/) | 8,937 |
| Extensions | 144 |
| Skills | 58 |
| Packages | 18 |

---

## Src Directories (groot → klein)

| Bestanden | Directory | Doel | Actie |
|-----------|-----------|------|-------|
| 1,811 | `agents/` | Agent execution + multi-agent | **Gedeeltelijk** — kern behouden |
| 782 | `infra/` | Infrastructure/monitoring | **Gedeeltelijk** — logging behouden |
| 727 | `gateway/` | Core session/state | **Behouden** |
| 694 | `commands/` | CLI commands | **Gedeeltelijk** — kern behouden |
| 629 | `plugins/` | Plugin system | **Verwijderen** |
| 586 | `plugin-sdk/` | Plugin SDK | **Verwijderen** |
| 553 | `auto-reply/` | Auto-reply logic | **Verwijderen** |
| 453 | `cli/` | CLI entry | **Behouden** |
| 384 | `config/` | Config schema + loading | **Behouden** |
| 378 | `channels/` | Messaging channels | **Verwijderen** |
| 213 | `cron/` | Background scheduling | **Gedeeltelijk** — basis behouden |
| 127 | `secrets/` | Secret management | **Gedeeltelijk** — lokaal behouden |
| 120 | `shared/` | Shared utilities | **Behouden** |
| 115 | `skills/` | Skill system | **Gedeeltelijk** — lokale skills behouden |
| 98 | `acp/` | Agent Communication Protocol | **Verwijderen** |
| 82 | `llm/` | LLM adapter layer | **Behouden** |
| 81 | `security/` | Security policy | **Gedeeltelijk** — basis behouden |
| 72 | `logging/` | Logging infrastructure | **Behouden** |
| 71 | `daemon/` | Background daemon | **Verwijderen** |

---

## Doel: NPR Local

| Onderdeel | Status |
|-----------|--------|
| Single-agent runtime | ✅ Behouden |
| Local model adapter | ✅ Behouden |
| Local source registry | ✅ Nieuw |
| NPR field router | ✅ Nieuw |
| Session memory | ✅ Behouden |
| Limited tool registry | ✅ Behouden (gefilterd) |
| Audit log | ✅ Behouden |
| Local UI (CLI/TUI) | ✅ Behouden |

---

## Verwachting

Van ~9,000 TypeScript bestanden naar ~1,500-2,000.

Reductie: **~80%**

Niet kleiner voor de lol — kleiner omdat het focust op één ding:
**lokale vraag → lokaal model → lokaal antwoord → lokaal log**

---

## Volgende Stappen

1. [ ] Fase 1: Externe kanalen uitschakelen (channels/)
2. [ ] Fase 2: Multi-agent uitschakelen (agents/ gedeeltelijk)
3. [ ] Fase 3: Mobile apps verwijderen (apps/)
4. [ ] Fase 4: Externe providers verwijderen (extensions/)
5. [ ] Fase 5: Plugin system verwijderen (plugins/, plugin-sdk/)
6. [ ] Fase 6: Overbodige background jobs (cron/ gedeeltelijk)
7. [ ] Fase 7: Config schema's vereenvoudigen (config/)

Elke fase gevolgd door: `npm test && npm run typecheck && npm run build`

---

## Kern (v0.0.1) — Gebouwd 2026-07-16

| Onderdeel | Locatie | Status |
|-----------|---------|--------|
| Route engine | `src/routes/core.js` | ✅ |
| HTTP gateway | `src/interface/gateway.js` | ✅ |
| Agent loop | `src/agent/loop.js` | ✅ |
| NPR field | `src/field/npr.js` | ✅ |
| Entry point | `src/index.js` | ✅ |
| Package | `package.json` | ✅ |

## Endpoints

| Path | Method | Slot | Functie |
|------|--------|------|---------|
| `/health` | GET | 0 (6N) | Health check |
| `/status` | GET | 0 (6N) | Status + route manifest |
| `/npr/trace?path=` | GET | 0 (6N) | NPR routing trace |
| `/agent/chat` | POST | 16 (12P) | Agent turn + NPR |

## Volgende

- [ ] Local model (llama.cpp / ollama)
- [ ] Session memory (disk-backed)
- [ ] Local knowledge sources
- [ ] File system tools (dir, read, exec)
- [ ] Canvas integration
- [ ] Skill loader

## Poort Stack

| Poort | Service | Status |
|-------|---------|--------|
| `18000` | config-llama UI | ✅ |
| `3000` | npr-hub (bestaand) | ✅ |
| `4000` | npr-local (agent loop) | ✅ |
| `4004` | geowon (memory gateway) | ✅ |
| `8765` | llama-server (Qwen3.6-27B) | ✅ |

## Test

```bash
# Health
curl http://[::1]:4000/health

# Chat (NPR routing → llama-server :8765)
curl -X POST http://[::1]:4000/agent/chat -d '{"message":"test"}'

# Config UI
http://[::1]:18000/config-llama.html

# Memory gateway
curl http://[::1]:4004/health
```
