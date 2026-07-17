/**
 * sec-registry.cjs — Security Field Registry
 *
 * Three fields: /sec/cc, /sec/javascript, /sec/node
 * Each maps capabilities → trust boundaries → vulnerabilities
 *
 * C/C++:  data → geheugen → control flow
 * JavaScript: token → interpretatie → browser capability
 * Node.js:  token → functie → runtime capability → OS
 *
 * NPR van security:
 *   Noise   = onbetrouwbare invoer of onverwachte toestand
 *   Pattern = invoer bereikt capability over onvoldoende bewaakte grens
 *   Return  = capability verkleinen, grens expliciet maken, route traceerbaar
 */

"use strict";

// ─── Digital Root ───

const digitalRoot = (n) => {
  n = Math.abs(n);
  return n === 0 ? 0 : (n - 1) % 9 + 1;
};

// ─── Five Security Eras ───

const SECURITY_ERAS = [
  { name: "Local Memory", from: 1980, to: 1994, dr: 1, desc: "Buffer overflows, format strings — data corrupts control flow" },
  { name: "Network Process", from: 1995, to: 2004, dr: 2, desc: "Remote exploits, RPC, early web — trust crosses wire" },
  { name: "Web Interpreter", from: 2005, to: 2014, dr: 3, desc: "JavaScript at scale, XSS, AJAX — interpreted trust" },
  { name: "Package Runtime", from: 2015, to: 2022, dr: 4, desc: "npm, node_modules, SSRF — supply chain as attack surface" },
  { name: "Supply Chain Mesh", from: 2023, to: 2030, dr: 5, desc: "Dependency confusion, registry attacks, AI-assisted exploit" },
];

const getSecurityEra = (year) => {
  if (!year) return null;
  const found = SECURITY_ERAS.find((e) => year >= e.from && year <= (e.to || 9999));
  return found || null;
};

// ─── Security Registry ───

const SecurityRegistry = {
  cc: {
    route: "/sec/cc",
    label: "C/C++ Memory & Control Flow",
    classes: ["memory-safety", "control-flow", "buffer-overflow", "use-after-free", "format-string", "integer-overflow", "heap-corruption"],
  },
  javascript: {
    route: "/sec/javascript",
    label: "JavaScript Interpretation & DOM",
    classes: ["xss", "dom-xss", "prototype-pollution", "unsafe-eval", "open-redirect", "token-injection"],
  },
  node: {
    route: "/sec/node",
    label: "Node.js Runtime & System Access",
    classes: ["command-injection", "path-traversal", "ssrf", "dependency-confusion", "prototype-pollution", "event-loop-blocking"],
  },
};

// ─── Capability → Field Map ───

const CAPABILITY_FIELD_MAP = {
  "memory-write": "cc",
  "memory-read": "cc",
  "pointer-arithmetic": "cc",
  "control-flow": "cc",
  "process-execution": "cc",
  "raw-pointer": "cc",
  "stack-manipulation": "cc",
  "heap-manipulation": "cc",
  "dom-manipulation": "javascript",
  "html-render": "javascript",
  "token-eval": "javascript",
  "object-prototype": "javascript",
  "browser-api": "javascript",
  "url-redirect": "javascript",
  "file-read": "node",
  "file-write": "node",
  "process-spawn": "node",
  "network-request": "node",
  "dns-resolution": "node",
  "package-install": "node",
  "module-require": "node",
  "event-loop": "node",
  "child-process": "node",
  "native-addon": "node",
};

// ─── Alias Map: common vulnerability names → field ───

const FIELD_ALIAS_MAP = {
  "c": "cc",
  "c++": "cc",
  "cpp": "cc",
  "memory": "cc",
  "buffer": "cc",
  "heap": "cc",
  "stack": "cc",
  "js": "javascript",
  "frontend": "javascript",
  "browser": "javascript",
  "web": "javascript",
  "client-side": "javascript",
  "server-side": "node",
  "server": "node",
  "backend": "node",
  "runtime": "node",
  "npm": "node",
};

// ─── Vulnerability Classes ───

const CC_VULNERABILITY_CLASSES = [
  "memory-safety",
  "control-flow",
  "buffer-overflow",
  "use-after-free",
  "format-string",
  "integer-overflow",
  "heap-corruption",
];

const JAVASCRIPT_VULNERABILITY_CLASSES = [
  "xss",
  "dom-xss",
  "prototype-pollution",
  "unsafe-eval",
  "open-redirect",
  "token-injection",
];

