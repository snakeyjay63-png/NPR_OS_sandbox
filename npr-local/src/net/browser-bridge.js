// @net 10.00.4.0/24
// browser-bridge.js — Browser → Kernel Bridge
// ═══════════════════════════════════════════════
//
// Browser = actieve systeemlaag (niet passieve viewer)
// Meerdere routes via 6-bit routing (0-63)
// Slot 0 = basis/null route
//
// WebAPI → 6-bit slot → NPR route → kernel/tool
// ═══════════════════════════════════════════════

const { digitalRoot } = require('../field/npr');

// ─── 6-Bit Route Table (0-63) ───

// Slot 0 = basis/null route — alles begint hier
const ROUTE_TABLE = [
  // ── Slot 0-7: Basis Routes ──
  { slot: 0,  name: 'null',           api: 'none',          desc: 'Basis route — null/void/empty' },
  { slot: 1,  name: 'console',        api: 'console',       desc: 'Console API — log/debug/info/warn/error' },
  { slot: 2,  name: 'clipboard',      api: 'ClipboardAPI',  desc: 'Clipboard — read/write text & files' },
  { slot: 3,  name: 'crypto',         api: 'WebCrypto',     desc: 'Crypto — AES, RSA, SHA, HKDF' },
  { slot: 4,  name: 'workers',        api: 'WebWorker',     desc: 'Workers — parallel JS execution' },
  { slot: 5,  name: 'service-worker', api: 'ServiceWorker', desc: 'Service Worker — background/cache/routing' },
  { slot: 6,  name: 'storage',        api: 'IndexedDB',     desc: 'IndexedDB — persistent storage' },
  { slot: 7,  name: 'cache',          api: 'CacheAPI',      desc: 'Cache — request/response caching' },

  // ── Slot 8-15: File & Storage Routes ──
  { slot: 8,  name: 'file-system',    api: 'FileSystemAccess', desc: 'File System Access — direct read/write' },
  { slot: 9,  name: 'file-reader',    api: 'FileReader',      desc: 'FileReader — async file read' },
  { slot: 10, name: 'blob-url',       api: 'Blob/URL',        desc: 'Blob URLs — in-memory file refs' },
  { slot: 11, name: 'drag-drop',      api: 'DragDrop',        desc: 'Drag & Drop — file transfer' },
  { slot: 12, name: 'navigator-store',api: 'NavigatorStorage',desc: 'Storage estimator & persistence' },
  { slot: 13, name: 'session-storage',api: 'SessionStorage',  desc: 'Session storage — ephemeral' },
  { slot: 14, name: 'local-storage',  api: 'LocalStorage',    desc: 'Local storage — persistent key-value' },
  { slot: 15, name: 'agent',          api: 'HTTP',            desc: 'Agent loop — NPR agent turns' },

  // ── Slot 16-23: Hardware Routes ──
  { slot: 16, name: 'serial',         api: 'WebSerial',       desc: 'Serial — UART/USB-serial devices' },
  { slot: 17, name: 'hid',            api: 'WebHID',          desc: 'HID — keyboards, mice, custom devices' },
  { slot: 18, name: 'usb',            api: 'WebUSB',          desc: 'USB — direct device communication' },
  { slot: 19, name: 'bluetooth',      api: 'WebBluetooth',    desc: 'Bluetooth — LE device discovery & connect' },
  { slot: 20, name: 'logs',           api: 'HTTP',            desc: 'Agent logs — in-memory circular buffer' },
  { slot: 21, name: 'memory',         api: 'HTTP',            desc: 'Memory search — workspace file index' },
  { slot: 22, name: 'nfc',           api: 'WebNFC',          desc: 'NFC — near-field communication' },
  { slot: 23, name: 'doctor',         api: 'HTTP',            desc: 'Doctor — system health checks' },

  // ── Slot 24-31: Sensor & Media Routes ──
  { slot: 24, name: 'tty',            api: 'HTTP/tty',        desc: 'TTY — terminal bridge' },
  { slot: 25, name: 'media-devices',  api: 'MediaDevices',    desc: 'Camera & microphone access' },
  { slot: 26, name: 'media-recorder', api: 'MediaRecorder',   desc: 'Record audio/video streams' },
  { slot: 27, name: 'web-codecs',     api: 'WebCodecs',       desc: 'Audio/video encoding/decoding' },
  { slot: 28, name: 'web-audio',      api: 'WebAudio',        desc: 'Audio processing & synthesis' },
  { slot: 29, name: 'gamepad',        api: 'Gamepad',         desc: 'Gamepad/controller input' },
  { slot: 30, name: 'geolocation',    api: 'Geolocation',     desc: 'GPS/location services' },
  { slot: 31, name: 'accelerometer',  api: 'SensorAPI',       desc: 'Motion/accelerometer data' },

  // ── Slot 32-39: Network & Comms Routes ──
  { slot: 32, name: 'fetch',          api: 'FetchAPI',        desc: 'HTTP requests — fetch/XMLHttpRequest' },
  { slot: 33, name: 'xhr',            api: 'XMLHttpRequest',  desc: 'XHR — legacy HTTP' },
  { slot: 34, name: 'websocket',      api: 'WebSocket',       desc: 'WebSocket — bidirectional comms' },
  { slot: 35, name: 'broadcast',      api: 'BroadcastChannel',desc: 'BroadcastChannel — cross-tab comms' },
  { slot: 36, name: 'shared-worker',  api: 'SharedWorker',    desc: 'SharedWorker — cross-tab worker' },
  { slot: 37, name: 'post-message',   api: 'postMessage',     desc: 'postMessage — cross-origin messaging' },
  { slot: 38, name: 'rtc-peer',       api: 'WebRTC',          desc: 'WebRTC — peer-to-peer media/data' },
  { slot: 39, name: 'rtc-data',       api: 'RTCDataChannel',  desc: 'RTC DataChannel — P2P data streams' },

  // ── Slot 40-47: Display & UI Routes ──
  { slot: 40, name: 'canvas-2d',      api: 'Canvas2D',        desc: '2D Canvas — bitmap rendering' },
  { slot: 41, name: 'canvas-gl',      api: 'WebGL',           desc: 'WebGL — GPU-accelerated 2D/3D' },
  { slot: 42, name: 'webgpu',         api: 'WebGPU',          desc: 'WebGPU — next-gen GPU compute' },
  { slot: 43, name: 'chat',           api: 'HTTP/SSE',        desc: 'Chat — agent chat with SSE streaming' },
  { slot: 44, name: 'dom',            api: 'DOM',             desc: 'DOM — document manipulation' },
  { slot: 45, name: 'css',            api: 'CSSOM',           desc: 'CSS — styling & layout' },
  { slot: 46, name: 'svg',            api: 'SVGDOM',          desc: 'SVG — vector graphics' },
  { slot: 47, name: 'fullscreen',     api: 'FullscreenAPI',   desc: 'Fullscreen — display mode' },

  // ── Slot 48-55: System & Config Routes ──
  { slot: 48, name: 'performance',    api: 'PerformanceAPI',  desc: 'Performance — timing & metrics' },
  { slot: 49, name: 'scheduler',      api: 'SchedulerAPI',    desc: 'Scheduler — priority & timing control' },
  { slot: 50, name: 'config',         api: 'HTTP',            desc: 'Config — runtime configuration' },
  { slot: 51, name: 'payment',        api: 'PaymentRequest',  desc: 'Payment — payment processing' },
  { slot: 52, name: 'contacts',       api: 'ContactsPicker',  desc: 'Contacts — address book access' },
  { slot: 53, name: 'screen-wake',    api: 'ScreenWakeLock',  desc: 'Wake Lock — prevent screen sleep' },
  { slot: 54, name: 'screen-orient',  api: 'ScreenOrientation',desc:'Screen orientation control' },
  { slot: 55, name: 'capture-display',api: 'getDisplayMedia', desc: 'Screen capture — display sharing' },

  // ── Slot 56-63: Meta & Control Routes ──
  { slot: 56, name: 'browser',        api: 'HTTP',            desc: 'File browser — directory navigation' },
  { slot: 57, name: 'npr-dns',        api: 'HTTP',            desc: 'NPR-DNS — service discovery' },
  { slot: 58, name: 'stroom',         api: 'HTTP',            desc: 'Stroom — live stream dashboard' },
  { slot: 59, name: 'devtools',       api: 'DevTools',        desc: 'DevTools — browser inspection' },
  { slot: 60, name: 'debugger',       api: 'Debugger API',    desc: 'Debugger — runtime debugging' },
  { slot: 61, name: 'profile',        api: 'Profiler',        desc: 'Profiler — performance profiling' },
  { slot: 62, name: 'introspect',     api: 'Runtime',         desc: 'Runtime introspection' },
  { slot: 63, name: 'hexa',           api: 'meta',            desc: 'Hexa point — field self-reference' },
];

