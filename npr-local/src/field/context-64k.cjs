// @addr 10.12.0.0 | fd00:npr:000c:000::0
// ═════════════════════════════════════════════
// Context 64K — Hypervisor + Blokmodel
// ═════════════════════════════════════════════
//
// Principe: npr-local routeert niet tokens.
// Het routeert 6-bit blockadressen.
// Ieder adres ontsluit één geïsoleerd contextblok ≤ 1024 tokens.
//
// Route: sessie → 6-bit adres → blokselectie → hypervisor
//        → model inference → antwoord → Tool-00 → commit/rollback
//
// VM hypervisor:   CPU + geheugen + apparaten isoleren
// Context hypervisor: tokens + tools + memory + authority isoleren

const TOKENS_PER_BLOCK = 1024;
const BLOCK_COUNT = 64;
const MAX_CONTEXT_TOKENS = TOKENS_PER_BLOCK * BLOCK_COUNT; // 65536

// ─── 6-bit Adressering ───

const ADDR6 = Object.freeze({
  MASK: 0x3F,
  MIN: 0,
  MAX: 63,
  encode(addr) {
    return Math.min(63, Math.max(0, addr)) & this.MASK;
  },
  toBinary(addr) {
    return this.encode(addr).toString(2).padStart(6, '0');
  },
  toHex(addr) {
    return '0x' + this.encode(addr).toString(16).padStart(2, '0').toUpperCase();
  },
});

// ─── Blok-domein layout ───
// 4 velden, elk 16 blokken (symmetrisch)
// Hypervisor mag dynamisch herverdelen

const BLOCK_LAYOUT = Object.freeze({
  summary: {
    id: 'summary',
    prefix: 0b00,
    start: 0,
    endExclusive: 16,
    blocks: 16,
    bits: '000000–001111',
    description: 'System summary + geconcentreerd verleden',
  },
  recent: {
    id: 'recent',
    prefix: 0b01,
    start: 16,
    endExclusive: 32,
    blocks: 16,
    bits: '010000–011111',
    description: 'Recente sessiebeweging',
  },
  retrieval: {
    id: 'retrieval',
    prefix: 0b10,
    start: 32,
    endExclusive: 48,
    blocks: 16,
    bits: '100000–101111',
    description: 'Memory / tools / retrieval',
  },
  'return': {
    id: 'return',
    prefix: 0b11,
    start: 48,
    endExclusive: 64,
    blocks: 16,
    bits: '110000–111111',
    description: 'Antwoord / return / validatie',
  },
});

const DOMAIN_ORDER = ['summary', 'recent', 'retrieval', 'return'];

// ─── Address → Domain ───

function addrToDomain(addr) {
  const a = ADDR6.encode(addr);
  const prefix = (a >> 4) & 0b11; // eerste 2 bits
  const local = a & 0b001111;      // laatste 4 bits
  for (const d of DOMAIN_ORDER) {
    const def = BLOCK_LAYOUT[d];
    if (prefix === def.prefix && local < def.blocks) {
      return { domain: d, domainDef: def, addr: a, localIndex: local };
    }
  }
  return null;
}

// ─── Context Block ───
// Immutable blok met provenance + permissions

function createContextBlock({ address, domain, text, tokenCount, provenance, writable = false }) {
  if (!Number.isInteger(address) || address < 0 || address >= BLOCK_COUNT) {
    throw new RangeError(`Invalid 6-bit block address: ${address}`);
  }
  if (tokenCount > TOKENS_PER_BLOCK) {
    throw new RangeError(`Block ${ADDR6.toBinary(address)} contains ${tokenCount}; maximum is ${TOKENS_PER_BLOCK}`);
  }

  return Object.freeze({
    address,
    address6Bit: ADDR6.toBinary(address),
    domain,
    text: text || '',
    tokenCount,
    provenance: Object.freeze({ ...provenance }),
    writable,
  });
}

// Token counter (simple estimate; replace with llama.cpp tokenizer in production)
function countTokens(text) {
  if (!text) return 0;
  // ~4 chars per token for English; ~3.5 for Dutch
  return Math.ceil(text.length / 3.8);
}

// ─── Block helpers ───

