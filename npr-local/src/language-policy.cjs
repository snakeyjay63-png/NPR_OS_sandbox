/**
 * Stap 22: Programmeertalen Als Selecteerbaar Taalveld
 *
 * NPR-OS taalselectiebeleid: alleen open-source, auditbare taalimplementaties
 * in de kern. Gesloten tools mogen extern als processor dienen.
 *
 * Afhankelijkheid: Stap 21 (transparante kernrouting).
 * Referentie: 22_programmeertalen.md
 */

// ─────────────────────────────────────────────
// 1. Policy — NPR-OS taalselectiecriteria
// ─────────────────────────────────────────────

const LANGUAGE_POLICY = Object.freeze({
  id: 'NPR_OS_LANGUAGE_POLICY',
  description: 'Kerncomponenten vereisen open-source taalimplementaties',
  criteria: ['specification_visible', 'implementation_open_source', 'license_compatible'],
});

// ─────────────────────────────────────────────
// 2. Bekende open-source implementaties
// ─────────────────────────────────────────────

const KNOWN_OPEN_IMPLEMENTATIONS = Object.freeze({
  c: ['GCC', 'Clang'],
  javascript: ['V8', 'SpiderMonkey', 'QuickJS'],
  python: ['CPython'],
  rust: ['rustc'],
  assembly: ['NASM', 'YASM'],
  shell: ['bash', 'zsh'],
  typescript: ['tsc'],
  go: ['gc'],
  lua: ['LuaJIT', 'Lua 5.x'],
});

// ─────────────────────────────────────────────
// 3. Policy Validation
// ─────────────────────────────────────────────

/**
 * Valideer of een taalimplementatie voldoet aan het NPR-OS kernbeleid.
 *
 * @param {Object} toolchain — taalimplementatie-descriptor
 * @param {string} toolchain.language   — taalnaam (kleine letters)
 * @param {string} toolchain.implementation — implementatienaam
 * @param {string} [toolchain.license]  — licentie (bijv MIT, Apache-2.0, GPL-3.0)
 * @param {string} [toolchain.specUrl]  — URL naar publieke specificatie
 * @param {string} [toolchain.sourceUrl] — URL naar broncode
 *
 * @returns {{ ok: boolean, reasons: string[] }}
 */
