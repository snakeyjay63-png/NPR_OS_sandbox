# Stap 04: Git-Trace = Signal Flow (DAG met cyclische semantiek)

**Doel:** Git commits ZIJN de signalen, niet alleen de versie.

---

## Concept

**Git is niet een log - git commits ZIJN de signalen.**

Binnen NPR-OS is elke commit een gestructureerd signaal:
- **Commit-message** = signaal-titel (routing-doel)
- **Commit-body** = de log-inhoud (data, foutdetails, tussenstatus)
- **Commit-hash** = object-integriteit (SHA-1 of SHA-256, afhankelijk van repo-configuratie)
- **Git-history** = de signal-trace (DAG — acyclisch maar met cyclische processemantiek)

```
Commit 1: "router init"    → body: {"status":"init"}
Commit 2: "capabilities"   → body: {"route":"C1A","cell":"1A"}
Commit 3: "first route"    → body: {"signal":"sunya","cel":"1A"}
Commit 4: "return to init" → body: {"status":"return","target":"C1A"}
```

**Git is een DAG (Directed Acyclic Graph).**
Git-objecten verwijzen naar ouders. Een commit kan NIET terugwijzen naar een latere commit.

**Maar:** een nieuwe commit kan *semantisch* "Return naar toestand 1" betekenen.
Dat is een **nieuwe knoop** die een eerdere toestand nabootst/verwijst — geen echte cyclus in de Git-history.

**Immutable Git-objecten:**
Een bestaande commit is niet veranderbaar. Een inhoudswijziging produceert een
*ander commitobject* met een *andere hash*. Git creëert nieuwe objecten, het overschrijft er geen.

**NPR-OS perspectief:** Git registreert niet alleen versie, maar **cyclische processemantiek** binnen een acyclische structuur.

| Aspect | Git-werkelijkheid | NPR-OS-semantiek |
|--------|-------------------|------------------|
| Grafiek | DAG (acyclisch) | Cyclisch proces |
| Return | Nieuwe commit | Terug naar toestand |
| Noise → Pattern → Return | Commits 1 → 2 → 3 → 4 | Cyclus in signaalfase |

**Verschil met traditionele logging:**
| Logfile | Git |
|---------|-----|
| Plain text | Hash-integriteit (object kan niet ongemerkt wijzigen) |
| Append-only | Acyclisch (hash = trace) |
| Lineair | DAG met cyclische semantiek |
| Niet gerouteerd | Elke commit = gerouteerd signaal |

**Nuance: Integriteit ≠ Externe Waarheid**
Een commit-hash bewaakt de integriteit van het object: het kan niet ongemerkt worden
aangepast zonder dat de identificatie verandert. Het bewijst echter *niet*
dat de gelogde inhoud extern waar of accuraat is. Het bewaakt de trace, niet de werkelijkheid.

---

## Test

**Vraag:** Kan een git-commit een gestructureerd signaal zijn?
(Is commit-body + commit-hash een valide logging-mechanisme?)

**Vraag:** Is git-history een valide trace voor signal flow?

---

## Resultaat

```
✅ / ❌
Reden: _______ (commit-body = log, hash = integriteit, DAG = acyclisch, semantiek = cyclisch)
```
