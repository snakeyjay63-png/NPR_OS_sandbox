// @net 10.03.0.0/24
// ═══════════════════════════════════════════════════
// agent/loop.js — Single Agent Loop
// ═══════════════════════════════════════════════════
// One agent. Local model. No external channels.
// Receive → route → respond → log → 0.0.0.0
// ═══════════════════════════════════════════════════

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const EventEmitter = require('events');
const { nprRoute, getPhaseContext } = require('../field/npr');
const { fullScan, quickScan, scheduleScan } = require('../sources/system-scan');
const { selectByGoal, listCapabilities } = require('../routes/capabilities');
const { scanWorkspace, buildContextString } = require('../workspace-context');
const { ContextBreath } = require('./context-breathe');
const { parseToolCalls, detectResponseType, toolCallHash } = require('./tool-call-parser');
const { ToolLoopGuard } = require('./tool-loop-guard');
const { ToolRegistry } = require('../capability-registry.cjs');

// Shared tool registry instance (capability policy engine)
const toolRegistry = new ToolRegistry();

// ─── Agent Event Sink (OpenClaw pattern: agent-loop.ts) ───
// Lifecycle events: agent_start → turn_start → message_start/end → tool_* → turn_end → agent_end
// Emissie is sync-friendly: handlers zijn async maar blocken de loop niet

class AgentEventSink extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(20);
    this.events = []; // buffered history for debugging
  }

  // @addr 10.03.2.1 | fd00:npr:0002:001::1 — event emit
  async emit(type, data = {}) {
    const event = { type, timestamp: Date.now(), ...data };
    this.events.push(event);
    // Keep last 100 events in buffer
    if (this.events.length > 100) {
      this.events = this.events.slice(-100);
    }
    // Sync emit — loop waits for handlers (matches OpenClaw pattern)
    this.emitRaw(event);
    return event;
  }

  emitRaw(event) {
    super.emit(event.type, event);
  }

  // Get buffered events (for /agent/debug, SSE streaming)
  getEvents() {
    return [...this.events];
  }

  // Clear buffer
  clear() {
    this.events = [];
  }
}

// ─── Agent Loop Config (OpenClaw pattern: AgentLoopConfig) ───
// Hoofden die per-turn gedrag sturen zonder de loop te breken

const defaultLoopConfig = {
  // Stop na één turn? (default: nee, loop tot geen tool-calls meer)
  shouldStopAfterTurn: null,
  // Voorbereid volgende turn (context/model/thinking aanpassen)
  prepareNextTurn: null,
  // Voer tool-call uit (before hook)
  beforeToolCall: null,
  // Tool-call resultaat verwerken (after hook)
  afterToolCall: null,
  // Max tool-calls per turn (veiligheid)
  maxToolCallsPerTurn: 10,
  // Max turns per agent-loop (veiligheid)
  maxTurnsPerLoop: 20,
  // Tool-loop guard config
  loopGuard: {
    windowSize: 10,
    maxRepeat: 3,
    maxPingPong: 3,
    maxTotalCalls: 30,
    mode: 'block', // warn | block | reflect | halt
  },
  // Auto-stop when model returns plain text (no tool calls)
  autoStopOnText: true,
  // Persist session state to disk after each turn
  persistSession: true,
};

// Session retention: auto-delete sessions older than X days
const SESSION_RETENTION_DAYS = parseInt(process.env.SESSION_RETENTION_DAYS) || 7;

// ─── Runtime Config (hoisted for buildSystemPrompt) ───

const MODEL_NAME = process.env.MODEL_NAME || 'Qwen3.6-27B-Q4_K_M.gguf';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 2048;
const GEOWON_PORT = parseInt(process.env.GEOWON_PORT) || 17004;
const MODEL_API = process.env.MODEL_API || 'http://127.0.0.1:8765/v1/chat/completions';
const GEOWON_API = process.env.GEOWON_API || `http://127.0.0.1:${GEOWON_PORT}`;
const MAX_HISTORY = 20;

// ─── Load Balancer (deferred require to avoid circular) ───
// Lazily resolve the endpoint getter at call time
let _endpointGetter = null;
function getEndpointGetter() {
  if (!_endpointGetter) {
    try {
      const m = require('../routes/models');
      _endpointGetter = m.getNextEndpointByStrategy || (() => MODEL_API);
    } catch {
      _endpointGetter = () => MODEL_API;
    }
  }
  return _endpointGetter;
}

// ─── Daily Memory Cache (avoids re-reading every turn) ───
let dailyMemoryCache = { data: null, timestamp: 0 };
const DAILY_MEMORY_TTL = 5 * 60 * 1000; // 5 min cache TTL

/**
 * Get daily memory context (today + yesterday)
 * Cached for 5 minutes to avoid excessive disk reads
 */
function getDailyMemoryContext() {
  const now = Date.now();
  if (dailyMemoryCache.data && (now - dailyMemoryCache.timestamp) < DAILY_MEMORY_TTL) {
    return dailyMemoryCache.data;
  }

  try {
    const daily = require('./../memory/daily');
    const recent = daily.readRecentDailies();
    dailyMemoryCache = {
      data: recent,
      timestamp: now,
    };
  } catch (e) {
    dailyMemoryCache = {
      data: { today: '', yesterday: '' },
      timestamp: now,
    };
  }

  return dailyMemoryCache.data;
}

// ─── Auto Memory Write (post-turn) ───
// Writes a lightweight daily entry after each agent turn
// @addr 10.03.2.5 | fd00:npr:0003:001::5 — memory auto-write
let lastPromoteCycle = 0;
const PROMOTE_INTERVAL = 60 * 60 * 1000; // max 1x per hour

/**
 * Write a daily entry summarizing the agent turn
 * Lightweight — runs in background, doesn't block response
 */
async function writeDailyEntryForTurn(sessionId, userMessage, assistantResponse, toolTrace) {
  try {
    const daily = require('./../memory/daily');
    const now = new Date().toLocaleTimeString('nl-NL', { timeZone: 'Europe/Amsterdam', hour12: false });
    
    // Truncate for brevity
    const userShort = (userMessage || '').slice(0, 200);
    const assistantShort = (assistantResponse || '').slice(0, 300);
    const toolCount = toolTrace ? toolTrace.filter(t => !t.error).length : 0;
    
    const entry = {
      type: 'agent-turn',
      title: `Turn: ${userShort.slice(0, 60)}${userShort.length > 60 ? '…' : ''}`,
      content: [assistantShort].join('\n'),
      tags: toolCount > 0 ? [`tools:${toolCount}`] : [],
    };
    
    daily.writeDailyEntry(entry);
    
    // Invalidate cache so next read picks up new content
    dailyMemoryCache = { data: null, timestamp: 0 };
  } catch (e) {
    // Silent fail — memory write should never break the agent loop
    // console.debug('[memory] auto-write failed:', e.message);
  }
}

/**
 * Run auto-promote cycle (throttled to 1x per hour)
 * Runs in background after agent loop completes
 */
async function runAutoPromote() {
  const now = Date.now();
  if (now - lastPromoteCycle < PROMOTE_INTERVAL) {
    return; // throttle
  }
  lastPromoteCycle = now;
  
  try {
    const autoPromote = require('./../memory/auto-promote');
    const result = autoPromote.runPromoteCycle({
      daysBack: 14,
      minCount: 3,
      maxPromote: 3,
    });
    
    if (result.promoted && result.promoted.length > 0) {
      console.log(`[memory] auto-promote: ${result.promoted.length} topics promoted`);
    }
  } catch (e) {
    // Silent fail
    // console.debug('[memory] auto-promote failed:', e.message);
  }
}

// ─── System Prompt Builder ───

