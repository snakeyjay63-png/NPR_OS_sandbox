/**
 * field-orchestrator.cjs — Veld-Orchestrator (Stap 26)
 *
 * Het actieve veld dat alle vorige stappen verbindt.
 * Dynamische route-selectie gebaseerd op input-type en context.
 *
 * Pipeline:
 *   input → detect → encode → validate → route → project → return
 *
 * Philosophy:
 *   Niet een framework. Niet een runtime.
 *   Een actief veld dat kiest, verwerkt, en terugkeert naar NULL_STATE.
 */

"use strict";

// ─── Module Registry (lazy load) ───

const _registry = new Map();

function loadModule(name) {
  if (_registry.has(name)) return _registry.get(name);

  let mod = null;
  try {
    switch (name) {
      case "npr-encode":       mod = require("../tool-00.cjs"); break;
      case "combine-cycles":   mod = require("./combine-cycles.cjs"); break;
      case "return-structure": mod = require("./return-structure.js"); break;
      case "route-encrypt":    mod = require("./route-encrypt.cjs"); break;
      case "block-validator":  mod = require("../block-validator.cjs"); break;
      case "language-policy":  mod = require("../language-policy.cjs"); break;
      case "hardware-evolution": mod = require("../hardware-language-cycle.cjs"); break;
      case "null-state":       mod = require("../null-state.cjs"); break;
      case "art-density":      mod = require("../art-density.cjs"); break;
      default:                 mod = null;
    }
    _registry.set(name, mod);
  } catch (e) {
    _registry.set(name, null);
  }
  return mod;
}

// ─── Route Table ───

const ROUTES = Object.freeze({
  NPR_ENCODE:    "npr-encode",
  NPR_COMBINE:   "combine-cycles",
  NPR_RETURN:    "return-structure",
  NPR_ROUTE:     "route-encrypt",
  NPR_CIPHER:    "route-encrypt",
  NPR_VALIDATE:  "block-validator",
  NPR_POLICY:    "language-policy",
  NPR_EVOLUTION: "hardware-evolution",
  NPR_NULL:      "null-state",
  NPR_ART:       "art-density",
});

// Reverse lookup: module name → route label
const MODULE_TO_ROUTE = Object.fromEntries(
  Object.entries(ROUTES).map(([k, v]) => [v, k])
);

// ─── NULL_STATE Check ───

const NULL_STATE_TYPE = "0.0.0.0";

function isNullState(input) {
  if (input === null || input === undefined) return true;
  if (input === NULL_STATE_TYPE) return true;
  if (typeof input === "string" && input.trim() === "") return true;
  return false;
}

// ─── Route Detection ───

function detect_route(input, ctx = {}) {
  const hint = ctx.hint;
  if (hint && ROUTES[hint]) return hint;

  if (isNullState(input)) return "NPR_NULL";
  return "NPR_ENCODE";
}

// ─── Cycle Tracking ───

function createCycle() {
  return { noise: null, pattern: null, return: null };
}

// ─── Core Process ───