function validate_core_language(toolchain) {
  const reasons = [];

  if (!toolchain || typeof toolchain !== 'object') {
    return { ok: false, reasons: ['Ongeldig toolchain object'] };
  }

  const { language, implementation, license, specUrl, sourceUrl } = toolchain;

  // Specificatie zichtbaar?
  if (!specUrl || typeof specUrl !== 'string' || specUrl.length === 0) {
    reasons.push('specification_not_visible: geen publieke specificatie');
  }

  // Open-source implementatie?
  if (!sourceUrl || typeof sourceUrl !== 'string' || sourceUrl.length === 0) {
    reasons.push('implementation_not_open_source: geen broncode-url');
  }

  // Licentie compatibel?
  if (!license || typeof license !== 'string') {
    reasons.push('license_unknown: geen licentie gedeclareerd');
  }

  // Controleer of het een bekende open-source implementatie is
  const lang = (language || '').toLowerCase();
  const impl = (implementation || '').toLowerCase();
  const known = KNOWN_OPEN_IMPLEMENTATIONS[lang];

  if (known && known.every(k => !k.toLowerCase().includes(impl))) {
    // Niet in bekende lijst — vereist expliciete broncode + spec
    if (!sourceUrl || !specUrl) {
      reasons.push('not_in_known_list: vereist expliciete bron + specificatie');
    }
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

/**
 * Valideer of een externe gesloten tool toegestaan is als processor.
 *
 * Externe tools zijn toegestaan mits:
 * - buiten kernrouting
 * - gedeclareerde interface
 * - geen verborgen kernrouting
 *
 * @param {Object} tool — externe tool descriptor
 * @param {string} tool.id — unieke tool-ID
 * @param {string} tool.role — rol ('processor' of 'router')
 * @param {string} [tool.interface] — gedeclareerde interface
 *
 * @returns {{ ok: boolean, reasons: string[] }}
 */
function validate_external_tool(tool) {
  const reasons = [];

  if (!tool || typeof tool !== 'object') {
    return { ok: false, reasons: ['Ongeldig tool object'] };
  }

  const { id, role, interface: iface } = tool;

  if (!id || typeof id !== 'string') {
    reasons.push('missing_id: tool vereist unieke identiteit');
  }

  // Gesloten tools mogen ALLEEN 'processor' zijn, nooit 'router'
  const roleLower = (role || '').toLowerCase();
  if (roleLower === 'router') {
    reasons.push('closed_router: gesloten tool mag geen kernrouting doen');
  }

  // Gedeclareerde interface vereist
  if (!iface || typeof iface !== 'string' || iface.length === 0) {
    reasons.push('missing_interface: externe tool vereist gedeclareerde interface');
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

/**
 * Check of een runtime reproduceerbaar is binnen NPR-OS beleid.
 *
 * @param {Object} runtime
 * @param {string} runtime.code — broncode string
 * @param {string} runtime.toolchain — gebruikte toolchain-ID
 * @param {string} [runtime.runtimeHash] — runtime hash
 *
 * @returns {{ ok: boolean, reasons: string[] }}
 */
function check_reproducible_runtime(runtime) {
  const reasons = [];

  if (!runtime || typeof runtime !== 'object') {
    return { ok: false, reasons: ['Ongeldig runtime object'] };
  }

  const { code, toolchain, runtimeHash } = runtime;

  if (!code || typeof code !== 'string' || code.length === 0) {
    reasons.push('no_source_code: reproduceerbaar runtime vereist zichtbare broncode');
  }

  if (!toolchain || typeof toolchain !== 'string' || toolchain.length === 0) {
    reasons.push('no_toolchain: reproduceerbaar runtime vereist gedeclareerde toolchain');
  }

  if (!runtimeHash) {
    reasons.push('no_runtime_hash: runtime-hash ontbreekt (niet verifieerbaar)');
  }

  return {
    ok: reasons.length === 0,
    reasons,
  };
}

// ─────────────────────────────────────────────
// 4. NPR Projectie van bronartefacten
// ─────────────────────────────────────────────

/**
 * Projecteer een bronartefact naar NPR-route-signatuur.
 *
 * Dit is ROUTE-METADATA, niet volledige broncode- of semantiekrepresentatie.
 * Gelijke signatuur ↛ gelijk programma of gedrag.
 *
 * @param {string} source — broncode string
 * @returns {{ bytes: number, npr_sum: number, npr_root: number, hex: string }}
 */
function project_source_to_npr(source) {
  if (typeof source !== 'string') {
    throw new TypeError('source must be a string');
  }

  const buf = Buffer.from(source, 'utf8');
  const bytes = Array.from(buf);

  // Eenvoudige NPR-projectie: byte → hex → digit-sum → mod9
  const npr_sum = bytes.reduce((acc, b) => acc + b, 0);
  const npr_root = npr_sum % 9 === 0 ? 9 : (npr_sum % 9);

  const hex = buf.toString('hex');

  return {
    bytes: buf.length,
    npr_sum,
    npr_root,
    hex: hex.slice(0, 32) + (hex.length > 32 ? '...' : ''), // truncatie voor leesbaarheid
  };
}

// ─────────────────────────────────────────────
// 5. BLOCK_CONTRACT
// ─────────────────────────────────────────────

const BLOCK_CONTRACT = Object.freeze({
  id: '22_programmeertalen',
  phases: ['validate_core_language', 'validate_external_tool', 'check_reproducible_runtime'],
  inputSchema: 'NPR_LANGUAGE_POLICY',
  outputSchema: 'NPR_POLICY_VALIDATION',
  dependencies: ['21_opensource_taalveld'],
});

// ─────────────────────────────────────────────
// 6. Exports
// ─────────────────────────────────────────────

module.exports = {
  BLOCK_CONTRACT,
  LANGUAGE_POLICY,
  KNOWN_OPEN_IMPLEMENTATIONS,
  validate_core_language,
  validate_external_tool,
  check_reproducible_runtime,
  project_source_to_npr,
};
