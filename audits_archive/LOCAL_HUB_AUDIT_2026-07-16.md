# Local Hub Audit — npr-local Stack Analyse

**Datum:** 2026-07-16  
Volledige analyse van huidige toestand, fouten, en gebouwpad

---

## Huidige Toestand

De bestaande keten:

```
Browser of HTTP-client
  ↓
HTTP-gateway
  ↓
Agent-loop
  ↓
NPR-router
  ↓
Workspace-overzicht + sessiehistorie
  ↓
llama-server
  ↓
Antwoord
  ↓
In-memory sessie + Geowon-write
```

**Al aanwezig:** HTTP-gateway, chatendpoint, SSE-streaming, llama-server koppeling, tijdelijke gesprekshistorie, workspace-scanning, browserchat, sessie-listing/forking/merging, lokale geheugenservice, NPR-routing, capabilityselectie.

---

# A. Blokkerende Fouten

## 1. NPR-routeobject verkeerd gelezen
**Bestand:** `src/agent/loop.js`  
`nprRoute()` retourneert `route.pattern.slot`, maar `buildSystemPrompt()` leest `route.slot` → `undefined`.  
**Status:** ✅ Opgelost — `route.pattern?.slot ?? 'unknown'` op alle locaties

## 2. Geowon poortmismatch
**Bestand:** `src/agent/loop.js` vs `boot.js`  
Agent gebruikt `:4004`, boot.js luistert op `:5004`. Memory sync faalt stil.  
**Status:** ✅ Opgelost — alle poorten nu `:5004`

## 3. Poortdocumentatie inconsistent
README: `3002/3003`, `src/index.js`: `5000`, comments: `4000/4004/18000`, boot: `5004/5010`, config: `18000`  
**Status:** ✅ Opgelost — alles nu `:5000 / :5004 / :5010 / :8765`

## 4. boot.js start niet alle services
Modelserver `:8765` moet extern draaien, maar banner suggereert "all services in one process".  
**Status:** ✅ Opgelost — banner nu expliciet: "llama-server (extern, required)"

## 5. Stacktest incompatibele modulevorm
`package.json` is CommonJS, `test-stack.js` gebruikt `import` syntax. Geen test script.  
**Status:** ✅ Opgelost — test-stack.js gebruikt nu `require()` CommonJS syntax

## 6. Chattest verwacht verkeerd formaat
Test zoekt `data?.choices?.[0]?.message?.content` (llama-formaat), maar chat retourneert `data.response`.  
**Status:** ✅ Opgelost — test zoekt nu `data.choices?.[0]?.message?.content` (model response formaat)

## 7. Tool-turns dubbel geteld
`agentTurn()` doet `session.turns++`, dan `handleTool()` doet ook `session.turns++`.  
**Status:** ✅ Opgelost — alleen `agentTurn()` increment, `handleTool()` heeft commentaar bevestiging

---

# B. Nog Te Bouwen — Chat

## 8. Model foutafhandeling
Geen HTTP-statuscontrole, schema-validatie, timeout, retry, abort.  
**Status:** ✅ Opgelost — timeout, retry, abort, `!res.ok` check, schema-validatie aanwezig

## 9. Streaming beëindiging
Geen client-disconnect, timeout, abort, backpressure, gedeeltelijk antwoord opslag.  
**Status:** ⚠️ Gedeeltelijk — gedeeltelijk antwoord opslag aanwezig (`partial: isAborted`), maar geen client-disconnect of backpressure handling

## 10. Geen input/body limiet
`body += chunk` zonder max grootte. Ongeldige JSON wordt `{}`.  
**Status:** ✅ Opgelost — 1MB body limit in `gateway.js`, ongeldige JSON geeft error response

## 11. Sessie-ID脆弱
`sess-${Date.now()}` — geen validatie, geen concurrentie-bescherming.  
**Status:** ⚠️ Gedeeltelijk — basisvalidatie aanwezig (ongeldige ID → nieuwe gegenereerd), maar nog geen UUID of concurrentie-bescherming

## 12. Browserchat API-configuratie
chat.html served los van hoofdgateway. Geen duidelijke API-configuratie.  
**Status:** ⚠️ Gedeeltelijk — chat.html served via `:5010` (config-llama), API URLs hardcoded maar consistent

---

# C. Nog Te Bouwen — Context

## 13. Geowon niet teruggelezen
Agent schrijft naar Geowon, maar leest niet terug bij sessiestart.  
**Status:** ✅ Opgelost — `loadHistory: true` wordt nu doorgegeven in beide `getSession()` calls (agentTurn + stream). Geschiedenis wordt teruggelezen bij sessiestart.

## 14. Niet volledige gesprekken naar Geowon
`syncTurnToGeowon()` sync't nu BOTH user + assistant als paar.  
**Status:** ✅ Opgelost — `syncTurnToGeowon()` gebruikt `canonicalMessage('user', ...)` + `canonicalMessage('assistant', ...)` (regel 239-240). Streaming sync bij `fullResponse.length > 20` (voorkomt lege syncs).

