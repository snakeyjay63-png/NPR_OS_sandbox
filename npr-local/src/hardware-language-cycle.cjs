/**
 * Stap 23: Hardware En Taal Als Co-evolutionair Veld
 *
 * Programmeertalen en hardware ontwikkelen zich wederzijds.
 * Terugkoppellus, geen ketting.
 *
 * Afhankelijkheid: Stap 22 (taalveld).
 * Referentie: 23_hardware_taal_evolutie.md
 */

// ─────────────────────────────────────────────
// 1. Cyclusdefinitie
// ─────────────────────────────────────────────

/**
 * HardwareLanguageCycle :=
 *   Hardware → Language → SoftwareDemand → Hardware
 *
 * Terugkoppellus: elke fase kan terugkoppelen naar vorige fasen.
 */
const CYCLE_PHASES = Object.freeze([
  'hardware_noise',
  'language_pattern',
  'software_demand',
  'engineering_return',
]);

/**
 * Fysieke eigenschappen die hardware aanbiedt.
 */
const HARDWARE_CAPABILITIES = Object.freeze([
  'rekenmodel',
  'geheugenstructuur',
  'parallelisme',
  'energiegebruik',
  'latentie',
  'io',
  'sensoren',
]);

/**
 * Abstracties die talen creëren vanuit hardware-eigenschappen.
 */
const LANGUAGE_ABSTRACTIONS = Object.freeze([
  'instructies',
  'types',
  'geheugenmodellen',
  'concurrency',
  'events',
  'streams',
  'ruimtelijke_structuren',
]);

// ─────────────────────────────────────────────
// 2. Co-evolutie paar
// ─────────────────────────────────────────────

/**
 * Een co-evolutie paar: hardware + taal die wederzijds beïnvloeden.
 *
 * @param {Object} spec
 * @param {string} spec.hardware   — hardwarenaam (bijv "CPU", "GPU")
 * @param {string} spec.language   — taalnaam (bijv "C", "CUDA")
 * @param {string} [spec.period]   — tijdsperiode (bijv "1972-", "2006-")
 * @param {string[]} [spec.hardwareFeatures] — wat hardware biedt
 * @param {string[]} [spec.languageDemands] — wat taal terugvraagt
 *
 * @returns {Object} co-evolutie descriptor
 */