const NODE_VULNERABILITY_CLASSES = [
  "command-injection",
  "path-traversal",
  "ssrf",
  "dependency-confusion",
  "prototype-pollution",
  "event-loop-blocking",
];

// ─── Canonical Vulnerability Records ───

const defineVulnerability = (obj) => {
  const { id, year, field, vulnerabilityClass, languageFeature, capability, trustBoundary, cause, effect, mitigation, npr } = obj;
  return Object.freeze({
    id,
    year,
    field,
    vulnerabilityClass,
    languageFeature,
    capability,
    trustBoundary,
    cause,
    effect,
    mitigation,
    npr: npr || {
      noise: cause,
      pattern: `${cause} → ${capability} across ${trustBoundary}`,
      return: mitigation,
    },
  });
};

// ── CC Vulnerabilities ──

const CC_VULNERABILITIES = [
  defineVulnerability({
    id: "cc-buffer-overflow",
    year: 1988,
    field: "cc",
    vulnerabilityClass: "buffer-overflow",
    languageFeature: "arrays, pointers, strcpy/memcpy",
    capability: "memory-write",
    trustBoundary: "stack buffer",
    cause: "Unbounded write past buffer boundary",
    effect: "Stack corruption, control flow hijack, code execution",
    mitigation: "Bounds checking, ASLR, stack canaries, safe string functions",
    npr: {
      noise: "Untrusted length or missing null-terminator",
      pattern: "Write past buffer → stack corruption → return address overwritten → control flow hijack",
      return: "Bounds-checked write, ASLR, stack canaries, ROP mitigation",
    },
  }),
  defineVulnerability({
    id: "cc-use-after-free",
    year: 1996,
    field: "cc",
    vulnerabilityClass: "use-after-free",
    languageFeature: "manual memory management, free/malloc",
    capability: "memory-read",
    trustBoundary: "heap object lifecycle",
    cause: "Access freed memory before reallocation or program exit",
    effect: "Data corruption, arbitrary read/write, code execution via heap grooming",
    mitigation: "Smart pointers, RAII, use-after-free detectors, safe memory allocators",
    npr: {
      noise: "Dangling pointer after free",
      pattern: "Free → dereference freed pointer → heap corruption → type confusion or code execution",
      return: "RAII ownership, null-after-free, safe allocators, use-counting",
    },
  }),
  defineVulnerability({
    id: "cc-format-string",
    year: 2000,
    field: "cc",
    vulnerabilityClass: "format-string",
    languageFeature: "printf-family format strings",
    capability: "memory-read",
    trustBoundary: "format string parameter",
    cause: "User-controlled format string with %n or %x",
    effect: "Arbitrary read/write via stack inspection, potential code execution",
    mitigation: "Never pass user input as format string, use %s wrapper, static analysis",
    npr: {
      noise: "User-controlled format string",
      pattern: "printf(user_input) → %x/%n on stack → arbitrary read/write → code execution",
      return: "printf(\"%s\", user_input), static format strings only",
    },
  }),
  defineVulnerability({
    id: "cc-integer-overflow",
    year: 2002,
    field: "cc",
    vulnerabilityClass: "integer-overflow",
    languageFeature: "unsigned/signed integer arithmetic",
    capability: "control-flow",
    trustBoundary: "integer wrap-around boundary",
    cause: "Arithmetic overflow wraps to small value, bypassing size checks",
    effect: "Undersized allocation, heap overflow, out-of-bounds access",
    mitigation: "Checked arithmetic, size validation before allocation, use safe_int patterns",
    npr: {
      noise: "Large unsigned values in arithmetic",
      pattern: "Overflow → undersized allocation → heap write past bounds → corruption",
      return: "Checked arithmetic, pre-allocation validation, size bounds",
    },
  }),
  defineVulnerability({
    id: "cc-heap-corruption",
    year: 2004,
    field: "cc",
    vulnerabilityClass: "heap-corruption",
    languageFeature: "heap metadata, malloc/free, chunk headers",
    capability: "heap-manipulation",
    trustBoundary: "heap chunk boundary",
    cause: "Write corrupts adjacent heap metadata (size, prev_size, fwd/bk pointers)",
    effect: "Double free, arbitrary write via fake chunk, heap-based buffer overflow",
    mitigation: "Heap hardening, safe unlink, tcache poisoning protection, ASAN",
    npr: {
      noise: "Heap buffer overflow or double free",
      pattern: "Corrupt chunk metadata → fake chunk creation → free triggers arbitrary write",
      return: "Heap hardening, ASAN, tcache limits, isolated allocators",
    },
  }),
];