function splitIntoBlocks(text, { startAddress, domain = 'return', provenance }) {
  const tokens = countTokens(text);
  const blocks = [];

  for (let offset = 0, idx = 0; offset < text.length; idx++) {
    const addr = startAddress + idx;
    if (addr >= BLOCK_COUNT) {
      throw new RangeError(`No context block capacity remaining at address ${addr}`);
    }

    // Split text into ~1024 token chunks
    const chunk = text.slice(offset, offset + (TOKENS_PER_BLOCK * 3.8));
    const chunkTokens = countTokens(chunk);

    blocks.push(createContextBlock({
      address: addr,
      domain,
      text: chunk,
      tokenCount: chunkTokens,
      provenance: { ...provenance, sequence: idx },
      writable: true,
    }));

    offset += chunk.length;
    if (offset >= text.length) break;
  }

  return blocks;
}

// ─── Context Hypervisor ───
//
// Isoleert tokens + tools + memory + authority
// Snapshot/rollback voor sandbox-run
//

class Context64K {
  constructor() {
    this._blocks = new Map();
  }

  // ─── Mount / Unmount ───

  mount(block) {
    if (this._blocks.has(block.address)) {
      throw new Error(`Block ${block.address6Bit} is already mounted`);
    }
    this._blocks.set(block.address, block);
  }

  unmount(address) {
    this._blocks.delete(ADDR6.encode(address));
  }

  read(address) {
    return this._blocks.get(ADDR6.encode(address)) ?? null;
  }

  // Selecteer blokken voor een modelpass
  select(addresses) {
    const blocks = addresses.map(addr => {
      const block = this.read(addr);
      if (!block) {
        throw new Error(`Context block ${ADDR6.toBinary(addr)} is not mounted`);
      }
      return block;
    });
    return Object.freeze(blocks);
  }

  // ─── Domein-bewaking ───

  selectByDomain(domainId) {
    const def = BLOCK_LAYOUT[domainId];
    if (!def) throw new Error(`Unknown domain: ${domainId}`);

    const blocks = [];
    for (let addr = def.start; addr < def.endExclusive; addr++) {
      const block = this.read(addr);
      if (block) blocks.push(block);
    }
    return Object.freeze(blocks);
  }

  // ─── Snapshot / Restore (rollback) ───

  snapshot() {
    return new Map(this._blocks);
  }

  restore(snapshot) {
    this._blocks = new Map(snapshot);
  }

  // ─── List / Status ───

  list() {
    return [...this._blocks.values()]
      .sort((a, b) => a.address - b.address);
  }

  status() {
    const domainAlloc = {};
    for (const d of DOMAIN_ORDER) {
      const def = BLOCK_LAYOUT[d];
      let count = 0;
      for (let addr = def.start; addr < def.endExclusive; addr++) {
        if (this._blocks.has(addr)) count++;
      }
      domainAlloc[d] = count;
    }

    const total = this._blocks.size;
    const writable = this.list().filter(b => b.writable).length;
    const totalTokens = this.list().reduce((sum, b) => sum + b.tokenCount, 0);

    return {
      totalBlocks: total,
      maxBlocks: BLOCK_COUNT,
      remainingBlocks: BLOCK_COUNT - total,
      totalTokens,
      writableBlocks: writable,
      domains: domainAlloc,
      utilization: total / BLOCK_COUNT,
    };
  }

  // ─── Validatie ───

