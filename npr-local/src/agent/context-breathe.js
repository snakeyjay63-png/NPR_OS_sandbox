// Context Breath Engine v2 — Single Window, 4 Rollen
//
// Concept: context IS routing.
// Niet 4 processen — 1 context window, 4 rollen die erin ademen.
//
// Patanjali 1.5 — viveka (discriminatie):
//   Bepaal wat nu nodig is, geef dat ruimte,
//   de rest ademt uit.
//
// 24-bit cooperative routing: 4 × 6-bit laag
//   Bits die niet gebruikt worden → flow door naar volgende rol
//   Grenzen shift per route (niet statisch)
//
// Flow: Vogel → Haas → Aap → Olifant

// ─── 6-bit codon (inline) ───
const BIT6 = {
  MASK: 0x3F,
  STATES: 64,
  encode(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 6) ^ str.charCodeAt(i)) & BIT6.MASK;
    }
    return h;
  },
};

// ─── De 4 Rollen ───

const ROLES = {
  vogel: {
    id: 'vogel',
    name: 'Vogel',
    emoji: '🐦',
    hex: 0b000001, // 1
    bit: 1,
    description: 'Overzicht, planning, routing, patroonherkenning',
    mode: 'survey',
    // Hoeveel system-prompt ruimte deze rol nodig heeft (tokens)
    baseTokens: 120,
    // Max uitbreiding wanneer actief
    maxTokens: 480,
    // Trigger keywords
    triggers: ['overzicht', 'plan', 'routing', 'patroon', 'wat', 'hoe', 'waarom'],
  },
  haas: {
    id: 'haas',
    name: 'Haas',
    emoji: '🐇',
    hex: 0b000010, // 2
    bit: 2,
    description: 'Snelle lookup, feiten, direct antwoord, herinnering',
    mode: 'lookup',
    baseTokens: 80,
    maxTokens: 320,
    triggers: ['zoek', 'vind', 'feit', 'herinner', 'wat is', 'wie', 'wanneer', 'waar'],
  },
  aap: {
    id: 'aap',
    name: 'Aap',
    emoji: '🐒',
    hex: 0b000100, // 4
    bit: 4,
    description: 'Creativiteit, bouwen, code, experimenten',
    mode: 'build',
    baseTokens: 200,
    maxTokens: 800,
    triggers: ['bouw', 'maak', 'code', 'script', 'test', 'implementeer', 'fix'],
  },
  olifant: {
    id: 'olifant',
    name: 'Olifant',
    emoji: '🐘',
    hex: 0b001000, // 8
    bit: 8,
    description: 'Diep denken, analyse, complexe redenering, reflectie',
    mode: 'think',
    baseTokens: 160,
    maxTokens: 1024,
    triggers: ['denk', 'analyseer', 'waarom', 'verdiep', 'reflecteer', 'vergelijk'],
  },
};

// 6-bit routing: 4 rollen × 6-bit = 24-bit cooperative address
// Elke rol krijgt 6 bits (64 states)
// Ongebruikte bits flowen door naar volgende rol
const ROUTING_BITS = {
  MASK: 0x3F,      // 6 bits
  PER_ROLE: 6,     // bits per rol
  TOTAL_BITS: 24,  // 4 × 6
  ROLES: 4,

  // Bouw 24-bit routing address uit rol-niveaus (0-63 per rol)
  // level = 0..63 → bepaalt hoeveel tokens deze rol krijgt
  // 0 = baseTokens, 63 = maxTokens, lineair ertussen
  encode(alloc) {
    let addr = 0;
    const order = ['vogel', 'haas', 'aap', 'olifant'];
    for (const [i, role] of order.entries()) {
      // Clamp naar 6-bit (0-63)
      const level = Math.min(63, Math.max(0, alloc[role] || 0)) & this.MASK;
      addr |= level << (i * this.PER_ROLE);
    }
    return addr;
  },

  // Convert level (0-63) → actual tokens voor een rol
  levelToTokens(level, roleKey) {
    const role = ROLES[roleKey];
    if (!role) return 0;
    const ratio = level / this.MASK; // 0.0..1.0
    return Math.floor(role.baseTokens + ratio * (role.maxTokens - role.baseTokens));
  },

  // Convert tokens → level (0-63) voor een rol
  tokensToLevel(tokens, roleKey) {
    const role = ROLES[roleKey];
    if (!role) return 0;
    const range = role.maxTokens - role.baseTokens;
    if (range === 0) return 0;
    const ratio = Math.max(0, Math.min(1, (tokens - role.baseTokens) / range));
    return Math.round(ratio * this.MASK);
  },

  // Decode 24-bit address → levels (0-63 per rol)
  decode(addr) {
    const levels = {};
    const order = ['vogel', 'haas', 'aap', 'olifant'];
    for (const [i] of order.entries()) {
      levels[order[i]] = (addr >> (i * this.PER_ROLE)) & this.MASK;
    }
    return levels;
  },

  // Decode → actual tokens
  decodeTokens(addr) {
    const levels = this.decode(addr);
    const tokens = {};
    for (const [key, level] of Object.entries(levels)) {
      tokens[key] = this.levelToTokens(level, key);
    }
    return tokens;
  },

  // Hex string van 24-bit address
  hex(addr) {
    return '0x' + addr.toString(16).padStart(6, '0').toUpperCase();
  },
};

