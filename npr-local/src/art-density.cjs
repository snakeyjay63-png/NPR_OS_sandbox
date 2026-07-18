/**
 * Stap 25: Kunst Als Hoge Betekenisdensiteit
 *
 * Kunst = vorm met meerdere betekenislagen tegelijk.
 * Token count ≠ meaning density.
 * Het oog = perspectiefselectie, geen oordeel.
 * Kunst = NPR-cyclus in praktijk.
 *
 * Afhankelijkheid: Stap 24 (return naar 0.0.0.0).
 * Referentie: 25_kunst_geluid.md
 */

const { createSimultaneousState } = require('./null-state.cjs');

// ─────────────────────────────────────────────
// 1. Kunstvormen
// ─────────────────────────────────────────────

const ART_SIGNALS = Object.freeze([
  'taal', 'geluid', 'beeld', 'beweging',
  'ruimte', 'code', 'interactie', 'multimodaal',
]);

// ─────────────────────────────────────────────
// 2. Betekenisdensiteit
// ─────────────────────────────────────────────

/**
 * meaning_density(signal, context) ∝
 *   active_layers × interaction_factor × interpretation_capacity
 *
 * Combinatorisch: betekenislagen vermenigvuldigen elkaar.
 * ∝ = proportioneel, geen exacte meeteenheid.
 *
 * @param {Object} spec
 * @param {string[]} spec.activeLayers — actieve betekenislagen
 * @param {number} [spec.interactionFactor] — interactiefactor (default 1)
 * @param {number} [spec.interpretationCapacity] — interpretatiecapaciteit (default 1)
 *
 * @returns {Object} densiteit-scores
 */
function meaningDensity(spec) {
  const {
    activeLayers = [],
    interactionFactor = 1,
    interpretationCapacity = 1,
  } = spec;

  const layerCount = activeLayers.length;
  // Combinatorisch: lagen × interactie × interpretatie
  const raw = layerCount * interactionFactor * interpretationCapacity;
  // Pairwise interactions (combinatorische vermenigvuldiging)
  const pairwiseInteractions = layerCount * (layerCount - 1) / 2;

  return Object.freeze({
    layerCount,
    layers: activeLayers,
    pairwiseInteractions,
    rawScore: raw,
    interactionFactor,
    interpretationCapacity,
    note: 'token_count ≠ meaning_density',
  });
}

// ─────────────────────────────────────────────
// 3. Het Oog — Perspectiefselectie
// ─────────────────────────────────────────────

/**
 * ARTISTIC_EYE := { perspective, intention, context, attention }
 *
 * Het oog activeert een artistieke route — geen oordeel, geen selectie
 * van wat kunst "is". Perspectiefselectie = zichtbaar perspectief.
 *
 * @param {Object} spec
 * @param {string} spec.perspective — welk standpunt
 * @param {string} [spec.intention] — welke doelstelling
 * @param {string} [spec.context] — welke omstandigheden
 * @param {string} [spec.attention] — welke focus
 *
 * @returns {Object} ARTISTIC_EYE descriptor
 */
function createArtisticEye(spec) {
  return Object.freeze({
    perspective: spec.perspective,
    intention: spec.intention ?? 'niet_gespecificeerd',
    context: spec.context ?? 'open',
    attention: spec.attention ?? 'breed',
    type: 'ARTISTIC_EYE',
  });
}

/**
 * artistic_reading(object) := interpret(object, perspective, intention, context)
 *
 * @param {string} object — het object/artefact
 * @param {Object} eye — ARTISTIC_EYE descriptor
 *
 * @returns {Object} artistieke lezing
 */
function artisticReading(object, eye) {
  return Object.freeze({
    object,
    perspective: eye.perspective,
    intention: eye.intention,
    context: eye.context,
    route: 'artistic',
    note: 'oog selecteert route, verandert niet het object zelf',
  });
}

