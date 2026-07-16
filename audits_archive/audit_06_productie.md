# Audit 6/6 — Productie: Observatie

**Punten:** 29-33 | **Doel:** Observeren, niet oplossen. Structuur onverstoord houden.

## 29. Geen Error-Boundary in HTTP Handler

**Aandacht:** `src/index.js` route handlers hebben geen try-catch. Als een handler crasht (bijv. `undefined.map()`), crasht de hele server. Er is geen global error handler die 500 teruggeeft in plaats van proces-dood.

**Regel:** productie-code vangt errors op, development-code laat ze crashen.

**Waarom:** één bad request = server down = geen herstel mogelijk zonder handmatige restart.

**✅ Fix:** `src/routes/core.js` — `safeHandler()` wrapper rond elke route call, vangt sync + async errors. Retourneert 500 in plaats van crash.
**✅ Fix:** `src/index.js` — `process.on('uncaughtException')` + `unhandledRejection` global handlers met graceful 5s shutdown.
**Status:** ✅

## 30. Logging Is Console-Only

**Aandacht:** alle log-statements zijn `console.log` / `console.error`. Er is geen file logging, geen log rotation, geen structured logging (JSON), geen log levels. `/agent/logs` heeft een in-memory buffer maar dat is alleen voor agent-events, niet voor systeem-events.

**Regel:** console output verdwijpt bij proces-einde; file logs blijven.

**Waarom:** zonder file logs is debugging na crash onmogelijk — je ziet alleen wat er nog in RAM zit.

**✅ Fix:** `src/log.js` — 4 levels (error/warn/info/debug), JSON structured logging naar `logs/npr-YYYY-MM-DD.log`, auto-rotation (10MB, 5 files), colored console output.
**Status:** ✅

## 31. Geen Health-Check Automatisering

**Aandacht:** `/health` en `/tick` bestaan maar er is geen automatische health monitoring. Als de LLM endpoint down gaat, blijft NPR-Local hangen tot een handmatige `/health` call de fout ontdekt. Geen self-healing, geen auto-retry, geen graceful degradation.

**Regel:** een health endpoint zonder monitoring is een dashboard, geen watchdog.

**Waarom:** afhankelijkheden (llama.cpp op :8765) kunnen vallen zonder dat NPR-Local het merkt of er iets aan doet.

**Status:** ⚠️

## 32. Configuratie Is Hardcoded of Environment-Only

**Aandacht:** `src/server-config.js` leest config uit environment variables en hardcoded defaults. Er is geen `config.yaml` of `.env` file, geen hot-reload, geen config validatie op boot-tijd. Veranderingen vereisen code-edit + restart.

**Regel:** config in code is deployment, niet configuratie.

**Waarom:** productie-systemen moeten configureerbaar zijn zonder hercompilatie of code-wijziging.

**Status:** ⚠️

## 33. Geen Test Suite

**Aandacht:** `test-stack.js` is een manual smoke test (handmatig draaien, visueel controleren). Er is geen geautomatized test framework (Jest, Mocha, etc.), geen CI pipeline, geen regression tests, geen coverage reporting.

**Regel:** een test die niet automatisch loopt, wordt niet gedraaid.

**Waarom:** zonder automatische tests is elke change riskant — je weet niet wat je breekt tot een gebruiker het merkt.

**Status:** ⚠️

---

**Audit 6/6: Productie-observatie — het systeem werkt, maar is niet productie-klaar.**