function defineCoevolution(spec) {
  const {
    hardware,
    language,
    period,
    hardwareFeatures = [],
    languageDemands = [],
  } = spec;

  return Object.freeze({
    hardware,
    language,
    period: period ?? 'unknown',
    hardwareFeatures: Object.freeze(hardwareFeatures),
    languageDemands: Object.freeze(languageDemands),
    cyclePhase: 'hardware_noise',
    createdAt: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────────
// 3. Bekende co-evolutie paren (voorbeelden)
// ─────────────────────────────────────────────

const KNOWN_COEVOLUTION_PAIRS = Object.freeze([
  defineCoevolution({
    hardware: 'CPU',
    language: 'C',
    period: '1972-',
    hardwareFeatures: ['geheugen', 'registers', 'instructies', 'MMU', 'caches'],
    languageDemands: ['geheugenbescherming', 'multi-core', 'vectorisatie', 'threads'],
  }),
  defineCoevolution({
    hardware: 'GPU',
    language: 'CUDA',
    period: '2006-',
    hardwareFeatures: ['duizenden_threads', 'SIMD', 'memory_hierarchy'],
    languageDemands: ['parallelle_abstracties', 'nvidia_architectuur_evolutie'],
  }),
  defineCoevolution({
    hardware: 'Browser',
    language: 'JavaScript',
    period: '1995-',
    hardwareFeatures: ['event-loop', 'DOM', 'asynchrone_io'],
    languageDemands: ['V8_optimalisatie', 'JIT', 'WebAssembly', 'CPU_GPU_integratie'],
  }),
  defineCoevolution({
    hardware: 'Moderne_systemen',
    language: 'Rust',
    period: '2010-',
    hardwareFeatures: ['multi-core', 'geheugenveiligheid', 'embedded', 'server'],
    languageDemands: ['type_checking', 'veiligheid', 'gecontroleerde_concurrentie'],
  }),
  defineCoevolution({
    hardware: 'Mobile',
    language: 'Swift/Kotlin',
    period: '2010-',
    hardwareFeatures: ['sensoren', 'energie_beperking', 'touch_io', 'accelerator'],
    languageDemands: ['energy_efficiency', 'safe_concurrency', 'interface_modelen'],
  }),
  defineCoevolution({
    hardware: 'DSP',
    language: 'Synthesetalen',
    period: '1980-',
    hardwareFeatures: ['signaalverwerking', 'realtime', 'audio_io'],
    languageDemands: ['laag_latency', 'stream_modellen', 'frequentie_abstracties'],
  }),
]);

// ─────────────────────────────────────────────
// 4. Cyclus-advance
// ─────────────────────────────────────────────

/**
 * Voer één cyclusstap uit:
 *   hardware_noise → language_pattern → software_demand → engineering_return → ...
 *
 * @param {Object} state — huidige cyclusstate
 * @param {string} state.phase — huidige fase
 * @param {string} state.hardware — hardwarenaam
 * @param {string} state.language — taalnaam
 * @param {string[]} state.observations — waargenomen veranderingen
 *
 * @returns {Object} nieuwe state met geavanceerde fase
 */
function advanceCycle(state) {
  const currentIdx = CYCLE_PHASES.indexOf(state.phase);
  if (currentIdx < 0) {
    throw new Error(`Onbekende cyclusfase: ${state.phase}`);
  }

  const nextIdx = (currentIdx + 1) % CYCLE_PHASES.length;
  const nextPhase = CYCLE_PHASES[nextIdx];

  const phaseLabels = {
    hardware_noise: 'Noise — nieuwe fysieke mogelijkheid of beperking',
    language_pattern: 'Pattern — taal maakt mogelijkheid programmeerbaar',
    software_demand: 'Demand — gebruik stelt nieuwe eisen',
    engineering_return: 'Return — eisen keren terug naar hardware-ontwerp',
  };

  return {
    ...state,
    phase: nextPhase,
    phaseLabel: phaseLabels[nextPhase],
    cycleCount: (state.cycleCount ?? 0) + 1,
    history: [
      ...(state.history ?? []),
      {
        from: state.phase,
        to: nextPhase,
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

/**
 * Voer volledige cyclus uit tot terug naar startfase.
 *
 * @param {Object} initialState — beginstate
 * @returns {Object} eindstate met volledige geschiedenis
 */
function runFullCycle(initialState) {
  let state = {
    ...initialState,
    cycleCount: 0,
    history: [],
  };

  for (let i = 0; i < CYCLE_PHASES.length; i++) {
    state = advanceCycle(state);
  }

  // Moet terug bij startfase
  if (state.phase !== initialState.phase) {
    throw new Error('Cyclus is niet teruggekomen bij startfase');
  }

  return state;
}

// ─────────────────────────────────────────────
// 5. Vertakkend veld — route-tree
// ─────────────────────────────────────────────

/**
 * Bouw een vertakkend veld vanuit een startpunt.
 * Vertegenwoordigt: "elektrische signalen → analoge → digitale → ..."
 *
 * @param {Object} spec
 * @param {string} spec.root — startpunt (bijv "elektrische_signalen")
 * @param {Object[]} spec.branches — vertakkingen { name, children[] }
 *
 * @returns {Object} boomstructuur
 */
function defineBranchingField(spec) {
  const buildNode = (name, children = []) => ({
    name,
    depth: 0,
    children: children.map(c => buildNode(c.name, c.children)),
    isLeaf: children.length === 0,
  });

  const root = buildNode(spec.root, spec.branches);

  // Bepaal diepte recursief
  const setDepth = (node, d) => {
    node.depth = d;
    node.children.forEach(c => setDepth(c, d + 1));
  };
  setDepth(root, 0);

  // Tel alle knopen
  const countNodes = (node) => {
    let count = 1;
    node.children.forEach(c => { count += countNodes(c); });
    return count;
  };

  return Object.freeze({
    tree: root,
    totalNodes: countNodes(root),
    maxDepth: spec.branches.length > 0
      ? Math.max(...spec.branches.map(b => {
          const maxD = (children, d) => children.length === 0
            ? d
            : Math.max(...children.map(c => maxD(c.children || [], d + 1)));
          return maxD(b.children || [], 1);
        }))
      : 0,
  });
}

// ─────────────────────────────────────────────
// 6. Levenscyclus-tracking
// ─────────────────────────────────────────────

/**
 * Track levenscycli van hardware en taal apart.
 * Gekoppeld ≠ identiek verdwijnen.
 *
 * @param {Object} spec
 * @param {string} spec.hardware — hardwarenaam
 * @param {string} spec.language — taalnaam
 * @param {string} spec.hardwareEmergence — jaar van ontstaan
 * @param {string} spec.languageEmergence — jaar van ontstaan
 * @param {string} [spec.hardwareDecline] — jaar van verval (null = nog actief)
 * @param {string} [spec.languageDecline] — jaar van verval (null = nog actief)
 *
 * @returns {Object} levenscyclus descriptor
 */
function defineLifecycle(spec) {
  const {
    hardware,
    language,
    hardwareEmergence,
    languageEmergence,
    hardwareDecline = null,
    languageDecline = null,
  } = spec;

  // Levenscycli gekoppeld ≠ tegelijk verdwijnen
  const bothActive = hardwareDecline === null && languageDecline === null;
  const decoupled = hardwareDecline !== languageDecline;

  return Object.freeze({
    hardware,
    language,
    hardwareEmergence,
    languageEmergence,
    hardwareDecline,
    languageDecline,
    bothActive,
    decoupled,
    note: decoupled
      ? 'Levenscycli gekoppeld maar niet identiek'
      : bothActive
        ? 'Beide nog actief'
        : 'Beide vervangen',
  });
}

// ─────────────────────────────────────────────
// 7. NPR-projectie cyclus
// ─────────────────────────────────────────────

/**
 * Projecteer hardware-taal cyclus naar NPR Noise→Pattern→Return.
 *
 * @param {Object} cycle — co-evolutie descriptor
 *
 * @returns {{ noise, pattern, return, phase }}
 */
function project_cycle_to_npr(cycle) {
  const phaseMap = {
    hardware_noise: { noise: cycle.hardware, pattern: null, return: null, phase: 'Noise' },
    language_pattern: { noise: cycle.hardware, pattern: cycle.language, return: null, phase: 'Pattern' },
    software_demand: { noise: cycle.hardware, pattern: cycle.language, return: cycle.languageDemands, phase: 'Demand' },
    engineering_return: { noise: cycle.hardware, pattern: cycle.language, return: cycle.languageDemands, phase: 'Return' },
  };

  return phaseMap[cycle.cyclePhase] ?? {
    noise: cycle.hardware,
    pattern: cycle.language,
    return: cycle.languageDemands,
    phase: 'unknown',
  };
}

// ─────────────────────────────────────────────
// 8. BLOCK_CONTRACT
// ─────────────────────────────────────────────

const BLOCK_CONTRACT = Object.freeze({
  id: '23_hardware_taal_evolutie',
  phases: ['defineCoevolution', 'advanceCycle', 'runFullCycle', 'project_cycle_to_npr'],
  inputSchema: 'NPR_HARDWARE_LANGUAGE_CYCLE',
  outputSchema: 'NPR_COEVOLUTION_RESULT',
  dependencies: ['22_programmeertalen'],
});

// ─────────────────────────────────────────────
// 9. Exports
// ─────────────────────────────────────────────

module.exports = {
  BLOCK_CONTRACT,
  CYCLE_PHASES,
  HARDWARE_CAPABILITIES,
  LANGUAGE_ABSTRACTIONS,
  KNOWN_COEVOLUTION_PAIRS,
  defineCoevolution,
  advanceCycle,
  runFullCycle,
  defineBranchingField,
  defineLifecycle,
  project_cycle_to_npr,
};
