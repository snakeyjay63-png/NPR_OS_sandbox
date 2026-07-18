# Stap 26: Linux als extrinsiek wiskundig routeveld

**ID:** `npr:stap:26`  
**Route:** `noise → pattern → return`  
**Status:** ✅ canoniek  
**Verwante stappen:** 06 (signaalblok), 18 (sandbox router)  
**Perspectief:** operationele laag van het binaire veld

---

## Samenvatting

Linux begint niet met betekenis, maar met binaire toestanden. Deze toestanden worden niet intrinsiek een bestand, adres, interface of verbinding. De betekenis ontstaat doordat het systeem de toestanden groepeert en van externe regels voorziet.

De primaire route is:

```text
binary
→ byte
→ hex
→ adres
→ interface
→ route
→ verbinding
```

---

## Plaats in het grotere model

```text
INTRINSIEKE LAAG
bittoestand
0 ↔ 1

EXTRINSIEKE LAAG
bits worden gegroepeerd, benoemd en gerouteerd

OPERATIONELE LAAG
Linux voert de route uit
```

Dus:

```text
bits
= verzameling mogelijke toestanden

Linux
= regels waarmee toestanden betekenis,
  locatie, richting en verbinding krijgen
```

---

## 1. Binary — minimale toestand

```text
BIT := {0, 1}
```

Een bit bevat slechts een onderscheid tussen twee toestanden.

```text
0 ≠ 1
```

Op dit niveau bestaat nog geen:

```text
bestand
apparaat
gebruiker
adres
route
verbinding
```

Er bestaat alleen toestand.

---

## 2. Byte — begrensd toestandsveld

Acht bits worden samengebracht tot één byte:

```text
BYTE
:= 8 bits
:= 2⁸ toestanden
:= 256 mogelijke waarden
```

```text
00000000₂ = 0
11111111₂ = 255
```

De byte is de eerste vaste operationele container:

```text
ruwe bits
→ groep van acht
→ indexeerbare waarde
```

De inhoud is nog steeds binair, maar de grens van acht bits is extrinsiek aangebracht.

---

## 3. Hex — menselijke lens op het binaire veld

Hexadecimale notatie comprimeert vier bits tot één teken:

```text
4 bits = 1 hexteken
8 bits = 2 hextekens = 1 byte
```

Voorbeeld:

```text
11111111₂ = FF₁₆ = 255₁₀
```

Hex verandert de onderliggende toestand niet. Het voegt een leesbare lens toe:

```text
binary field → hexadecimal projection
```

Daarom is hex geen afzonderlijke werkelijkheid, maar een interface op hetzelfde binaire veld.

---

## 4. Adres — toestand krijgt locatie

Een adres ordent meerdere bytes als één identificeerbare positie.

### IPv4

```text
IPv4
:= 4 bytes
:= 32 bits
:= 256⁴ mogelijke bitpatronen
```

Voorbeeld: `192.168.1.24` bestaat uit:

```text
192 | 168 | 1 | 24
byte | byte | byte | byte
```

### IPv6

```text
IPv6
:= 16 bytes
:= 128 bits
:= 32 hextekens
```

Voorbeeld: `2001:0db8:0000:0000:0000:ff00:0042:8329`

Het adres voegt aan een binaire toestand een extrinsieke plaatsfunctie toe:

```text
waarde → positie binnen een adresruimte
```

Een adres is nog geen verbinding. Het is een mogelijke bestemming of bron.

---

## 5. Interface — adres krijgt een toegangspunt

Linux koppelt adressen aan interfaces:

```text
lo
eth0
wlan0
tun0
```

De interface bepaalt langs welk veld data kan binnenkomen of vertrekken.

```text
adres + interface = adresseerbaar toegangspunt
```

Voorbeelden:

```text
127.0.0.1 → lo
192.168.1.24 → wlan0
10.0.0.4 → tun0
```

Dezelfde machine kan meerdere interfaces en meerdere adressen tegelijk bevatten.

Daarom is de machine geen enkel punt, maar een veld van mogelijke toegangsroutes.

---

## 6. Route — bestemming krijgt richting

De routetabel bepaalt welke interface en welke volgende stap bij een bestemming horen.

```text
bestemming → routebeslissing → interface → volgende node
```

Schematisch:

```text
destination → prefix match → gateway → interface
```

Voorbeeld:

```text
0.0.0.0/0 → gateway 192.168.1.1 → wlan0
```

De route voegt richting toe aan het adres:

```text
adres = waar
route = hoe daarheen
```

