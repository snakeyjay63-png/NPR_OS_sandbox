/**
 * Stap 24+24a: Return Naar Bron — 0.0.0.0 Als Grensstaattype
 * + Śūnya-Opvulling — Actieve Veldsluiting
 *
 * 0.0.0.0 (Null Island) = grensstaattype — zowel start als einde.
 * Perspectiefselectie projecteert volgorde; gelijktijdigheid is fundamenteel.
 * Śūnya = actieve veldsluiting (0x00), niet afwezigheid.
 *
 * Afhankelijkheid: Stap 23 (hardware-taal co-evolutie).
 * Referentie: 24_return_naar_bron.md, 24a_sunya_padding.md
 */

// ─────────────────────────────────────────────
// 1. NULL_STATE_TYPE — 0.0.0.0
// ─────────────────────────────────────────────

const NULL_STATE_TYPE = Object.freeze({
  id: 'NPR_NULL_STATE',
  networkAddress: '0.0.0.0',
  systemName: 'NULL_ISLAND',
  meaning: 'niet-geselecteerde grensstaat (zowel start als einde)',
  contains: ['QuestionState', 'RoutingState', 'AnswerState', 'NULL_STATE_TYPE'],
});

// ─────────────────────────────────────────────
// 2. NPR-Toestand — drie gelijktijdige perspectieven
// ─────────────────────────────────────────────

/**
 * Eén NPR-token bestaat uit drie gelijktijdige perspectieven:
 *   perspectief 0 → ruimte (positie 1)
 *   perspectief 1 → vorm (positie 2)
 *   perspectief 0≐1 → eenheid van tegenstelling (positie 3)
 *   1 + 2 + 3 = 6 → de complete ruimte
 */
const NPR_PERSPECTIVES = Object.freeze([
  { id: 0, label: 'ruimte', positie: 1 },
  { id: 1, label: 'vorm', positie: 2 },
  { id: '0≐1', label: 'eenheid_van_tegenstelling', positie: 3 },
]);

// ─────────────────────────────────────────────
// 3. Perspectiefprojectie
// ─────────────────────────────────────────────

/**
 * Creëer een gelijktijdige NPR-toestand.
 * Alle punten bestaan tegelijk — geen fundamentele volgorde.
 *
 * @param {Object} spec
 * @param {string} spec.id — toestand-ID
 * @param {string[]} spec.routePoints — alle routepunten gelijktijdig
 *
 * @returns {Object} gelijktijdige toestand
 */
function createSimultaneousState(spec) {
  const { id, routePoints = [] } = spec;

  return Object.freeze({
    id,
    type: 'NULL_STATE_TYPE',
    routePoints: Object.freeze([...routePoints]),
    count: routePoints.length,
    note: 'alle punten bestaan tegelijk — geen fundamentele volgorde',
    createdAt: new Date().toISOString(),
  });
}

/**
 * Selecteer een perspectief → projecteer routevolgorde.
 * Verschillende perspectieven = verschillende projecties.
 *
 * @param {Object} state — gelijktijdige toestand
 * @param {number|string} perspective — perspectief-ID (0, 1, of '0≐1')
 *
 * @returns {{ perspective, sequence, timestamps, note }}
 */
function projectPerspective(state, perspective) {
  const points = [...state.routePoints];
  const timestamps = points.map((_, i) => `t${i}`);

  const labels = {
    0: 'ruimte → projecteert: vraag → routing → antwoord → return',
    1: 'vorm → andere projectievolgorde',
    '0≐1': 'eenheid → volledige gelijktijdige ruimte',
  };

  return Object.freeze({
    perspective,
    sequence: points,
    timestamps,
    length: points.length,
    note: labels[perspective] ?? `perspectief ${perspective}`,
  });
}

// ─────────────────────────────────────────────
// 4. Toestandstype vs. Toestandinstantie
// ─────────────────────────────────────────────

/**
 * Vergelijk begin- en eindtoestand.
 *
 * type(s0) = type(s4) = NULL_STATE_TYPE
 * s0 ≠ s4   → lokaal (geschiedenis verschilt)
 * s0 ≐ s4   → volledig (dezelfde toestand, ander perspectief)
 *
 * @param {Object} s0 — beginstate
 * @param {Object} s4 — eindstate
 *
 * @returns {Object} vergelijking
 */
