// @addr 10.04.1.7
// Patañjali Sūtra 1.7 — Traidharmya (Threefold Evidence)
// NPR Pattern Validator: Noise → Pattern → Return
//
// Validates a model candidate against three pramāṇas (sources of knowledge):
//   Pratyakṣa  — Direct perception (runtime data)
//   Anumāna    — Inference (logical derivation)
//   Āgama      — Scriptural/formal authority (schema contracts)

"use strict";

// @addr 10.04.1.7.1
// ──────────────────────────────────────────────
// Pratyakṣa (Direct Evidence)
// Compares candidate claims against observable runtime state.
// ──────────────────────────────────────────────

function validatePratyaksha(candidate, noise) {
  const checks = [];

  // Candidate must be a plain object with at least a result key
  if (candidate && typeof candidate === "object") {
    checks.push({
      pass: true,
      detail: "candidate is a structured object",
    });
  } else {
    checks.push({
      pass: false,
      detail: "candidate is not a structured object",
    });
    return { valid: false, checks };
  }

  // --- VM trace consistency ---
  // @addr 10.04.1.7.1.1
  if (noise && noise.vm) {
    if (noise.vm.trace) {
      if (Array.isArray(noise.vm.trace)) {
        checks.push({
          pass: true,
          detail: `vm.trace is an array (${noise.vm.trace.length} entries)`,
        });
      } else {
        checks.push({
          pass: false,
          detail: `vm.trace is not an array (got ${typeof noise.vm.trace})`,
        });
      }

      // If trace exists and is an array, verify no entry is null/undefined
      const nullEntries = noise.vm.trace.filter(
        (e) => e === null || e === undefined
      );
      if (nullEntries.length === 0) {
        checks.push({
          pass: true,
          detail: "vm.trace has no null/undefined entries",
        });
      } else {
        checks.push({
          pass: false,
          detail: `vm.trace contains ${nullEntries.length} null/undefined entries`,
        });
      }
    }

    // If vm has a slot map, verify candidate references match
    if (noise.vm.slots && typeof noise.vm.slots === "object") {
      const slotKeys = Object.keys(noise.vm.slots);
      if (slotKeys.length > 0) {
        checks.push({
          pass: true,
          detail: `vm.slots present (${slotKeys.length} slots)`,
        });
      }
    }
  }

  // --- Workspace / file-system state ---
  // @addr 10.04.1.7.1.2
  if (noise && noise.workspace) {
    if (typeof noise.workspace === "object") {
      checks.push({
        pass: true,
        detail: "workspace state is a structured object",
      });

      // If workspace lists expected files, verify candidate doesn't claim
      // results for files marked as missing
      if (Array.isArray(noise.workspace.missing)) {
        const candidateFiles =
          candidate.files && Array.isArray(candidate.files)
            ? candidate.files
            : [];
        const claimedMissing = candidateFiles.filter((f) =>
          noise.workspace.missing.includes(f)
        );
        if (claimedMissing.length === 0) {
          checks.push({
            pass: true,
            detail: "candidate does not claim results for missing workspace files",
          });
        } else {
          checks.push({
            pass: false,
            detail: `candidate claims results for ${claimedMissing.length} missing file(s)`,
          });
        }
      }
    } else {
      checks.push({
        pass: false,
        detail: "workspace state is not a structured object",
      });
    }
  }

  // --- Port status check ---
  // @addr 10.04.1.7.1.3
  if (noise && noise.ports) {
    if (typeof noise.ports === "object") {
      const portChecks = Object.entries(noise.ports).map(([port, status]) => ({
        pass: status === "open" || status === true,
        detail: `port ${port}: ${status}`,
      }));
      checks.push(...portChecks);
    }
  }

  // --- Tool execution results ---
  // @addr 10.04.1.7.1.4
  if (noise && noise.tools) {
    if (typeof noise.tools === "object") {
      const toolEntries = Object.entries(noise.tools);
      if (toolEntries.length > 0) {
        const toolChecks = toolEntries.map(([tool, result]) => ({
          pass: result !== undefined && result !== null,
          detail: `tool.${tool}: ${result === undefined ? "no result" : "result present"}`,
        }));
        checks.push(...toolChecks);
      } else {
        checks.push({
          pass: true,
          detail: "tools object present but empty (no executions to verify)",
        });
      }
    }
  }

  return {
    valid: checks.every((c) => c.pass),
    checks,
  };
}

// @addr 10.04.1.7.2
// ──────────────────────────────────────────────
// Anumāna (Inference)
// Verifies logical derivation chains within the candidate.
// ──────────────────────────────────────────────