// @addr 10.03.3.1 | fd00:npr:0003:003::1 — system prompt builder
function buildSystemPrompt(route, workspaceContext = null, breathRoute = null) {
  const parts = [];

  // Extract correct fields from route object
  const slot = route.pattern?.slot ?? 'unknown';
  const digitalRoot = route.pattern?.digitalRoot ?? 0;
  const phase = route.phase ?? (digitalRoot ? `dr-${digitalRoot}` : 'unknown');

  // Phase-specific context
  const phaseInfo = getPhaseContext(phase);

  // Context breath role
  const breathRole = breathRoute?.role ?? null;
  const breathAddr = breathRoute?.route?.addr ?? '0x000000';

  parts.push(`Je bent NPR Local v0.0.1 — single-agent, local-only runtime.
Oorsprong: 0.0.0.0. Route via digitale root. Geen decimale routes.

## Hoe Je Werkt
- Lokaal model: ${MODEL_NAME} op :8765
- NPR routing: hash → slot (${slot}) → fase (${phase})
- Memory: geowon op :${GEOWON_PORT} (event-driven, disk-backed)
- Token budget: ${MAX_TOKENS} per turn
- Alles lokaal — geen externe API calls
${breathRole ? `\n## Actuele Rol: ${breathRole.name} ${breathRole.emoji}\n- Routing: ${breathAddr}\n${breathRoute.systemPrompt ?? ''}` : ''}
## Huidige Fase: ${phaseInfo?.name || phase}
${phaseInfo?.description || 'NPR routing actief.'}
${phaseInfo?.tools ? 'Beschikbare fase-tools: ' + phaseInfo.tools.join(', ') : ''}

## Tools
- tool:scan — systeem scannen (quick of --full)
- tool:scan --save — bewaar scan naar ~/.openclaw/npr-local/scans/
- tool:capabilities — alle capabilities tonen
- tool:select <doel> — wiskundige selectie via digitale root
- tool:workspace — workspace info (optioneel: --scan, --full)
- tool:read <pad> — bestand inhoud ophalen (injecteert in context)
- tool:write <pad> <inhoud> — bestand schrijven (workspace only)
- tool:edit {"path":"...","oldText":"...","newText":"..."} — bestand bewerken
- tool:exec <command> — shell command (30s timeout)
- tool:web-fetch <url> — webpagina ophalen (GET/POST)
- tool:web-fetch --url=<url> --method=POST --body=... --raw
- tool:echo <message> — echo test
- tool:memory <query> — zoeken in memory files
- tool:hex_encode <text> — text → hex + digitale root
- tool:npr_trace <input> — NPR routing trace

## Capabilities (digitale root 1-9)
1=Identiteit | 2=Communicatie | 3=Analyse | 4=Structuur
5=Creatie | 6=Integratie | 7=Reflectie | 8=Optimalisatie | 9=Transformatie

## Antwoord Stijl
- Taal: Nederlands of Engels, volg gebruiker
- Direct en concreet — geen vuller
- Toon actuele context: bestanden, systeem, routing
- Geen halve antwoorden — als je iets niet weet, zeg het
- Je hebt toegang tot lokaal bestandssysteem via tools

## Chat = Terminal
- Deze chat IS de terminal. Geen aparte CLI nodig.
- Als gebruiker vraagt over code/structuur/bestanden: scan direct lokaal
- Werkruimte: /home/claw/.openclaw/workspace
- NPR sandbox: /home/claw/.openclaw/workspace/NPR_OS_sandbox
- Geen "geef het pad op" — je weet waar de bestanden zitten

Huidige route: slot ${slot}, fase ${phase}.`);

  // Inject workspace context if available
  if (workspaceContext) {
    parts.push(`
## Actuele Workspace
${workspaceContext}

Gebruik deze context als gebruiker over bestanden, projecten, of mappen praat.
Als de vraag niet relevant is voor deze workspace, negeer deze sectie.`);
  }

  // Inject daily memory context (today + yesterday)
  const dailyMem = getDailyMemoryContext();
  if (dailyMem.today || dailyMem.yesterday) {
    const memParts = [];
    if (dailyMem.today) {
      memParts.push(`### Vandaag (${dailyMem.todayDate})
${dailyMem.today.slice(0, 1500)}`);
    }
    if (dailyMem.yesterday) {
      memParts.push(`### Gisteren (${dailyMem.yesterdayDate})
${dailyMem.yesterday.slice(0, 1000)}`);
    }
    parts.push(`
## Dagelijks Geheugen
${memParts.join('\n\n')}

Dit is je dagelijkse geheugen. Gebruik het als context voor recente gesprekken.
Als er niets relevant is, negeer deze sectie.`);
  }

  return parts.join('\n');
}

// ─── Session Memory (in-memory, disk-backed later) ───

const sessions = new Map();
let currentWorkspace = process.env.NPR_WORKSPACE || null;

// ─── Context Breath (Patanjali 1.5 — viveka/discriminatie) ───
// Dynamisch context ademen: omhoog (comprimeer) / omlaag (expandeer)
let contextBreath = null;

function getContextBreath() {
  if (!contextBreath) {
    contextBreath = new ContextBreath({
      memoryDir: path.join(currentWorkspace || process.cwd(), 'memory'),
      compressAt: 8000,
      expandAt: 2000,
      maxActiveBlocks: 6,
    });
  }
  return contextBreath;
}

// Session ID: prefix + 16 hex chars (8 bytes)
const SESSION_PREFIX = 'sess';
const SESSION_HEX_LEN = 16;

// @addr 10.03.0.1 | fd00:npr:0003:000::1 — session ID generator
function generateSessionId() {
  return `${SESSION_PREFIX}_${crypto.randomBytes(SESSION_HEX_LEN / 2).toString('hex')}`;
}

// @addr 10.03.0.2 | fd00:npr:0003:000::2 — session ID validator
function validateSessionId(id) {
  if (typeof id !== 'string') return false;
  if (id.length < 4 || id.length > 128) return false;
  // Allow alphanumeric, underscore, hyphen
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return false;
  return true;
}

// @addr 10.03.3.2 | fd00:npr:0003:003::2 — session getter
function getSession(id, options = {}) {
  if (!validateSessionId(id)) {
    // Generate a new valid ID if the provided one is invalid
    id = generateSessionId();
    console.warn(`[agent] Ongeldige session ID, gegenereerd: ${id}`);
  }
  if (!sessions.has(id)) {
    const newSession = { id, turns: 0, createdAt: Date.now() };

    // Load from disk first (fast, local)
    const diskHistory = loadSessionFromDisk(id);
    if (diskHistory && diskHistory.length > 0) {
      newSession.history = diskHistory;
      if (diskHistory.turns) newSession.turns = diskHistory.turns;
      console.log(`[agent] Loaded ${diskHistory.messages?.length || diskHistory.length} messages from disk for ${id}`);
    }

    sessions.set(id, newSession);

    // Async: load history from geowon if requested and no disk history
    if (options.loadHistory && (!newSession.history || newSession.history.length === 0)) {
      loadFromGeowon(id).then(history => {
        if (history.length > 0) {
          newSession.history = history;
          console.log(`[agent] Loaded ${history.length} messages from geowon for ${id}`);
        }
      });
    }
  }
  return sessions.get(id);
}

// ─── Session Management ───

// @addr 10.03.1.1 | fd00:npr:0003:001::1 — list sessions
function listSessions() {
  const result = [];
  for (const [id, session] of sessions) {
    result.push({
      id,
      turns: session.turns || 0,
      historyLength: session.history?.length || 0,
      createdAt: session.createdAt,
      lastActivity: session.history?.length ? session.history[session.history.length - 1].timestamp : session.createdAt,
    });
  }
  return result.sort((a, b) => b.lastActivity - a.lastActivity);
}

// @addr 10.03.3.3 | fd00:npr:0003:003::3 — fork session
function forkSession(sourceId, newId = `fork-${Date.now()}`) {
  const source = sessions.get(sourceId);
  if (!source) return null;

  const forked = {
    id: newId,
    turns: 0,
    history: [], // new session, starts empty
    forkedFrom: sourceId,
    createdAt: Date.now(),
  };
  sessions.set(newId, forked);
  return forked;
}

// @addr 10.03.3.4 | fd00:npr:0003:003::4 — merge sessions
function mergeSessions(targetId, sourceId) {
  const target = sessions.get(targetId);
  const source = sessions.get(sourceId);
  if (!target || !source) return { error: 'Session not found' };

  if (!target.history) target.history = [];
  if (!source.history) source.history = [];

  // Merge source history into target
  const merged = [...target.history, ...source.history];
  target.history = merged;
  target.turns = (target.turns || 0) + (source.turns || 0);
  target.mergedWith = sourceId;

  // Remove source
  sessions.delete(sourceId);

  return {
    success: true,
    targetId,
    mergedTurns: target.turns,
    mergedHistoryLength: target.history.length,
  };
}

// ─── Agent Turn ───

// ─── Local Model (llama.cpp :8765) ───

// (constants hoisted to top for buildSystemPrompt)

// ─── Geowon Memory (event-driven, disk-backed) ───

// (constants hoisted to top)

// ─── Canonical Message Schema ───
// Shared between local memory, Geowon, and sync events
// { role, content, timestamp, route?, slot?, phase?, partial? }

// @addr 10.03.0.3 | fd00:npr:0003:000::3 — message canonicalizer
function canonicalMessage(role, content, meta = {}) {
  return {
    role,
    content,
    timestamp: Date.now(),
    ...meta,
  };
}

// ─── Geowon Sync (bidirectional) ───

// @addr 10.03.1.2 | fd00:npr:0003:001::2 — geowon sync (write)
async function syncToGeowon(sessionId, data) {
  try {
    await fetch(`${GEOWON_API}/session/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  } catch(e) {
    // Geowon offline = no problem, in-memory still works
    console.warn(`[agent] geowon sync failed: ${e.message}`);
  }
}