function process(input, ctx = {}) {
  const cycle = createCycle();
  const routeLabel = detect_route(input, ctx);
  const moduleName = ROUTES[routeLabel];

  const mod = loadModule(moduleName);
  if (!mod) {
    return { error: `module not found: ${moduleName}`, route: routeLabel, nullState: true };
  }

  let result;

  switch (routeLabel) {
    // Stap 17: NPR encoders + reductie
    case "NPR_ENCODE": {
      result = mod.analyze({ source: input });
      cycle.noise = input;
      cycle.pattern = result.npr?.hex || null;
      cycle["return"] = result.npr?.npr || null;
      break;
    }

    // Stap 18: Cycluscombinatie
    case "NPR_COMBINE": {
      // combine_cycles(a, b) — verwacht { a, b }
      if (typeof input === "object" && input.a !== undefined) {
        result = mod.combine_cycles(input.a, input.b);
      } else {
        result = { error: "combine expects { a, b }" };
      }
      cycle.noise = input;
      cycle.pattern = result;
      cycle["return"] = result?.combined?.npr || null;
      break;
    }

    // Stap 19: Return structuur
    case "NPR_RETURN": {
      // createReturn(success, data)
      if (typeof input === "object" && input.mode) {
        result = input.success !== false
          ? mod.createReturn(true, input)
          : mod.createFailedReturn(input.reason || "halt", input);
      } else {
        result = { error: "return-structure expects { mode, ... }" };
      }
      cycle.noise = input;
      cycle.pattern = result;
      cycle["return"] = result?.code || null;
      break;
    }

    // Stap 20: Route encryptie
    case "NPR_ROUTE":
    case "NPR_CIPHER": {
      if (routeLabel === "NPR_CIPHER" && ctx.key) {
        if (ctx.action === "encrypt") {
          result = mod.npr_cipher_encrypt(input, ctx.key);
        } else {
          result = mod.npr_cipher_decrypt(input, ctx.key);
        }
      } else {
        // String → bytes → route_encode
        let bytes;
        if (typeof input === "string") {
          const buf = Buffer.from(input, "utf8");
          bytes = Array.from(buf);
        } else if (Array.isArray(input)) {
          bytes = input;
        } else {
          result = { error: "NPR_ROUTE expects string or byte array" };
          cycle.noise = input;
          cycle["return"] = null;
          break;
        }
        const ctx_obj = {
          source_ids: [ctx.source || "orchestrator"],
          motor_phase: "ΦA",
          iteration_depth: ctx.depth ?? 0,
          return_mode: "return",
          layer_id: ctx.layer ?? 0,
          timestamp: Date.now(),
        };
        result = mod.route_encode_bulk(new Uint8Array(bytes), ctx_obj);
      }
      cycle.noise = input;
      cycle.pattern = result?.encoded || result?.ciphertext || null;
      cycle["return"] = result?.signature || result?.npr || null;
      break;
    }

    // Stap 21: Blok validatie
    case "NPR_VALIDATE": {
      result = mod.validateRoute(input);
      cycle.noise = input;
      cycle.pattern = result?.phase || null;
      cycle["return"] = result?.valid ? null : result?.errors || null;
      break;
    }

    // Stap 22: Taalbeleid
    case "NPR_POLICY": {
      result = mod.validate_core_language(input);
      cycle.noise = input;
      cycle.pattern = result?.allowed || result;
      cycle["return"] = null;
      break;
    }

    // Stap 23: Hardware taal evolutie
    case "NPR_EVOLUTION": {
      result = mod.runFullCycle(input);
      cycle.noise = input;
      cycle.pattern = result?.stage || result;
      cycle["return"] = result?.evolved || null;
      break;
    }

    // Stap 24: NULL_STATE
    case "NPR_NULL": {
      result = mod.createSunyaBlock(NULL_STATE_TYPE);
      cycle.noise = null;
      cycle.pattern = null;
      cycle["return"] = result;
      break;
    }

    // Stap 25: Betekenisdensiteit + base64 brug
    case "NPR_ART": {
      if (typeof input === "string") {
        result = mod.meaningDensity(input);
      } else {
        result = { error: "art-density expects string input" };
      }
      cycle.noise = input;
      cycle.pattern = result?.density || result;
      cycle["return"] = result?.base64 || null;
      break;
    }

    default:
      result = { error: "unknown route" };
  }

  const nullState = isNullState(cycle["return"]);

  return Object.freeze({
    route: routeLabel,
    module: moduleName,
    result,
    cycle: Object.freeze(cycle),
    nullState,
  });
}

// ─── Multi-Stage Pipeline ───

function pipeline(input, stages = []) {
  if (!Array.isArray(stages) || stages.length === 0) {
    return { error: "pipeline requires stage list" };
  }

  let current = input;
  const history = [];

  for (const stageLabel of stages) {
    const result = process(current, { hint: stageLabel });
    const stageName = ROUTES[stageLabel] || stageLabel;

    history.push({
      stage: stageLabel,
      module: stageName,
      result: result.result,
      cycle: result.cycle,
    });

    current = result.result;
    if (result.nullState) break;
  }

  return Object.freeze({
    stages: history,
    final: history[history.length - 1]?.result ?? null,
    nullState: isNullState(current),
  });
}

// ─── Exports ───

module.exports = {
  ROUTES,
  MODULE_TO_ROUTE,
  NULL_STATE_TYPE,
  process,
  pipeline,
  loadModule,
  detect_route,
  isNullState,
};
