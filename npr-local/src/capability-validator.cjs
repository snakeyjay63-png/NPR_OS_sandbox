/**
 * tool-00.cjs — NPR Validation Tool (Tool-00)
 *
 * Validates programs against NPR-OS capability constraints.
 * Checks: authorities, traceability, capability boundaries, NPR cycles.
 *
 * Philosophy:
 *   A correct program has every capability activation backed by authority.
 *   Authority flows through explicit traces.
 *   No capability exists without a return path.
 */

"use strict";

const { getByField, routeCapability } = require("./sec-registry.cjs");

// ─── Authority System ───

/**
 * Authority = explicit permission to activate a capability.
 * Each operation requires at least one matching authority.
 */
const AUTHORITY_CLASSES = {
  // Data operations
  "DataRead": { capabilities: ["memory-read", "file-read", "token-eval"], risk: "low" },
  "DataWrite": { capabilities: ["memory-write", "file-write"], risk: "medium" },
  "DataTransform": { capabilities: ["token-eval"], risk: "low" },

  // Process operations
  "ProcessExecution": { capabilities: ["process-spawn", "process-execution", "child-process"], risk: "critical" },
  "ProcessControl": { capabilities: ["control-flow", "stack-manipulation"], risk: "critical" },

  // Network operations
  "NetworkRequest": { capabilities: ["network-request", "dns-resolution"], risk: "high" },
  "NetworkBind": { capabilities: ["network-request"], risk: "medium" },

  // DOM/Browser operations
  "DOMManipulation": { capabilities: ["dom-manipulation", "html-render"], risk: "medium" },
  "BrowserAPI": { capabilities: ["browser-api", "url-redirect"], risk: "low" },

  // System operations
  "SystemAccess": { capabilities: ["native-addon", "event-loop"], risk: "critical" },
  "PackageManagement": { capabilities: ["package-install", "module-require"], risk: "high" },
};

/**
 * Validate a single trace entry against authority requirements.
 */
const validateTraceEntry = (entry) => {
  const violations = [];
  const { operation, inputType, authorities, source } = entry;

  // Check: operation must exist
  if (!operation) {
    violations.push({ type: "missing-operation", severity: "error", message: "Trace entry has no operation" });
    return { valid: false, violations };
  }

  // Check: authority required for high-risk operations
  const authClass = AUTHORITY_CLASSES[operation];
  if (authClass && authClass.risk !== "low") {
    if (!authorities || authorities.length === 0) {
      violations.push({
        type: "missing-authority",
        severity: authClass.risk === "critical" ? "critical" : "high",
        operation,
        requiredRisk: authClass.risk,
        message: `Operation "${operation}" (${authClass.risk} risk) requires explicit authority`,
      });
    }
  }

  // Check: input type safety
  if (inputType === "string" && authClass) {
    const dangerousCaps = ["process-execution", "memory-write", "token-eval"];
    if (authClass.capabilities.some((c) => dangerousCaps.includes(c))) {
      violations.push({
        type: "unsafe-input-type",
        severity: "warning",
        operation,
        inputType,
        message: `String input to ${operation} — consider typed/sanitized input`,
      });
    }
  }

  return { valid: violations.length === 0, violations };
};

// ─── Source Analysis ───

/**
 * Pattern-based source analysis for capability violations.
 * Detects dangerous patterns in JavaScript/Node.js source.
 */