// @addr 10.03.1.3 | fd00:npr:0003:001::3 — geowon sync (read)
async function loadFromGeowon(sessionId) {
  try {
    const res = await fetch(`${GEOWON_API}/session/${sessionId}`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch(e) {
    console.warn(`[agent] geowon readback failed: ${e.message}`);
    return [];
  }
}

// @addr 10.03.1.4 | fd00:npr:0003:001::4 — geowon turn sync
async function syncTurnToGeowon(sessionId, userMsg, assistantMsg, route) {
  const slot = route.pattern?.slot ?? 'unknown';
  const phase = route.phase ?? `dr-${route.pattern?.digitalRoot ?? 0}`;
  const meta = { route: route.pattern, slot, phase };

  // Sync both user and assistant as a pair
  syncToGeowon(sessionId, canonicalMessage('user', userMsg, meta));
  syncToGeowon(sessionId, canonicalMessage('assistant', assistantMsg, meta));
}

// @addr 10.03.3.5 | fd00:npr:0003:003::5 — model call
// Fallback models: tried in order if primary fails
const MODEL_FALLBACKS = process.env.MODEL_FALLBACKS
  ? process.env.MODEL_FALLBACKS.split(',')
  : [];

async function callModel(messages, options = {}) {
  const { timeout = 120000, retry = 1, maxTokens = 2048, model } = options;
  const modelsToTry = [
    model || MODEL_NAME,
    ...MODEL_FALLBACKS.filter(m => m !== (model || MODEL_NAME)),
  ];

  for (const modelName of modelsToTry) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const startMs = Date.now();

    for (let attempt = 0; attempt <= retry; attempt++) {
      try {
        console.log(`[model] ${modelName} (poging ${attempt + 1}/${retry + 1})`);
        const res = await fetch(MODEL_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: modelName,
            messages,
            temperature: 0.3,
            max_tokens: maxTokens,
            enable_thinking: false,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
        }

        const data = await res.json();
        const msg = data.choices?.[0]?.message;
        // Sommige modellen (Qwen3.6) retourneren alleen reasoning_content
        const content = msg?.content || msg?.reasoning_content || '';

        if (!content || typeof content !== 'string') {
          throw new Error(`Ongeldig model response formaat: ${JSON.stringify(data).slice(0, 200)}`);
        }

        // Record metrics
        const elapsedMs = Date.now() - startMs;
        const tokenCount = data.usage?.completion_tokens || content.split(/\s+/).length;
        try { require('../routes/models').recordInference(modelName, tokenCount, elapsedMs, true); } catch {};

        return { content, model: modelName };
      } catch (e) {
        if (attempt < retry) {
          console.warn(`[model] ${modelName} poging ${attempt + 1} faalde, retry...: ${e.message}`);
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
        } else {
          clearTimeout(timer);
          const errMsg = e.name === 'AbortError'
            ? `Model timeout na ${timeout/1000}s`
            : e.message;
          console.warn(`[model] ${modelName} faalde: ${errMsg}`);
          // Record failed metrics
          const elapsedMs = Date.now() - startMs;
          try { require('../routes/models').recordInference(modelName, 0, elapsedMs, false); } catch {};
          // Continue to next fallback model
          break;
        }
      }
    }
  }

  // All models failed
  throw new Error(`Alle modellen faalde: ${modelsToTry.join(', ')}`);
}

// Streaming call to llama-server
// @addr 10.03.3.6 | fd00:npr:0003:003::6 — model stream
async function* callModelStream(messages, options = {}) {
  const { timeout = 120000, model, maxTokens = 2048 } = options;
  const activeModel = model || MODEL_NAME;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const startMs = Date.now();
  let tokenCount = 0;

  // Resolve endpoint via load balancer
  const getter = getEndpointGetter();
  const targetBase = getter('round-robin');
  const targetApi = targetBase.replace(/\/$/, '') + '/v1/chat/completions';

  try {
    const res = await fetch(targetApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: activeModel,
        messages,
        temperature: 0.3,
        max_tokens: maxTokens,
        stream: true,
        enable_thinking: false,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const token = json.choices?.[0]?.delta?.content;
            if (token) {
              tokenCount++;
              yield token;
            }
          } catch {}
        }
      }
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }

    // Record metrics on successful stream completion
    const elapsedMs = Date.now() - startMs;
    try { require('../routes/models').recordInference(activeModel, tokenCount, elapsedMs, true); } catch {}

  } catch (e) {
    clearTimeout(timer);
    // Record failed metrics
    const elapsedMs = Date.now() - startMs;
    try { require('../routes/models').recordInference(activeModel, tokenCount, elapsedMs, false); } catch {}
    if (e.name === 'AbortError') {
      throw new Error(`Stream timeout na ${timeout/1000}s`);
    }
    throw e;
  }
}

// ─── Agent Loop (OpenClaw pattern: agent-loop.ts) ───
// Two-loop structuur:
//   - Buitenste loop: follow-up turns (context/model/thinking aanpassen)
//   - Binnenste loop: tool-calls per turn (tot geen tool-calls meer)
// Lifecycle events: agent_start → turn_start → message_start/end → tool_* → turn_end → agent_end

// @addr 10.03.2.2 | fd00:npr:0003:001::2 — create agent event sink
function createAgentEventSink() {
  return new AgentEventSink();
}