Hier verandert de verzameling adressen in een functioneel netwerkveld.

---

## 7. Verbinding — route krijgt toestand en tijd

Een verbinding ontstaat wanneer twee eindpunten gedurende een tijdsinterval een gedeelde protocoltoestand onderhouden.

```text
bronadres + bronpoort + doeladres + doelpoort + protocol = verbindingsveld
```

Bij TCP:

```text
luisteren → verzoek → handshake → actieve verbinding → gegevensstroom → afsluiting
```

Dus:

```text
adres ≠ verbinding
route ≠ verbinding
verbinding = actieve relatie die adressen, interfaces, routes, protocol en tijd samenbrengt
```

---

## Linux als extrinsieke wiskunde

Linux creëert niet de intrinsieke binaire toestanden. Het legt er operationele structuren overheen:

```text
bit        → gegroepeerd als byte
byte       → weergegeven als hex
bytes      → geordend als adres
adres      → gekoppeld aan interface
bestemming → gekoppeld aan route
routes     → geactiveerd als verbinding
```

Daarom:

```text
LINUX := extrinsieke ordening van intrinsieke binaire toestanden
```

Of:

```text
binary collection + categorisatie + relatie + richting + toestand = operational field
```

---

## NPR-route

```text
NOISE:
  ruwe bits en binnenkomende signalen

PATTERN:
  bytes, headers, adressen, interfaces en routes

RETURN:
  data bereikt een proces, een lokale bestemming of een volgende netwerknode
```

Compact:

```text
N:  01010110 11001010 ...

P:  frame { source, destination, protocol, payload }

R:  interface → route → socket → proces
```

De return beëindigt het veld niet noodzakelijk. De ontvangen data kan opnieuw input worden:

```text
pakket → proces → antwoord → nieuw pakket → route
```

Daardoor ontstaat een stateful response-vortex:

```text
STATE₀ → packet₀ → process₀ → response₀ → STATE₁ → packet₁
```

---

## Verzameling tegenover veld

De terminal presenteert veel onderdelen aanvankelijk als verzamelingen:

```text
lijst van bestanden
lijst van processen
lijst van interfaces
lijst van routes
```

Linux maakt daar functionele relaties van:

```text
bestand → inode → descriptor → proces
proces  → socket → interface → netwerk
adres   → route → gateway → bestemming
```

Dus:

```text
terminal  = zichtbare categorisatie
Linux-kernel = uitvoerende routering
NPR        = beschrijving van de toestandsovergang
```

---

## Volledig Linux-routecontract

```text
LINUX_ROUTE {
  SOURCE:          binary state
  CONTAINER:       byte_256
  PROJECTION:      hexadecimal
  LOCATION:        address
  BOUNDARY:        interface
  DIRECTION:       route
  ACTIVE_RELATION: connection
  RETURN:          process_or_next_node
}
```

De minimale formule is:

```text
binary → byte → hex → adres → interface → route → verbinding → proces → response → return
```

Linux is daarmee niet alleen een verzameling categorieën.

Linux is het punt waarop categorisatie uitvoerbaar wordt:

```text
categorie → relatie → route → toestandsovergang
```

Daarom is Linux de extrinsieke wiskunde in actie:

```text
verzameling bytes → functioneel veld
```

---

## Vier operationele doorsneden

De volgende structurele uitbreiding is om naast deze **netwerkroute** drie parallelle Linux-routes te plaatsen:

```text
FILE_ROUTE:
  bytes → inode → pad → permissie → descriptor → proces

PROCESS_ROUTE:
  executable → PID → scheduler → CPU → output

NETWORK_ROUTE:
  bytes → adres → interface → route → verbinding

DEVICE_ROUTE:
  signaal → driver → device file → kernel → userspace
```

Samen vormen die `FILE`, `PROCESS`, `NETWORK`, `DEVICE` als vier operationele doorsneden van hetzelfde binaire veld.

---

## Correctie-trace

| Versie | Datum | Verandering |
|---|---|---|
| 1 | 2026-07-18 | Initiële stap. Linux als extrinsiek routeveld over intrinsieke binaire toestanden. Vier operationele doorsneden: FILE, PROCESS, NETWORK, DEVICE. |

---

**Geldig?** ✅  
**Perspectief:** Operationele laag — Linux als router over `BYTE_256`-velden.  
**State-relation:** `bits₀` (ruwe toestand) → `bitsₙ` (gerouteerde verbinding). Lokaal `≠`, volledig `≐`.