// ─── Context Breath Engine ───

class ContextBreath {
  constructor(options = {}) {
    // Totaal context window in tokens (model limit)
    this.windowTokens = options.windowTokens || 65536; // 64k

    // Huidige actieve rol
    this.currentRole = null;

    // Niveau per rol (0-63, 6-bit)
    // 0 = baseTokens, 63 = maxTokens
    this.levels = {
      vogel: 0,
      haas: 0,
      aap: 0,
      olifant: 0,
    };

    // System prompt per rol (te injecteren in context)
    this.rolePrompts = {};
    this._buildRolePrompts();

    // Conversatie geschiedenis (token budget tracking)
    this.conversationTokens = 0;

    // Routing history (voor trace)
    this.routeHistory = [];
  }

  // ─── System Prompt Bouwen ───

  _buildRolePrompts() {
    this.rolePrompts = {
      vogel: `JE BENT VOGEL — overzicht en routing.
Je ziet het volledige patroon. Bepaal wat nodig is, plan de route, herken patronen.
Dink in termen van flow: wat komt eerst, wat volgt, wat kan samenvallen.
Wees kort en duidelijk. Overzicht > detail.

Routing: kies de juiste rol voor de volgende stap.
- Haas: snelle feiten, lookup, herinnering
- Aap: bouwen, code, creatief werk
- Olifant: diep denken, complexe analyse
- Vogel: overzicht, planning, patroonherkenning`,

      haas: `JE BENT HAAS — snelle lookup en feiten.
Je antwoordt direct, zonder omhaal. Feit → antwoord → klaar.
Geen intros, geen uitleg, geen opbouw. Direct het antwoord.
Als je het niet weet: zeg het kort en schakel door naar Olifant.

Focus: accuraat, snel, beknopt.`,

      aap: `JE BENT AAP — bouwen en creëren.
Je code, script, test, en bouwt dingen. 
Je denkt in termen van: wat werkt, hoe kan dit, laat me het bouwen.
Experimenteel, praktisch, hands-on.

Output: werkende code, duidelijke instructies, testbare resultaten.
Als je vastloopt: vraag Olifant om analyse, of Vogel voor overzicht.`,

      olifant: `JE BENT OLIFANT — diep denken en reflectie.
Je analyseert grondig, denkt in lagen, verbindt patronen.
Complexiteit is je element. Je ziet wat anderen missen.

Focus: redenering, analyse, vergelijking, reflectie, verduidelijking.
Neem de tijd. Ga diep. Maar wees wel concreet — diep betekent niet vaag.`,
    };
  }

  // ─── Viveka: Discriminatie ───
  // Bepaal welke rol nu nodig is

  // @addr 10.03.3.1 | fd00:npr:0003:001::1 — role discernment
  discern(input) {
    if (!input || typeof input !== 'string') {
      return this._defaultRole();
    }

    const lower = input.toLowerCase();
    let bestMatch = null;
    let bestScore = 0;

    for (const [key, role] of Object.entries(ROLES)) {
      const score = this._roleScore(role, lower);
      if (score > bestScore) {
        bestScore = score;
        bestMatch = role;
      }
    }

    // Als score laag: default naar Haas (snel antwoord)
    if (bestScore < 2) {
      bestMatch = ROLES.haas;
    }

    return bestMatch;
  }

  // @addr 10.03.3.2 | fd00:npr:0003:001::2 — role scoring
  _roleScore(role, input) {
    let score = 0;
    for (const trigger of role.triggers) {
      if (input.includes(trigger)) {
        score += 3; // exact match
      }
      // Partial match (eerste 4 chars)
      if (input.includes(trigger.substring(0, 4))) {
        score += 1;
      }
    }
    return score;
  }

  // @addr 10.03.3.3 | fd00:npr:0003:001::3 — default role
  _defaultRole() {
    // Als er een actieve rol is: behoud die (continuïteit)
    if (this.currentRole) {
      return this.currentRole;
    }
    // Default: Haas (snel feitelijke check)
    return ROLES.haas;
  }

  // ─── Ademhaling: Token Budget ───

  // @addr 10.03.3.4 | fd00:npr:0003:001::4 — breath in (expand role)
  breatheIn(roleKey) {
    this.levels[roleKey] = Math.min(63, this.levels[roleKey] + 20);
    for (const k of Object.keys(ROLES)) {
      if (k !== roleKey) this.levels[k] = Math.max(0, this.levels[k] - 5);
    }
    return this._levelsToTokens();
  }