// @addr 10.03.1.5 | fd00:npr:0003:001::5 — agent turn (single turn, no loop)
async function agentTurn(sessionId, input, options = {}) {
  const { maxTokens, dryRun } = options;
  const session = getSession(sessionId, { loadHistory: true });
  session.turns++;

  // Tool detection FIRST
  if (input.startsWith('tool:')) {
    return await handleTool(sessionId, input);
  }

  // NPR route the input
  const route = nprRoute(input);

  // Get workspace context (async, non-blocking)
  let workspaceContext = null;
  try {
    if (currentWorkspace) {
      const ctx = await scanWorkspace(currentWorkspace);
      workspaceContext = buildContextString(ctx);
    }
  } catch (e) {
    console.error(`[agent] Workspace scan failed: ${e.message}`);
  }

  // Context breath: determine role for this input
  const breathRoute = getContextBreath().route(input);

  // Build context: system + history + current input
  const sysMsg = {
    role: 'system',
    content: buildSystemPrompt(route, workspaceContext, breathRoute),
  };

  const history = (session.history || []).slice(-MAX_HISTORY).map(h => ({
    role: h.role || 'user',
    content: h.content || h.input,
  }));

  history.push({ role: 'user', content: input });

  // Call local model (skip on dryRun — test routing only)
  let modelResponse, usedModel;
  if (maxTokens !== undefined) {
    const res = await callModel([sysMsg, ...history], { maxTokens });
    modelResponse = res?.content || res; usedModel = res?.model;
  } else if (!dryRun) {
    const res = await callModel([sysMsg, ...history]);
    modelResponse = res?.content || res; usedModel = res?.model;
  } else {
    modelResponse = '[dryRun] routing OK, model call skipped';
    usedModel = MODEL_NAME;
  }

  // Log + sync to geowon (event-driven)
  if (!session.history) session.history = [];
  session.history.push(canonicalMessage('user', input));
  session.history.push(canonicalMessage('assistant', modelResponse));

  // Sync full turn (user + assistant) to geowon
  syncTurnToGeowon(sessionId, input, modelResponse, route);

  return {
    session: sessionId,
    turn: session.turns,
    input,
    route,
    breath: {
      role: breathRoute.role.id,
      addr: breathRoute.route.addr,
      levels: breathRoute.route.levels,
    },
    response: modelResponse,
    model: usedModel || MODEL_NAME,
    origin: '0.0.0.0',
  };
}

// @addr 10.03.2.3 | fd00:npr:0003:001::3 — run single agent loop
// Full OpenClaw pattern: two-loop with events, tool lifecycle, config hooks
// Enhanced: structured tool-call parsing, loop guard, halt_reason, session persist
async function runAgentLoop(sessionId, input, loopConfig = {}) {
  const config = { ...defaultLoopConfig, ...loopConfig };
  const sink = createAgentEventSink();
  const session = getSession(sessionId, { loadHistory: true });

  // Tool-loop guard (loop-wide, not per-turn)
  const guard = new ToolLoopGuard(config.loopGuard || {});

  // Track full tool-call trace for replay
  const toolTrace = [];

  // Emit agent_start
  await sink.emit('agent_start', { sessionId, input });

  let turnCount = 0;
  let followUpInput = input;
  let lastResponse = null;
  let haltReason = null;

  // ─── Buitenste loop: follow-up turns ───
  while (!haltReason) {
    turnCount++;
    if (turnCount > config.maxTurnsPerLoop) {
      haltReason = 'max_turns_reached';
      await sink.emit('agent_end', {
        sessionId,
        reason: haltReason,
        turns: turnCount,
      });
      return {
        session: sessionId,
        error: `max turns (${config.maxTurnsPerLoop}) reached`,
        turns: turnCount,
        halt_reason: haltReason,
        tool_trace: toolTrace,
        guard_state: guard.getState(),
        events: sink.getEvents(),
        origin: '0.0.0.0',
      };
    }

    // Prepare next turn (config hook)
    if (config.prepareNextTurn) {
      followUpInput = config.prepareNextTurn(followUpInput, lastResponse, turnCount) ?? followUpInput;
    }

    // Emit turn_start
    await sink.emit('turn_start', { sessionId, turn: turnCount, input: followUpInput });

    // ─── Single turn execution ───
    session.turns++;

    // NPR route
    const route = nprRoute(followUpInput);

    // Workspace context
    let workspaceContext = null;
    try {
      if (currentWorkspace) {
        const ctx = await scanWorkspace(currentWorkspace);
        workspaceContext = buildContextString(ctx);
      }
    } catch (e) {
      console.error(`[agent/loop] Workspace scan failed: ${e.message}`);
    }

    // Context breath: determine role for this input
    const breathRoute = getContextBreath().route(followUpInput);

    // Build messages
    const sysMsg = {
      role: 'system',
      content: buildSystemPrompt(route, workspaceContext, breathRoute),
    };

    const history = (session.history || []).slice(-MAX_HISTORY).map(h => ({
      role: h.role || 'user',
      content: h.content || h.input,
    }));
    history.push({ role: 'user', content: followUpInput });

    // Emit message_start
    await sink.emit('message_start', { sessionId, turn: turnCount });

    // Model call
    let modelResponse, usedModel;
    try {
      const res = await callModel([sysMsg, ...history]);
      modelResponse = res?.content || res; usedModel = res?.model;
    } catch (e) {
      haltReason = 'model_error';
      await sink.emit('turn_end', { sessionId, turn: turnCount, error: e.message });
      await sink.emit('agent_end', { sessionId, turns: turnCount, reason: haltReason });
      return {
        session: sessionId,
        error: `model call failed: ${e.message}`,
        turns: turnCount,
        halt_reason: haltReason,
        tool_trace: toolTrace,
        events: sink.getEvents(),
        origin: '0.0.0.0',
      };
    }

    await sink.emit('message_end', { sessionId, turn: turnCount, response: modelResponse });

    // ─── Binnenste loop: tool-calls ───
    let toolCallCount = 0;
    let toolResponse = modelResponse;

    while (toolCallCount < config.maxToolCallsPerTurn) {
      // Parse tool calls (structured, multi-format)
      const toolCalls = parseToolCalls(toolResponse);
      if (toolCalls.length === 0) break; // no tool calls → stop inner loop

      toolCallCount++;
      const call = toolCalls[0]; // Execute first call per iteration
      const { name: toolName, args: toolArgs, hash: callHash } = call;

      // ─── Tool-loop guard check ───
      const guardResult = guard.checkBefore(toolName, toolArgs);
      if (!guardResult.allowed) {
        if (guardResult.action === 'halt') {
          haltReason = 'loop_guard_halt';
          await sink.emit('tool_guard_halt', {
            sessionId,
            turn: turnCount,
            reason: guardResult.reason,
            message: guardResult.message,
          });
          // Return guard message as response
          toolResponse = guardResult.message;
          break;
        }

        if (guardResult.action === 'block') {
          // Feed reflection back to model instead of executing
          const reflectMsg = guardResult.reflectPrompt || guardResult.message;
          await sink.emit('tool_guard_block', {
            sessionId,
            turn: turnCount,
            reason: guardResult.reason,
            reflect: reflectMsg,
          });

          history.push({ role: 'assistant', content: toolResponse });
          history.push({ role: 'user', content: `⚠ Tool call blocked: ${reflectMsg}` });

          try {
            const res2 = await callModel([sysMsg, ...history]);
            toolResponse = res2?.content || res2;
          } catch (e) {
            toolResponse = `Error: ${e.message}`;
            break;
          }
          continue; // Re-check new response
        }

        // warn/reflect: allow but inject warning
        if (guardResult.reflectPrompt) {
          history.push({ role: 'system', content: guardResult.reflectPrompt });
        }
      }

      // Before tool call hook
      if (config.beforeToolCall) {
        config.beforeToolCall({ toolName, toolArgs, turn: turnCount });
      }

      // Emit tool_execution_start
      await sink.emit('tool_execution_start', {
        sessionId,
        turn: turnCount,
        tool: toolName,
        args: toolArgs,
      });

      // Execute tool
      let toolResult;
      try {
        toolResult = await executeTool(toolName, toolArgs, sessionId);
      } catch (e) {
        toolResult = { error: `tool execution failed: ${e.message}` };
      }

      // Record in guard (after execution)
      guard.record(toolName, toolArgs);

      // Emit tool_execution_end
      await sink.emit('tool_execution_end', {
        sessionId,
        turn: turnCount,
        tool: toolName,
        result: toolResult,
      });

      // After tool call hook
      if (config.afterToolCall) {
        toolResult = config.afterToolCall({ toolName, toolArgs, result: toolResult, turn: turnCount }) ?? toolResult;
      }

      // Record in trace
      toolTrace.push({
        turn: turnCount,
        iteration: toolCallCount,
        tool: toolName,
        args: toolArgs,
        hash: callHash,
        result: toolResult,
        guard: guardResult,
      });

      // Feed tool result back to model for next iteration
      const toolResultMsg = JSON.stringify(toolResult, null, 2);
      history.push({ role: 'assistant', content: toolResponse });
      history.push({ role: 'user', content: `Tool result: ${toolResultMsg}` });

      try {
        const res3 = await callModel([sysMsg, ...history]);
        toolResponse = res3?.content || res3;
      } catch (e) {
        toolResponse = `Error: ${e.message}`;
        break;
      }
    }

    // Store in session (full conversation + tool trace)
    if (!session.history) session.history = [];
    session.history.push(canonicalMessage('user', followUpInput));

    // Store each tool call + result for future context
    for (const t of toolTrace) {
      session.history.push(canonicalMessage('assistant', `→ ${t.tool}(${t.args})`));
      session.history.push(canonicalMessage('system', `[${t.tool}] ${JSON.stringify(t.result)}`));
    }

    session.history.push(canonicalMessage('assistant', toolResponse));

    // Keep history bounded to prevent context bloat
    while (session.history.length > MAX_HISTORY * 2) {
      session.history.shift();
    }

    // Sync to geowon
    syncTurnToGeowon(sessionId, followUpInput, toolResponse, route);

    lastResponse = toolResponse;

    // Emit turn_end
    await sink.emit('turn_end', {
      sessionId,
      turn: turnCount,
      toolsExecuted: toolCallCount,
      response: toolResponse,
    });

    // ─── Auto memory write (background, non-blocking) ───
    writeDailyEntryForTurn(sessionId, followUpInput, toolResponse, toolTrace);

    // ─── Stop conditions ───

    // 1. Custom stop hook
    if (config.shouldStopAfterTurn && config.shouldStopAfterTurn(lastResponse, turnCount)) {
      haltReason = 'custom_stop';
      break;
    }

    // 2. Auto-stop on plain text (no tool calls detected)
    if (config.autoStopOnText) {
      const response = detectResponseType(lastResponse);
      if (response.type === 'text') {
        haltReason = 'text_response';
        break;
      }
    }

    // 3. No auto-stop → loop continues with model output as next input
    //    (only if autoStopOnText is false or tool calls still detected)
  }

  // ─── Session persistence ───
  if (config.persistSession) {
    persistSessionState(sessionId, session, {
      halt_reason: haltReason,
      tool_trace: toolTrace,
      guard_state: guard.getState(),
      turns: turnCount,
    });
  }

  // Emit agent_end
  await sink.emit('agent_end', {
    sessionId,
    turns: turnCount,
    finalResponse: lastResponse,
    halt_reason: haltReason,
  });

  // ─── Auto-promote (background, throttled) ───
  // Runs after agent loop completes, not before return (non-blocking)
  runAutoPromote();

  return {
    session: sessionId,
    turns: turnCount,
    response: lastResponse,
    halt_reason: haltReason,
    tool_trace: toolTrace,
    guard_state: guard.getState(),
    model: usedModel || MODEL_NAME,
    events: sink.getEvents(),
    origin: '0.0.0.0',
  };
}