  validate() {
    const errors = [];

    for (const block of this.list()) {
      if (block.tokenCount > TOKENS_PER_BLOCK) {
        errors.push({
          type: 'block-overflow',
          address: block.address6Bit,
          tokens: block.tokenCount,
          max: TOKENS_PER_BLOCK,
        });
      }
      if (block.domain && !BLOCK_LAYOUT[block.domain]) {
        errors.push({
          type: 'unknown-domain',
          address: block.address6Bit,
          domain: block.domain,
        });
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // ─── Compaction ───
  // Verplaats recente blokken → summary met ratio

  compactFromDomain(fromDomain, toDomain, ratio = 4) {
    const fromDef = BLOCK_LAYOUT[fromDomain];
    const toDef = BLOCK_LAYOUT[toDomain];

    const activeBlocks = [];
    for (let addr = fromDef.start; addr < fromDef.endExclusive; addr++) {
      const block = this.read(addr);
      if (block) activeBlocks.push(block);
    }

    if (activeBlocks.length === 0) {
      return { compacted: 0, freed: 0, summaryBlocks: [] };
    }

    // Merge text from active blocks
    const mergedText = activeBlocks.map(b => b.text).join('\n');
    const summaryNeeded = Math.ceil(activeBlocks.length / ratio);

    // Check capacity
    const toAvailable = toDef.endExclusive - toDef.start - (this.status().domains[toDomain] || 0);
    if (summaryNeeded > toAvailable) {
      throw new Error(
        `Compaction needs ${summaryNeeded} blocks in '${toDomain}', only ${toAvailable} available`
      );
    }

    // Allocate summary blocks
    const startAddr = toDef.start;
    const summaryBlocks = splitIntoBlocks(mergedText, {
      startAddress: startAddr,
      domain: toDomain,
      provenance: {
        type: 'compaction',
        source: activeBlocks.map(b => b.address6Bit),
        ratio,
      },
    });

    // Mount summary, unmount source
    for (const sb of summaryBlocks) this.mount(sb);
    for (const ab of activeBlocks) this.unmount(ab.address);

    return {
      compacted: activeBlocks.length,
      freed: activeBlocks.length,
      summaryBlocks: summaryBlocks.map(b => b.address6Bit),
      ratio,
    };
  }
}

// ─── Sandbox Run ───
//
// Kandidaat-antwoord eerst sandbox, dan Tool-00 validatie,
// dan commit of rollback

async function runAnswerSandbox({ hypervisor, selectedAddresses, generate, validate, executeTools }) {
  const snapshot = hypervisor.snapshot();

  try {
    const mounted = hypervisor.select(selectedAddresses);

    const candidate = await generate({ contextBlocks: mounted });

    const toolResult = await executeTools(candidate, { mode: 'sandbox' });

    const validation = await validate({
      candidate,
      toolResult,
      contextBlocks: mounted,
    });

    if (!validation.valid) {
      hypervisor.restore(snapshot);
      return { status: 'rolled_back', candidate, validation };
    }

    return { status: 'committed', answer: candidate, toolResult, validation };

  } catch (error) {
    hypervisor.restore(snapshot);
    throw error;
  }
}

// ─── Tool-00 Answer Validator ───
//
// Beslist of antwoord gecommitted mag worden

function validateAnswerRoute({ candidate, toolResult, contextBlocks }) {
  const violations = [];

  if (candidate.tokenCount && candidate.tokenCount > TOKENS_PER_BLOCK) {
    violations.push({
      type: 'return-block-overflow',
      maximum: TOKENS_PER_BLOCK,
      received: candidate.tokenCount,
    });
  }

  for (const call of (toolResult.calls || [])) {
    if (!call.capabilityNamed) {
      violations.push({ type: 'unnamed-capability', tool: call.name });
    }
    if (!call.authorized) {
      violations.push({ type: 'unauthorized-capability', tool: call.name });
    }
  }

  return {
    valid: violations.length === 0,
    violations,
    sourceBlocks: contextBlocks.map(b => b.address6Bit),
  };
}

// ─── NPR Analyse ───

function analyzeContext64K(hypervisor) {
  const s = hypervisor.status();
  const dr = digitalRoot(s.totalTokens);

  return {
    validation: s,
    digitalRoot: dr,
    npr: {
      noise: s.remainingBlocks,      // onbezet = potentieel
      pattern: s.totalBlocks,        // gemount = gestructureerd
      return: Math.round(s.utilization * 10), // volledigheid
    },
    domains: s.domains,
    writable: s.writableBlocks,
  };
}

function digitalRoot(n) {
  n = Math.abs(parseInt(n) || 0);
  if (n === 0) return 0;
  return ((n - 1) % 9) + 1;
}

// ─── Exports ───

module.exports = {
  TOKENS_PER_BLOCK,
  BLOCK_COUNT,
  MAX_CONTEXT_TOKENS,
  ADDR6,
  BLOCK_LAYOUT,
  DOMAIN_ORDER,
  addrToDomain,
  createContextBlock,
  countTokens,
  splitIntoBlocks,
  Context64K,
  runAnswerSandbox,
  validateAnswerRoute,
  analyzeContext64K,
};