// ─────────────────────────────────────────────
// 4. Routes — technisch ∧ artistiek
// ─────────────────────────────────────────────

/**
 * Een artefact kan beide routes tegelijk openen:
 *   technical_route(object) ∧ artistic_route(object)
 *
 * @param {Object} spec
 * @param {string} spec.id — artefact-ID
 * @param {string} spec.form — vorm (bijv "code", "geluid", "beeld")
 * @param {boolean} [spec.technical] — technische route (default true)
 * @param {boolean} [spec.artistic] — artistieke route (default true)
 *
 * @returns {Object} route-descriptor
 */
function defineArtifactRoutes(spec) {
  return Object.freeze({
    id: spec.id,
    form: spec.form,
    technicalRoute: spec.technical ?? true,
    artisticRoute: spec.artistic ?? true,
    both: (spec.technical ?? true) && (spec.artistic ?? true),
    note: spec.technical && spec.artistic
      ? 'technical ∧ artistic tegelijk mogelijk'
      : 'alleen technische route',
  });
}

// ─────────────────────────────────────────────
// 5. Vrijheid — binnen/tussen/buiten regels
// ─────────────────────────────────────────────

const FREEDOM_TYPES = Object.freeze({
  binnen_regels: { type: 'binnen_regels', voorbeeld: 'Bach: contrapunt' },
  tussen_regels: { type: 'tussen_regels', voorbeeld: 'Debussy: harmonie grenzen verleggen' },
  buiten_regels: { type: 'buiten_regels', voorbeeld: 'Cage: stilte als materiaal' },
  regels_vervormen: { type: 'regels_vervormen', voorbeeld: 'Riley: herhaling als structuur' },
});

/**
 * @param {string} freedomType — type vrijheid
 * @param {Object} [context] — contextspecificatie
 *
 * @returns {Object} vrijheids-descriptor
 */
function defineArtisticFreedom(freedomType, context = {}) {
  const base = FREEDOM_TYPES[freedomType];
  if (!base) {
    throw new Error(`Onbekend vrijheidstype: ${freedomType}`);
  }

  return Object.freeze({
    ...base,
    context: {
      within: context.within ?? '',
      transforms: context.transforms ?? [],
      breaks: context.breaks ?? [],
    },
  });
}

// ─────────────────────────────────────────────
// 6. NPR-Kunst Cyclus — toestandsovergangen
// ─────────────────────────────────────────────

/**
 * NPR-kunstroute met toestandsovergangen:
 *
 *   s0 : NULL_STATE_TYPE        ← bron
 *   p1 : PERSPECTIVE_STATE      ← maker kiest perspectief (+1)
 *   a2 : ART_PATTERN_STATE      ← kunstvorm (Pattern)
 *   p3 : RECEPTION_PERSPECTIVE  ← waarnemer (+1, nieuw perspectief)
 *   i4 : INTERPRETATION_STATE   ← interpretatie
 *   s5 : NULL_STATE_TYPE        ← return naar gedeeld grensstaattype
 *
 * Lokaal: s0 ≠ s5 (geschiedenis verschilt)
 * Volledig: s0 ≐ s5 (dezelfde gelijktijdige toestand, ander perspectief)
 *
 * @param {Object} spec
 * @param {string} spec.artwork — kunstwerk-ID
 * @param {string} spec.form — kunstvorm
 * @param {string} spec.makerPerspective — maker-perspectief
 * @param {Object} [spec.receptionEye] — waarnemer-oog
 *
 * @returns {Object} volledige NPR-kunst cyclus
 */
