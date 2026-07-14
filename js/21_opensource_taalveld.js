#!/usr/bin/env node
/**
 * NPR-OS Stap 21: Validate Nearest — Lokale Foutisolatie
 *
 * Generieke validatielaag voor driefasenblokken.
 * Beheert blokstatus, foutadres en gerichte hervalidatie.
 *
 * Principe: VALIDATE_NEAREST
 *   Een fout markeert het kleinste zelfstandig valideerbare blok
 *   of de kleinste gebroken overdracht.
 *   De volledige route wordt niet automatisch opnieuw uitgevoerd.
 *
 * Statussen:
 *   VALID               — lokaal en aan gesloten keten
 *   INVALID_LOCAL       — interne route van blok sluit niet
 *   INVALID_CHAIN       — overdracht tussen twee blokken sluit niet
 *   PENDING_REVALIDATE  — upstream contract gewijzigd
 *   BLOCKED_BY_UPSTREAM — bron is lokaal ongeldig
 *
 * © 2026-07-14 — NPR-OS sandbox
 */

// ============================================================
// BLOCK_STATUS — status constanten
// ============================================================

const BLOCK_STATUS = Object.freeze({
  VALID: 'VALID',
  INVALID_LOCAL: 'INVALID_LOCAL',
  INVALID_CHAIN: 'INVALID_CHAIN',
  PENDING_REVALIDATE: 'PENDING_REVALIDATE',
  BLOCKED_BY_UPSTREAM: 'BLOCKED_BY_UPSTREAM',
});

// ============================================================
// contractHash — content-based contract identifier
// ============================================================

/**
 * Genereer een kort hash-achtige ID uit contractinhoud.
 * Geen versienummer — alleen inhoudelijke identificatie.
 *
 * @param {Object} fields — velden die het contract definiëren
 * @returns {string} contract hash bijv "18B:7A3F91"
 */
function contractHash(fields) {
  // Deterministische string-serialize → simple hash
  const raw = JSON.stringify(fields, Object.keys(fields).sort());
  // DJB2-style hash, 6-char hex
  let h = 5381;
  for (let i = 0; i < raw.length; i++) {
    h = ((h << 5) + h + raw.charCodeAt(i)) | 0;
  }
  const hex = Math.abs(h).toString(16).toUpperCase().slice(0, 6).padStart(6, '0');
  return hex;
}

// ============================================================
// defineBlock — blokcontract aanmaken
// ============================================================

/**
 * Maak een nieuw valideerbaar blok.
 *
 * @param {Object} spec
 * @param {string} spec.id              — unieke blok-ID
 * @param {*}      spec.input           — invoerdata
 * @param {Function} spec.run           — kernbewerking: input → output
 * @param {Function} [spec.validateInput]  — valideer invoer (throw bij mislukt)
 * @param {Function} [spec.validateOutput] — valideer uitvoer (throw bij mislukt)
 * @param {string}   [spec.contractId]  — contract-ID (verandert bij schema-aanpassing)
 * @param {string[]} [spec.dependsOn]   — lijst van upstream blok-IDs
 * @param {Object}   [spec.contract]    — extra contractdata (schema, versie, etc.)
 * @param {Object}   [spec.inputSchema] — invoerschema-definitie
 * @param {Object}   [spec.outputSchema] — uitvoerschema-definitie
 * @param {string[]} [spec.operators]   — gebruikte operatoren
 *
 * @returns {Object} blok met status, error, output, dependsOn, etc.
 */
function defineBlock(spec) {
  const block = Object.assign({
    localStatus: BLOCK_STATUS.PENDING_REVALIDATE,
    chainStatus: null,
    output: undefined,
    error: null,
  }, spec);

  // Zorg voor defaults
  if (!block.validateInput) {
    block.validateInput = () => { /* geen input-validatie */ };
  }
  if (!block.validateOutput) {
    block.validateOutput = () => { /* geen output-validatie */ };
  }
  if (!block.dependsOn) {
    block.dependsOn = [];
  }

  // Contract-ID: content-hash ipv versienummer
  // Geen @1/@2 — hash verandert alleen bij inhoudelijke wijziging
  if (!block.contractId) {
    const hash = contractHash({
      inputSchema: block.inputSchema,
      outputSchema: block.outputSchema,
      operators: block.operators,
      dependencies: block.dependsOn,
    });
    block.contractId = `${block.id}:${hash}`;
  }

  return block;
}

// ============================================================
// validateLocal — lokale validatie van één blok
// ============================================================

/**
 * Valideer de interne route van een blok.
 *
 * @param {Object} block — door defineBlock aangemaakt
 *
 * @returns {Object} resultaat met ok, type, blockId, output | message
 */
function validateLocal(block) {
  try {
    block.validateInput(block.input);

    const output = block.run(block.input);

    block.validateOutput(output);

    block.output = output;
    block.localStatus = BLOCK_STATUS.VALID;
    block.chainStatus = null;
    block.error = null;

    return {
      ok: true,
      type: 'LOCAL_VALID',
      blockId: block.id,
      output,
    };
  } catch (error) {
    block.localStatus = BLOCK_STATUS.INVALID_LOCAL;
    block.error = {
      type: 'LOCAL_ERROR',
      blockId: block.id,
      message: error.message,
    };

    return {
      ok: false,
      ...block.error,
    };
  }
}

