// @net 10.03.0.0/24
// ═══════════════════════════════════════════════════
// agent/loop.js — Single Agent Loop
// ═══════════════════════════════════════════════════
// One agent. Local model. No external channels.
// Receive → route → respond → log → 0.0.0.0
// ═══════════════════════════════════════════════════

const path = require('path');
const crypto = require('crypto');
const EventEmitter = require('events');
const { nprRoute, getPhaseContext } = require('../field/npr');
const { fullScan, quickScan, scheduleScan } = require('../sources/system-scan');
const { selectByGoal, listCapabilities } = require('../routes/capabilities');
const { scanWorkspace, buildContextString } = require('../workspace-context');
const { ContextBreath } = require('./context-breathe');

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
    this.emit(event.type, event);
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
};

// ─── Runtime Config (hoisted for buildSystemPrompt) ───

const MODEL_NAME = process.env.MODEL_NAME || 'Qwen3.6-27B-Q4_K_M.gguf';
const MAX_TOKENS = parseInt(process.env.MAX_TOKENS) || 2048;
const GEOWON_PORT = parseInt(process.env.GEOWON_PORT) || 17004;
const MODEL_API = process.env.MODEL_API || 'http://127.0.0.1:8765/v1/chat/completions';
const GEOWON_API = process.env.GEOWON_API || `http://127.0.0.1:${GEOWON_PORT}`;
const MAX_HISTORY = 20;

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
    sessions.set(id, newSession);
    // Async: load history from geowon if requested
    if (options.loadHistory) {
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
async function callModel(messages, options = {}) {
  const { timeout = 120000, retry = 1, maxTokens = 2048 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  for (let attempt = 0; attempt <= retry; attempt++) {
    try {
      const res = await fetch(MODEL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: MODEL_NAME,
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

      return content;
    } catch (e) {
      if (attempt < retry) {
        console.warn(`[model] Poging ${attempt + 1} faalde, retry...: ${e.message}`);
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      } else {
        clearTimeout(timer);
        if (e.name === 'AbortError') {
          throw new Error(`Model timeout na ${timeout/1000}s`);
        }
        throw e;
      }
    }
  }
}

// Streaming call to llama-server
// @addr 10.03.3.6 | fd00:npr:0003:003::6 — model stream
async function* callModelStream(messages, options = {}) {
  const { timeout = 120000 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(MODEL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        messages,
        temperature: 0.3,
        max_tokens: 2048,
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
            if (token) yield token;
          } catch {}
        }
      }
    } finally {
      clearTimeout(timer);
      reader.releaseLock();
    }
  } catch (e) {
    clearTimeout(timer);
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
  let modelResponse;
  if (maxTokens !== undefined) {
    modelResponse = await callModel([sysMsg, ...history], { maxTokens });
  } else if (!dryRun) {
    modelResponse = await callModel([sysMsg, ...history]);
  } else {
    modelResponse = '[dryRun] routing OK, model call skipped';
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
    model: MODEL_NAME,
    origin: '0.0.0.0',
  };
}

// @addr 10.03.2.3 | fd00:npr:0003:001::3 — run single agent loop
// Full OpenClaw pattern: two-loop with events, tool lifecycle, config hooks
async function runAgentLoop(sessionId, input, loopConfig = {}) {
  const config = { ...defaultLoopConfig, ...loopConfig };
  const sink = createAgentEventSink();
  const session = getSession(sessionId, { loadHistory: true });

  // Emit agent_start
  await sink.emit('agent_start', { sessionId, input });

  let turnCount = 0;
  let followUpInput = input;
  let lastResponse = null;

  // ─── Buitenste loop: follow-up turns ───
  while (true) {
    turnCount++;
    if (turnCount > config.maxTurnsPerLoop) {
      await sink.emit('agent_end', {
        sessionId,
        reason: 'max_turns_reached',
        turns: turnCount,
      });
      return { error: `max turns (${config.maxTurnsPerLoop}) reached`, turns: turnCount, events: sink.getEvents() };
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
    let modelResponse;
    try {
      modelResponse = await callModel([sysMsg, ...history]);
    } catch (e) {
      await sink.emit('turn_end', { sessionId, turn: turnCount, error: e.message });
      return { error: `model call failed: ${e.message}`, events: sink.getEvents() };
    }

    await sink.emit('message_end', { sessionId, turn: turnCount, response: modelResponse });

    // ─── Binnenste loop: tool-calls ───
    let toolCallCount = 0;
    let toolResponse = modelResponse;

    while (toolResponse && toolResponse.startsWith('tool:') && toolCallCount < config.maxToolCallsPerTurn) {
      toolCallCount++;
      const toolMatch = toolResponse.match(/^tool:(\w+)\s*(.*)$/s);
      if (!toolMatch) break;

      const [, toolName, toolArgs] = toolMatch;

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

      // Feed tool result back to model for next iteration
      const toolResultMsg = JSON.stringify(toolResult, null, 2);
      history.push({ role: 'assistant', content: toolResponse });
      history.push({ role: 'user', content: `Tool result: ${toolResultMsg}` });

      try {
        toolResponse = await callModel([sysMsg, ...history]);
      } catch (e) {
        toolResponse = `Error: ${e.message}`;
        break;
      }
    }

    // Store in session
    if (!session.history) session.history = [];
    session.history.push(canonicalMessage('user', followUpInput));
    session.history.push(canonicalMessage('assistant', toolResponse));

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

    // Check stop condition
    if (config.shouldStopAfterTurn && config.shouldStopAfterTurn(lastResponse, turnCount)) {
      break;
    }

    // Default: stop after one turn unless config says otherwise
    break;
  }

  // Emit agent_end
  await sink.emit('agent_end', {
    sessionId,
    turns: turnCount,
    finalResponse: lastResponse,
  });

  return {
    session: sessionId,
    turns: turnCount,
    response: lastResponse,
    model: MODEL_NAME,
    events: sink.getEvents(),
    origin: '0.0.0.0',
  };
}

// @addr 10.03.2.4 | fd00:npr:0003:001::4 — execute tool by name
async function executeTool(toolName, args, sessionId) {
  const session = sessions.get(sessionId);
  
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
    default:
      return { error: `unknown tool: ${toolName}`, available: ['scan', '00', 'select', 'capabilities', 'workspace', 'read'] };
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

  const result = await agentTurn(sessionId, input, { maxTokens, dryRun });

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

  // Store (partial) response in session
  if (!session.history) session.history = [];
  session.history.push(canonicalMessage('user', input));
  session.history.push(canonicalMessage('assistant', fullResponse, { partial: isAborted }));

  // Sync full turn (user + assistant) to geowon
  if (fullResponse.length > 20) {
    syncTurnToGeowon(sessionId, input, fullResponse, route);
  }

  res.end();
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
};
