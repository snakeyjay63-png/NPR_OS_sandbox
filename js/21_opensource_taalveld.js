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
 *
 * @returns {Object} blok met status, error, output, dependsOn, etc.
 */
function defineBlock(spec) {
  const block = Object.assign({
    status: BLOCK_STATUS.PENDING_REVALIDATE,
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
  if (!block.contractId) {
    block.contractId = `${block.id}@1`;
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
    block.status = BLOCK_STATUS.VALID;
    block.error = null;

    return {
      ok: true,
      type: 'LOCAL_VALID',
      blockId: block.id,
      output,
    };
  } catch (error) {
    block.status = BLOCK_STATUS.INVALID_LOCAL;
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
// validateChain — kettingvalidatie tussen twee blokken
// ============================================================

/**
 * Valideer de overdracht van sourceBlock → targetBlock.
 *
 * @param {Object}   sourceBlock — upstream blok
 * @param {Object}   targetBlock — downstream blok
 * @param {Function} transfer    — transformatie: source.output → target.input
 *
 * @returns {Object} resultaat met ok, type, edge, ...
 */
function validateChain(sourceBlock, targetBlock, transfer) {
  if (sourceBlock.status !== BLOCK_STATUS.VALID) {
    targetBlock.status = BLOCK_STATUS.BLOCKED_BY_UPSTREAM;

    return {
      ok: false,
      type: 'BLOCKED_BY_UPSTREAM',
      sourceId: sourceBlock.id,
      targetId: targetBlock.id,
      message: `Bron ${sourceBlock.id} is ${sourceBlock.status}`,
    };
  }

  try {
    const transferredInput = transfer(sourceBlock.output);

    targetBlock.validateInput(transferredInput);

    return {
      ok: true,
      type: 'CHAIN_VALID',
      edge: `${sourceBlock.id}→${targetBlock.id}`,
      input: transferredInput,
    };
  } catch (error) {
    targetBlock.status = BLOCK_STATUS.INVALID_CHAIN;

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
  block.status = BLOCK_STATUS.PENDING_REVALIDATE;

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
        candidate.status = BLOCK_STATUS.PENDING_REVALIDATE;
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
 * Volgorde:
 *   1. lokale validatie
 *   2. inkomende overgang  (indien aanwezig)
 *   3. uitgaande overgang  (indien aanwezig)
 *
 * Stopt bij lokale fout — upstream/downstream wordt niet
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

  // 1. Lokale validatie
  const localResult = validateLocal(block);
  results.push(localResult);

  if (!localResult.ok) {
    return {
      ok: false,
      nearestTarget: block.id,
      results,
    };
  }

  // 2. Inkomende overgang
  if (incoming) {
    const chainIn = validateChain(incoming.source, block, incoming.transfer);
    results.push(chainIn);
  }

  // 3. Uitgaande overgang
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

  // Lokale validatie voor alle blokken
  for (const block of blocks) {
    const local = validateLocal(block);
    results.push(local);
    if (!local.ok) {
      errors.push(local);
    }
  }

  // Kettingvalidatie voor alle overgangen
  if (transfers && transfers.length > 0) {
    for (let i = 0; i < blocks.length - 1 && i < transfers.length; i++) {
      const chain = validateChain(blocks[i], blocks[i + 1], transfers[i]);
      results.push(chain);
      if (!chain.ok) {
        errors.push(chain);
      }
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
  phases: ['defineBlock', 'validateLocal', 'validateChain', 'validateNearest', 'validateRoute'],
  inputSchema: 'NPR_BLOCK_SPEC',
  outputSchema: 'NPR_VALIDATION_RESULT',
  dependencies: [], // zelfstandig — afhankelijk van andere blokken
  status: BLOCK_STATUS.VALID,
});

// ============================================================
// Exports
// ============================================================

module.exports = {
  BLOCK_STATUS,
  BLOCK_CONTRACT,
  defineBlock,
  validateLocal,
  validateChain,
  markContractChanged,
  validateNearest,
  validateRoute,
};
