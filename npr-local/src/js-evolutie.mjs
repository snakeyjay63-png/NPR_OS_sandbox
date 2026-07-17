/**
 * js-evolutie.js — JavaScript Capabilities, Begin Tot Nu
 *
 * 0.0.0.0 = universele route
 * één bestand = capabilityruimte
 * functienamen = adressen binnen die ruimte
 * functieaanroep = activering van een capability
 *
 * Evolutie:
 *   Fase 0 — Browser-primitieven (1995-2004)
 *   Fase 1 — AJAX + JSON (2005-2009)
 *   Fase 2 — Module + Promise (2010-2015)
 *   Fase 3 — Streams + WebAssembly (2016-2020)
 *   Fase 4 — NPR-OS (2021-heden)
 *
 * Alle capabilities hangen aan 0.0.0.0.
 * De dispatcher is de veiligheidsgrens.
 */

import http from "node:http";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
import * as ExploitTimeline from "./exploit-timeline.cjs";

// CJS modules via createRequire
const _require = createRequire(import.meta.url);
const sec = _require("./sec-registry.cjs");
const tool00 = _require("./tool-00.cjs");

// ─── Fase 0: Browser-primitieven (1995-2004) ───
// Evaluatie, timer, DOM-toegang — de oerfuncties

/**
 * eval() → de oorspronkelijke transformatie
 * String → executable → resultaat
 * NPR-analogie: Noise → Pattern
 */
function evalRaw(input) {
  const meta = { phase: "eval", era: "1995", npr_stage: "Noise" };

  if (typeof input !== "string") {
    return { error: "eval expects string", meta };
  }

  try {
    const result = globalThis.eval(input);
    return { result, meta };
  } catch (e) {
    return { error: e.message, meta };
  }
}

/**
 * setTimeout / setInterval → tijdsgebonden activering
 * NPR-analogie: motorphase-klok (meten, niet veroorzaken)
 */
function schedule(action, delayMs, options = {}) {
  const meta = { phase: "schedule", era: "1995+", npr_stage: "Pattern" };
  const { repeat = false, id = crypto?.randomUUID?.() ?? `t-${Date.now()}` } = options;

  if (typeof action !== "function") {
    return { error: "schedule expects function", meta };
  }

  const handle = repeat
    ? setInterval(action, delayMs)
    : setTimeout(action, delayMs);

  return {
    handle,
    id,
    cancel: () => repeat ? clearInterval(handle) : clearTimeout(handle),
    meta,
  };
}

/**
 * document.write / innerHTML → DOM-mutaties
 * NPR-analogie: zichtbaar patroon in de bron
 */
function render(target, content) {
  const meta = { phase: "render", era: "1995-2004", npr_stage: "Pattern" };

  if (typeof target === "string" && typeof content === "string") {
    return { html: `<${target}>${content}</${target}>`, meta };
  }

  if (typeof target?.innerHTML === "string") {
    target.innerHTML = content;
    return { rendered: true, meta };
  }

  return { error: "render target must be string or DOM element", meta };
}

// ─── Fase 1: AJAX + JSON (2005-2009) ───
// Asynchrone data-uitwisseling — de eerste fetch-route

/**
 * XMLHttpRequest → async data-fetch
 * NPR-analogie: signaaltransport over netwerk
 */
function ajaxFetch(url, options = {}) {
  const meta = { phase: "fetch", era: "2005", npr_stage: "Noise→Pattern", method: options.method ?? "GET" };

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(options.method ?? "GET", url);
    xhr.onreadystatechange = () => {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ data: xhr.responseText, meta });
      } else {
        reject({ error: `HTTP ${xhr.status}`, meta });
      }
    };
    xhr.onerror = () => reject({ error: "xhr error", meta });
    xhr.send(options.body ?? null);
  });
}

/**
 * JSON.parse / JSON.stringify → serielisatie
 * NPR-analogie: patroon ↔ tekenreeks
 */
function jsonTransform(data, direction = "parse") {
  const meta = { phase: "json", era: "2005+", npr_stage: "Pattern" };

  try {
    const result = direction === "parse"
      ? JSON.parse(data)
      : JSON.stringify(data, null, 2);
    return { result, meta };
  } catch (e) {
    return { error: e.message, meta };
  }
}

// ─── Fase 2: Module + Promise (2010-2015) ───
// Gestructureerde async + code-organisatie

/**
 * Promise → deferred computation
 * NPR-analogie: route die nog moet convergeren
 */