function compareStates(s0, s4) {
  return Object.freeze({
    sameType: s0.type === s4.type && s0.type === 'NULL_STATE_TYPE',
    locallyDifferent: JSON.stringify(s0) !== JSON.stringify(s4),
    fullyEquivalent: s0.routePoints.length === s4.routePoints.length,
    note: 'type(s0) = type(s4) = NULL_STATE_TYPE',
  });
}

// ─────────────────────────────────────────────
// 5. Klok — labelt, schept niet
// ─────────────────────────────────────────────

/**
 * Klok labelt de geselecteerde routevolgorde.
 * Klok = label(route_projection), niet = oorzaker(volgorde).
 *
 * @param {Object} projection — perspectiefprojectie
 * @returns {{ labeled: string[], clock, note }}
 */
function applyClock(projection) {
  return Object.freeze({
    labeled: projection.timestamps.map((t, i) => `${t}:${projection.sequence[i]}`),
    clock: projection.timestamps,
    note: 'Klok labelt geselecteerde route, schept geen volgorde',
  });
}

// ─────────────────────────────────────────────
// 6. Śūnya-padding (Stap 24a)
// ─────────────────────────────────────────────

/**
 * Drie onafhankelijke assen:
 *   1. Semantische documentas: 27 × 32 bytes = 864 bytes inhoud
 *   2. Opslag-as: 864 + 160 = 1024 bytes
 *   3. Context-as: 65.536 tokens (fysieke RAM hangt af van architectuur)
 */
const SUNYA_CONFIG = Object.freeze({
  semantic: { blocks: 27, width: 32, total: 864, note: 'inhoud' },
  padding: { blocks: 5, width: 32, total: 160, note: 'actieve veldsluiting' },
  storage: { total: 1024, note: '864 + 160 = 1024 (32 × 32)' },
  context: { tokens: 65536, note: 'logische contextgrens (token ≠ byte)' },
});

/**
 * Creëer een śūnya-opgevulde block.
 *
 * @param {number} contentBytes — bytes inhoud (bijv 864)
 * @param {number} frameSize — vaste frame-grootte (bijv 1024)
 * @returns {Object} block met padding
 */
function createSunyaBlock(contentBytes, frameSize = 1024) {
  if (contentBytes > frameSize) {
    throw new RangeError(`inhoud (${contentBytes}) > frame (${frameSize})`);
  }

  const sunyaBytes = frameSize - contentBytes;

  return Object.freeze({
    frame: frameSize,
    content: contentBytes,
    sunya: sunyaBytes,
    complete: contentBytes + sunyaBytes === frameSize,
    buffer: Buffer.alloc(frameSize, 0x00),
    note: 'śūnya = actieve veldsluiting (0x00), niet afwezigheid',
  });
}

/**
 * Bereken block-alignment voor 64 KiB opslagveld.
 *
 * @param {number} blockSize — grootte per block (bijv 1024)
 * @param {number} fieldSize — veldgrootte (bijv 65536)
 * @param {number} contentPerBlock — inhoud per block (bijv 864)
 *
 * @returns {Object} alignment-info
 */
function calculateAlignment(blockSize, fieldSize, contentPerBlock) {
  const blocks = fieldSize / blockSize;
  if (blocks !== Math.floor(blocks)) {
    throw new RangeError('blockSize moet exact verdelen in fieldSize');
  }

  const totalContent = blocks * contentPerBlock;
  const totalSunya = blocks * (blockSize - contentPerBlock);

  return Object.freeze({
    blocks,
    fieldSize,
    blockSize,
    totalContent,
    totalSunya,
    contentPct: ((totalContent / fieldSize) * 100).toFixed(3) + '%',
    sunyaPct: ((totalSunya / fieldSize) * 100).toFixed(3) + '%',
    aligned: totalContent + totalSunya === fieldSize,
    addressFn: (n, base = 0) => base + n * blockSize,
  });
}

/**
 * Digital root berekening.
 *
 * @param {number} n — getal
 * @returns {number} digital root (1-9)
 */
function digitalRoot(n) {
  if (n <= 0) return 0;
  const r = n % 9;
  return r === 0 ? 9 : r;
}

/**
 * NPR-mapping van opslaglaag.
 *
 * @param {number} contentBytes — bytes inhoud
 * @param {number} sunyaBytes — bytes padding
 * @param {number} frameSize — frame-grootte
 *
 * @returns {Object} NPR-mapping + digital roots
 */