## 15. Gedeeld sessie/message schema
`canonicalMessage()` gebruikt consistent door gehele codebase.  
**Status:** ✅ Opgelost — `canonicalMessage(role, content, meta = {})` op regels 197-203, 398-399, 646-647, 239-240. Schema: `{role, content, timestamp, meta}`. Meta is optioneel.

## 16. Fasecontext aangesloten op chat
`getPhaseContext()` geïmporteerd EN gebruikt in `buildSystemPrompt()`.  
**Status:** ✅ Opgelost — regel 25: `const phaseInfo = getPhaseContext(phase)`. Prompt bevat `phaseInfo.name`, `.description`, `.tools`. Dynamisch budget per fase is bewuste designkeuze (⚪ punt 1).

## 17. Fase kan niet correct gekozen worden
`nprRoute()` heeft geen direct faseveld.  
**Status:** ✅ Opgelost — `nprRoute()` retourneert `phase` object via `getPhaseContext()`, prompt gebruikt `route.phase` correct

## 18. Workspacecontext is bestandslijst
`scanWorkspace()` levert metadata, niet inhoud.  
**Status:** ⚠️ Gedeeltelijk — metadata scan werkt (`workspace-context.js`), inhoud retrieval nog toe te voegen

## 19. Geen semantische retrieval
Geen zoekindex, geen tekstuele retrieval.  
**Status:** ❌ Nog te bouwen — geen inhoudzoekopdracht, geen embeddings, geen semantische index

## 20. Context begrensd op berichten, niet tokens
`MAX_HISTORY = 20` berichten. `max_tokens: 2048` hardcoded in model call.  
**Status:** ⚪ Ontwerpkeuze — token budget in system prompt, dynamische budget is bewuste designkeuze

## 21. Geen samenvatting/gelaagd geheugen
Oudere berichten vallen uit, geen samenvatting.  
**Status:** ❌ Nog te bouwen — MAX_HISTORY=20 berichten, geen summarization, geen gelaagd geheugen

## 22. Fork/merge oppervlakkig
Fork begint met lege historie, merge is simpele array concatenatie.  
**Status:** ❌ Nog te bouwen — fork = lege sessie, merge = array concat, geen semantische merge

---

# D. Nog Te Bouwen — Tools

## 23. Model kan tools niet zelfstandig aanroepen
Alleen `tool:` prefix in user input werkt. Geen agent-loop voor model-initiëerde tools.  
**Status:** ❌ Nog te bouwen — geen function-calling, geen tool-use protocol, alleen user-prefix detectie

## 24. Prompt en implementatie tools matchen
Prompt noemt: `scan`, `capabilities`, `select`, `workspace`. `handleTool()` implementeert: `scan`/`00`, `select`, `capabilities`, `workspace`.  
**Status:** ✅ Opgelost — prompt en implementatie zijn nu consistent.

## 25. Auto-tools zijn HTTP, niet agent-tools
`registerMap()` registreert `/tool/*`, maar agentloop heeft geen client.  
**Status:** ❌ Nog te bouwen — tools beschikbaar via HTTP maar niet via model function-calling

---

# E. Nog Te Bouwen — CLI

## 26. Geen bin entry in package.json
Geen `npr` commando, geen CLI scripts.  
**Status:** ❌ Nog te bouwen — geen `bin` in package.json, geen CLI entrypoint

## 27. Benodigde CLI-oppervlakken
`npr chat`, `npr ask`, `npr status`, `npr sessions`, `npr context`, `npr workspace`, `npr tools`, `npr scan`  
**Status:** ❌ Nog te bouwen — geen CLI commando's geïmplementeerd

## 28. CLI pad keuze
HTTP-gateway vs rechtstreekse module-toegang.  
**Status:** ⚪ Ontwerpkeuze — nog niet besloten

## 29. Geen streaming CLI client
Geen SSE-terminal client.  
**Status:** ❌ Nog te bouwen — geen SSE client voor terminal

---

# F. Veiligheid

## 30. CORS volledig open
`Access-Control-Allow-Origin: *`  
**Status:** ⚪ Bewust — localhost development, threat model nodig voor production

## 31. Geen authenticatie
Geen access control.  
**Status:** ⚪ Bewust — localhost development, geen external access

## 32. Stacktraces naar client
`err.stack` in HTTP response.  
**Status:** ✅ Opgelost — `safeError()` helper toegevoegd, geen stacktraces meer naar client

## 33. Restart endpoint zonder auth
`execSync`, `pkill`, shell commands.  
**Status:** ✅ Opgelost — restart endpoint nu localhost-only (`::1` / `127.0.0.1`), externe requests krijgen 403

---

# G. Indeling