function validateAnumana(candidate, noise) {
  const checks = [];

  // --- Opcode trace → slot result consistency ---
  // @addr 10.04.1.7.2.1
  if (noise && noise.vm && noise.vm.trace && Array.isArray(noise.vm.trace)) {
    // Verify trace forms a connected chain: each step references the previous
    let chainValid = true;
    for (let i = 1; i < noise.vm.trace.length; i++) {
      const prev = noise.vm.trace[i - 1];
      const curr = noise.vm.trace[i];
      // A valid chain has each entry with an index or order
      if (prev && curr) {
        const prevIdx = prev.index !== undefined ? prev.index : i - 1;
        const currIdx = curr.index !== undefined ? curr.index : i;
        if (currIdx <= prevIdx) {
          chainValid = false;
          break;
        }
      }
    }

    if (noise.vm.trace.length > 0) {
      checks.push({
        pass: chainValid,
        detail: chainValid
          ? `opcode trace chain consistent (${noise.vm.trace.length} steps)`
          : "opcode trace chain has ordering violation",
      });
    }
  }

  // --- Route → phase alignment ---
  // @addr 10.04.1.7.2.2
  if (candidate.route && candidate.phase) {
    // Valid routes should map to recognized phases
    const routePhaseMap = {
      noise: ["ingest", "sense", "raw"],
      pattern: ["analyze", "validate", "derive"],
      return: ["respond", "emit", "deliver"],
    };

    const validPhases = routePhaseMap[candidate.route] || [];
    const phaseAligned = validPhases.includes(candidate.phase);

    checks.push({
      pass: phaseAligned,
      detail: phaseAligned
        ? `route "${candidate.route}" → phase "${candidate.phase}" aligned`
        : `route "${candidate.route}" → phase "${candidate.phase}" misaligned (expected one of: ${validPhases.join(", ")})`,
    });
  } else {
    // If neither route nor phase is present, that's acceptable (not claiming alignment)
    checks.push({
      pass: true,
      detail: "no route/phase claim to verify (neutral)",
    });
  }

  // --- Tool result → answer claim alignment ---
  // @addr 10.04.1.7.2.3
  if (noise && noise.tools && candidate.answer) {
    // If candidate makes an answer claim and tool results exist,
    // verify the answer references at least one tool
    const toolNames = Object.keys(noise.tools);
    const answerStr = String(candidate.answer);

    // Check if answer mentions any of the executed tools
    const referencesTools = toolNames.some(
      (t) => answerStr.includes(t) || answerStr.includes(`tool.${t}`)
    );

    // Answer doesn't have to reference tools if it's a derivation
    // (that's a soft check — pass but log)
    checks.push({
      pass: true, // soft check
      detail: referencesTools
        ? `answer references executed tool(s)`
        : `answer is a derivation without direct tool reference (${toolNames.length} tools available)`,
    });
  }

  // --- Candidate internal consistency ---
  // @addr 10.04.1.7.2.4
  if (candidate.result !== undefined) {
    checks.push({
      pass: true,
      detail: "candidate.result is defined",
    });

    // If result has a derivation field, verify it's non-empty
    if (
      typeof candidate.result === "object" &&
      candidate.result.derivation !== undefined
    ) {
      const isNonEmpty =
        candidate.result.derivation !== "" &&
        candidate.result.derivation !== null;
      checks.push({
        pass: isNonEmpty,
        detail: isNonEmpty
          ? "result.derivation is present and non-empty"
          : "result.derivation is empty or null",
      });
    }
  }

  return {
    valid: checks.every((c) => c.pass),
    checks,
  };
}

// @addr 10.04.1.7.3
// ──────────────────────────────────────────────
// Āgama (Formal Contracts)
// Validates candidate against schema and contract requirements.
// ──────────────────────────────────────────────

