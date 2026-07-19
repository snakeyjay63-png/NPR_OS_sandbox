# Architecture Comparison: OpenClaw vs Hermes Agent

> NPR-local Architecture Research — July 2026

---

## Executive Summary

OpenClaw and Hermes (NousResearch/hermes-agent) represent two fundamentally different architectural philosophies for building local-first AI agent systems. **OpenClaw is gateway-first**: the gateway process is the authoritative orchestrator, with agents, sessions, and tools as managed resources underneath it. **Hermes is agent-first**: the agent loop is the primary concern, with a gateway as an optional transport layer bolted around it.

NPR-local inherits the gateway-first paradigm from OpenClaw but diverges significantly in its NPR cycle semantics (Noise→Pattern→Return), PLC-style component lifecycle, and śūnya-context philosophy. This document maps both systems to identify what NPR-local should adopt, adapt, and avoid.

---

## 1. Architectural DNA

### OpenClaw — Gateway-First

OpenClaw's architecture is built around a central **Gateway process** that owns:

- **Session lifecycle**: Every conversation is a session with state (init → connecting → running → reconnecting → stopped)
- **Model routing**: The gateway decides which model handles which turn, with provider abstraction built in
- **Tool orchestration**: All tool calls flow through the gateway's policy filter
- **Multi-agent coordination**: Subagent spawning, context passing, and result aggregation are gateway-managed
- **Messaging platform bridging**: Discord, Telegram, Slack, WhatsApp, Signal — all routes through the gateway
- **Cron scheduling**: Timed jobs execute within the gateway process
- **Mobile node pairing**: Camera, screen, location, notifications — all managed by the gateway

The gateway is the **source of truth**. Even local inference (llama.cpp, Ollama) is just another provider the gateway routes to.

```
┌─────────────────────────────────────────────────────┐
│                    OpenClaw Gateway                  │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │ Sessions│  │  Routing  │  │   Multi-Agent Hub  │ │
│  │ Manager │  │  Engine   │  │   (spawn/aggregate)│ │
│  └─────────┘  └──────────┘  └────────────────────┘ │
│                                                      │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────┐ │
│  │  Cron   │  │  Tool    │  │  Platform Bridge   │ │
│  │ Schedul-│  │ Policy   │  │  (TG/Disc/Slack/   │ │
│  │ er      │  │ Filter   │  │   WhatsApp/Signal)  │ │
│  └─────────┘  └──────────┘  └────────────────────┘ │
│                                                      │
│  ┌────────────────────────────────────────────────┐  │
│  │           Model Provider Abstraction           │  │
│  │  llama.cpp | Ollama | OpenAI | Anthropic |     │  │
│  │  OpenRouter | Gemini | Google Native | Custom   │  │
│  └────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### Hermes — Agent-First

Hermes is built around a **central Agent loop** with everything else serving it:

- **The Agent loop** is primary: read input → process → tool calls → generate output → learn
- **Learning loop** is baked into the core: skill creation, memory curation, self-improvement during use
- **Gateway is secondary**: `hermes gateway` is a separate subcommand that bridges messaging platforms to the agent
- **CLI/TUI is the default interface**: `hermes` starts the interactive terminal session
- **Memory system is agent-owned**: FTS5 search, cross-session recall, user profiling — all managed by the agent itself
- **Skills are agent-generated**: Complex tasks trigger autonomous skill creation

```
┌─────────────────────────────────────────────────────┐
│                   Hermes Agent                       │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │           Core Agent Loop                    │   │
│  │  Input → Process → Tools → Output → Learn   │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Memory  │  │  Skills  │  │   User Profile   │  │
│  │  (FTS5)  │  │ (auto-   │  │  (Honcho/        │  │
│  │          │  │  gen)    │  │   Dialectic)     │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │
│  │  Toolset │  │ Context  │  │ Trajectory       │  │
│  │  (40+)   │  │ Files    │  │ Generation       │  │
│  └──────────┘  └──────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────┘
                          │
                    ┌─────┴─────┐
                    │   Gates   │
                    │ TG/Disc/  │
                    │ Slack/CLI │
                    └───────────┘
