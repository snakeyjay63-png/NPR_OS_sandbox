# OpenClaw CLI vs NPR-Local — Gap Analyse

**Datum:** 2026-07-16  
**OpenClaw:** v2026.6.10 (aa69b12)  
**NPR-Local:** v0.0.1

---

## OpenClaw CLI Commanden (≈55)

| Command | Functie | NPR-Local | Status |
|---------|---------|-----------|--------|
| `agent` | Single agent turn | `/agent/chat` + `/agent/chat-stream` | ✅ |
| `agents` | Multi-agent manage | Niet (single-agent design) | 🚫 by design |
| `approvals` | Exec approvals | Niet | ❌ |
| `backup` | Backup state | Niet | ❌ |
| `capability` | Provider caps | `/capabilities` | ✅ |
| `channels` | Messaging | Niet (local only) | 🚫 by design |
| `chat` / `tui` | Terminal UI | `/enter` portal | ⚠️ basic |
| `commitments` | Follow-ups | Niet | ❌ |
| `config` | Config helpers | `/config` | ✅ |
| `configure` | Interactive config | Niet | ❌ |
| `cron` | Scheduling | Niet | ❌ |
| `daemon` | Service manage | `boot.js` | ⚠️ basic |
| `dashboard` | Control UI | `/verify` | ⚠️ partial |
| `devices` | Device pairing | Niet | 🚫 |
| `directory` | Contact lookup | Niet | 🚫 |
| `docs` | Docs search | Niet | ❌ |
| `doctor` | Diagnose/repair | `/doctor` | ✅ |
| `gateway` | Run/inspect/query | `boot.js` + `/health` | ⚠️ basic |
| `health` | Health check | `/health` + `/tick` | ✅ |
| `hooks` | Agent hooks | AgentEventSink | ⚠️ internal |
| `infer` | Model/media/search | Llama call | ⚠️ basic |
| `logs` | Tail logs | `/agent/logs` | ✅ |
| `memory` | Search/inspect/reindex | `/warehouse`, `/memory/search` | ✅ |
| `message` | Send/read/manage | `/agent/chat` | ⚠️ partial |
| `models` | List/set providers | Niet (single model) | 🚫 |
| `sessions` | List sessions | `/sessions` | ⚠️ basic |
| `skills` | List/install skills | Niet | ❌ |
| `status` | Gateway status | `/status` | ✅ |
| `system` | Events/heartbeat | Niet | ❌ |
| `tasks` | Background tasks | Niet | ❌ |
| `transcripts` | Inspect transcripts | Niet | ❌ |
| `update` | Update | Niet | ❌ |

---

## Priority Matrix

### ✅ Geïmplementeerd (Core)
- **Agent loop:** `agentTurn`, `runAgentLoop` (two-loop + tool-calls)
- **Chat:** `/agent/chat` (JSON) + `/agent/chat-stream` (SSE)
- **Routing:** NPR 64-slot engine, phase detection
- **Health:** `/health`, `/tick` (μs precision), `/status`
- **Capabilities:** `/capabilities` (digital root 1-9)
- **Memory:** `/warehouse`, `src/memory/` (context, list, read-file)
- **Context breath:** 4-rollen routing (Vogel/Haas/Aap/Olifant), 6-bit levels

### ⚠️ Gedeeltelijk
- **Terminal UI:** `/enter` (basic portal) vs OpenClaw `tui` (full interactive)
- **Config:** server-config UI vs OpenClaw `config`/`configure` (CLI + interactive)
- **Sessions:** basic CRUD vs OpenClaw full persistence
- **Memory:** geowon-backed vs OpenClaw SDK (embeddings, search, reindex)
- **Gateway:** `boot.js` vs OpenClaw `gateway` (full lifecycle + RPC)

### ❌ Ontbreekt (Implementeerbaar)
1. **`/agent/logs`** — tail agent event log
2. **`/config` POST** — config set/unset
3. **`/memory/search`** — memory search (OpenClaw SDK pattern)
4. **`/doctor`** — self-diagnose + repair
5. **`/sessions/:id/transcript`** — transcript view
6. **`/skills`** — skill registry (list/inspect)
7. **`/system/events`** — heartbeat + system events
8. **`/cron`** — simple scheduler (isolated agentTurn)
9. **`/tasks`** — background task inspector
10. **`/backup`** — workspace snapshot

### 🚫 By Design Niet
- Channels/messaging (local only)
- Multi-agent (single agent)
- Device pairing (no mobile)
- External providers (local model only)

---

## Volgende Stap: Pariteitslaag

Om OpenClaw CLI functionaliteit lokaal te krijgen, moeten we de **ontbrekende endpoints** toevoegen. Prioriteit:

### Fase 1: Direct Nodig
| # | Endpoint | Functie | OpenClaw Equivalent |
|---|----------|---------|---------------------|
| 1 | `GET /agent/logs` | Agent event log tail | `openclaw logs` |
| 2 | `GET /config` + `POST /config` | Config read/write | `openclaw config get/set` |
| 3 | `GET /memory/search?q=` | Memory search | `openclaw memory search` |
| 4 | `GET /doctor` | Self-diagnose | `openclaw doctor` |

### Fase 2: Nuttig
| # | Endpoint | Functie | OpenClaw Equivalent |
|---|---|---------|---------------------|
| 5 | `GET /skills` | Skill list/inspect | `openclaw skills` |
| 6 | `GET /system/events` | Heartbeat + events | `openclaw system` |
| 7 | `GET /sessions/:id/transcript` | Transcript view | `openclaw transcripts` |

### Fase 3: Advanced
| # | Endpoint | Functie | OpenClaw Equivalent |
|---|---|---------|---------------------|
| 8 | `POST /cron` | Simple scheduler | `openclaw cron` |
| 9 | `GET /tasks` | Task inspector | `openclaw tasks` |
| 10 | `POST /backup` | Workspace snapshot | `openclaw backup` |

---

## Architectuur Impact

Elke nieuwe endpoint volgt het bestaande patroon:
```js
register(slot, '/path', handler);
```

Geen breaking changes. Pure toevoeging.