// ============================================================
// applyIncoming — pas inkomende overdracht toe vóór lokale validatie
// ============================================================

/**
 * Valideer en pas de overdracht van source → target toe.
 * Hierbij wordt target.input daadwerkelijk bijgewerkt.
 *
 * INVALID_LOCAL heeft voorrang op BLOCKED_BY_UPSTREAM.
 *
 * @param {Object}   sourceBlock — upstream blok
 * @param {Object}   targetBlock — downstream blok
 * @param {Function} transfer    — transformatie: source.output → target.input
 *
 * @returns {Object} resultaat met ok, type, edge, ...
 */
function applyIncoming(sourceBlock, targetBlock, transfer) {
  // Upstream check
  if (sourceBlock.localStatus !== BLOCK_STATUS.VALID) {
    // INVALID_LOCAL heeft voorrang — overschrijf niet
    if (targetBlock.localStatus !== BLOCK_STATUS.INVALID_LOCAL) {
      targetBlock.chainStatus = BLOCK_STATUS.BLOCKED_BY_UPSTREAM;
    }

    return {
      ok: false,
      type: 'BLOCKED_BY_UPSTREAM',
      sourceId: sourceBlock.id,
      targetId: targetBlock.id,
      message: `Bron ${sourceBlock.id} is ${sourceBlock.localStatus}`,
      targetLocalStatus: targetBlock.localStatus,
    };
  }

  // Transfer berekenen en valideren
  try {
    const nextInput = transfer(sourceBlock.output);
    targetBlock.validateInput(nextInput);
    
    // Daadwerkelijk toewijzen — target draait op nieuwe input
    targetBlock.input = nextInput;

    return {
      ok: true,
      type: 'CHAIN_INPUT_READY',
      edge: `${sourceBlock.id}→${targetBlock.id}`,
    };
  } catch (error) {
    // INVALID_LOCAL heeft voorrang
    if (targetBlock.localStatus !== BLOCK_STATUS.INVALID_LOCAL) {
      targetBlock.chainStatus = BLOCK_STATUS.INVALID_CHAIN;
    }

    return {
      ok: false,
      type: 'CHAIN_ERROR',
      edge: `${sourceBlock.id}→${targetBlock.id}`,
      message: error.message,
    };
  }
}

// ============================================================
// validateChain — kettingvalidatie tussen twee blokken
// ============================================================

/**
 * Valideer de overdracht van sourceBlock → targetBlock.
 * Pas de overdracht toe en wijzig target.input.
 *
 * @param {Object}   sourceBlock — upstream blok
 * @param {Object}   targetBlock — downstream blok
 * @param {Function} transfer    — transformatie: source.output → target.input
 *
 * @returns {Object} resultaat met ok, type, edge, ...
 */
function validateChain(sourceBlock, targetBlock, transfer) {
  if (sourceBlock.localStatus !== BLOCK_STATUS.VALID) {
    // INVALID_LOCAL heeft voorrang op BLOCKED_BY_UPSTREAM
    if (targetBlock.localStatus !== BLOCK_STATUS.INVALID_LOCAL) {
      targetBlock.chainStatus = BLOCK_STATUS.BLOCKED_BY_UPSTREAM;
    }

    return {
      ok: false,
      type: 'BLOCKED_BY_UPSTREAM',
      sourceId: sourceBlock.id,
      targetId: targetBlock.id,
      message: `Bron ${sourceBlock.id} is ${sourceBlock.localStatus}`,
      targetLocalStatus: targetBlock.localStatus,
    };
  }

  try {
    const transferredInput = transfer(sourceBlock.output);

    targetBlock.validateInput(transferredInput);
    
    // Input daadwerkelijk toewijzen
    targetBlock.input = transferredInput;

    return {
      ok: true,
      type: 'CHAIN_VALID',
      edge: `${sourceBlock.id}→${targetBlock.id}`,
    };
  } catch (error) {
    if (targetBlock.localStatus !== BLOCK_STATUS.INVALID_LOCAL) {
      targetBlock.chainStatus = BLOCK_STATUS.INVALID_CHAIN;
    }

    return {
      ok: false,
      type: 'CHAIN_ERROR',
      edge: `${sourceBlock.id}→${targetBlock.id}`,
      message: error.message,
    };
  }
}

// ============================================================
// markContractChanged — cascade PENDING_REVALIDATE
// ============================================================

/**
 * Markeer een blok en alle afhankelijke downstream-blokken
 * als PENDING_REVALIDATE.
 *
 * PENDING_REVALIDATE ≠ INVALID
 *
 * @param {Object} block     — gewijzigd blok
 * @param {Object[]} allBlocks — alle beheerde blokken
 *
 * @returns {string[]} lijst van beïnvloede blok-IDs
 */