function createArtCycle(spec) {
  const { artwork, form, makerPerspective, receptionEye } = spec;

  // s0: bron — NULL_STATE_TYPE
  const s0 = createSimultaneousState({
    id: `${artwork}_s0`,
    routePoints: [artwork],
  });

  // p1: maker kiest perspectief (+1)
  const p1 = {
    state: 'PERSPECTIVE_STATE',
    maker: makerPerspective,
    note: 'maker kiest +1 perspectief',
  };

  // a2: kunstvorm (Pattern)
  const a2 = {
    state: 'ART_PATTERN_STATE',
    form,
    meaningDensity: meaningDensity({
      activeLayers: [form],
      interactionFactor: 1,
    }),
    note: 'Pattern: compositie, vorm, structuur',
  };

  // p3: waarnemer (+1, nieuw perspectief)
  const p3 = {
    state: 'RECEPTION_PERSPECTIVE',
    eye: receptionEye ?? createArtisticEye({ perspective: 'open' }),
    note: 'waarnemer = +1 perspectief, niet direct 0.0.0.0',
  };

  // i4: interpretatie
  const i4 = {
    state: 'INTERPRETATION_STATE',
    reading: artisticReading(artwork, p3.eye),
    note: 'interpretatie = route door betekenislagen',
  };

  // s5: return naar gedeeld grensstaattype
  const s5 = createSimultaneousState({
    id: `${artwork}_s5`,
    routePoints: [...s0.routePoints, artwork, p1.maker, a2.form, i4.state],
  });

  return Object.freeze({
    artwork,
    s0,
    p1,
    a2,
    p3,
    i4,
    s5,
    localDifferent: true, // s0 ≠ s5 (geschiedenis verschilt)
    fullyEquivalent: s0.type === s5.type, // s0 ≐ s5 (zelfde type)
    history: ['s0', 'p1', 'a2', 'p3', 'i4', 's5'],
    note: 'Kunst opent vanuit één lokaal perspectief meerdere gelijktijdige betekenissen',
  });
}

// ─────────────────────────────────────────────
// 7. NPR-Lezingen — historische voorbeelden
// ─────────────────────────────────────────────

/**
 * Historische kunstwerken als NPR-lezingen (interpretatieve mappings,
 * niet absolute eigenschappen).
 *
 * @param {string} name — kunstenaar/werk
 * @param {Object} spec — NPR-lezing
 *
 * @returns {Object} NPR-lezing descriptor
 */
function defineNPRReading(name, spec) {
  return Object.freeze({
    name,
    perspective: spec.perspective ?? 'NPR-projectie',
    noise: spec.noise ?? '',
    pattern: spec.pattern ?? '',
    return: spec.return ?? '',
    layers: spec.layers ?? [],
    note: 'interpretatieve mapping, niet absolute eigenschap',
  });
}

const KNOWN_NPR_READINGS = Object.freeze([
  defineNPRReading('Bach — Contrapunt', {
    noise: 'ruwe emotie, wiskundige structuur',
    pattern: 'meerdere gelijktijdige routes binnen één structuur',
    return: 'wiskundige correctheid ∧ spiritualiteit',
    layers: ['taal', 'geluid', 'wiskunde', 'spiritualiteit'],
  }),
  defineNPRReading('Debussy — Impressionisme', {
    noise: 'klankkleur, water-structuur',
    pattern: 'klankkleur boven melodie (andere laagselectie)',
    return: 'geluid → water → taal',
    layers: ['klankkleur', 'water', 'taal', 'impressie'],
  }),
  defineNPRReading('Terry Riley — In C', {
    noise: 'herhaling, cyclus',
    pattern: 'elke speler bepaalt tempo (geen centraal punt)',
    return: 'alle stemmen openen gelijktijdige routes',
    layers: ['herhaling', 'tempo', 'gelijktijdigheid', 'vrijheid'],
  }),
  defineNPRReading('Brian Eno — Ambient', {
    noise: 'ruimte, omgeving',
    pattern: 'ambient als open veld (geen begin, geen eind)',
    return: 'geluid als omgeving = 0.0.0.0 als compositie',
    layers: ['ruimte', 'cyclisch', 'omgeving'],
  }),
  defineNPRReading('Raga\'s — Indiase Klassiek', {
    noise: 'Sanskriet, tijd, seizoen',
    pattern: 'structuur (āroha/avroha) + vrijheid (alap)',
    return: 'Sanskriet → frequentie → tijd → ruimte',
    layers: ['taal', 'frequentie', 'tijd', 'ruimte', 'seizoen'],
  }),
  defineNPRReading('Cage — 4\'33"', {
    noise: 'stilte, afwezigheid',
    pattern: 'stilte als materiaal (geluid inclusief afwezigheid)',
    return: 'ruimte = compositie, return als werk zelf',
    layers: ['stilte', 'ruimte', 'afwezigheid', 'return'],
  }),
  defineNPRReading('Code Als Kunst', {
    noise: 'instructie, structuur',
    pattern: 'abstractie als compositie',
    return: 'functionaliteit ∧ esthetiek tegelijk',
    layers: ['instructie', 'structuur', 'ritme', 'abstractie', 'interface', 'stijl', 'expressie'],
  }),
]);

