// ═══════════════════════════════════════════════════
// agent/loop.js — Single Agent Loop
// ═══════════════════════════════════════════════════
// One agent. Local model. No external channels.
// Receive → route → respond → log → 0.0.0.0
// ═══════════════════════════════════════════════════

const { nprRoute } = require('../field/npr');
const { fullScan, quickScan, scheduleScan } = require('../sources/system-scan');
const { selectByGoal, listCapabilities } = require('../routes/capabilities');
const { scanWorkspace, buildContextString } = require('../workspace-context');

// ─── System Prompt Builder ───

function buildSystemPrompt(route, workspaceContext = null) {
  const parts = [];

  // Extract correct fields from route object
  const slot = route.pattern?.slot ?? 'unknown';
  const digitalRoot = route.pattern?.digitalRoot ?? 0;
  const phase = route.phase ?? (digitalRoot ? `dr-${digitalRoot}` : 'unknown');

  parts.push(`Je bent NPR Local v0.0.1 — single-agent, local-only runtime.
Oorsprong: 0.0.0.0. Route via digitale root. Geen decimale routes.

## Hoe Je Werkt
- Lokaal model: ${MODEL_NAME} op :8765
- NPR routing: hash → slot (${slot}) → fase (${phase})
- Memory: geowon op :${GEOWON_PORT} (event-driven, disk-backed)
- Alles lokaal — geen externe API calls

## Tools
- tool:scan — systeem scannen (quick of --full)
- tool:scan --save — bewaar scan naar ~/.openclaw/npr-local/scans/
- tool:capabilities — alle 9 capabilities tonen
- tool:select <doel> — wiskundige selectie via digitale root

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

function getSession(id) {
  if (!sessions.has(id)) {
    sessions.set(id, { id, turns: 0, createdAt: Date.now() });
  }
  return sessions.get(id);
}

// ─── Session Management ───

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

const MODEL_API = process.env.MODEL_API || 'http://127.0.0.1:8765/v1/chat/completions';
const MODEL_NAME = process.env.MODEL_NAME || 'Qwen3.6-27B-Q4_K_M.gguf';
const MAX_HISTORY = 20;

// ─── Geowon Memory (event-driven, disk-backed) ───

const GEOWON_PORT = parseInt(process.env.GEOWON_PORT) || 5004;
const GEOWON_API = process.env.GEOWON_API || `http://127.0.0.1:${GEOWON_PORT}`;

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

async function callModel(messages, options = {}) {
  const { timeout = 120000, retry = 1 } = options;
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
          max_tokens: 2048,
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
      const content = data.choices?.[0]?.message?.content;

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

async function agentTurn(sessionId, input) {
  const session = getSession(sessionId);
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

  // Build context: system + history + current input
  const sysMsg = {
    role: 'system',
    content: buildSystemPrompt(route, workspaceContext),
  };

  const history = (session.history || []).slice(-MAX_HISTORY).map(h => ({
    role: h.role || 'user',
    content: h.content || h.input,
  }));

  history.push({ role: 'user', content: input });

  // Call local model
  const modelResponse = await callModel([sysMsg, ...history]);

  // Log + sync to geowon (event-driven)
  if (!session.history) session.history = [];
  session.history.push(
    { role: 'user', content: input, timestamp: Date.now() },
    { role: 'assistant', content: modelResponse, timestamp: Date.now() },
  );

  // Sync to geowon (disk-backed, only on change)
  syncToGeowon(sessionId, {
    role: 'assistant',
    content: modelResponse,
    route: route.pattern,
    slot: route.pattern?.slot ?? 'unknown',
    phase: route.phase ?? `dr-${route.pattern?.digitalRoot ?? 0}`,
  });

  return {
    session: sessionId,
    turn: session.turns,
    input,
    route,
    response: modelResponse,
    model: MODEL_NAME,
    origin: '0.0.0.0',
  };
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
  const sessionId = data.sessionId || `sess-${Date.now()}`;
  const input = data.message || data.prompt || data.text || '';

  if (!input) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'no input' }));
    return;
  }

  const result = await agentTurn(sessionId, input);

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result, null, 2));
}

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
  } else {
    result = { error: `unknown tool: ${tool}`, available: ['scan', '00', 'select', 'capabilities'] };
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
  const sessionId = data.sessionId || `sess-${Date.now()}`;
  const input = data.message || data.prompt || data.text || '';

  if (!input) {
    res.writeHead(400, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'no input' }));
    return;
  }

  // NPR route
  const route = nprRoute(input);

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  // Send routing info first
  res.write(`data: ${JSON.stringify({
    type: 'route',
    slot: route.pattern?.slot ?? 'unknown',
    phase: route.phase ?? `dr-${route.pattern?.digitalRoot ?? 0}`,
    model: MODEL_NAME,
    sessionId,
  })}\n\n`);

  // Build messages
  const session = getSession(sessionId);

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
    content: buildSystemPrompt(route, workspaceContext),
  };

  const history = (session.history || []).slice(-MAX_HISTORY).map(h => ({
    role: h.role || 'user',
    content: h.content || h.input,
  }));
  history.push({ role: 'user', content: input });

  // Stream tokens
  let fullResponse = '';
  let reasoning = '';
  let tokenCount = 0;
  const startTime = Date.now();

  res.write('data: {"type":"thinking"}\n\n');

  for await (const token of callModelStream([sysMsg, ...history])) {
    // Check if reasoning token
    if (token.startsWith('<thinking>') || token.endsWith('</thinking>')) {
      reasoning += token;
      continue;
    }

    fullResponse += token;
    tokenCount++;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const tps = (tokenCount / elapsed).toFixed(1);

    res.write(`data: ${JSON.stringify({
      type: 'token',
      content: token,
      tokenCount,
      elapsed,
      tps,
    })}\n\n`);
  }

  // Done
  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  res.write(`data: ${JSON.stringify({
    type: 'done',
    content: fullResponse,
    tokenCount,
    elapsed: totalElapsed,
  })}\n\n`);

  // Store in session
  if (!session.history) session.history = [];
  session.history.push(
    { role: 'user', content: input, timestamp: Date.now() },
    { role: 'assistant', content: fullResponse, timestamp: Date.now() },
  );

  // Sync to geowon
  syncToGeowon(sessionId, {
    role: 'assistant',
    content: fullResponse,
    route: route.pattern,
    slot: route.pattern?.slot ?? 'unknown',
    phase: route.phase ?? `dr-${route.pattern?.digitalRoot ?? 0}`,
  });

  res.end();
}

module.exports = {
  handleAgentChat,
  handleAgentChatStream,
  agentTurn,
  sessions,
  handleTool,
  listSessions,
  forkSession,
  mergeSessions,
  getCurrentWorkspace: () => currentWorkspace,
  setCurrentWorkspace: (path) => { currentWorkspace = path; },
};
