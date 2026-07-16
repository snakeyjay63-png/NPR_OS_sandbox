# Local Hub Audit — npr-local Stack Analyse

**Datum:** 2026-07-16  
**Status:** Volledige analyse van huidige toestand, fouten, en gebouwpad

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
**Status:** codefout

## 2. Geowon poortmismatch
**Bestand:** `src/agent/loop.js` vs `boot.js`  
Agent gebruikt `:4004`, boot.js luistert op `:5004`. Memory sync faalt stil.  
**Status:** configuratiefout

## 3. Poortdocumentatie inconsistent
README: `3002/3003`, `src/index.js`: `5000`, comments: `4000/4004/18000`, boot: `5004/5010`, config: `18000`  
**Status:** inconsistentie

## 4. boot.js start niet alle services
Modelserver `:8765` moet extern draaien, maar banner suggereert "all services in one process".  
**Status:** documentatie/runtime mismatch

## 5. Stacktest incompatibele modulevorm
`package.json` is CommonJS, `test-stack.js` gebruikt `import` syntax. Geen test script.  
**Status:** testinfrastructuur

## 6. Chattest verwacht verkeerd formaat
Test zoekt `data?.choices?.[0]?.message?.content` (llama-formaat), maar chat retourneert `data.response`.  
**Status:** testfout

## 7. Tool-turns dubbel geteld
`agentTurn()` doet `session.turns++`, dan `handleTool()` doet ook `session.turns++`.  
**Status:** codefout

---

# B. Nog Te Bouwen — Chat

## 8. Model foutafhandeling
Geen HTTP-statuscontrole, schema-validatie, timeout, retry, abort.  
**Status:** nog te bouwen

## 9. Streaming beëindiging
Geen client-disconnect, timeout, abort, backpressure, gedeeltelijk antwoord opslag.  
**Status:** nog te bouwen

## 10. Geen input/body limiet
`body += chunk` zonder max grootte. Ongeldige JSON wordt `{}`.  
**Status:** nog te bouwen

## 11. Sessie-ID脆弱
`sess-${Date.now()}` — geen validatie, geen concurrentie-bescherming.  
**Status:** nog te bouwen

## 12. Browserchat API-configuratie
chat.html served los van hoofdgateway. Geen duidelijke API-configuratie.  
**Status:** nog te integreren

---

# C. Nog Te Bouwen — Context

## 13. Geowon niet teruggelezen
Agent schrijft naar Geowon, maar leest niet terug bij sessiestart.  
**Status:** nog te bouwen

## 14. Niet volledige gesprekken naar Geowon
Alleen assistant response geschreven, user message ontbreekt.  
**Status:** nog te bouwen

## 15. Geen gedeeld sessie/message schema
Lokaal, Geowon, en sync events hebben verschillende structuren.  
**Status:** nog te bouwen

## 16. Fasecontext niet aangesloten op chat
`memory/context.js` heeft fasemodel, maar `agent/loop.js` gebruikt het niet.  
**Status:** nog te verbinden

## 17. Fase kan niet correct gekozen worden
`nprRoute()` heeft geen direct faseveld.  
**Status:** nog te verbinden

## 18. Workspacecontext is bestandslijst
`scanWorkspace()` levert metadata, niet inhoud.  
**Status:** nog te bouwen

## 19. Geen semantische retrieval
Geen zoekindex, geen tekstuele retrieval.  
**Status:** nog te bouwen

## 20. Context begrensd op berichten, niet tokens
`MAX_HISTORY = 20` berichten, geen token-berekening.  
**Status:** nog te bouwen

## 21. Geen samenvatting/gelaagd geheugen
Oudere berichten vallen uit, geen samenvatting.  
**Status:** nog te bouwen

## 22. Fork/merge oppervlakkig
Fork begint met lege historie, merge is simpele array concatenatie.  
**Status:** nog te bouwen

---

# D. Nog Te Bouwen — Tools

## 23. Model kan tools niet zelfstandig aanroepen
Alleen `tool:` prefix in user input werkt. Geen agent-loop voor model-initiëerde tools.  
**Status:** nog te bouwen

## 24. Prompt bewert tools die niet bestaan
Prompt zegt `scan` en `workspace`, maar `tool:workspace` bestaat niet in `handleTool()`.  
**Status:** prompt/implementatie mismatch

