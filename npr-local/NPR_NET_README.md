# NPR-Net — Eigen Internet

NPR-Local draait nu als een mini-internet. Elke service heeft eigen adres, eigen poort, eigen naam.

## Architectuur

```
┌──────────────────────────────────────────────────────────┐
│                  NPR-Gateway (:5000)                      │
│                                                          │
│  Incoming request → DNS lookup → slot → IP → port        │
│                                                          │
│  Endpoints:                                              │
│    /dns?name=chat    → resolve naam → adres              │
│    /registry         → alle services                     │
│    /net              → netwerk topologie                 │
│    /tool/{name}      → proxy naar service                │
│                                                          │
│  Router = Digitale Root (1-9) → subnet 10.{dr}.0.0/24   │
└────────────┬──────────────┬──────────────┬───────────────┘
             │              │              │
        ┌────▼────┐    ┌───▼────┐    ┌───▼────┐
        │ :5043   │    │ :5021  │    │ :5023  │
        │ chat    │    │ memory │    │ doctor │
        │ slot 43 │    │ slot 21│    │ slot 23│
        └─────────┘    └────────┘    └────────┘
```

## DNS

Elke naam = slot = IP = port = functie.

| Naam | Slot | IP | Port | Functie |
|------|------|----|------|---------|
| chat | 43 | 10.07.0.43 | 5043 | Chat + agent loop |
| memory | 21 | 10.03.0.21 | 5021 | Memory context + search |
| doctor | 23 | 10.05.0.23 | 5023 | Health checks |
| echo | 24 | 10.06.0.24 | 5024 | Echo tool |
| config | 50 | 10.05.0.50 | 5050 | Config |
| agent | 15 | 10.06.0.15 | 5015 | Agent |
| browser | 56 | 10.02.0.56 | 5056 | File & service viewer |

## Services

Elke service:
- Draait op eigen HTTP server
- Registreert bij centrale registry
- Heeft eigen `/` endpoint
- Heeft eigen `/_status` endpoint
- Exposeert capabilities (wat kan deze service?)

### Service aanmaken

```js
const { NPRService } = require('./src/net');

const chat = new NPRService('chat', {
  description: 'Chat + agent loop',
  capabilities: ['chat', 'agent', 'stream'],
});

chat.get('/agent/chat', (req, res) => {
  this.json(res, { text: 'hello' });
});

await chat.start(); // → :5043
```

## DNS Page

Live netwerk dashboard: `http://127.0.0.1:5000/public/dns.html`

Toont:
- Alle services
- Status (alive/dead)
- IP adres per service
- Capabilities
- Netwerk topologie

## Gebruik

### Boot netwerk

```js
const { boot } = require('./src/net');
const { NPRService } = require('./src/net');

const BROWSER = require('./src/net/browser');
const chat = new NPRService('chat', { capabilities: ['chat'] });
const memory = new NPRService('memory', { capabilities: ['memory'] });

const { gateway } = await boot({
  port: 5000,
  services: [BROWSER, chat, memory],
});
```

### DNS resolve

```bash
# Resolve naam
curl http://127.0.0.1:5000/dns?name=chat

# Alle services
curl http://127.0.0.1:5000/registry

# Netwerk topologie
curl http://127.0.0.1:5000/net
```

### Proxy

```bash
# Via gateway → chat service
curl http://127.0.0.1:5000/tool/chat

# Direct → chat service
curl http://127.0.0.1:5043/
```

## Voordelen

- **Geen port conflicts** — elk ding heeft eigen poort
- **Service discovery** — registry weet wat er draait
- **DNS** — naam → adres → functie
- **Scalable** — voeg services toe zonder gateway aanpassen
- **Testbaar** — elke service apart testbaar
- **Distributed ready** — kan later op echte hosts draaien
