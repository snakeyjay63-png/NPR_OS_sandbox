# Externe Statische Code-Audit — NPR-Local
**Datum:** 2026-07-17 01:02 CET
**Type:** Statistische code-review (main branch)
**Status:** 2 ✅ | 3 ⚠️ | 5 → NPR 1.0

---

## Samenvatting

> **Routering is sterke, testbare indexstructuur.**
> **Overgangen adres → bestand → module → proces moeten formeel worden afgedwongen.**

De IPv4/IPv6 annotatielaag (`@net`/`@addr`) is door het hele project consistent toegepast. 
Dat bevestigt het concept. Maar drie lagen zijn niet volledig gescheiden:
1. Documentatie-adressen in comments
2. Logische routeringsadressen
3. Echte netwerkadressen

---

## Bevindingen

### ✅ Opgelost
| # | Issue | Fix | Commit |
|---|-------|-----|--------|
| 5 | Command injection tool-exec | `spawnSync(shell:false)` + allowlist | 632ee7a (P0-1) |
| 7 | Path traversal workspace | `resolveInsideWorkspace()` guard | 632ee7a (P0-2) |
| 8 | `retrieveContent()` bug | `break` → `continue` voor directories | 6cda294 |

### ⚠️ Conceptueel (behoud met nadruk)
| # | Issue | Advies |
|---|-------|--------|
| 2 | `fd00:npr:*` geen geldig IPv6 | Benoem als `routeAddress` of `npr://` URI |
| 3 | Map = tool: trust risico | read-only block-root + hash + status vóór require() |
| 4 | 64 slots = buckets | blok-ID = volledig adres, slot = uitvoeringsbucket |

### → NPR 1.0 (structurele verbeteringen)
| # | Issue | Scope |
|---|-------|-------|
| 1 | `@addr` niet machineleesbaar | `@net/@addr` parser → registry.json → collision check → manifest |
| 6 | Toolcalls = tekst | JSON Schema: `{type, address, tool, arguments}` |
| 9 | Context = metadata, geen inhoud | Recursieve retrieval: vraag → route → map → fragment |
| 10 | Registry = procesintern | Runtime registry vs. immutable manifest splitsing |
| Build | NPR-manifest | Build-time: manifest + collision + encoding + bloktests |

---

## Aangeschoven Architectuur

```
NPR-adres (uniek)
  → manifest lookup (hash + status check)
  → gevalideerd blok (read-only root)
  → capability check
  → veilige executor (spawnSync, no shell)
  → workspace-bounded resultaat
  → lokaal (127.0.0.1) antwoord
```

---

## Prioriteiten NPR 1.0

1. **@addr parser** — machineleesbaar, uniciteit, manifest
2. **Route-URI** — `npr://` of `routeAddress`, geen `fd00:npr:*` als IPv6
3. **Blok-ID vs slot** — adres = identiteit, slot = bucket
4. **Hash + status** — vóór `require()`, read-only block-root
5. ✅ **execSync → spawnSync** (P0-1)
6. ✅ **Workspace guard** (P0-2)
7. ✅ **retrieveContent fix** (audit #8) → recursief → 1.0
8. **Gestructureerde toolcalls** — JSON Schema
9. **Build-time manifest**
10. **Start guard** — alleen starten bij geldig manifest + tests

---

## Conclusie

De NPR-adresarchitectuur is **niet decoratief** — het is een werkende, testbare indexstructuur.
De volgende stap is formalisering: van menselijke annotatie naar machine-afgedwongen manifest.

NPR 1.0 = formele afdwinging van wat nu als annotatie en conventie werkt.