function nprMapping(contentBytes, sunyaBytes, frameSize) {
  return Object.freeze({
    noise: { bytes: contentBytes, dr: digitalRoot(contentBytes), label: 'patroon' },
    sunya: { bytes: sunyaBytes, dr: digitalRoot(sunyaBytes), label: 'sluiting' },
    return: { bytes: frameSize, dr: digitalRoot(frameSize), label: 'grens' },
    complete: contentBytes + sunyaBytes === frameSize,
  });
}

// ─────────────────────────────────────────────
// 7. NPR-Cyclus sluit
// ─────────────────────────────────────────────

/**
 * Creëer een volledige NPR-cyclus:
 *   Noise → Pattern → Return → NULL_STATE_TYPE
 *
 * @param {Object} spec
 * @param {string} spec.id — cyclus-ID
 * @param {string[]} spec.noisePoints — ruwe informatie
 * @param {string[]} spec.patternPoints — gestructureerde patronen
 *
 * @returns {Object} cyclus met return
 */
function createNPRCycle(spec) {
  const { id, noisePoints = [], patternPoints = [] } = spec;

  // Beginstate: NULL_STATE_TYPE
  const s0 = createSimultaneousState({ id: `${id}_s0`, routePoints: noisePoints });

  // Pattern-fase: structuur toegepast
  const sp = createSimultaneousState({ id: `${id}_sp`, routePoints: patternPoints });

  // Returnstate: voorwaartse terugkeer naar NULL_STATE_TYPE
  const s4 = createSimultaneousState({ id: `${id}_s4`, routePoints: patternPoints });

  // Vergelijking
  const comparison = compareStates(s0, s4);

  return Object.freeze({
    id,
    s0,
    sp,
    s4,
    comparison,
    cycle: {
      noise: noisePoints,
      pattern: patternPoints,
      return: patternPoints,
    },
    note: 'type(s0) = type(s4) = NULL_STATE_TYPE; cyclus sluit structureel',
  });
}

// ─────────────────────────────────────────────
// 8. Waterstructuur (SOUL.md)
// ─────────────────────────────────────────────

/**
 * Informatie = water (SOUL.md)
 * Talen = patronen in dezelfde bron.
 * Return = patroon keert voorwaarts terug naar grensstaattype.
 */
const WATER_STRUCTURE = Object.freeze({
  informatie: 'water',
  taal: 'patroon in de stroming',
  hardware: 'vat waarin water stroomt',
  software: 'beweging van het water',
  talen: ['Sanskriet', 'Arabisch', 'C', 'Python', 'JavaScript', 'Rust'],
  note: 'Niet verschillende vloeistoffen. Zelfde water, verschillende patronen.',
});

// ─────────────────────────────────────────────
// 9. 0.0.0.0 = Alle Interfaces Tegelijk
// ─────────────────────────────────────────────

const INTERFACE_MAPPING = Object.freeze({
  cpu_interface: '0.0.0.0',
  gpu_interface: '0.0.0.0',
  netwerk: '0.0.0.0',
  geluid: '0.0.0.0',
  vr: '0.0.0.0',
  note: 'Alle interfaces luisteren op hetzelfde grensstaattype',
});

// ─────────────────────────────────────────────
// 10. BLOCK_CONTRACT
// ─────────────────────────────────────────────

const BLOCK_CONTRACT = Object.freeze({
  id: '24_return_naar_bron',
  phases: ['createNPRCycle', 'createSimultaneousState', 'projectPerspective'],
  inputSchema: 'NPR_NULL_STATE_TYPE',
  outputSchema: 'NPR_CYCLE_COMPLETE',
  dependencies: ['23_hardware_taal_evolutie'],
  padding: {
    id: '24a_sunya_padding',
    config: SUNYA_CONFIG,
  },
});

// ─────────────────────────────────────────────
// 11. Exports
// ─────────────────────────────────────────────

module.exports = {
  BLOCK_CONTRACT,
  NULL_STATE_TYPE,
  NPR_PERSPECTIVES,
  WATER_STRUCTURE,
  INTERFACE_MAPPING,
  SUNYA_CONFIG,
  createSimultaneousState,
  projectPerspective,
  compareStates,
  applyClock,
  createSunyaBlock,
  calculateAlignment,
  digitalRoot,
  nprMapping,
  createNPRCycle,
};