```

### Key Philosophical Difference

| Dimension | OpenClaw | Hermes |
|-----------|----------|--------|
| **Primary unit** | Gateway (orchestrator) | Agent (processor) |
| **Memory ownership** | Gateway-managed session store | Agent-owned with FTS5 |
| **Skill origin** | Human-authored SKILL.md files | Agent-autogenerated + human-curated |
| **Learning** | Static skills, session-based memory | Closed learning loop, self-improvement |
| **Gateway role** | Core identity | Optional transport layer |
| **Multi-agent** | Gateway-spawned subagents with hierarchy | Agent-spawned subagents with RPC |
| **Model switching** | Gateway-level routing | Agent-level config (`/model`) |

---

## 2. Core Architecture Comparison

### Routing & Request Lifecycle

**OpenClaw:**
- Gateway receives all input from every platform
- Routes through session manager → model router → tool policy filter
- Each turn is a discrete unit with tool-call sub-lifecycles
- Session state persists across turns; gateway owns the state machine
- Model provider selection happens at the gateway level, configurable per-session

**Hermes:**
- Input arrives through CLI or gateway bridge
- Agent loop processes directly: parse → decide → tools → output
- No explicit session manager; agent maintains its own context window
- Model provider is a config setting, switched via `/model` command
- Trajectory compression for training data generation

**NPR-local:**
- Gateway (port 5017) owns the request lifecycle
- Component lifecycle: `Gateway > Session > Turn > Tool-call`
- Supervisor manages component health with state machine (starting → ready → degraded → draining → recovering → stopped)
- Llama supervisor manages the inference backend independently

### Session Management

| Feature | OpenClaw | Hermes | NPR-local |
|---------|----------|--------|-----------|
| **Session model** | Explicit state machine | Implicit context window | Gateway-managed + Geowon store |
| **Persistence** | JSON session files | FTS5 + memory files | JSON per-session in geowon/memory/ |
| **Cross-session recall** | MEMORY.md routes | FTS5 search + summarization | śūnya-context (25 files, 3000 lines) |
| **Multi-session** | Full multi-session support | Single context, compressed | Main-session + Geowon side-channels |
| **Session state** | init→connecting→running→reconnecting→stopped | Not explicit | Supervisor state machine |

### Model Management

| Feature | OpenClaw | Hermes | NPR-local |
|---------|----------|--------|-----------|
| **Provider abstraction** | Unified interface, 7+ providers | Unified, 8+ providers | llama.cpp only (port 8765) |
| **Switching** | Per-session config | `/model` command | Config file only |
| **Local inference** | llama.cpp, Ollama, native | llama.cpp via Ollama | llama-server external process |
| **Multi-model routing** | Gateway-level | Agent-level | Not implemented |
| **Token budgeting** | Per-goal budgets | Context compression | NPR cycle-based |

### Multi-Agent Support

| Feature | OpenClaw | Hermes | NPR-local |
|---------|----------|--------|-----------|
| **Spawning** | `sessions_spawn` with context modes | Subagent spawn + Python RPC | Not yet implemented |
| **Hierarchy** | Tree with depth limits | Flat with parallel workstreams | Supervisor component model |
| **Communication** | Push-based descendant results | RPC calls between agents | EventBus (intra-process) |
| **Isolation** | Separate session contexts | Isolated subagent contexts | Component isolation via supervisor |
| **Orchestration** | Gateway-managed | Agent-managed | Gateway supervisor |

### Provider Switching

Both systems share a critical insight: **model providers must be hot-swappable without code changes**.

**OpenClaw** achieves this through:
- Config-based provider selection with per-session overrides
- `default_model` and inline `@model` annotations
- Provider abstraction layer that normalizes API differences
- Native support for llama.cpp, OpenAI, Anthropic, OpenRouter, Gemini, Google Native, Ollama

**Hermes** achieves this through:
- `hermes model` CLI command for instant switching
- Provider config with per-tool backend selection (Nous Portal can route all tools)
- Format-agnostic tool calling
- Supports Nous Portal, OpenRouter, OpenAI, Anthropic, and custom endpoints

**NPR-local** currently only supports llama.cpp on port 8765. This is a deliberate constraint (local-only philosophy) but limits flexibility.

---

## 3. Feature Comparison

### Memory Systems

| Dimension | OpenClaw | Hermes | NPR-local |
|-----------|----------|--------|-----------|
| **Short-term** | Session context window | Context window + compression | Session context in main process |
| **Long-term** | MEMORY.md → MEMORY_claw.md | FTS5 + memory files + user profiles | śūnya-context (25 basisbestanden) |
| **User profiling** | USER.md | Honcho dialectic modeling + persistent memory | Not yet implemented |
| **Search** | File-based reading | FTS5 full-text search with LLM summarization | File-based loading at boot |
| **Cross-session** | Memory routes | Session search + recall | śūnya-context loaded at boot |
| **Learning loop** | None (static) | Closed: agent creates, improves, recalls | None (static) |

### Tool Systems

| Dimension | OpenClaw | Hermes | NPR-local |
|-----------|----------|--------|-----------|
| **Tool count** | ~15 core + skills | 40+ built-in | 1 (tool-00) + NPR-specific |
| **Tool format** | JSON actions (`{"action": "tool_name"}`) | MCP + native tool definitions | NPR cycle semantics |
| **Policy/filter** | AGENTS.md rules + runtime policy | Command allowlist + approval patterns | Language policy module |
| **Custom tools** | Skills with tool definitions | Toolset system + MCP servers | Capability registry |
| **MCP support** | Yes | Yes | Not yet |

### Skills

| Dimension | OpenClaw | Hermes | NPR-local |
|-----------|----------|--------|-----------|
| **Format** | SKILL.md files | agentskills.io standard + auto-generated | NPR-specific patterns |
| **Creation** | Human-authored | Agent-autogenerated after complex tasks | Human-authored |
| **Improvement** | Manual | Self-improving during use | Static |
| **Discovery** | Pre-loaded list | Skills Hub + search | Capability registry |
| **Lifecycle** | Create → apply → reject → quarantine | Create → use → improve → persist | Register → use |

### Cron / Scheduled Jobs

| Dimension | OpenClaw | Hermes | NPR-local |
|-----------|----------|--------|-----------|
| **Scheduling** | Cron jobs with delivery to any platform | Built-in cron with platform delivery | Not yet implemented |
| **Delivery** | Any connected platform | Any connected platform | N/A |
| **Format** | Natural language descriptions | Natural language descriptions | N/A |
| **State** | Persistent across restarts | Persistent | N/A |

### Messaging Platforms

| Platform | OpenClaw | Hermes |
|----------|----------|--------|
| Telegram | ✅ | ✅ |
| Discord | ✅ | ✅ |
| Slack | ✅ | ✅ |
| WhatsApp | ✅ | ✅ |
| Signal | ✅ | ✅ |
| Home Assistant | ❌ | ✅ |
| Email | ❌ | ✅ |
| CLI/TUI | Basic | Full TUI with multiline editing |

### Local Inference

| Feature | OpenClaw | Hermes | NPR-local |
|---------|----------|--------|-----------|
| **llama.cpp** | ✅ Native | ✅ via Ollama | ✅ External process |
| **Ollama** | ✅ | ✅ | ❌ |
| **GPU support** | Via local providers | Via local providers | Via llama-server |
| **Process management** | Gateway-managed | Agent-managed | LlamaSupervisor (external process) |
| **Health monitoring** | Provider health checks | Connection monitoring | Full supervisor with restart policies |

---

## 4. Modularity Analysis

### What Can Be Stripped Away?

#### OpenClaw Modularity

OpenClaw is highly modular by design:

| Component | Strip-able? | Impact if Removed |
|-----------|-------------|-------------------|
| Messaging platforms | ✅ | Gateway works standalone |
| Multi-agent | ✅ | Single-agent mode works |
| Skills system | ✅ | Core tools still work |
| Cron | ✅ | No scheduled jobs |
| Mobile nodes | ✅ | No camera/screen/location |
| MCP | ✅ | No external tool servers |
| Local inference | ✅ | Cloud providers only |
| Canvas UI | ✅ | No visual output |
| **Gateway core** | ❌ | System stops functioning |
| **Session manager** | ❌ | No conversation state |
| **Model routing** | ❌ | No inference |

OpenClaw effectively has a **"gateway-only" mode** — the gateway can run with minimal plugins and still function as a session manager + model router.

#### Hermes Modularity

Hermes is less modular — the agent loop is deeply integrated:

| Component | Strip-able? | Impact if Removed |
|-----------|-------------|-------------------|
| Gateway | ✅ | CLI-only mode works |
| Memory system | ⚠️ Partially | Agent loses cross-session recall |
| Skills | ✅ | Agent works with tools only |
| Cron | ✅ | No scheduled tasks |
| MCP | ✅ | No external tool servers |
| Desktop app | ✅ | CLI/TUI-only works |
| **Agent loop** | ❌ | System stops functioning |
| **Tool system** | ❌ | Agent cannot act |
| **Model provider** | ❌ | No inference |

Hermes has a **"gateway-only" mode** (run `hermes gateway start` separately) but the agent itself is monolithic. There is no "agent-only" mode separate from the learning loop.

#### NPR-local Modularity (Current)

| Component | Status | Strip-able? |
|-----------|--------|-------------|
| Gateway (5017) | ✅ Built | ❌ Core |
| Supervisor | ✅ Built | ❌ Core |
| EventBus | ✅ Built | ❌ Core |
| LlamaSupervisor | ✅ Built | ⚠️ Degrades to cloud-only |
| Geowon Memory (17004) | ✅ Built | ⚠️ Loses persistence |
| Config Server (17010) | ✅ Built | ✅ Optional |
| NPR cycles | ✅ Built | ⚠️ Loses semantics |
| PLC components | ✅ Built | ⚠️ Loses validation |
| śūnya-context | ✅ Built | ❌ Core identity |
| Tool-00 | ✅ Built | ⚠️ Loses validation |
| Session manager | ❌ Not built | Needs implementation |
| Model routing | ❌ Not built | Needs implementation |
| Messaging | ❌ Not built | Future extension |
| Cron | ❌ Not built | Future extension |
| Multi-agent | ❌ Not built | Future extension |

---

## 5. Extensibility Analysis

### Adding/Removing Components

**OpenClaw** — High extensibility:
- Skills are self-contained SKILL.md + assets directories
- Tool policy is declarative (AGENTS.md rules)
- Model providers are plug-and-play (add config, get routing)
- Messaging platforms are independent bridges
- Cron jobs are declarative, not code-coupled

**Hermes** — Medium-High extensibility:
- Tools via MCP (standardized interface)
- Skills via agentskills.io standard (interoperable)
- Models via provider config
- Custom toolsets can be added
- Gateway platforms are modular bridges

**NPR-local** — Medium extensibility (in progress):
- Supervisor provides component registration API
- EventBus enables decoupled component communication
- Capability registry for tool/capability discovery
- PLC-style validation pipeline is extensible
- Llama supervisor pattern can be generalized for other providers

### Custom Tools

| System | Mechanism | Effort |
|--------|-----------|--------|
| OpenClaw | SKILL.md + JSON actions | Low (declarative) |
| Hermes | MCP servers + toolset definitions | Medium (requires MCP server or tool def) |
| NPR-local | Capability registry + language policy | Medium (requires CJS module + registration) |

### Custom Agents

| System | Mechanism | Effort |
|--------|-----------|--------|
| OpenClaw | Subagent spawn with context modes | Low (built-in) |
| Hermes | Python RPC between agents | Medium (requires Python) |
| NPR-local | Supervisor component registration | Medium (requires CJS module + adapter) |

---

## 6. Summary Comparison Table

| Category | OpenClaw | Hermes | NPR-local |
|----------|----------|--------|-----------|
| **Language** | Node.js | Python | Node.js (CJS) |
| **Philosophy** | Gateway-first | Agent-first | Gateway-first + NPR semantics |
| **License** | Proprietary | MIT | MIT (implied) |
| **Core pattern** | Gateway orchestrates everything | Agent loop with optional gateway | Gateway with NPR cycle semantics |
| **Memory** | File-based (MEMORY.md) | FTS5 + cross-session search | śūnya-context (25 files) |
| **Skills** | SKILL.md, human-authored | Auto-generated + agentskills.io | Capability registry, NPR patterns |
| **Learning** | None | Closed loop (create→use→improve) | Static (NPR cycles as process) |
| **Tools** | ~15 core + skills | 40+ built-in + MCP | 1 (tool-00) + NPR-specific |
| **MCP** | ✅ | ✅ | ❌ (planned) |
| **Multi-agent** | Subagent tree | Subagent + Python RPC | Supervisor components |
| **Model providers** | 7+ unified | 8+ unified | llama.cpp only |
| **Model switching** | Per-session config | `/model` command | Config file only |
| **Local inference** | llama.cpp, Ollama | llama.cpp via Ollama | llama-server (external) |
| **Messaging** | 5 platforms | 7 platforms + CLI TUI | None yet |
| **Cron** | ✅ | ✅ | ❌ (planned) |
| **Cron delivery** | Any platform | Any platform | N/A |
| **Deployment** | Gateway process | VPS, GPU, serverless (Daytona/Modal) | Single process, local only |
| **Config** | JSON + workspace files | CLI + config file + env vars | JS config + env + śūnya-context |
| **Extensibility** | High (skills, tools, providers) | High (MCP, toolsets, providers) | Medium (supervisor, eventbus) |
| **Modularity** | High (gateway-only mode) | Medium (monolithic agent) | Medium (component lifecycle) |
| **Security model** | Policy filter + approval patterns | Command allowlist + approval | Language policy + capability registry |
| **State management** | Gateway state machine | Agent context management | Supervisor state machine |
| **Health monitoring** | Provider health checks | Connection monitoring | Full component health + auto-restart |
| **Recovery** | Session reconnect | Context compression | Component auto-restart, gateway recovery |

---

## 7. NPR-local Implications: What to Adopt, Adapt, Avoid

### ✅ Adopt From OpenClaw

1. **Gateway as orchestrator** — NPR-local already does this correctly. The gateway should remain the single point of truth for all component lifecycle, session management, and routing.

2. **Session state machine** — OpenClaw's explicit session states (init → connecting → running → reconnecting → stopped) provide clarity. NPR-local should formalize session lifecycle beyond the current implicit model.

3. **Model provider abstraction** — Even though NPR-local is local-first, the provider abstraction pattern from OpenClaw should be used. This allows future hot-swapping between llama.cpp backends without architecture changes.

4. **Policy filter pattern** — OpenClaw's tool policy (AGENTS.md rules + runtime filtering) is a clean model for controlling what the agent can do. NPR-local's `language-policy.cjs` should evolve in this direction.

5. **Skills as self-contained artifacts** — The SKILL.md pattern (self-contained markdown + assets) is superior to Hermes' auto-generated skills for the NPR-local use case where procedural knowledge is carefully curated.

6. **Subagent hierarchy** — OpenClaw's tree-based subagent model with push-based descendant results is cleaner than Hermes' flat RPC model for NPR-local's component architecture.

### ✅ Adopt From Hermes

1. **FTS5 session search** — OpenClaw's file-based memory is insufficient for cross-session recall. NPR-local should implement FTS5 (SQLite full-text search) for session history, mirroring Hermes' approach.

2. **Context compression** — Hermes' `/compress` command for managing context window is essential. NPR-local's śūnya-context loading is static; dynamic compression is needed.

3. **Skill auto-generation trigger** — While NPR-local won't fully adopt Hermes' self-improving agent loop, the *trigger pattern* (complex task → consider skill creation) is worth borrowing as a suggestion system.

4. **Terminal UI** — Hermes' TUI (multiline editing, slash commands, conversation history, streaming output) is significantly more polished than OpenClaw's basic CLI. NPR-local should consider a rich TUI.

5. **Trajectory generation** — Hermes' batch trajectory generation for training data is a research-ready feature that NPR-local could adopt for NPR cycle analysis.

### ⚠️ Adapt (Modify Before Adopting)

1. **NPR cycles as the core loop** — Both OpenClaw and Hermes use conventional agent loops. NPR-local should replace the conventional loop with its Noise→Pattern→Return cycle as the primary processing model. This is the key differentiator.

2. **PLC-style validation** — NPR-local's PLC (Programmable Logic Controller) design is unique. Neither OpenClaw nor Hermes has hardware-level validation patterns. Keep this but make it pluggable.

3. **śūnya-context as identity** — The 25-file, ~3000-line śūnya-context is NPR-local's version of OpenClaw's SOUL.md + MEMORY.md + AGENTS.md. Formalize this into a structured identity system rather than raw file loading.

4. **Geowon memory gateway** — The separate port (17004) for memory is an interesting pattern. Consider whether this should be an in-process module (like OpenClaw) or remain a separate HTTP endpoint (current design). The separate process allows independent scaling but adds complexity.

5. **Component lifecycle from Supervisor** — NPR-local's supervisor is more sophisticated than either OpenClaw or Hermes in its component lifecycle management (auto-restart, health checks, state machine). Preserve this strength.

### ❌ Avoid

1. **Hermes' monolithic agent loop** — Do not let the agent become the central orchestrator. The gateway must remain primary. Hermes' approach couples too many concerns (memory, skills, user profiling) into the agent loop.

2. **Auto-generated skills without curation** — Hermes' skill auto-generation can produce low-quality artifacts. NPR-local should keep the curated, human-authored skill model from OpenClaw.

3. **Python dependency** — Hermes is Python-based, which adds dependency complexity. NPR-local's pure Node.js/CJS approach is cleaner for the local-first, no-install philosophy.

4. **Over-engineered messaging** — Both systems support 5-7 messaging platforms. NPR-local should focus on being the best local runtime first, then add messaging as an optional layer later. Don't bolt on Telegram/Discord before the core is solid.

5. **Cloud provider lock-in patterns** — Neither system should influence NPR-local toward cloud dependencies. The `llama-server` external process pattern is correct — keep inference local and independent.

---

## 8. Recommended Architecture for NPR-local v1

Based on this comparison, NPR-local should evolve toward this structure:

```
┌──────────────────────────────────────────────────────────────┐
│                   NPR-local Gateway (:5017)                  │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Supervisor     │  │  EventBus       │  │  Runtime     │ │
│  │  (lifecycle +   │  │  (decoupled     │  │  Monitor     │ │
│  │   health +      │  │   component     │  │  (SSE +      │ │
│  │   auto-restart) │  │   comm)         │  │   snapshots) │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Session        │  │  Context        │  │  Llama       │ │
│  │  Manager        │  │  Hypervisor     │  │  Supervisor  │ │
│  │  (state machine)│  │  (NPR cycles +  │  │  (external   │ │
│  │                 │  │   śūnya)        │  │   llama-srv) │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│                                                              │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │  Tool-00        │  │  Language       │  │  Capability  │ │
│  │  (validation)   │  │  Policy         │  │  Registry    │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────┘
              │                       │                       │
     ┌────────┴───────┐      ┌───────┴────────┐     ┌───────┴──────┐
     │ Geowon Memory  │      │ Config Server  │     │ llama-server │
     │ (:17004)       │      │ (:17010)       │     │ (:8765)      │
     │ FTS5 + JSON    │      │ UI + config    │     │ external     │
     └────────────────┘      └────────────────┘     └──────────────┘