// @addr 10.03.2.4 | fd00:npr:0003:001::4 — execute tool by name
async function executeTool(toolName, args, sessionId) {
  const session = sessions.get(sessionId);

  // Capability authorization check
  try {
    if (!toolRegistry.canUseTool(toolName)) {
      return {
        error: `Tool '${toolName}' denied by capability policy`,
        tool: toolName,
        denied: true,
        available: toolRegistry.available(),
      };
    }
  } catch (e) {
    // Fallback: allow if registry unavailable
    console.warn(`[agent] Capability check failed: ${e.message}`);
  }

  switch (toolName) {
    case 'scan':
    case '00': {
      const argList = args.split(' ').filter(Boolean);
      const full = argList.includes('--full');
      const save = argList.includes('--save');
      const cron = argList.find(a => a.startsWith('--cron='));
      
      if (cron) {
        const intervalMs = parseInt(cron.split('=')[1]) * 60 * 1000;
        const timer = scheduleScan(intervalMs, full);
        return {
          scheduled: true,
          intervalMs,
          full,
          nextScan: new Date(Date.now() + intervalMs).toISOString(),
          message: `Scan scheduled every ${intervalMs/60000} minutes`,
        };
      }
      const result = full ? await fullScan(save) : quickScan(save);
      result.tool = 'scan';
      result.args = args;
      return result;
    }
    case 'select':
      return {
        tool: 'select',
        goal: args,
        selection: selectByGoal(args),
        note: 'Geen decimale routes. Alles → 0.0.0.0',
      };
    case 'capabilities':
      return {
        tool: 'capabilities',
        capabilities: listCapabilities(),
      };
    case 'workspace': {
      const wsPath = currentWorkspace || process.cwd();
      const argList = args.split(' ').filter(Boolean);
      const result = { tool: 'workspace', path: wsPath, currentWorkspace: wsPath };
      if (argList.includes('--scan')) {
        try {
          const full = argList.includes('--full');
          result.scan = full ? await fullScan(false) : quickScan(false);
        } catch (e) {
          result.scanError = e.message;
        }
      }
      return result;
    }
    case 'read': {
      const fs = require('fs');
      const pathMod = require('path');
      const filePath = args.trim();
      if (!filePath) {
        return { error: 'read: no file path specified', usage: 'tool:read <path>' };
      }
      const fullPath = pathMod.isAbsolute(filePath)
        ? filePath
        : pathMod.resolve(currentWorkspace || process.cwd(), filePath);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        return {
          tool: 'read',
          path: filePath,
          fullPath,
          content,
          lines: content.split('\n').length,
          size: Buffer.byteLength(content, 'utf8'),
        };
      } catch (e) {
        return { error: `read failed: ${e.message}`, path: filePath };
      }
    }
    case 'web-fetch': {
      const http = require('http');
      const https = require('https');
      const argList = args.split(' ').filter(Boolean);
      let targetUrl = null;
      let method = 'GET';
      let body = '';
      let timeout = 15000;
      let raw = false;
      let headers = {};

      for (const arg of argList) {
        if (arg.startsWith('--url=')) targetUrl = arg.slice(6);
        else if (arg.startsWith('--method=')) method = arg.slice(9).toUpperCase();
        else if (arg.startsWith('--body=')) body = arg.slice(7);
        else if (arg.startsWith('--timeout=')) timeout = parseInt(arg.slice(10));
        else if (arg.startsWith('--raw')) raw = true;
        else if (arg.startsWith('--headers=')) {
          try { headers = JSON.parse(arg.slice(10)); } catch {}
        }
        else if (!targetUrl) targetUrl = arg;
      }

      if (!targetUrl) {
        return { error: 'web-fetch: url parameter is vereist', usage: 'tool:web-fetch <url> [--method=GET|POST] [--body=...] [--timeout=15000] [--raw]' };
      }

      let parsedUrl;
      try { parsedUrl = new URL(targetUrl); } catch (e) {
        return { error: `Ongeldige URL: ${e.message}` };
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return { error: `Protocol niet toegestaan: ${parsedUrl.protocol}` };
      }

      const transport = parsedUrl.protocol === 'https:' ? https : http;
      let hostname = parsedUrl.hostname;
      if (hostname.startsWith('[') && hostname.endsWith(']')) {
        hostname = hostname.slice(1, -1);
      }
      const opts = {
        method, hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: { ...headers }, timeout,
        family: hostname.includes(':') ? 6 : undefined,
      };

      return new Promise((resolve) => {
        const start = Date.now();
        const req = transport.request(opts, (res) => {
          let data = '';
          res.on('data', c => { data += c; });
          res.on('end', () => {
            const elapsed = Date.now() - start;
            const result = { tool: 'web-fetch', url: targetUrl, method, status: res.statusCode, elapsed, slot: 'web' };
            if (raw) {
              result.raw = data;
            } else {
              try {
                result.json = JSON.parse(data);
                result.type = 'json';
              } catch {
                result.text = data.length > 2000 ? data.slice(0, 2000) + '\n\n... [geknipt, ' + Buffer.byteLength(data, 'utf8') + ' bytes]' : data;
                result.type = 'text';
              }
            }
            resolve(result);
          });
        });
        req.on('error', e => resolve({ tool: 'web-fetch', error: e.message, code: e.code, url: targetUrl }));
        req.on('timeout', () => { req.destroy(); resolve({ tool: 'web-fetch', error: `Timeout na ${timeout}ms`, url: targetUrl }); });
        if (body) req.write(body);
        req.end();
      });
    }
    case 'echo':
      return { tool: 'echo', message: args, timestamp: new Date().toISOString() };

    case 'memory':
    case 'memory_search': {
      const query = args.trim();
      if (!query) {
        return { error: 'memory: query vereist', usage: 'tool:memory <query>' };
      }
      // Search daily memory files + MEMORY_claw.md
      try {
        const memoryDir = path.join(currentWorkspace || process.cwd(), 'memory');
        const memoryFile = path.join(currentWorkspace || process.cwd(), 'MEMORY_claw.md');
        const results = [];
        const q = query.toLowerCase();

        // Search MEMORY_claw.md
        if (fs.existsSync(memoryFile)) {
          const content = fs.readFileSync(memoryFile, 'utf8');
          const lines = content.split('\n').filter(l => l.toLowerCase().includes(q));
          if (lines.length > 0) {
            results.push({ source: 'MEMORY_claw.md', matches: lines.slice(0, 10).join('\n') });
          }
        }

        // Search daily files
        if (fs.existsSync(memoryDir)) {
          const files = fs.readdirSync(memoryDir)
            .filter(f => f.endsWith('.md'))
            .sort().reverse()
            .slice(0, 7); // last 7 days
          for (const f of files) {
            const content = fs.readFileSync(path.join(memoryDir, f), 'utf8');
            const lines = content.split('\n').filter(l => l.toLowerCase().includes(q));
            if (lines.length > 0) {
              results.push({ source: f, matches: lines.slice(0, 5).join('\n') });
            }
          }
        }

        return { tool: 'memory_search', query, results, count: results.length };
      } catch (e) {
        return { error: `memory search failed: ${e.message}` };
      }
    }

    case 'write':
    case '04': { // 04 = Structure
      const parts = args.split(' ').slice(1); // first word is filename
      let filePath = parts.shift();
      const content = parts.join(' ') || '';

      if (!filePath) {
        return { error: 'write: bestandspad vereist', usage: 'tool:write <pad> <inhoud>' };
      }

      try {
        const fullPath = path.isAbsolute(filePath)
          ? filePath
          : path.resolve(currentWorkspace || process.cwd(), filePath);

        // Security: only allow writing within workspace
        const allowedRoot = path.resolve(currentWorkspace || process.cwd());
        if (!fullPath.startsWith(allowedRoot)) {
          return { error: 'write: pad buiten workspace niet toegestaan' };
        }

        // Create parent dirs
        const dir = path.dirname(fullPath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }

        fs.writeFileSync(fullPath, content, 'utf8');
        return { tool: 'write', path: filePath, fullPath, size: content.length, success: true };
      } catch (e) {
        return { error: `write failed: ${e.message}`, path: filePath };
      }
    }

    case 'edit':
    case '05': { // 05 = Creation
      // Simple edit: { path, oldText, newText } as JSON or "path|old|new" format
      let editData;
      try {
        editData = JSON.parse(args);
      } catch {
        // Fallback: path|oldText|newText (URL-encoded)
        const parts = args.split('|');
        if (parts.length < 3) {
          return { error: 'edit: invalid format', usage: 'tool:edit {"path":"...","oldText":"...","newText":"..."}' };
        }
        editData = { path: parts[0], oldText: parts[1], newText: parts.slice(2).join('|') };
      }

      const { path: editPath, oldText, newText } = editData;
      if (!editPath || oldText === undefined) {
        return { error: 'edit: path + oldText vereist' };
      }

      try {
        const fullPath = path.isAbsolute(editPath)
          ? editPath
          : path.resolve(currentWorkspace || process.cwd(), editPath);

        if (!fs.existsSync(fullPath)) {
          return { error: `edit: bestand niet gevonden: ${editPath}` };
        }

        const content = fs.readFileSync(fullPath, 'utf8');
        if (!content.includes(oldText)) {
          return { error: `edit: oldText niet gevonden in ${editPath}` };
        }

        const newContent = content.replace(oldText, newText);
        fs.writeFileSync(fullPath, newContent, 'utf8');
        return { tool: 'edit', path: editPath, fullPath, success: true };
      } catch (e) {
        return { error: `edit failed: ${e.message}`, path: editPath };
      }
    }

    case 'exec':
    case '06': { // 06 = Integration
      const cmd = args.trim();
      if (!cmd) {
        return { error: 'exec: command vereist', usage: 'tool:exec <command>' };
      }

      const { execSync } = require('child_process');
      try {
        const output = execSync(cmd, {
          cwd: currentWorkspace || process.cwd(),
          timeout: 30000,
          maxBuffer: 1024 * 1024,
          encoding: 'utf8',
        });
        return {
          tool: 'exec',
          command: cmd,
          output: output.length > 2000 ? output.slice(0, 2000) + '\n\n... [geknipt]' : output,
          exitCode: 0,
          success: true,
        };
      } catch (e) {
        return {
          tool: 'exec',
          command: cmd,
          error: e.message,
          exitCode: e.status ?? -1,
          output: e.stdout ? e.stdout.toString() : '',
          stderr: e.stderr ? e.stderr.toString() : '',
          success: false,
        };
      }
    }

    case 'hex_encode':
    case 'hexa': {
      const text = args.trim();
      if (!text) {
        return { error: 'hex_encode: text vereist' };
      }
      const hex = Buffer.from(text, 'utf8').toString('hex');
      const bytes = text.split('').map(c => c.charCodeAt(0).toString(16).padStart(2, '0'));
      return {
        tool: 'hex_encode',
        text,
        hex,
        bytes,
        digitalRoot: (() => {
          let sum = 0;
          for (const b of bytes) sum += parseInt(b, 16);
          let dr = sum % 9 || 9;
          while (dr > 9) dr = dr.toString().split('').reduce((a, b) => a + parseInt(b), 0);
          return dr;
        })(),
      };
    }

    case 'npr_trace':
    case 'trace': {
      const traceInput = args.trim();
      const route = traceInput ? nprRoute(traceInput) : nprRoute('trace-default');
      return {
        tool: 'npr_trace',
        input: traceInput || 'default',
        route: route.pattern,
        slot: route.pattern?.slot,
        phase: route.phase,
        digitalRoot: route.pattern?.digitalRoot,
        nprLogicValue: route.pattern?.nprLogicValue,
      };
    }

    default:
      return { error: `unknown tool: ${toolName}`, available: ['scan', '00', 'select', 'capabilities', 'workspace', 'read', 'web-fetch', 'echo', 'memory', 'write', 'edit', 'exec', 'hex_encode', 'npr_trace'] };
  }
}