function promiseChain(steps, initial) {
  const meta = { phase: "promise", era: "2015", npr_stage: "Pattern→Return", steps: steps.length };

  return steps.reduce(
    (chain, step, i) => chain.then(prev => step(prev, i)),
    Promise.resolve(initial)
  ).then(final => ({ result: final, meta })).catch(e => ({ error: e.message, meta }));
}

/**
 * async/await → leesbare sequentie
 * NPR-analogie: voorwaartse route met tussenstappen
 */
async function asyncRoute(steps, initial) {
  const meta = { phase: "async", era: "2017+", npr_stage: "Pattern→Return" };
  let current = initial;

  for (let i = 0; i < steps.length; i++) {
    current = await steps[i](current, i);
  }

  return { result: current, meta };
}

/**
 * module.exports / export → capability-export
 * NPR-analogie: capability-register naar buiten
 */
function moduleExport(name, fn) {
  const meta = { phase: "module", era: "2010+", npr_stage: "Pattern" };

  return {
    name,
    capability: fn,
    exported: true,
    meta,
  };
}

// ─── Fase 3: Streams + WebAssembly (2016-2020) ───
// Streaming data + native performance

/**
 * ReadableStream / WritableStream → data-stroming
 * NPR-analogie: informatie = water, stromend door buizen
 */
function streamTransform(readable, transformer) {
  const meta = { phase: "stream", era: "2018+", npr_stage: "Noise→Pattern→Return" };

  if (typeof ReadableStream?.prototype?.pipeThrough === "function") {
    const writable = new WritableStream({
      write(chunk) { return transformer(chunk); },
    });

    return { pipeline: readable.pipeTo(writable), meta };
  }

  return { error: "Streams API not available", meta };
}

/**
 * WebAssembly → native computation
 * NPR-analogie: hardware-taal co-evolutie (stap 23)
 */
function wasmInstantiate(bytes, imports = {}) {
  const meta = { phase: "wasm", era: "2017+", npr_stage: "Pattern" };

  return WebAssembly.instantiate(bytes, imports)
    .then(result => ({ instance: result.instance, meta }))
    .catch(e => ({ error: e.message, meta }));
}

// ─── Fase 4: NPR-OS (2021-heden) ───
// De return-lus — reflectie, observatie, routing

/**
 * parseToken → signaal naar patroon
 * NPR-analogie: stap 06 → stap 10 (signal_block → npr_cycle)
 */
function parseToken(raw) {
  const meta = { phase: "parse", era: "npr-os", npr_stage: "Noise" };

  if (typeof raw !== "string") {
    return { error: "parseToken expects string", meta };
  }

  return {
    token: raw,
    length: raw.length,
    hex: [...raw].map(c => c.charCodeAt(0).toString(16).padStart(2, "0")),
    digitalRoot: (raw.length % 9) || 9,
    meta,
  };
}

/**
 * resolveBinding → context naar betekenis
 * NPR-analogie: stap 16 (taalmapping), stap 15 (perceptie)
 */
function resolveBinding(token, context) {
  const meta = { phase: "resolve", era: "npr-os", npr_stage: "Pattern" };

  const binding = {
    token,
    context: context ?? {},
    resolved: true,
    timestamp: Date.now(),
  };

  return { binding, meta };
}

/**
 * transform → patroon naar nieuw patroon
 * NPR-analogie: stap 14 (reductie), stap 12 (vortex primes)
 */
function transform(input, operation, params = {}) {
  const meta = { phase: "transform", era: "npr-os", npr_stage: "Pattern→Pattern" };

  switch (operation) {
    case "hex_reduce":
      return {
        result: input
          .toString(16)
          .split("")
          .reduce((sum, c) => sum + parseInt(c, 16), 0)
          .toString(16),
        meta,
      };
    case "npr_root":
      const digits = input.toString().split("").map(Number);
      const root = ((digits.reduce((a, b) => a + b, 0) - 1) % 9) + 1;
      return { result: root, meta };
    default:
      return { error: `Unknown operation: ${operation}`, meta };
  }
}

/**
 * route → signaal naar doel
 * NPR-analogie: stap 02 (routing), stap 18 (sandbox_router)
 */
function route(input, destination, options = {}) {
  const meta = { phase: "route", era: "npr-os", npr_stage: "Pattern", destination };

  const { maxHops = 16, ttl = 64, returnMode = "deepen" } = options;

  return {
    input,
    destination,
    path: Array.from({ length: maxHops }, (_, i) => `hop_${i.toString(16).padStart(2, "0")}`),
    ttl,
    returnMode,
    meta,
  };
}

/**
 * fetchData → async signaal-inzameling
 * NPR-analogie: stap 01 (spec), stap 10 (cycle)
 */