```

### Priority Implementation Order

1. **Session Manager** — Formalize session lifecycle with state machine (adopt from OpenClaw)
2. **FTS5 Memory Search** — Add SQLite FTS5 to Geowon for cross-session recall (adopt from Hermes)
3. **Context Compression** — Dynamic śūnya-context management, not just static loading (adapt from Hermes)
4. **Model Provider Abstraction** — Even local-only, prepare for llama.cpp backend switching (adopt from OpenClaw)
5. **Skill System** — Structured skill format with NPR cycle semantics (adapt from both)
6. **Cron/Scheduler** — Scheduled NPR cycles with delivery (adopt from both)
7. **Terminal UI** — Rich TUI with slash commands (adopt from Hermes)
8. **MCP Support** — External tool server integration (adopt from both)
9. **Messaging Gateway** — Platform bridges (adopt from both, but as optional layer)

---

## 9. Conclusions

**NPR-local should remain gateway-first.** The supervisor pattern with component lifecycle management is superior to Hermes' monolithic agent loop for the use case of a local, observable, recoverable runtime.

**The key innovation is the NPR cycle semantics.** Neither OpenClaw nor Hermes processes input through Noise→Pattern→Return. This is NPR-local's differentiator and should be the foundation, not an afterthought.

**Borrow selectively.** OpenClaw for gateway orchestration patterns, Hermes for memory/search and context management. Avoid both systems' cloud-centric assumptions and auto-generation overreach.

**The śūnya-context is the soul.** Formalize it into a structured identity system rather than leaving it as raw file loading. This is NPR-local's version of OpenClaw's AGENTS.md + SOUL.md + MEMORY.md, and it should be treated with equal architectural importance.

---

*Document generated for NPR-local architecture research.*
*Sources: OpenClaw docs (/home/claw/.local/lib/node_modules/openclaw/docs/), NPR-local codebase, Hermes README + docs (NousResearch/hermes-agent).*
