# Audit 6/6 — Fase 7: Productie

**Punten:** 30-33 | **Status:** 2 ✅ | 2 ⚪

## 30. CORS volledig open

**Aandacht:** `Access-Control-Allow-Origin: *` zou security risk zijn

**Regel:** CORS moet beperkt zijn tot vertrouwde origins

**Waarom:** Open CORS = XSS risico bij external access

**Status:** ⚪ Bewust — geen CORS headers, localhost-only development. Threat model nodig voor productie.

## 31. Geen authenticatie

**Aandacht:** Geen access control op endpoints

**Regel:** Productie-systeem moet auth hebben

**Waarom:** Zonder auth = iedereen kan commands uitvoeren

**Status:** ⚪ Bewust — localhost development, geen external access. Single-agent design.

## 32. Stacktraces naar client

**Aandacht:** `err.stack` in HTTP response = informatie leak

**Regel:** Productie errors mogen geen stacktraces exposen

**Waarom:** Stacktraces leak internals en sensibele paths

**Status:** ✅ Opgelost — stacktraces alleen in server log (`log.error`), niet naar client response.

## 33. Restart endpoint zonder auth

**Aandacht:** `execSync`, `pkill`, shell commands zonder auth

**Regel:** Destructieve endpoints moeten localhost-only zijn

**Waarom:** Externe access tot restart = DoS vector

**Status:** ✅ Opgelost — geen restart endpoint meer. Server lifecycle via tmux/npm scripts.

---
**Audit 6/6: 2 ✅ | 2 ⚪**