// ─── Handler ───

async function handleAgentChat(req, res, ctx) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method not allowed' }));
    return;
  }

  const data = req.body || {};
  const sessionId = validateSessionId(data.sessionId) ? data.sessionId : generateSessionId();
  const input = data.message || data.prompt || data.text || '';

  if (!input) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'no input' }));
    return;
  }

  // Optional: max_tokens override, dryRun to skip model
  const maxTokens = data.maxTokens || data.max_tokens;
  const dryRun = data.dryRun === true;
  const persist = data.persist === true;

  // ─── Use full agent loop (tool-call → execute → re-prompt cycle) ───
  let loopConfig = {
    maxToolCallsPerTurn: 10,
    maxTurnsPerLoop: 20,
    autoStopOnText: true,
    persistSession: persist,
    loopGuard: {
      windowSize: 10,
      maxRepeat: 3,
      maxPingPong: 3,
      maxTotalCalls: 30,
      mode: 'block',
    },
  };

  // dryRun: skip model call entirely (routing test only)
  if (dryRun) {
    // Use simple agentTurn for dry-run (no loop overhead)
    const result = await agentTurn(sessionId, input, { maxTokens, dryRun });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(result, null, 2));
  }

  const loopResult = await runAgentLoop(sessionId, input, loopConfig);

  // Normalize response: preserve backward-compatible shape
  const result = {
    session: loopResult.session,
    turn: loopResult.turns,
    input,
    response: loopResult.response,
    model: loopResult.model,
    origin: loopResult.origin,
    // Loop metadata
    halt_reason: loopResult.halt_reason,
    tool_trace: loopResult.tool_trace,
    guard_state: loopResult.guard_state,
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result, null, 2));
}