const DANGEROUS_PATTERNS = [
  { pattern: /\beval\s*\(/, type: "unsafe-eval", severity: "critical", capability: "token-eval", field: "javascript", message: "eval() — arbitrary code execution" },
  { pattern: /new\s+Function\s*\(/, type: "function-constructor", severity: "critical", capability: "token-eval", field: "javascript", message: "new Function() — dynamic code generation" },
  { pattern: /\.innerHTML\s*=/, type: "dom-injection", severity: "high", capability: "dom-manipulation", field: "javascript", message: "innerHTML assignment — potential XSS" },
  { pattern: /\.outerHTML\s*=/, type: "dom-injection", severity: "high", capability: "dom-manipulation", field: "javascript", message: "outerHTML assignment — potential XSS" },
  { pattern: /document\.write\s*\(/, type: "dom-write", severity: "high", capability: "html-render", field: "javascript", message: "document.write() — DOM injection" },
  { pattern: /child_process\.exec\s*\(/, type: "shell-exec", severity: "critical", capability: "process-spawn", field: "node", message: "child_process.exec() — shell command execution" },
  { pattern: /require\s*\(\s*[^"'`]/, type: "dynamic-require", severity: "high", capability: "module-require", field: "node", message: "Dynamic require() — module path injection" },
  { pattern: /fs\.readFileSync\s*\(/, type: "sync-io", severity: "warning", capability: "event-loop", field: "node", message: "Synchronous file read — event loop blocking" },
  { pattern: /fs\.writeFileSync\s*\(/, type: "sync-io", severity: "warning", capability: "event-loop", field: "node", message: "Synchronous file write — event loop blocking" },
  { pattern: /setTimeout\s*\(\s*['"`]/, type: "timeout-string", severity: "high", capability: "token-eval", field: "javascript", message: "setTimeout with string — eval equivalent" },
  { pattern: /setInterval\s*\(\s*['"`]/, type: "interval-string", severity: "high", capability: "token-eval", field: "javascript", message: "setInterval with string — eval equivalent" },
  { pattern: /\.__proto__\s*=/, type: "prototype-write", severity: "critical", capability: "object-prototype", field: "javascript", message: "__proto__ assignment — prototype pollution" },
  { pattern: /Object\.assign\s*\([^,]+,\s*\w+\.body/, type: "merge-pollution", severity: "high", capability: "object-prototype", field: "javascript", message: "Object.assign with request body — prototype pollution risk" },
];

const analyzeSource = (source) => {
  if (!source || typeof source !== "string") {
    return { findings: [], findingCount: 0, clean: true, npr: { noise: "empty source", pattern: "no analysis", return: "nothing to validate" } };
  }

  const findings = [];

  for (const { pattern, type, severity, capability, field, message } of DANGEROUS_PATTERNS) {
    const matches = source.match(pattern);
    if (matches) {
      const route = routeCapability(capability);
      findings.push({
        type,
        severity,
        capability,
        field,
        route: route?.route || `/sec/${field}`,
        match: matches[0],
        message,
        suggestion: getSuggestion(type),
      });
    }
  }

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;

  return {
    findings,
    findingCount: findings.length,
    clean: criticalCount === 0 && highCount === 0,
    severity: criticalCount > 0 ? "critical" : highCount > 0 ? "high" : findings.length > 0 ? "warning" : "clean",
    npr: {
      noise: `${findings.length} pattern(s) detected in source`,
      pattern: findings.map((f) => `${f.type} → ${f.capability}`).join("; ") || "no dangerous patterns",
      return: criticalCount > 0 ? "Critical patterns require remediation" : highCount > 0 ? "High-risk patterns need review" : findings.length > 0 ? "Warnings to consider" : "Source clean",
    },
    languageCorrections: findings.map((f) => ({
      finding: f.type,
      before: f.match,
      after: f.suggestion,
      reason: f.message,
    })),
  };
};

const getSuggestion = (type) => {
  const suggestions = {
    "unsafe-eval": "JSON.parse(), structured data, or safe parser",
    "function-constructor": "Pre-compiled functions, switch/case, or lookup tables",
    "dom-injection": "textContent, DOMPurify.sanitize(), or template literals with escaping",
    "dom-write": "DOM APIs (createElement, appendChild) or framework templating",
    "shell-exec": "child_process.execFile() or spawn() with arg array",
    "dynamic-require": "Static require() calls or module map",
    "sync-io": "fs.promises.readFile/writeFile or async/await",
    "timeout-string": "setTimeout(() => { ... }, delay) — function callback",
    "interval-string": "setInterval(() => { ... }, delay) — function callback",
    "prototype-write": "Object.create(null), Map, or schema validation",
    "merge-pollution": "Object.assign(Object.create(null), ...), or schema-validated merge",
  };
  return suggestions[type] || "Review and sanitize";
};

// ─── Full Program Validation ───

const validateProgram = ({ source = "", trace = null }) => {
  const violations = [];
  const corrections = [];

  // Phase 1: Source analysis
  const sourceResult = analyzeSource(source);
  violations.push(...sourceResult.findings.map((f) => ({
    phase: "source-analysis",
    type: f.type,
    severity: f.severity,
    message: f.message,
    capability: f.capability,
    field: f.field,
  })));

  // Phase 2: Trace validation
  if (trace && Array.isArray(trace)) {
    for (const entry of trace) {
      const entryResult = validateTraceEntry(entry);
      violations.push(...entryResult.violations.map((v) => ({
        phase: "trace-validation",
        ...v,
      })));
    }

    // Check: trace continuity
    if (trace.length > 0) {
      const gaps = [];
      for (let i = 1; i < trace.length; i++) {
        if (!trace[i - 1].operation || !trace[i].operation) {
          gaps.push(i);
        }
      }
      if (gaps.length > 0) {
        violations.push({
          phase: "trace-continuity",
          type: "trace-gap",
          severity: "error",
          indices: gaps,
          message: `Trace has gaps at indices ${gaps.join(", ")}`,
        });
      }
    }
  }

  // Phase 3: Capability boundary check
  const capabilitiesUsed = new Set();
  for (const v of violations) {
    if (v.capability) capabilitiesUsed.add(v.capability);
  }
  if (trace) {
    for (const entry of trace) {
      if (entry.capability) capabilitiesUsed.add(entry.capability);
    }
  }

  // Check: mixed field capabilities
  const fields = new Set();
  for (const cap of capabilitiesUsed) {
    const route = routeCapability(cap);
    if (route?.field) fields.add(route.field);
  }

  if (fields.size > 1) {
    corrections.push({
      type: "multi-field-boundary",
      severity: "warning",
      fields: [...fields],
      message: `Program crosses ${fields.size} security fields: ${[...fields].join(", ")}`,
      suggestion: "Ensure explicit boundary handling between fields",
    });
  }

  // Phase 4: Language corrections from source
  corrections.push(...(sourceResult.languageCorrections || []));

  const criticalCount = violations.filter((v) => v.severity === "critical").length;
  const highCount = violations.filter((v) => v.severity === "high").length;

  // NPR analysis
  const npr = {
    noise: `${violations.length} violation(s), ${corrections.length} correction(s)`,
    pattern: [...capabilitiesUsed].join(" → ") || "no capability violations",
    return: criticalCount > 0
      ? `Critical: ${criticalCount} — immediate remediation required`
      : highCount > 0
        ? `High-risk: ${highCount} — review before deployment`
        : violations.length > 0
          ? `Warnings: ${violations.length} — review recommended`
          : "Program structurally sound",
  };

  return {
    valid: criticalCount === 0 && highCount === 0,
    violations,
    violationCount: violations.length,
    languageCorrections: corrections,
    correctionCount: corrections.length,
    capabilities: [...capabilitiesUsed],
    fields: [...fields],
    npr,
  };
};

// ─── Capability Constraint Check ───

const checkCapabilityConstraints = (program) => {
  const { trace = [], constraints = {} } = program;
  const issues = [];

  // Check: no critical capability without explicit constraint
  for (const entry of trace) {
    const authClass = AUTHORITY_CLASSES[entry.operation];
    if (authClass && authClass.risk === "critical") {
      if (!constraints[entry.operation]) {
        issues.push({
          type: "unconstrained-critical",
          operation: entry.operation,
          message: `Critical operation "${entry.operation}" has no explicit constraint`,
        });
      }
    }
  }

  return { issues, issueCount: issues.length, clean: issues.length === 0 };
};

// ─── Exports ───

module.exports = {
  AUTHORITY_CLASSES,
  DANGEROUS_PATTERNS,
  analyzeSource,
  validateProgram,
  validateTraceEntry,
  checkCapabilityConstraints,
  getSuggestion,
};
