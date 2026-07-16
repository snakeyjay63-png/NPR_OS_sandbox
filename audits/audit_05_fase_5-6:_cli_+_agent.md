# Audit 5/6 — Fase 5-6: CLI + Agent

**Punten:** 25-29 | **Status:** 5 ✅

## 25. Auto-tools zijn HTTP, niet agent-tools

**Aandacht:** `/tool/*` geregistreerd maar agent loop had geen client

**Regel:** Tools moeten bereikbaar zijn via HTTP én agent function-calling

**Waarom:** Zonder bridge tussen HTTP tools en agent loop is tooling dood

**Status:** ✅ Opgelost — `/tool/exec` (slot 25) + `registerAutoTools()` bridge

## 26. Geen bin entry in package.json

**Aandacht:** Geen `npr` commando, geen CLI scripts

**Regel:** CLI-app moet `bin` hebben voor `npm link` + direct run

**Waarom:** Geen `npr` commando = geen CLI-pariteit met OpenClaw

**Status:** ✅ Opgelost — `bin/npr.js` + `bin: { npr }` in package.json

## 27. Benodigde CLI-oppervlakken

**Aandacht:** `npr chat`, `npr ask`, `npr status`, `npr context`, etc.

**Regel:** Alle HTTP endpoints moeten CLI-equivalent hebben

**Waarom:** Terminal-gebruik vereist native CLI, niet alleen `curl`

**Status:** ✅ Opgelost — 16 CLI commands:
- `npr chat/stream/status/context/logs/config/search/doctor`
- `npr tool/introspect/memory/workspace/scan/bridge/maps`

## 28. CLI pad keuze

**Aandacht:** HTTP-gateway vs rechtstreekse module-toegang

**Regel:** CLI moet consistent pad kiezen

**Waarom:** Dual-mode (HTTP + direct) verward en inconsistent

**Status:** ✅ Besloten — HTTP-gateway first, CLI = wrapper om HTTP endpoints

## 29. Geen streaming CLI client

**Aandacht:** Geen SSE-terminal client

**Regel:** Real-time agent output moet via SSE naar terminal

**Waarom:** Niet-streaming = slechte UX bij lange agent turns

**Status:** ✅ Opgelost — `/agent/chat-stream` (SSE, slot 17) + `npr stream <msg>`

---
**Audit 5/6: 5 ✅**