// @addr 10.03.1.6 | fd00:npr:0003:001::6 — tool handler
async function handleTool(sessionId, input) {
  // turn already incremented in agentTurn() before calling handleTool
  const [tool, ...args] = input.replace('tool:', '').split(' ');

  let result;
  if (tool === 'scan' || tool === '00') {
    const full = args.includes('--full');
    const save = args.includes('--save');
    const cron = args.find(a => a.startsWith('--cron='));
    
    if (cron) {
      // Schedule recurring scan
      const intervalMs = parseInt(cron.split('=')[1]) * 60 * 1000;
      const timer = scheduleScan(intervalMs, full);
      result = {
        scheduled: true,
        intervalMs,
        full,
        nextScan: new Date(Date.now() + intervalMs).toISOString(),
        message: `Scan scheduled every ${intervalMs/60000} minutes`,
      };
    } else {
      // One-time scan
      result = full ? await fullScan(save) : quickScan(save);
      result.tool = 'scan';
      result.args = args;
      
      if (save && result.savedPath) {
        console.log(`[scan] Saved to: ${result.savedPath}`);
      }
    }
  } else if (tool === 'select') {
    // Wiskundige selectie via doel
    const goal = args.join(' ');
    const selection = selectByGoal(goal);
    result = {
      tool: 'select',
      goal,
      selection,
      note: 'Geen decimale routes. Alles → 0.0.0.0',
    };
  } else if (tool === 'capabilities') {
    // Alle capabilities tonen
    result = {
      tool: 'capabilities',
      capabilities: listCapabilities(),
    };
  } else if (tool === 'workspace') {
    // Workspace info + scan
    const wsPath = currentWorkspace || process.cwd();
    const full = args.includes('--full');
    const scan = args.includes('--scan');
    result = {
      tool: 'workspace',
      path: wsPath,
      currentWorkspace: wsPath,
    };
    if (scan) {
      try {
        const wsScan = full ? await fullScan(false) : quickScan(false);
        result.scan = wsScan;
      } catch (e) {
        result.scanError = e.message;
      }
    }
  } else if (tool === 'read') {
    // Read file content into context
    const filePath = args.join(' ') || (args[0] || '');
    if (!filePath) {
      result = { error: 'read: no file path specified', usage: 'tool:read <path>' };
    } else {
      const fs = require('fs');
      const path = require('path');
      // Resolve relative to workspace or cwd
      const fullPath = path.isAbsolute(filePath) ? filePath : path.resolve(currentWorkspace || process.cwd(), filePath);
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n').length;
        const size = Buffer.byteLength(content, 'utf8');
        result = {
          tool: 'read',
          path: filePath,
          fullPath,
          content: content,
          lines,
          size,
        };
      } catch (e) {
        result = { error: `read failed: ${e.message}`, path: filePath };
      }
    }
  } else {
    result = { error: `unknown tool: ${tool}`, available: ['scan', '00', 'select', 'capabilities', 'workspace', 'read'] };
  }

  return {
    session: sessionId,
    turn: session.turns,
    tool: true,
    result,
    origin: '0.0.0.0',
  };
}

// ─── Streaming Handler (SSE) ───

async function handleAgentChatStream(req, res, ctx) {
  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'method not allowed' }));
    return;
  }

  const data = req.body || {};
  const sessionId = validateSessionId(data.sessionId) ? data.sessionId : generateSessionId();
  const input = data.message || data.prompt || data.text || '';

  if (!input) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'no input' }));
    return;
  }

  // NPR route
  const route = nprRoute(input);

  // P0-3 CORS (localhost only)
  const origin = req.headers.origin || '';
  const corsHeaders = {};
  if (/^(http:\/\/(localhost|127\.0\.0\.1|\[::1\]))(:\d+)?$/.test(origin) || origin === 'null') {
    corsHeaders['Access-Control-Allow-Origin'] = origin;
  }

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    ...corsHeaders,
  });

  // Context breath: determine role for this input
  const breathRoute = getContextBreath().route(input);

  // Send routing info first
  res.write(`data: ${JSON.stringify({
    type: 'route',
    slot: route.pattern?.slot ?? 'unknown',
    phase: route.phase ?? `dr-${route.pattern?.digitalRoot ?? 0}`,
    model: MODEL_NAME,
    sessionId,
    breath: {
      role: breathRoute.role.id,
      emoji: breathRoute.role.emoji,
      addr: breathRoute.route.addr,
    },
  })}\n\n`);

  // Build messages
  const session = getSession(sessionId, { loadHistory: true });

  // Get workspace context (async, non-blocking)
  let workspaceContext = null;
  try {
    if (currentWorkspace) {
      const ctx = await scanWorkspace(currentWorkspace);
      workspaceContext = buildContextString(ctx);
    }
  } catch (e) {
    console.error(`[agent/stream] Workspace scan failed: ${e.message}`);
  }

  const sysMsg = {
    role: 'system',
    content: buildSystemPrompt(route, workspaceContext, breathRoute),
  };

  const history = (session.history || []).slice(-MAX_HISTORY).map(h => ({
    role: h.role || 'user',
    content: h.content || h.input,
  }));
  history.push({ role: 'user', content: input });

  // Client disconnect detection
  let isClosed = false;
  res.on('close', () => { isClosed = true; });

  // Stream tokens
  let fullResponse = '';
  let reasoning = '';
  let tokenCount = 0;
  const startTime = Date.now();

  res.write('data: {"type":"thinking"}\n\n');

  try {
    for await (const token of callModelStream([sysMsg, ...history])) {
      if (isClosed) break; // client disconnected

      // Check if reasoning token
      if (token.startsWith('<thinking>') || token.endsWith('</thinking>')) {
        reasoning += token;
        continue;
      }

      fullResponse += token;
      tokenCount++;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      const tps = (tokenCount / elapsed).toFixed(1);

      const written = res.write(`data: ${JSON.stringify({
        type: 'token',
        content: token,
        tokenCount,
        elapsed,
        tps,
      })}\n\n`);

      if (!written) break; // backpressure
    }
  } catch (e) {
    console.error(`[agent/stream] Stream error: ${e.message}`);
    res.write(`data: ${JSON.stringify({ type: 'error', message: e.message })}\n\n`);
  }

  // Done / abort
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  const isAborted = isClosed || !fullResponse;

  if (!isClosed) {
    res.write(`data: ${JSON.stringify({
      type: 'done',
      content: fullResponse,
      tokenCount,
      elapsed: totalElapsed,
      aborted: isAborted,
    })}\n\n`);
  }

  // Record metrics (streaming path)
  const elapsedMs = Date.now() - startTime;
  try { require('../routes/models').recordInference(MODEL_NAME, tokenCount, elapsedMs, !isAborted); } catch {};

  // Store (partial) response in session
  if (!session.history) session.history = [];
  session.history.push(canonicalMessage('user', input));
  session.history.push(canonicalMessage('assistant', fullResponse, { partial: isAborted }));

  // Persist session to disk
  try {
    persistSessionState(sessionId, session, {
      halt_reason: isAborted ? 'stream_aborted' : 'complete',
      model: MODEL_NAME,
      tokens: tokenCount,
      elapsedMs,
    });
  } catch (e) {
    console.error(`[agent/stream] Persist failed: ${e.message}`);
  }

  // Sync full turn (user + assistant) to geowon
  if (fullResponse.length > 20) {
    syncTurnToGeowon(sessionId, input, fullResponse, route);
  }

  res.end();
}