async function fetchData(source, options = {}) {
  const meta = { phase: "fetch", era: "npr-os", npr_stage: "Noise", source };

  try {
    const response = await fetch(source, options);
    const data = await response.text();
    return { data, status: response.status, meta };
  } catch (e) {
    return { error: e.message, meta };
  }
}

/**
 * store → resultaat naar geheugen
 * NPR-analogie: stap 19 (return), stap 24 (return_naar_bron)
 */
function store(key, value, options = {}) {
  const meta = { phase: "store", era: "npr-os", npr_stage: "Return" };

  const { persistent = false, ttl = null } = options;

  return {
    key,
    stored: true,
    timestamp: Date.now(),
    persistent,
    ttl,
    meta,
  };
}

/**
 * observe → toestand meten zonder te veranderen
 * NPR-analogie: stap 17 (observatie), stap 24 (klok meet, veroorzaakt niet)
 */
function observe(target, predicate) {
  const meta = { phase: "observe", era: "npr-os", npr_stage: "Pattern" };

  const snapshot = {
    target,
    timestamp: Date.now(),
    matches: predicate ? predicate(target) : true,
  };

  return { snapshot, meta };
}

/**
 * reflect → eigen output als nieuwe input
 * NPR-analogie: stap 19 (return-modus: reflect), Route 5
 */
function reflect(output, depth = 1) {
  const meta = { phase: "reflect", era: "npr-os", npr_stage: "Return", depth };

  let current = output;
  const trail = [];

  for (let i = 0; i < depth; i++) {
    trail.push(current);
    current = {
      question: `Analyseer: ${JSON.stringify(current)}`,
      context: [current],
      iteration: i + 1,
    };
  }

  return { reflection: current, trail, meta };
}

/**
 * returnOutput → voorwaartse terugkeer naar bron
 * NPR-analogie: stap 19, stap 24 — type(s0) = type(s4) ≠ s0 = s4
 */
function returnOutput(output, history = []) {
  const meta = {
    phase: "return",
    era: "npr-os",
    npr_stage: "Return→0.0.0.0",
    historyLength: history.length,
  };

  return {
    output,
    history: [...history, output],
    boundaryType: "NULL_STATE_TYPE",
    note: "zelfde grensstaattype ≠ dezelfde instantie",
    meta,
  };
}

// ─── Capability Register ───

const CapabilityRegistry = Object.freeze({
  // Fase 0
  evalRaw,
  schedule,
  render,
  // Fase 1
  ajaxFetch,
  jsonTransform,
  // Fase 2
  promiseChain,
  asyncRoute,
  moduleExport,
  // Fase 3
  streamTransform,
  wasmInstantiate,
  // Fase 4
  parseToken,
  resolveBinding,
  transform,
  route,
  fetchData,
  store,
  observe,
  reflect,
  returnOutput,
  // Exploit Timeline
  listExploitTimeline: () => ExploitTimeline.ExploitTimeline,
  getExploitRecord: (id) =>
    ExploitTimeline.ExploitTimeline.find((r) => r.id === id) ?? null,
  filterExploitTimeline: (filters) =>
    ExploitTimeline.filterExploitTimeline(filters),
  analyzeExploit: (id) => {
    const record = ExploitTimeline.ExploitTimeline.find(
      (r) => r.id === id,
    );
    return record ? ExploitTimeline.analyzeExploit(record) : null;
  },
  summarizeExploitTimeline: () =>
    ExploitTimeline.summarizeExploitTimeline(),
  validateExploitTimeline: () =>
    ExploitTimeline.validateExploitTimeline(),
  listHardwareGenerations: () => ExploitTimeline.HardwareGenerations,
});

// ─── Autorisatie ───

const PUBLIC_CAPABILITIES = new Set([
  "parseToken",
  "jsonTransform",
  "observe",
  "transform",
  "route",
  // Exploit Timeline (read-only)
  "listExploitTimeline",
  "getExploitRecord",
  "filterExploitTimeline",
  "analyzeExploit",
  "summarizeExploitTimeline",
  "validateExploitTimeline",
  "listHardwareGenerations",
]);

const TRUSTED_ONLY = new Set([
  "evalRaw",
  "wasmInstantiate",
  "streamTransform",
]);

function authorize(capabilityName, context = {}) {
  const { isTrusted = false } = context;

  if (PUBLIC_CAPABILITIES.has(capabilityName)) {
    return { allowed: true, reason: "public capability" };
  }

  if (isTrusted && !TRUSTED_ONLY.has(capabilityName)) {
    return { allowed: true, reason: "trusted context" };
  }

  if (isTrusted && TRUSTED_ONLY.has(capabilityName)) {
    return { allowed: true, reason: "trusted + sensitive" };
  }

  return { allowed: false, reason: "unauthorized" };
}