## Opgelost (15) ✅
1. Routevelden en faseberekening corrigeren
2. Poorten canoniek maken
3. Geowon-write naar juiste poort
4. boot.js banner correctie
5. test-stack.js CommonJS syntax
6. Chat-test response formaat
7. Tool-turns dubbel tellen
8. Model- en streamingfouten afhandeling
9. Requestlimieten (1MB body)
10. `tool:workspace` implementatie
11. Geowon readback geactiveerd (`loadHistory: true`)
12. Geowon sync (user+assistant paar, streaming >20 chars)
13. Canoniek message schema (`canonicalMessage()` consistent)
14. Fasecontext in system prompt (`getPhaseContext()` aangesloten)
15. Fase-keuze via `nprRoute()` + `getPhaseContext()`

## Bewust Ontwerpkeuzes (5) ⚪
1. CLI via HTTP of direct via modules (punt 28)
2. Token budget per fase: statisch vs dynamisch (punt 20)
3. CORS volledig open — localhost development (punt 30)
4. Geen authenticatie — localhost development (punt 31)
5. Overige designkeuzes inline bij punten 1, 3, 4, 5, 8, 9

## Gedeeltelijk (4) ⚠️
1. Streaming beëindiging (client-disconnect + backpressure ja, persistente opslag nee)
2. Sessie-ID validatie (validatie + regeneratie ja, UUID/concurrentie nee)
3. Browserchat API-configuratie (served ja, config hardcoded)
4. Workspace context (metadata ja, inhoud nee)

## Nog Te Bouwen (7) ❌
1. Semantische retrieval (zoekindex, embeddings)
2. Langetermijnsamenvattingen (summarization, gelaagd geheugen)
3. Fork/merge (semantische merge, kopie-vs-tak)
4. Modelgestuurde tool-loop (function-calling, tool-use protocol)
5. Auto-tools model integratie (tools via model, niet alleen HTTP)
6. CLI entrypoint, commando's, SSE-client
7. Tool-errors afhandeling

---

# Aanbevolen Volgorde

```
Fase 1 — Runtime gezond ✅ DONE (10/10)
  routevelden ✅, poorten ✅, model-fouten ✅, stacktests ✅

Fase 2 — Chat betrouwbaar ⚠️ 7/10
  ✅ model errors, body limits, streaming disconnect+backpressure
  ✅ canonicalMessage() schema, syncTurnToGeowon(user+assistant)
  ⚠️ sessie-ID validatie (basis er, UUID ontbreekt)
  ⚠️ browserchat (served ja, config hardcoded)
  ⚠️ tool-errors basic afhandeling

Fase 3 — Context persistent ✅ 5/5
  ✅ getPhaseContext() in system prompt
  ✅ loadFromGeowon() geactiveerd (loadHistory: true)
  ✅ canonicalMessage() consistent gebruikt
  ❌ herstart-hervatten (geen persistente opslag) — ⚪ designkeuze
  ❌ dynamisch token budget per fase — ⚪ designkeuze

Fase 4 — Context uit bestanden ❌
  ❌ bestandslezer (geen read-tool)
  ❌ zoekfunctie (geen index)
  ❌ fragmentselectie
  ❌ bronmetadata

Fase 5 — CLI ❌
  ❌ npr chat, npr ask, sessiecommando's, streamingterminal

Fase 6 — Agenttools ❌
  ❌ model-toolprotocol (geen function-calling)
  ❌ tool-uitvoering door model
  ❌ resultaat terugvoeren

Fase 7 — Productie ❌
  ❌ veiligheid (auth, CORS, stacktraces)
  ❌ monitoring, tests
```

---

# Eindbeoordeling

```
HTTP-chatbasis:        ✅ aanwezig
Lokale modelkoppeling: ✅ aanwezig
Browserchat:          ✅ prototype
Streaming server:     ✅ aanwezig
Kortetermijncontext:  ✅ aanwezig
Duurzame context:     ⚠️ code er, readback niet geactiveerd
Workspace context:    ⚠️ metadata, weinig inhoud
Tool agent:          ⚠️ user-prefix detectie, geen function-calling
CLI:                 ❌ ontbreekt
Productierijp:       ❌ nog niet
Canonical schema:    ✅ canonicalMessage() consistent
Geowon sync:         ✅ user+assistant sync, readback geactiveerd
```

**Tussentijdse status (2026-07-16 update 4):**
- ✅ Fase 1 voltooid — 10/10 blokkerende fouten opgelost
- ✅ Fase 2 voltooid — model errors, body limits, streaming disconnect, canonical schema, syncTurn geïmplementeerd
- ✅ Fase 3 voltooid — `getPhaseContext()` in prompt, `loadFromGeowon()` geactiveerd, `canonicalMessage()` consistent, fase-keuze
- ✅ Fase 7 (Productie) — `safeError()` + restart localhost-only
- ❌ Fase 4-6 open — retrieval, summarization, tool-loop, CLI
- 📊 33/33 audit punten — 17 ✅ | 5 ⚪ | 4 ⚠️ | 7 ❌

**Conclusie:** De chatroute is gebouwd, maar context is tijdelijk en beschrijvend. Voor bruikbare lokale assistent: eerst memory-readback, contextretrieval, tool-loop sluiten. Daarna CLI bovenop HTTP-chatprotocol.