// ─────────────────────────────────────────────
// 8. Drie Perspectieven In Kunst
// ─────────────────────────────────────────────

const ART_PERSPECTIVES = Object.freeze({
  '0': { id: 0, description: 'open ruimte, materiaal, nog geen geselecteerde vorm' },
  '1': { id: 1, description: 'lokaal geselecteerde vorm of interpretatie' },
  '0≐1': { id: '0≐1', description: 'meerdere interpretaties blijven gelijktijdig geldig' },
  complete: '1 + 2 + 3 = 6', // complete NPR-kunstruimte
});

// ─────────────────────────────────────────────
// 9. Base64 — Modale Brug
//
// Base64 = universele brug tussen modaliteiten:
//   beeld (pixel-blokken, resolutie-afhankelijk)
//   licht (frequentie-amplitude per byte)
//   geluid (byte → frequentie-mapping)
//   wiskundig (digital root, hex, NPR-reductie)
//
// Dezelfde byte-stream → verschillende lezingen.
// Eén structuur, meerdere betekenislagen.

const BASE64_BRIDGE_MODALITIES = Object.freeze([
  'beeld',   // pixel-blokken, resolutie-afhankelijk
  'licht',   // frequentie-amplitude
  'geluid',  // byte → frequentie
  'wiskundig', // digital root, hex, NPR
]);

/**
 * Base64-modale brug: decodeer base64 → bytes → projecteer naar modaliteit.
 *
 * @param {string} base64Data — base64-gedecodeerde string
 * @param {string} modality — 'beeld', 'licht', 'geluid', 'wiskundig'
 * @param {Object} [options] — modality-specifieke opties
 * @param {number} [options.resolution] — resolutie voor beeld (bijv 32 voor 32x32)
 * @param {number} [options.blockSize] — block-grootte voor beeld (bijv 1024)
 *
 * @returns {Object} modale projectie
 */