// ─── Dispatcher ───

/**
 * invoke → universele ingang via 0.0.0.0
 *
 * request
 *   → 0.0.0.0
 *   → capabilityNaam
 *   → functie
 *   → resultaat
 *   → return-lus
 */
async function invoke(capabilityName, args = [], context = {}) {
  const capability = CapabilityRegistry[capabilityName];

  if (typeof capability !== "function") {
    return {
      error: `Unknown capability: ${capabilityName}`,
      available: Object.keys(CapabilityRegistry),
    };
  }

  const auth = authorize(capabilityName, context);

  if (!auth.allowed) {
    return {
      error: `Capability ${capabilityName} unauthorized: ${auth.reason}`,
    };
  }

  try {
    const result = await capability(...args);

    return {
      capability: capabilityName,
      result,
      authorized: auth.reason,
      route: `/capability/${capabilityName}`,
      bindAddress: "0.0.0.0",
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Capability failed",
      capability: capabilityName,
    };
  }
}

// ─── HTTP Server — 0.0.0.0 Listener ───

const HOST = "0.0.0.0";

function parseOptionalInteger(value) {
  if (value === null || value === "") {
    return undefined;
  }
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}
const PORT = 3000;

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.setEncoding("utf8");

    request.on("data", chunk => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });

    request.on("end", () => {
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); }
      catch { reject(new Error("Invalid JSON body")); }
    });

    request.on("error", reject);
  });
}