## 25. Auto-tools zijn HTTP, niet agent-tools
`registerMap()` registreert `/tool/*`, maar agentloop heeft geen client.  
**Status:** nog te verbinden

---

# E. Nog Te Bouwen — CLI

## 26. Geen bin entry in package.json
Geen `npr` commando, geen CLI scripts.  
**Status:** nog te bouwen

## 27. Benodigde CLI-oppervlakken
`npr chat`, `npr ask`, `npr status`, `npr sessions`, `npr context`, `npr workspace`, `npr tools`, `npr scan`  
**Status:** nog te bouwen

## 28. CLI pad keuze
HTTP-gateway vs rechtstreekse module-toegang.  
**Status:** ontwerpkeuze

## 29. Geen streaming CLI client
Geen SSE-terminal client.  
**Status:** nog te bouwen

---

# F. Veiligheid

## 30. CORS volledig open
`Access-Control-Allow-Origin: *`  
**Status:** threat model

## 31. Geen authenticatie
Geen access control.  
**Status:** bewust voor localhost

## 32. Stacktraces naar client
`err.stack` in HTTP response.  
**Status:** development vs production

## 33. Restart endpoint zonder auth
`execSync`, `pkill`, shell commands.  
**Status:** veiligheidspunt

---

# G. Indeling

## Bewust Ontwerpkeuzes (9)
1. Welke NPR-fase welke context krijgt
2. Hoeveel geschiedenis actief blijft
3. Hoe oudere gesprekken worden samengevat
4. Of fork een lege tak of echte kopie is
5. Hoe merge semantisch werkt
6. CLI via HTTP of direct via modules
7. Hoeveel lokale beveiliging nodig is
8. Welke toolacties automatisch mogen
9. Statische of dynamische capabilityselectie

## Nog Te Bouwen (20)
1. Routevelden en faseberekening corrigeren
2. Poorten canoniek maken
3. Geowon-write naar juiste poort
4. Geowon-memory teruglezen bij sessiestart
5. Volledige user+assistant turns opslaan
6. Canoniek sessie/message schema
7. Fasecontext aansluiten op agentprompt
8. Inhoudelijke workspace-retrieval
9. Tokenbudgettering
10. Langetermijnsamenvattingen
11. Werkelijke modelgestuurde tool-loop
12. `tool:workspace` implementeren of verwijderen
13. Model- en streamingfouten afhandelen
14. Requestlimieten en timeouts
15. Stacktest uitvoerbaar maken
16. Chat-test aan echte response aanpassen
17. Browserinterface en API verbinden
18. CLI entrypoint en promptloop
19. SSE-client voor CLI
20. Integratie- en herstarttests

---

# Aanbevolen Volgorde

```
Fase 1 — Runtime gezond
  routevelden, poorten, model-foutafhandeling, stacktests

Fase 2 — Chat betrouwbaar
  sessieschema, volledige gesprekshistorie, streamingfouten, browserconfig

Fase 3 — Context persistent
  Geowon read+write, herstart-hervatten, fasecontext koppelen, tokenbudget

Fase 4 — Context uit bestanden
  bestandslezer, zoekfunctie, fragmentselectie, bronmetadata

Fase 5 — CLI
  npr chat, npr ask, sessiecommando's, streamingterminal

Fase 6 — Agenttools
  model-toolprotocol, tooluitvoering, resultaat terugvoeren, eindantwoord
```

---

# Eindbeoordeling

```
HTTP-chatbasis:        ✅ aanwezig
Lokale modelkoppeling: ✅ aanwezig
Browserchat:          ✅ prototype
Streaming server:     ✅ aanwezig
Kortetermijncontext:  ✅ aanwezig
Duurzame context:     ⚠️ gedeeltelijk (geen readback)
Workspace context:    ⚠️ metadata, weinig inhoud
Tool agent:          ❌ nog niet werkend
CLI:                 ❌ ontbreekt
Productierijp:       ❌ nog niet
```

**Conclusie:** De chatroute is gebouwd, maar context is tijdelijk en beschrijvend. Voor bruikbare lokale assistent: eerst memory-readback, contextretrieval, tool-loop sluiten. Daarna CLI bovenop HTTP-chatprotocol.
