# Audit 2/6 — Fase 2: Chat Betrouwbaar ✅

**Punten:** 7-12 | **Status:** 5 ✅ | 3 ⚠️

## 7. Tool-turns dubbel geteld
`agentTurn()` + `handleTool()` beide `session.turns++`.  
**✅** Alleen `agentTurn()` increment

## 8. Model foutafhandeling
Geen HTTP-statuscontrole, timeout, retry.  
**✅** Timeout, retry, abort, `!res.ok` check

## 9. Streaming beëindiging
Geen client-disconnect, backpressure.  
**⚠️** Gedeeltelijk antwoord opslag (`partial: isAborted`), geen client-disconnect

## 10. Geen input/body limiet
`body += chunk` zonder max.  
**✅** 1MB body limit in `gateway.js`

## 11. Sessie-ID脆弱
`sess-${Date.now()}` — geen validatie/concurrentie.  
**⚠️** Basisvalidatie (ongeldige ID → nieuwe), geen UUID

## 12. Browserchat API-configuratie
chat.html served los.  
**⚠️** Served via `:5010`, API URLs hardcoded maar consistent

---
**Audit 2/6: 5 ✅ | 3 ⚠️ — Fase 2 voltooid**