// ── JavaScript Vulnerabilities ──

const JAVASCRIPT_VULNERABILITIES = [
  defineVulnerability({
    id: "js-cross-site-scripting",
    year: 1996,
    field: "javascript",
    vulnerabilityClass: "xss",
    languageFeature: "document.write, innerHTML, eval",
    capability: "dom-manipulation",
    trustBoundary: "HTML context",
    cause: "Unescaped user input rendered as HTML/JS in another user's browser",
    effect: "Session hijack, credential theft, keylogging, browser-based attacks",
    mitigation: "Context-aware output encoding, CSP, DOMPurify, never use innerHTML with user data",
    npr: {
      noise: "User input in HTML context",
      pattern: "Unescaped input → innerHTML → script execution in victim context → credential theft",
      return: "Encode output, CSP headers, DOMPurify sandbox, separate data from markup",
    },
  }),
  defineVulnerability({
    id: "js-dom-xss",
    year: 2003,
    field: "javascript",
    vulnerabilityClass: "dom-xss",
    languageFeature: "document.location, window.name, DOM APIs",
    capability: "html-render",
    trustBoundary: "DOM sink-source boundary",
    cause: "DOM-based script reads user-controlled source and writes to dangerous sink",
    effect: "Client-side code execution without server involvement",
    mitigation: "Avoid DOM sinks with user data, use safe APIs, CSP with strict-dynamic",
    npr: {
      noise: "Location hash or search param controlled by attacker",
      pattern: "location.hash → innerHTML → script execution → data exfiltration",
      return: "textContent over innerHTML, CSP, source sanitization",
    },
  }),
  defineVulnerability({
    id: "js-prototype-pollution",
    year: 2019,
    field: "javascript",
    vulnerabilityClass: "prototype-pollution",
    languageFeature: "Object prototype chain, __proto__, Object.assign",
    capability: "object-prototype",
    trustBoundary: "object prototype chain",
    cause: "Deep merge or assign with user-controlled keys modifies Object.prototype",
    effect: "Property injection, authentication bypass, DoS via infinite loops",
    mitigation: "Object.create(null), freeze prototypes, validate merge keys, avoid __proto__",
    npr: {
      noise: "User-controlled object keys in merge",
      pattern: "__proto__: {admin:true} → Object.assign → prototype modified → all objects infected",
      return: "Object.create(null), schema validation, prototype freeze",
    },
  }),
  defineVulnerability({
    id: "js-unsafe-eval",
    year: 2005,
    field: "javascript",
    vulnerabilityClass: "unsafe-eval",
    languageFeature: "eval, Function constructor, setTimeout string",
    capability: "token-eval",
    trustBoundary: "JS interpreter boundary",
    cause: "User input passed to eval or Function constructor",
    effect: "Arbitrary JavaScript execution in application context",
    mitigation: "Never eval user input, use structured parsing, JSON.parse, CSP without unsafe-eval",
    npr: {
      noise: "User string reaches eval()",
      pattern: "User input → eval() → arbitrary code in app context → full session compromise",
      return: "JSON.parse, structured data, CSP without 'unsafe-eval'",
    },
  }),
  defineVulnerability({
    id: "js-open-redirect",
    year: 2010,
    field: "javascript",
    vulnerabilityClass: "open-redirect",
    languageFeature: "window.location, location.href, a.href",
    capability: "url-redirect",
    trustBoundary: "origin boundary",
    cause: "User-controlled URL parameter used for redirect without validation",
    effect: "Phishing, credential theft, open redirect abuse",
    mitigation: "Allowlist redirect URLs, validate origin, use relative paths only",
    npr: {
      noise: "User-controlled redirect parameter",
      pattern: "?redirect=evil.com → window.location → victim redirected → phishing",
      return: "Allowlist redirects, origin validation, relative paths",
    },
  }),
];

// ── Node.js Vulnerabilities ──