function markContractChanged(block, allBlocks) {
  block.localStatus = BLOCK_STATUS.PENDING_REVALIDATE;

  const affected = [block.id];
  const queue = [block.id];
  const visited = new Set([block.id]);

  while (queue.length > 0) {
    const sourceId = queue.shift();

    for (const candidate of allBlocks) {
      if (
        candidate.dependsOn.includes(sourceId) &&
        !visited.has(candidate.id)
      ) {
        candidate.localStatus = BLOCK_STATUS.PENDING_REVALIDATE;
        visited.add(candidate.id);
        affected.push(candidate.id);
        queue.push(candidate.id);
      }
    }
  }

  return affected;
}

// ============================================================
// validateNearest — VALIDATE_NEAREST hoofdregel
// ============================================================

/**
 * Valideer het aangewezen blok en zijn directe overgangen.
 *
 * Volgorde (correct):
 *   1. inkomende transfer  →  target.input bijwerken
 *   2. lokale validatie    (op nieuwe input)
 *   3. uitgaande transfer  (indien aanwezig)
 *
 * Stopt bij eerste fout — upstream/downstream wordt niet
 * automatisch herstart.
 *
 * @param {Object} opts
 * @param {Object} opts.block       — doelblok
 * @param {Object} [opts.incoming]  — { source, transfer }
 * @param {Object} [opts.outgoing]  — { target, transfer }
 *
 * @returns {Object} { ok, nearestTarget, results[] }
 */
function validateNearest(opts) {
  const { block, incoming, outgoing } = opts;

  const results = [];

  // 1. Inkomende transfer vóór lokale validatie
  if (incoming) {
    const incomingResult = applyIncoming(
      incoming.source,
      block,
      incoming.transfer
    );
    results.push(incomingResult);

    if (!incomingResult.ok) {
      return {
        ok: false,
        nearestTarget: incomingResult.edge ?? block.id,
        results,
      };
    }
  }

  // 2. Lokale validatie (op de actuele input)
  const localResult = validateLocal(block);
  results.push(localResult);

  if (!localResult.ok) {
    return {
      ok: false,
      nearestTarget: block.id,
      results,
    };
  }

  // 3. Uitgaande transfer
  if (outgoing) {
    const chainOut = validateChain(block, outgoing.target, outgoing.transfer);
    results.push(chainOut);
  }

  return {
    ok: results.every(r => r.ok),
    nearestTarget: block.id,
    results,
  };
}

// ============================================================
// validateRoute — volledige driefasensluiting
// ============================================================

/**
 * Valideer een volledige route:
 *   BLOCK_A → BLOCK_B → BLOCK_C
 *
 * Elke fase zelfstandig valideerbaar.
 * Elke overgang expliciet gecontroleerd.
 * Volledige transfers vereist: blocks.length - 1.
 *
 * @param {Object[]} blocks — geordende lijst van blokken
 * @param {Function[]} transfers — transformatiefuncties tussen opeenvolgende blokken
 *
 * @returns {Object} { ok, routeValid, results[], errors[] }
 */
function validateRoute(blocks, transfers) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return {
      ok: false,
      routeValid: false,
      results: [],
      errors: [{ type: 'EMPTY_ROUTE', message: 'Route bevat geen blokken' }],
    };
  }

  const results = [];
  const errors = [];

  // Verplichte transfers: exact blocks.length - 1
  const requiredTransferCount = blocks.length - 1;
  if (
    !Array.isArray(transfers) ||
    transfers.length !== requiredTransferCount
  ) {
    return {
      ok: false,
      routeValid: false,
      results: [],
      errors: [{
        type: 'INCOMPLETE_ROUTE',
        expectedTransfers: requiredTransferCount,
        receivedTransfers: Array.isArray(transfers) ? transfers.length : 0,
      }],
    };
  }

  // 1. Lokale validatie voor alle blokken
  for (const block of blocks) {
    const local = validateLocal(block);
    results.push(local);
    if (!local.ok) {
      errors.push(local);
    }
  }

  // 2. Kettingvalidatie voor alle overgangen
  // INVALID_LOCAL heeft voorrang op BLOCKED_BY_UPSTREAM
  for (let i = 0; i < blocks.length - 1; i++) {
    const chain = validateChain(blocks[i], blocks[i + 1], transfers[i]);
    results.push(chain);
    if (!chain.ok) {
      errors.push(chain);
    }
  }

  return {
    ok: errors.length === 0,
    routeValid: errors.length === 0,
    results,
    errors,
  };
}

// ============================================================
// BLOCK_CONTRACT — stap 21 eigen contract
// ============================================================

const BLOCK_CONTRACT = Object.freeze({
  id: '21_opensource_taalveld',
  phases: ['defineBlock', 'applyIncoming', 'validateLocal', 'validateChain', 'validateNearest', 'validateRoute'],
  inputSchema: 'NPR_BLOCK_SPEC',
  outputSchema: 'NPR_VALIDATION_RESULT',
  dependencies: [], // zelfstandig — validatie-infrastructuur
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  BLOCK_STATUS,
  BLOCK_CONTRACT,
  contractHash,
  defineBlock,
  validateLocal,
  applyIncoming,
  validateChain,
  markContractChanged,
  validateNearest,
  validateRoute,
};