// ─── Session Persistence ───
// Disk-backed session state with halt_reason and tool trace
// @addr 10.03.4.0 | fd00:npr:0004:000::0

// Sessions stored outside the codebase (open-source clean)
// Falls back to npr-local/sessions/ for dev, but prefers external memory dir
const SESSIONS_DIR = process.env.NPR_SESSIONS_DIR ||
  path.join(os.homedir(), '.openclaw', 'workspace', 'NPR_OS_sandbox-memory', 'sessions');

/**
 * Ensure sessions directory exists.
 */
function ensureSessionsDir() {
  if (!fs.existsSync(SESSIONS_DIR)) {
    fs.mkdirSync(SESSIONS_DIR, { recursive: true, mode: 0o755 });
  }
}

/**
 * Get path for a session state file.
 * @param {string} sessionId
 * @returns {string}
 */
function sessionStatePath(sessionId) {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

/**
 * Persist session state to disk.
 * @param {string} sessionId
 * @param {object} session - In-memory session object
 * @param {object} meta - Additional metadata (halt_reason, tool_trace, etc.)
 */
function persistSessionState(sessionId, session, meta = {}) {
  try {
    ensureSessionsDir();
    const state = {
      sessionId,
      turns: session.turns,
      history: session.history || [],
      halted_at: Date.now(),
      halt_reason: meta.halt_reason || null,
      tool_trace: meta.tool_trace || [],
      guard_state: meta.guard_state || null,
      turns_in_run: meta.turns || 0,
      // SOURCE→ROUTE→RETURN trace preservation
      route_trace: (session.history || []).map(h => ({
        role: h.role,
        slot: h.slot || null,
        phase: h.phase || null,
        timestamp: h.timestamp,
      })),
    };

    const filePath = sessionStatePath(sessionId);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf8');
    console.log(`[agent/persist] Session ${sessionId} saved → ${filePath}`);

    // Hexa-memory: compress + git commit
    try {
      const { commitSessionMemory } = require('../memory/git-hexa-memory');
      const result = commitSessionMemory(sessionId, state);
      if (result.hash) {
        console.log(`[agent/hexa] Session ${sessionId} → hexa-commit ${result.hash}`);
      }
    } catch (e) {
      console.warn(`[agent/hexa] Git commit skipped: ${e.message}`);
    }
  } catch (e) {
    console.error(`[agent/persist] Failed to save session ${sessionId}: ${e.message}`);
  }
}

/**
 * Load persisted session state from disk.
 * @param {string} sessionId
 * @returns {object|null} Session state or null if not found
 */
function loadSessionState(sessionId) {
  try {
    const filePath = sessionStatePath(sessionId);
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, 'utf8');
    const state = JSON.parse(raw);

    // Restore to in-memory session
    const session = sessions.get(sessionId) || {
      id: sessionId,
      turns: 0,
      history: [],
    };
    session.turns = state.turns || 0;
    session.history = state.history || [];

    return state;
  } catch (e) {
    console.error(`[agent/load] Failed to load session ${sessionId}: ${e.message}`);
    return null;
  }
}

/**
 * List all persisted sessions.
 * @returns {Array} Array of session summaries
 */
function listPersistedSessions() {
  try {
    ensureSessionsDir();
    const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json'));
    return files.map(f => {
      const filePath = path.join(SESSIONS_DIR, f);
      const stat = fs.statSync(filePath);
      const sessionId = f.replace('.json', '');
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const state = JSON.parse(raw);
        return {
          sessionId,
          turns: state.turns,
          historyLength: (state.history || []).length,
          halt_reason: state.halt_reason,
          halted_at: state.halted_at,
          modified: stat.mtime.toISOString(),
        };
      } catch {
        return {
          sessionId,
          error: 'unreadable',
          modified: stat.mtime.toISOString(),
        };
      }
    });
  } catch (e) {
    console.error(`[agent/list] Failed to list sessions: ${e.message}`);
    return [];
  }
}

/**
 * Delete a persisted session.
 * @param {string} sessionId
 * @returns {boolean}
 */
function deletePersistedSession(sessionId) {
  try {
    const filePath = sessionStatePath(sessionId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (e) {
    console.error(`[agent/delete] Failed to delete session ${sessionId}: ${e.message}`);
    return false;
  }
}

/**
 * Load session from disk (simplified wrapper).
 * @param {string} sessionId
 * @returns {Array|null} History array or null
 */
function loadSessionFromDisk(sessionId) {
  const state = loadSessionState(sessionId);
  return state?.history || null;
}

/**
 * Clean up old sessions beyond retention period.
 * @returns {number} Number of sessions deleted
 */
function cleanupOldSessions() {
  const cutoff = Date.now() - (SESSION_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  let deleted = 0;

  for (const session of listPersistedSessions()) {
    if (session.halted_at && session.halted_at < cutoff) {
      if (deletePersistedSession(session.sessionId)) {
        deleted++;
        console.log(`[agent/cleanup] Deleted old session: ${session.sessionId}`);
      }
    }
  }

  if (deleted > 0) {
    console.log(`[agent/cleanup] Cleaned up ${deleted} sessions older than ${SESSION_RETENTION_DAYS} days`);
  }
  return deleted;
}

/**
 * Compress conversation history for context window.
 * Keeps recent messages, summarizes older ones.
 * @param {Array} history - Full conversation history
 * @param {number} maxMessages - Max messages to keep (default: MAX_HISTORY)
 * @returns {Array} Compressed history
 */
function compressHistory(history, maxMessages = MAX_HISTORY) {
  if (!history || history.length <= maxMessages) return history;

  const recent = history.slice(-maxMessages);
  const oldCount = history.length - maxMessages;

  // Count tool calls and messages in the old portion
  const oldToolCalls = history.slice(0, -maxMessages).filter(m => m.content?.includes('[tool'))?.length || 0;
  const oldMessages = history.slice(0, -maxMessages).filter(m => m.role === 'user' || m.role === 'assistant')?.length || 0;

  const summary = {
    role: 'system',
    content: `[Compressed history: ${oldCount} messages (${oldMessages} exchanges, ${oldToolCalls} tool calls) omitted for context window]`,
    timestamp: new Date().toISOString(),
  };

  return [summary, ...recent];
}

module.exports = {
  handleAgentChat,
  handleAgentChatStream,
  agentTurn,
  runAgentLoop,
  createAgentEventSink,
  executeTool,
  sessions,
  handleTool,
  listSessions,
  forkSession,
  mergeSessions,
  generateSessionId,
  validateSessionId,
  getContextBreath,
  getCurrentWorkspace: () => currentWorkspace,
  setCurrentWorkspace: (p) => { currentWorkspace = p; },
  // Session persistence
  persistSessionState,
  loadSessionState,
  loadSessionFromDisk,
  listPersistedSessions,
  deletePersistedSession,
  cleanupOldSessions,
  compressHistory,
  // Daily memory
  getDailyMemoryContext,
  writeDailyEntryForTurn,
  runAutoPromote,
  // Capability registry
  toolRegistry,
};