const NODE_VULNERABILITIES = [
  defineVulnerability({
    id: "node-command-injection",
    year: 2010,
    field: "node",
    vulnerabilityClass: "command-injection",
    languageFeature: "child_process.exec, os.exec",
    capability: "process-spawn",
    trustBoundary: "shell boundary",
    cause: "User input interpolated into shell command string",
    effect: "Arbitrary OS command execution, full server compromise",
    mitigation: "Use execFile/spawn with arg array, never interpolate user input into shell strings",
    npr: {
      noise: "User input in shell command string",
      pattern: "exec('rm ' + userFile) → shell injection → arbitrary command execution",
      return: "execFile('rm', [userFile]), no shell, arg array separation",
    },
  }),
  defineVulnerability({
    id: "node-path-traversal",
    year: 2015,
    field: "node",
    vulnerabilityClass: "path-traversal",
    languageFeature: "fs.readFile, path.join, Express static",
    capability: "file-read",
    trustBoundary: "filesystem path boundary",
    cause: "User-controlled path with ../ sequences escapes intended directory",
    effect: "Read/write arbitrary files, config exposure, code modification",
    mitigation: "path.resolve + prefix validation, chroot, sanitize path, use allowlist",
    npr: {
      noise: "User path parameter with ..",
      pattern: "?file=../../etc/passwd → fs.readFile → arbitrary file read → credential exposure",
      return: "path.resolve(base, userPath), prefix check, chroot jail",
    },
  }),
  defineVulnerability({
    id: "node-ssrf",
    year: 2016,
    field: "node",
    vulnerabilityClass: "ssrf",
    languageFeature: "http.request, fetch, axios",
    capability: "network-request",
    trustBoundary: "network origin boundary",
    cause: "Server makes request to user-controlled URL, reaching internal services",
    effect: "Internal network scanning, cloud metadata theft, service-to-service auth abuse",
    mitigation: "URL allowlist, block private IPs, disable redirect, egress filtering",
    npr: {
      noise: "User URL in server-side fetch",
      pattern: "?url=169.254.169.254 → server fetch → cloud metadata → credential theft",
      return: "URL allowlist, IP blocklist, no redirect, egress proxy",
    },
  }),
  defineVulnerability({
    id: "node-dependency-confusion",
    year: 2021,
    field: "node",
    vulnerabilityClass: "dependency-confusion",
    languageFeature: "npm registry resolution, package name collision",
    capability: "package-install",
    trustBoundary: "registry trust boundary",
    cause: "Attacker publishes package with same name on public registry, shadowing internal package",
    effect: "Malicious code in supply chain, data exfiltration, backdoor installation",
    mitigation: "Private registry with priority, scoped packages, dependency pinning, audit",
    npr: {
      noise: "Internal package name on public registry",
      pattern: "npm install internal-pkg → public evil version → supply chain compromise",
      return: "Private registry priority, scoped names, hash pinning, npm audit",
    },
  }),
  defineVulnerability({
    id: "node-prototype-pollution",
    year: 2019,
    field: "node",
    vulnerabilityClass: "prototype-pollution",
    languageFeature: "lodash.merge, Object.assign, JSON.parse",
    capability: "object-prototype",
    trustBoundary: "object prototype chain",
    cause: "Server-side deep merge with user-controlled JSON modifies prototype",
    effect: "Authentication bypass, property injection, DoS",
    mitigation: "Object.create(null), schema validation, avoid unsafe merge, prototype freeze",
    npr: {
      noise: "User JSON in server merge",
      pattern: "JSON with __proto__ → merge → prototype polluted → auth bypass on all objects",
      return: "Schema-first validation, Object.create(null), lodash.mergeWith guard",
    },
  }),
  defineVulnerability({
    id: "node-event-loop-blocking",
    year: 2018,
    field: "node",
    vulnerabilityClass: "event-loop-blocking",
    languageFeature: "synchronous methods, CPU-intensive sync operations",
    capability: "event-loop",
    trustBoundary: "single-threaded event loop",
    cause: "Synchronous operation blocks event loop, preventing request handling",
    effect: "Denial of service, request timeout, degraded availability",
    mitigation: "Async alternatives, worker threads, cluster mode, timeout guards",
    npr: {
      noise: "Sync operation on hot path",
      pattern: "fs.readFileSync in handler → event loop blocked → all requests stall → DoS",
      return: "fs.promises, worker threads, cluster, async everywhere",
    },
  }),
];

// ─── All Vulnerabilities ───

const ALL_VULNERABILITIES = Object.freeze([
  ...CC_VULNERABILITIES,
  ...JAVASCRIPT_VULNERABILITIES,
  ...NODE_VULNERABILITIES,
]);