// ─── Route Lookup ───

function getRoute(slot) {
  return ROUTE_TABLE.find(r => r.slot === slot) || ROUTE_TABLE[0];
}

function getRouteByName(name) {
  return ROUTE_TABLE.find(r => r.name === name) || ROUTE_TABLE[0];
}

function getRouteByAPI(api) {
  return ROUTE_TABLE.find(r => r.api.toLowerCase() === api.toLowerCase()) || ROUTE_TABLE[0];
}

// ─── 6-Bit Encoding ───

function encode6Bit(slot) {
  if (slot < 0 || slot > 63) return null;
  return slot.toString(2).padStart(6, '0');
}

function decode6Bit(bin) {
  const slot = parseInt(bin, 2);
  if (isNaN(slot) || slot > 63) return null;
  return slot;
}

// ─── NPR Route Mapping ───

// Text → digital root → slot → route
function routeFromText(text) {
  let sum = 0;
  for (const ch of text) {
    sum += ch.codePointAt(0) || 0;
  }
  const dr = digitalRoot(sum);
  const slot = (dr * 7) % 64;
  return { ...getRoute(slot), digitalRoot: dr, binary: encode6Bit(slot) };
}

// API name → route
function routeFromAPI(apiName) {
  const route = getRouteByAPI(apiName);
  return { ...route, binary: encode6Bit(route.slot) };
}