  // @addr 10.03.3.5 | fd00:npr:0003:001::5 — breath out (compress role)
  breatheOut(roleKey) {
    this.levels[roleKey] = Math.max(0, this.levels[roleKey] - 15);
    for (const k of Object.keys(ROLES).filter(k => k !== roleKey)) {
      this.levels[k] = Math.min(63, this.levels[k] + 3);
    }
    return this._levelsToTokens();
  }

  // @addr 10.03.3.13 | fd00:npr:0003:001::13 — levels → tokens
  _levelsToTokens() {
    const tokens = {};
    for (const [key, level] of Object.entries(this.levels)) {
      tokens[key] = ROUTING_BITS.levelToTokens(level, key);
    }
    return tokens;
  }

  // @addr 10.03.3.6 | fd00:npr:0003:001::6 — available tokens
  _availableTokens() {
    const t = this._levelsToTokens();
    const systemCost = Object.values(t).reduce((a, b) => a + b, 0);
    return this.windowTokens - systemCost - this.conversationTokens;
  }

  // ─── Routing ───

  // @addr 10.03.3.7 | fd00:npr:0003:001::7 — full route (discern + breath + prompt)
  route(input) {
    // 1. Bepaal rol (viveka)
    const role = this.discern(input);
    this.currentRole = role;

    // 2. Adem in voor deze rol
    const alloc = this.breatheIn(role.id);

    // 3. 24-bit routing address (van levels)
    const addr = ROUTING_BITS.encode(this.levels);

    // 4. Bouw system prompt voor deze rol
    const systemPrompt = this._buildSystemPrompt(role, alloc);

    // 5. Log route
    const route = {
      role: role.id,
      addr: ROUTING_BITS.hex(addr),
      levels: { ...this.levels },
      tokens: alloc,
      available: this._availableTokens(),
      used: this.conversationTokens,
    };
    this.routeHistory.push(route);

    return {
      role,
      systemPrompt,
      route,
      nextRole: this._suggestNext(role),
    };
  }

  // @addr 10.03.3.8 | fd00:npr:0003:001::8 — build system prompt
  _buildSystemPrompt(activeRole, alloc) {
    const parts = [];

    // Header
    parts.push(`NPR-OS Context Breath — 4-rollen routing (24-bit)`);
    parts.push(`Rol: ${activeRole.name} ${activeRole.emoji}`);
    parts.push(`Routing: ${ROUTING_BITS.hex(ROUTING_BITS.encode(this.levels))}`);
    parts.push('');

    // Actieve rol — volle instructie
    parts.push(this.rolePrompts[activeRole.id]);
    parts.push('');

    // Andere rollen — alleen beschikbare als ze ruimte hebben
    for (const [key, role] of Object.entries(ROLES)) {
      if (key !== activeRole.id) {
        const ratio = alloc[key] / role.maxTokens;
        if (ratio > 0.5) {
          // Deze rol heeft genoeg ruimte voor hint
          parts.push(`[${role.name}] ${role.description}`);
        }
      }
    }

    return parts.join('\n');
  }

  // @addr 10.03.3.9 | fd00:npr:0003:001::9 — suggest next role
  _suggestNext(currentRole) {
    // Flow: Vogel→Haas→Aap→Olifant→Vogel
    const order = ['vogel', 'haas', 'aap', 'olifant'];
    const idx = order.indexOf(currentRole.id);
    if (idx < order.length - 1) {
      return ROLES[order[idx + 1]];
    }
    return ROLES.vogel; // loop terug naar start
  }

  // ─── State ───

  // @addr 10.03.3.10 | fd00:npr:0003:001::10 — state snapshot
  state() {
    const t = this._levelsToTokens();
    return {
      window: this.windowTokens,
      conversation: this.conversationTokens,
      available: this._availableTokens(),
      currentRole: this.currentRole ? this.currentRole.id : null,
      levels: { ...this.levels },
      tokens: t,
      routing: ROUTING_BITS.hex(ROUTING_BITS.encode(this.levels)),
      history: this.routeHistory.slice(-10),
    };
  }

  // @addr 10.03.3.11 | fd00:npr:0003:001::11 — update token usage
  updateUsage(tokensUsed) {
    this.conversationTokens += tokensUsed;
  }

  // @addr 10.03.3.12 | fd00:npr:0003:001::12 — reset
  reset() {
    this.currentRole = null;
    this.conversationTokens = 0;
    this.levels = { vogel: 0, haas: 0, aap: 0, olifant: 0 };
    this.routeHistory = [];
  }
}

module.exports = {
  ContextBreath,
  ROLES,
  ROUTING_BITS,
  BIT6,
};
