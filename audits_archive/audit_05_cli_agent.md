# Audit 5/6 — CLI + Agent: Observatie

**Punten:** 25-28 | **Doel:** Observeren, niet oplossen. Structuur onverstoord houden.

## 25. Tool-Exec Bestaat Maar Wordt Niet Gebruikt

**Aandacht:** `src/routes/tool-exec.js` is volledig geïmplementeerd (6 tools, 25+ commands) maar er is geen integratie met de agent loop. De tool kan commands uitvoeren maar de agent kan er niet bij.

**Regel:** een tool die niet door de agent bereikbaar is, is infrastructure, niet functionaliteit.

**Waarom:** zonder agent-tool-koppeling is `/tool/exec` een losse API, geen onderdeel van het systeem.

**Status:** ⚠️

## 26. Agent Loop Heeft Geen Tool-Calllus

**Aandacht:** `src/agent/loop.js` heeft `handleTool()` maar de agent kan niet initiëren van tool calls. Er is geen `tool_calls` array in de LLM response die automatisch wordt opgepakt en uitgevoerd.

**Regel:** twee-lussen architectuur vereist dat de agent tools kanaanroepen, niet alleen ontvangen.

**Waarom:** momenteel is het een half-automatisch systeem — de gebruiker moet tool calls handmatig via POST doen.

**Status:** ⚠️

## 27. Geen CLI Wrapper

**Aandacht:** alle functionaliteit is HTTP-endpoints, maar er is geen CLI wrapper (`npr-local command`) die de gebruiker aan de terminal geeft. OpenClaw heeft `openclaw <command>`; NPR-Local heeft alleen `curl http://localhost:5000/...`.

**Regel:** een runtime zonder CLI is een webserver, geen werkstation.

**Waarom:** terminal-gebruikers verwachten commando's, geen HTTP-calls.

**Status:** ⚠️

## 28. Sessie-persistentie Is Basis

**Aandacht:** sessies worden in-memory bewaard (`sessions = new Map()`). Bij herstart is alles weg. Er is geen bestandssysteem persistentie, geen transcript opslag, geen sessie-herstel.

**Regel:** state zonder persistentie is geheugen, niet storage.

**Waarom:** bij elke restart begint het systeem opnieuw — geen continuity, geen history, geen leercurve.

**Status:** ⚠️

---

**Audit 5/6: CLI + Agent observatie — functionaliteit bestaat maar is niet verbonden.**