// ─── Capability Discovery ───

function listCapabilities(category) {
  if (!category) return ROUTE_TABLE;
  
  const categories = {
    basis:      [0, 1, 2, 3, 4, 5, 6, 7],
    storage:    [8, 9, 10, 11, 12, 13, 14, 15],
    hardware:   [16, 17, 18, 19, 20, 21, 22, 23],
    sensor:     [24, 25, 26, 27, 28, 29, 30, 31],
    network:    [32, 33, 34, 35, 36, 37, 38, 39],
    display:    [40, 41, 42, 43, 44, 45, 46, 47],
    system:     [48, 49, 50, 51, 52, 53, 54, 55],
    meta:       [56, 57, 58, 59, 60, 61, 62, 63],
  };
  
  const slots = categories[category.toLowerCase()];
  if (!slots) return ROUTE_TABLE;
  return ROUTE_TABLE.filter(r => slots.includes(r.slot));
}

// ─── Bridge Interface ───

const BrowserBridge = {
  ROUTE_TABLE,
  getRoute,
  getRouteByName,
  getRouteByAPI,
  encode6Bit,
  decode6Bit,
  routeFromText,
  routeFromAPI,
  listCapabilities,
  
  // Full route map (compact)
  get map() {
    return ROUTE_TABLE.map(r => ({
      slot: r.slot,
      binary: encode6Bit(r.slot),
      name: r.name,
      api: r.api,
      dr: digitalRoot(r.slot || 1),
    }));
  },
  
  // Slot 0 = null/basis
  get nullRoute() { return ROUTE_TABLE[0]; },
};

module.exports = BrowserBridge;