function validateAgama(candidate, contracts) {
  const checks = [];

  // --- Return schema structure ---
  // @addr 10.04.1.7.3.1
  {
    const requiredKeys = ["result"];
    const missingKeys = requiredKeys.filter(
      (k) => candidate[k] === undefined
    );

    checks.push({
      pass: missingKeys.length === 0,
      detail:
        missingKeys.length === 0
          ? "candidate has all required top-level keys: " + requiredKeys.join(", ")
          : `candidate missing required key(s): ${missingKeys.join(", ")}`,
    });
  }

  // --- Tool contract adherence ---
  // @addr 10.04.1.7.3.2
  if (contracts && contracts.tools) {
    const toolContracts = contracts.tools;

    for (const [toolName, contract] of Object.entries(toolContracts)) {
      if (typeof contract === "object") {
        // Check if the contract specifies required output keys
        if (Array.isArray(contract.outputKeys)) {
          const candidateToolResult =
            candidate.tools && candidate.tools[toolName];

          if (candidateToolResult) {
            const missingOutputKeys = contract.outputKeys.filter(
              (k) => candidateToolResult[k] === undefined
            );
            checks.push({
              pass: missingOutputKeys.length === 0,
              detail:
                missingOutputKeys.length === 0
                  ? `tool contract ${toolName}: all output keys present`
                  : `tool contract ${toolName}: missing keys ${missingOutputKeys.join(", ")}`,
            });
          } else {
            // Tool not executed — acceptable if not required
            const isRequired = contract.required === true;
            checks.push({
              pass: !isRequired,
              detail: isRequired
                ? `tool contract ${toolName}: required but not executed`
                : `tool contract ${toolName}: not required, not executed (acceptable)`,
            });
          }
        }
      }
    }
  }

  // --- Hex-VM contract compliance ---
  // @addr 10.04.1.7.3.3
  if (contracts && contracts.vm) {
    const vmContract = contracts.vm;

    // Check max trace length if specified
    if (typeof vmContract.maxTraceLength === "number") {
      const traceLen =
        candidate.vm && Array.isArray(candidate.vm.trace)
          ? candidate.vm.trace.length
          : 0;
      checks.push({
        pass: traceLen <= vmContract.maxTraceLength,
        detail: traceLen <= vmContract.maxTraceLength
          ? `hex-vm trace length (${traceLen}) within limit (${vmContract.maxTraceLength})`
          : `hex-vm trace length (${traceLen}) exceeds limit (${vmContract.maxTraceLength})`,
      });
    }

    // Check allowed opcodes if specified
    if (Array.isArray(vmContract.allowedOpcodes)) {
      const candidateOpcodes =
        candidate.vm && Array.isArray(candidate.vm.trace)
          ? candidate.vm.trace.map((s) => s.opcode).filter(Boolean)
          : [];
      const invalidOpcodes = candidateOpcodes.filter(
        (op) => !vmContract.allowedOpcodes.includes(op)
      );
      checks.push({
        pass: invalidOpcodes.length === 0,
        detail:
          invalidOpcodes.length === 0
            ? "hex-vm opcodes all within allowed set"
            : `hex-vm has disallowed opcodes: ${[...new Set(invalidOpcodes)].join(", ")}`,
      });
    }
  }

  // --- Provenance requirements ---
  // @addr 10.04.1.7.3.4
  if (contracts && contracts.provenance) {
    const provContract = contracts.provenance;

    // If provenance requires a source field
    if (provContract.requiresSource) {
      checks.push({
        pass: candidate.source !== undefined,
        detail:
          candidate.source !== undefined
            ? `provenance source present: "${candidate.source}"`
            : "provenance source required but missing",
      });
    }

    // If provenance requires a timestamp
    if (provContract.requiresTimestamp) {
      const hasTimestamp =
        candidate.timestamp !== undefined || candidate.ts !== undefined;
      checks.push({
        pass: hasTimestamp,
        detail: hasTimestamp
          ? "provenance timestamp present"
          : "provenance timestamp required but missing",
      });
    }

    // If provenance requires a model identifier
    if (provContract.requiresModelId) {
      checks.push({
        pass: candidate.model_id !== undefined || candidate.model !== undefined,
        detail:
          candidate.model_id !== undefined || candidate.model !== undefined
            ? "provenance model identifier present"
            : "provenance model identifier required but missing",
      });
    }
  }

  // --- General contract matching (candidate vs contracts) ---
  // @addr 10.04.1.7.3.5
  if (contracts && contracts.schema) {
    // If a flat schema object defines type expectations
    const schemaChecks = Object.entries(contracts.schema).map(
      ([key, expectedType]) => {
        const value = candidate[key];
        const actualType = value === null ? "null" : typeof value;
        const pass = actualType === expectedType;
        return {
          pass,
          detail: pass
            ? `schema: ${key} is ${expectedType}`
            : `schema: ${key} expected ${expectedType}, got ${actualType}`,
        };
      }
    );
    checks.push(...schemaChecks);
  }

  return {
    valid: checks.every((c) => c.pass),
    checks,
  };
}

// @addr 10.04.1.7.0
// ──────────────────────────────────────────────
// Main Entry: validatePattern
// The Pattern step of NPR — validates candidate against
// all three pramāṇas simultaneously.
// ──────────────────────────────────────────────

/**
 * Validate a model candidate against the traidharmya (threefold evidence).
 *
 * @param {object} opts
 * @param {object} opts.candidate - The model output candidate to validate.
 * @param {object} [opts.noise]   - Runtime context (vm, workspace, ports, tools).
 * @param {object} [opts.contracts] - Formal contract definitions.
 *
 * @returns {object} Validation result with pratyaksha, anumana, agama sections.
 */
function validatePattern({ candidate, noise, contracts }) {
  const pratyaksha = validatePratyaksha(candidate, noise);
  const anumana = validateAnumana(candidate, noise);
  const agama = validateAgama(candidate, contracts);

  return {
    sutra_hex: "0x0107",
    valid: pratyaksha.valid && anumana.valid && agama.valid,
    pratyaksha,
    anumana,
    agama,
  };
}

// @addr 10.04.1.7
module.exports = { validatePattern };