// ─── Query Functions ───

const getByField = (field) => ALL_VULNERABILITIES.filter((v) => v.field === field);
const getById = (id) => ALL_VULNERABILITIES.find((v) => v.id === id) || null;
const getAllVulnerabilities = () => ALL_VULNERABILITIES;

// ─── Routing ───

const routeSecurityIssue = (issue) => {
  const field = issue.field?.toLowerCase() || "";
  const resolved = FIELD_ALIAS_MAP[field] || field;
  const registry = SecurityRegistry[resolved];
  if (!registry) {
    return { error: `Unknown security field: ${field}`, resolved, available: Object.keys(SecurityRegistry) };
  }
  return {
    field: resolved,
    route: registry.route,
    label: registry.label,
    classes: registry.classes,
  };
};

const routeCapability = (capability) => {
  const field = CAPABILITY_FIELD_MAP[capability];
  if (!field) {
    return { error: `Capability not mapped: ${capability}`, available: Object.keys(CAPABILITY_FIELD_MAP) };
  }
  const registry = SecurityRegistry[field];
  return {
    capability,
    field,
    route: registry.route,
    label: registry.label,
  };
};

// ─── Multi-field security path derivation ───

const deriveSecurityPath = (issue) => {
  const capabilities = issue.capabilities || [];
  const fields = new Set();
  for (const cap of capabilities) {
    const f = CAPABILITY_FIELD_MAP[cap];
    if (f) fields.add(f);
  }
  // Native addon crosses all three
  if (capabilities.includes("native-addon")) {
    fields.add("cc");
    fields.add("javascript");
    fields.add("node");
  }
  return {
    fields: [...fields],
    routes: [...fields].map((f) => SecurityRegistry[f]?.route).filter(Boolean),
    depth: fields.size,
  };
};

// ─── NPR Analysis ───

const analyzeSecurityNPR = (vulnerability) => {
  const dr = digitalRoot(vulnerability.year);
  const era = getSecurityEra(vulnerability.year);
  return {
    dr,
    era: era?.name || "unknown",
    npr: vulnerability.npr,
    severity: dr <= 3 ? "structural" : "surface",
    cycle: dr % 3 === 0 ? "return-focused" : "noise-pattern",
  };
};

// ─── Filter ───

const filterVulnerabilities = (filters = {}) => {
  let result = ALL_VULNERABILITIES;
  if (filters.field) result = result.filter((v) => v.field === filters.field);
  if (filters.vulnerabilityClass) result = result.filter((v) => v.vulnerabilityClass === filters.vulnerabilityClass);
  if (filters.fromYear) result = result.filter((v) => v.year >= filters.fromYear);
  if (filters.toYear) result = result.filter((v) => v.year <= filters.toYear);
  if (filters.dr) result = result.filter((v) => digitalRoot(v.year) === filters.dr);
  return result;
};

// ─── Summarize ───

const summarizeSecurity = () => {
  const byField = {};
  for (const v of ALL_VULNERABILITIES) {
    byField[v.field] = (byField[v.field] || 0) + 1;
  }
  const byEra = {};
  for (const v of ALL_VULNERABILITIES) {
    const era = getSecurityEra(v.year);
    if (era) byEra[era.name] = (byEra[era.name] || 0) + 1;
  }
  return {
    total: ALL_VULNERABILITIES.length,
    byField,
    byEra,
    fields: Object.keys(SecurityRegistry),
    eras: SECURITY_ERAS.length,
  };
};

// ─── Exports ───

module.exports = {
  // Constants
  SecurityRegistry,
  CAPABILITY_FIELD_MAP,
  FIELD_ALIAS_MAP,
  SECURITY_ERAS,
  CC_VULNERABILITY_CLASSES,
  JAVASCRIPT_VULNERABILITY_CLASSES,
  NODE_VULNERABILITY_CLASSES,

  // Data
  CC_VULNERABILITIES,
  JAVASCRIPT_VULNERABILITIES,
  NODE_VULNERABILITIES,
  ALL_VULNERABILITIES,

  // Query
  getByField,
  getById,
  getAllVulnerabilities,

  // Routing
  routeSecurityIssue,
  routeCapability,
  deriveSecurityPath,

  // Analysis
  getSecurityEra,
  analyzeSecurityNPR,
  filterVulnerabilities,
  summarizeSecurity,

  // Utility
  defineVulnerability,
  digitalRoot,
};