function base64ModalBridge(base64Data, modality, options = {}) {
  if (!Buffer.isEncoding('base64')) {
    throw new Error('base64 encoding not supported');
  }

  const buf = Buffer.from(base64Data, 'base64');
  const bytes = Array.from(buf);

  // Wiskundige basis (altijd berekend)
  const nprSum = bytes.reduce((a, b) => a + b, 0);
  const nprRoot = nprSum % 9 === 0 ? 9 : (nprSum % 9);
  const hex = buf.toString('hex');

  const projections = {
    modality,
    bytes: buf.length,
    nprSum,
    nprRoot,
    hex: hex.slice(0, 64) + (hex.length > 64 ? '...' : ''),
  };

  // Modality-specifieke projectie
  if (modality === 'beeld') {
    const res = options.resolution ?? 32;
    const bs = options.blockSize ?? (res * res);
    const blocks = Math.ceil(buf.length / bs);
    projections.modality = {
      type: 'beeld',
      resolution: res,
      blockSize: bs,
      blocks,
      pixels: buf.length,
      bytesPerPixel: 1, // simplistisch; RGB/RGBA vereist meer
      note: 'afhankelijk van resolutie; inhoud per pixel in verschillende blokken',
    };
  } else if (modality === 'licht') {
    // Byte → amplitude/frequentie-mapping
    const amplitudes = bytes.map(b => ({
      byte: b,
      amplitude: b / 255, // 0-1 normalisatie
      frequency: b * 10, // ruwe frequentie-mapping (10-2550 Hz)
    }));
    projections.modality = {
      type: 'licht',
      samples: amplitudes.length,
      avgAmplitude: (amplitudes.reduce((a, s) => a + s.amplitude, 0) / amplitudes.length).toFixed(4),
      peakByte: Math.max(...bytes),
      note: 'byte → amplitude/frequentie mapping',
    };
  } else if (modality === 'geluid') {
    // Byte → frequentie-mapping (NPR-achtig)
    const frequencies = bytes.map(b => ({
      byte: b,
      midi: Math.round(69 + 12 * Math.log2(b / 440)), // MIDI-note benadering
      hz: b > 0 ? 440 * Math.pow(2, (Math.log2(b / 440)) / 12) : 0,
    }));
    projections.modality = {
      type: 'geluid',
      samples: frequencies.length,
      avgHz: (frequencies.reduce((a, f) => a + f.hz, 0) / frequencies.length).toFixed(1),
      note: 'byte → MIDI/HZ frequentie-mapping',
    };
  } else if (modality === 'wiskundig') {
    projections.modality = {
      type: 'wiskundig',
      nprSum,
      nprRoot,
      byteMean: (nprSum / bytes.length).toFixed(2),
      byteMin: Math.min(...bytes),
      byteMax: Math.max(...bytes),
      byteStdDev: (function() {
        const mean = nprSum / bytes.length;
        const variance = bytes.reduce((a, b) => a + (b - mean) ** 2, 0) / bytes.length;
        return Math.sqrt(variance).toFixed(2);
      })(),
      note: 'digital root, hex, NPR-reductie',
    };
  }

  return Object.freeze(projections);
}

/**
 * Multi-modale analyse: projecteer base64 naar alle modaliteiten.
 * Toont hoe één structuur meerdere betekenislagen draagt.
 *
 * @param {string} base64Data — base64 string
 * @param {Object} [options] — opties voor elke modaliteit
 *
 * @returns {Object} multi-modale analyse
 */
function multiModalAnalysis(base64Data, options = {}) {
  const results = {};
  for (const m of BASE64_BRIDGE_MODALITIES) {
    results[m] = base64ModalBridge(base64Data, m, options);
  }

  return Object.freeze({
    modalities: results,
    modalityCount: BASE64_BRIDGE_MODALITIES.length,
    note: 'één byte-stream → meerdere betekenislagen tegelijk',
  });
}

// ─────────────────────────────────────────────
// 10. BLOCK_CONTRACT
// ─────────────────────────────────────────────

const BLOCK_CONTRACT = Object.freeze({
  id: '25_kunst_geluid',
  phases: ['createArtCycle', 'meaningDensity', 'artisticReading'],
  inputSchema: 'NPR_ART_SIGNAL',
  outputSchema: 'NPR_ART_CYCLE',
  dependencies: ['24_return_naar_bron'],
});

// ─────────────────────────────────────────────
// 10. Exports
// ─────────────────────────────────────────────

module.exports = {
  BLOCK_CONTRACT,
  ART_SIGNALS,
  FREEDOM_TYPES,
  ART_PERSPECTIVES,
  KNOWN_NPR_READINGS,
  BASE64_BRIDGE_MODALITIES,
  meaningDensity,
  createArtisticEye,
  artisticReading,
  defineArtifactRoutes,
  defineArtisticFreedom,
  createArtCycle,
  defineNPRReading,
  base64ModalBridge,
  multiModalAnalysis,
};