const server = http.createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json; charset=utf-8");

  try {
    const url = new URL(
      request.url ?? "/",
      `http://${request.headers.host ?? "localhost"}`,
    );

    // ── /sec routes ──

    // GET /sec — overview
    if (request.method === "GET" && url.pathname === "/sec") {
      response.statusCode = 200;
      response.end(JSON.stringify({
        route: "/sec",
        fields: {
          cc: { route: sec.SecurityRegistry.cc.route, label: sec.SecurityRegistry.cc.label, classes: sec.CC_VULNERABILITY_CLASSES.length },
          javascript: { route: sec.SecurityRegistry.javascript.route, label: sec.SecurityRegistry.javascript.label, classes: sec.JAVASCRIPT_VULNERABILITY_CLASSES.length },
          node: { route: sec.SecurityRegistry.node.route, label: sec.SecurityRegistry.node.label, classes: sec.NODE_VULNERABILITY_CLASSES.length },
        },
        totalVulnerabilities: sec.getAllVulnerabilities().length,
        eras: sec.SECURITY_ERAS.length,
      }, null, 2));
      return;
    }

    // GET /sec/eras
    if (request.method === "GET" && url.pathname === "/sec/eras") {
      response.statusCode = 200;
      response.end(JSON.stringify({ eras: sec.SECURITY_ERAS }, null, 2));
      return;
    }

    // GET /sec/capabilities — capability→field map
    if (request.method === "GET" && url.pathname === "/sec/capabilities") {
      response.statusCode = 200;
      response.end(JSON.stringify({ capabilityMap: sec.CAPABILITY_FIELD_MAP }, null, 2));
      return;
    }

    // GET /sec/route?field=x&capability=y — route an issue
    if (request.method === "GET" && url.pathname === "/sec/route") {
      const field = url.searchParams.get("field");
      const capability = url.searchParams.get("capability");
      let result;
      if (capability) {
        result = sec.routeCapability(capability);
      } else if (field) {
        result = sec.routeSecurityIssue({ field });
      } else {
        result = { error: "Provide ?field= or ?capability=" };
      }
      response.statusCode = 200;
      response.end(JSON.stringify(result, null, 2));
      return;
    }

    // GET /sec/{field} — all vulnerabilities in a field
    const fieldMatch = url.pathname.match(/^\/(sec)\/(cc|javascript|node)$/);
    if (request.method === "GET" && fieldMatch) {
      const field = fieldMatch[2];
      const vulns = sec.getByField(field);
      const registry = sec.SecurityRegistry[field];
      response.statusCode = 200;
      response.end(JSON.stringify({
        route: registry.route,
        label: registry.label,
        vulnerabilityClasses: registry.classes,
        vulnerabilities: vulns,
        count: vulns.length,
      }, null, 2));
      return;
    }

    // GET /sec/{field}/{id} — single vulnerability
    const vulnMatch = url.pathname.match(/^\/(sec)\/(cc|javascript|node)\/(.+)$/);
    if (request.method === "GET" && vulnMatch) {
      const id = vulnMatch[3];
      const vuln = sec.getById(id) ?? sec.getByField(vulnMatch[2]).find((v) => v.id === id);
      if (!vuln) {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: "Vulnerability not found", id }));
        return;
      }
      const era = sec.getSecurityEra(vuln.year);
      response.statusCode = 200;
      response.end(JSON.stringify({
        ...vuln,
        era: era ? { name: era.name, from: era.from, to: era.to } : null,
        npr: sec.analyzeSecurityNPR ? sec.analyzeSecurityNPR(vuln) : vuln.npr,
      }, null, 2));
      return;
    }

    // POST /sec/validate — Tool-00 full validation
    if (request.method === "POST" && url.pathname === "/sec/validate") {
      const body = await readJsonBody(request);
      const result = tool00.validateProgram({
        source: body.source ?? "",
        trace: body.trace ?? null,
      });
      response.statusCode = 200;
      response.end(JSON.stringify(result, null, 2));
      return;
    }

    // POST /sec/analyze — Tool-00 source analysis
    if (request.method === "POST" && url.pathname === "/sec/analyze") {
      const body = await readJsonBody(request);
      const result = tool00.analyzeSource(body.source ?? "");
      response.statusCode = 200;
      response.end(JSON.stringify(result, null, 2));
      return;
    }

    // ── Exploit Timeline API routes (GET) ──
    if (request.method === "GET" && url.pathname === "/api/exploits") {
      const filters = {
        fromYear: parseOptionalInteger(url.searchParams.get("from")),
        toYear: parseOptionalInteger(url.searchParams.get("to")),
        dr: parseOptionalInteger(url.searchParams.get("dr")),
        category: url.searchParams.get("category") ?? undefined,
        search: url.searchParams.get("search") ?? undefined,
      };

      response.statusCode = 200;
      response.end(JSON.stringify(ExploitTimeline.filterExploitTimeline(filters)));
      return;
    }

    const exploitMatch = url.pathname.match(/^\/api\/exploits\/([a-z0-9-]+)$/);
    if (request.method === "GET" && exploitMatch) {
      const record = ExploitTimeline.ExploitTimeline.find(
        (r) => r.id === exploitMatch[1],
      );

      if (!record) {
        response.statusCode = 404;
        response.end(JSON.stringify({ error: "Exploit record not found" }));
        return;
      }

      response.statusCode = 200;
      response.end(JSON.stringify(ExploitTimeline.analyzeExploit(record)));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/exploits-summary") {
      response.statusCode = 200;
      response.end(JSON.stringify(ExploitTimeline.summarizeExploitTimeline()));
      return;
    }

    // ── Capability routes (POST) ──
    const [, namespace, capabilityName] = url.pathname.split("/");

    if (namespace !== "capability" || !capabilityName) {
      response.statusCode = 404;
      response.end(JSON.stringify({
        error: "Use /capability/{name}",
        available: Object.keys(CapabilityRegistry),
      }));
      return;
    }

    if (request.method !== "POST") {
      response.statusCode = 405;
      response.end(JSON.stringify({ error: "Capability invocation requires POST" }));
      return;
    }

    const body = await readJsonBody(request);

    const result = await invoke(
      capabilityName,
      Array.isArray(body.args) ? body.args : [],
      {
        isTrusted: false,
        remoteAddress: request.socket.remoteAddress,
      },
    );

    response.statusCode = result.error ? 400 : 200;
    response.end(JSON.stringify(result));
  } catch (error) {
    response.statusCode = 500;
    response.end(JSON.stringify({
      error: error instanceof Error ? error.message : "Internal error",
    }));
  }
});

// ─── Export ───

export {
  // Capabilities
  evalRaw,
  schedule,
  render,
  ajaxFetch,
  jsonTransform,
  promiseChain,
  asyncRoute,
  moduleExport,
  streamTransform,
  wasmInstantiate,
  parseToken,
  resolveBinding,
  transform,
  route,
  fetchData,
  store,
  observe,
  reflect,
  returnOutput,
  // System
  CapabilityRegistry,
  PUBLIC_CAPABILITIES,
  authorize,
  invoke,
  server,
  PORT,
  HOST,
};

// ─── Direct Execution ───
// Start server only when run directly: node js-evolutie.js
const isDirectRun =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) ===
  path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  server.listen(PORT, HOST, () => {
    console.log(`Capabilityruimte luistert op ${HOST}:${PORT}`);
  });
}

// ─── 0.0.0.0 ───
//
// Null Island blijft de positie.
// De routegeschiedenis groeit vooruit.
// De klok laat alleen vooruitgang zien.
//
// Alle capabilities bestaan in één bestand.
// 0.0.0.0 is de universele ingang tot die functieruimte.
