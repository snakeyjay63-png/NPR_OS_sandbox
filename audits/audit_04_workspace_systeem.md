# Audit 4/6 — Workspace Systeem: Observatie

**Punten:** 19-24 | **Doel:** Observeren, niet oplossen. Structuur onverstoord houden.

## 19. Audit Format Verstoort
Audit bevat oplossingen → verandert de structuur die het zou moeten observeren.

**Aandacht:** audits zijn nu zowel observatie als oplossing in één bestand.

**Regel:** observatie ≠ interventie. Het oog verandert wat het kijkt.

**Waarom:** als de audit de code verandert tijdens het kijken, meet je nooit de werkelijke staat.

**Status:** ⚠️ — Observatie, geen fix nodig. Methodeologische regel.

## 20. Geheugenlaag Dubbel Opgebouwd
NPR Local bouwt eigen geheugen terwijl OpenClaw workspace memory al heeft.

**Aandacht:** `memory/` en `MEMORY.md` bestaan al in workspace, maar npr-local probeert eigen laag.

**Regel:** bestaande laag koppelen, niet heruitvinden.

**Waarom:** twee geheugensystemen = inconsistentie. Een systeem > twee halfwerkend.

**Status:** ✅ — `/memory/context` leest nu `~/.openclaw/workspace` + `/warehouse`. Geen dubbele laag meer.

## 21. Workspace Context Te Groot
Gehele workspace in context = context overflow bij 64k limit.

**Aandacht:** `sources/`, `routes/`, `outputs/` zijn groot — niet allemaal per request laden.

**Regel:** vaste bootstrap (klein) + retrieval (gericht) ≠ alles injecteren.

**Waarom:** 64k context raat vol met brulkaal voordat de vraag überhaupt binnen is.

**Status:** ✅ — Phase-based maxChars (12800-19200), gericht laden per fase.

## 22. Integratielus Niet Expliciet
Workspace → context → llama → tool → workspace lus staat niet documenteerd.

**Aandacht:** de keten bestaat maar is niet als één eenheid te zien.

**Regel:** lus moet traceerbaar zijn. Wat binnenkomt, moet terug kunnen.

**Waarom:** als je de lus niet ziet, breek je hem zonder het te weten.

**Status:** ⚠️ — Agent loop werkt maar keten is niet als één document traceerbaar.

## 23. Oplossing Los Van Observatie
Audit observeert punt X en past tegelijk oplossing Y toe → geen clean state meer.

**Aandacht:** geen scheiding tussen "dit is wat er is" en "dit is wat we gaan doen".

**Regel:** audit = wat er is. Fix = apart proces, apart tijdstip.

**Waarom:** je kunt niet tegelijk kijken en knutselen. Het resultaat is altijd verstoord.

**Status:** ⚠️ — Observatie, geen fix nodig. Methodeologische regel.

## 24. Eén Systeem Niet Bevestigd
Workspace + audit + geheugen + tool-lus horen bij elkaar maar staan los.

**Aandacht:** alle onderdelen bestaan, geen eenheidsdocument dat ze koppelt.

**Regel:** een systeem is meer dan een verzameling delen.

**Waarom:** zonder expliciete koppeling ontstaat drift tussen de lagen.

**Status:** ⚠️ — Architectuur document nodig.

---
**Audit 4/6: 2 ✅ | 4 ⚠️ — Workspace observatie.**
