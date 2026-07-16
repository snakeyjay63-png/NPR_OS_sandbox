// @net 10.00.0.0/24
// terminal.js — Linux TTY bridge
//
// Verbindt fysiek toetsenbord → NPR field → agent loop
// Raw stdin capture + TUI output
//
// Usage:
//   node src/index.js --tty        # Terminal mode (blocks stdin)
//   node src/index.js              # HTTP mode (default)

const { keyboardNPR, signalChain, ENCODING_LAYERS } = require('./field/keyboard-npr');

let stdin;
let stdout;
let ttyMode = false;
let keyBuffer = [];
const MAX_BUFFER = 100;

// ─── ANSI Colors ───

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// ─── Digital Root Color ───

function drColor(dr) {
  const colors = [C.reset, C.cyan, C.blue, C.green, C.yellow, C.red, C.magenta, C.white, C.dim, C.bold];
  return colors[dr] || C.reset;
}

// ─── TUI Banner ───

function banner() {
  return `
${C.bold}${C.cyan}╔══════════════════════════════════════════╗${C.reset}
${C.bold}${C.cyan}║       NPR-Local Terminal v0.0.1         ║${C.reset}
${C.bold}${C.cyan}║       Fysiek toetsenbord → NPR Field    ║${C.reset}
${C.bold}${C.cyan}╚══════════════════════════════════════════╝${C.reset}

${C.dim}Type anything → see NPR routing in real-time${C.reset}
${C.dim}Type a message and press Enter → agent turn${C.reset}

${C.dim}Commands:${C.reset}
  /help     Show commands
  /chain <char>  Show full signal chain
  /layers   Show encoding layers
  /quit     Exit terminal

${C.green}>${C.reset} `;
}

// ─── Parse Key Sequence ───

function parseKey(seq) {
  // Escape sequences
  if (Array.isArray(seq)) {
    if (seq.length === 1 && seq[0] === 27) return { key: 'esc', special: true };
    if (seq.length === 3 && seq[0] === 27 && seq[1] === 91) {
      const arrows = { 65: 'up', 66: 'down', 67: 'right', 68: 'left' };
      return { key: arrows[seq[2]] || `F${seq[2]}`, special: true, code: seq[2] };
    }
    if (seq.length === 6 && seq[0] === 27 && seq[1] === 91 && seq[2] === 126) {
      const specials = { 50: 'insert', 51: 'delete', 72: 'f12', 71: 'home', 79: 'end' };
      return { key: specials[seq[3]] || `F${seq[3]}`, special: true };
    }
  }
  
  // Regular key
  const key = String.fromCharCode(seq);
  return { key, special: false, code: seq };
}

// ─── Render NPR Route ───

function renderNPR(keyObj) {
  if (keyObj.special) {
    return `${C.dim}[${keyObj.key}]${C.reset}`;
  }
  
  const result = keyboardNPR(keyObj.key);
  const dr = result.route.digitalRoot;
  const col = drColor(dr);
  
  return `${col}${keyObj.key}${C.reset} → ` +
         `${C.dim}U+${result.input.codePoint.toString(16).padStart(4, '0')}${C.reset} ` +
         `${C.dim}dr:${dr}${C.reset} ` +
         `${C.dim}slot:${result.route.slot}${C.reset} ` +
         `${C.dim}${result.input.utf8.join(' ')}${C.reset}`;
}

// ─── Render Signal Chain ───

function renderChain(char) {
  const chain = signalChain(char);
  let out = `\n${C.bold}Signal Chain: '${char}'${C.reset}\n`;
  
  for (const step of chain) {
    const marker = step.gat ? `${C.yellow}⚡${C.reset}` : '  ';
    out += `  ${marker} ${C.cyan}${step.stage.padEnd(12)}${C.reset} → ${step.data}\n`;
  }
  
  out += `\n`;
  return out;
}

// ─── Render Encoding Layers ───

function renderLayers() {
  let out = `\n${C.bold}Encoding Layers (with gaten):${C.reset}\n`;
  
  for (const layer of ENCODING_LAYERS) {
    const marker = layer.gat ? `${C.yellow}⚡ GAT${C.reset}` : `${C.dim}---${C.reset}`;
    out += `  ${marker} L${layer.layer.toString().padStart(2)} ${C.cyan}${layer.name.padEnd(12)}${C.reset} ${layer.type}\n`;
  }
  
  out += `\n`;
  return out;
}

// ─── Initialize TTY ───

function initTTY() {
  if (!process.stdin.isTTY) {
    console.error('Not a TTY — terminal mode requires a terminal');
    return false;
  }
  
  stdin = process.stdin;
  stdout = process.stdout;
  
  // Set raw mode
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  
  // Clear screen
  stdout.write('\x1b[2J\x1b[H');
  stdout.write(banner());
  
  ttyMode = true;
  keyBuffer = [];
  
  // Handle input
  stdin.on('data', (data) => {
    const code = data instanceof Buffer ? data[0] : data.charCodeAt(0);
    const keyObj = parseKey(code);
    
    // Handle special keys
    if (keyObj.key === 'esc') {
      shutdown();
      return;
    }
    
    if (keyObj.key === 'up' || keyObj.key === 'down' || 
        keyObj.key === 'left' || keyObj.key === 'right') {
      // Navigation — could implement history later
      return;
    }
    
    // Enter = process buffer
    if (code === 13) {
      stdout.write('\n');
      const message = keyBuffer.join('');
      
      if (message.startsWith('/')) {
        handleCommand(message);
      } else if (message.trim()) {
        handleMessage(message);
      }
      
      keyBuffer = [];
      return;
    }
    
    // Backspace
    if (code === 127 || code === 8) {
      if (keyBuffer.length > 0) {
        keyBuffer.pop();
        stdout.write('\b \b');
      }
      return;
    }
    
    // Regular character — show NPR routing inline
    if (keyObj.key >= ' ' && keyObj.key <= '~') {
      if (keyBuffer.length >= MAX_BUFFER) return;
      
      keyBuffer.push(keyObj.key);
      
      // Show key + NPR route
      const nprLine = renderNPR(keyObj);
      stdout.write(nprLine);
    }
  });
  
  return true;
}

// ─── Agent Turn via HTTP ───

const http = require('http');

function agentTurn(message) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ message });
    const options = {
      hostname: '127.0.0.1',
      port: process.env.PORT || 5000,
      path: '/tty/agent',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    };
    
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch {
          resolve({ text: body });
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ─── Handle Commands ───

async function handleCommand(cmd) {
  const [command, ...args] = cmd.split(' ');
  
  switch (command) {
    case '/help':
      stdout.write(`${C.cyan}Commands:${C.reset}\n`);
      stdout.write('  /help         Show this help\n');
      stdout.write('  /chain <char> Show signal chain\n');
      stdout.write('  /layers       Show encoding layers\n');
      stdout.write('  /quit         Exit terminal\n\n');
      break;
      
    case '/chain':
      if (args[0]) {
        stdout.write(renderChain(args[0][0] || 'a'));
      } else {
        stdout.write(`${C.yellow}Usage: /chain <character>${C.reset}\n\n`);
      }
      break;
      
    case '/layers':
      stdout.write(renderLayers());
      break;
      
    case '/quit':
      stdout.write(`${C.green}Goodbye.${C.reset}\n`);
      shutdown();
      return;
      
    default:
      stdout.write(`${C.yellow}Unknown command: ${command}${C.reset}\n\n`);
  }
  
  stdout.write(`${C.green}>${C.reset} `);
}

// ─── Handle Message (agent turn) ───

async function handleMessage(message) {
  if (!message.trim()) return;
  
  stdout.write(`${C.dim}→ agent:${C.reset} "${message}"\n\n`);
  
  try {
    const result = await agentTurn(message);
    
    if (result && result.text) {
      stdout.write(`${C.green}${result.text}${C.reset}\n\n`);
    } else if (result && result.error) {
      stdout.write(`${C.red}Error: ${result.error}${C.reset}\n\n`);
    } else {
      stdout.write(`${C.dim}No response${C.reset}\n\n`);
    }
  } catch (e) {
    stdout.write(`${C.red}Agent error: ${e.message}${C.reset}\n\n`);
  }
  
  stdout.write(`${C.green}>${C.reset} `);
}

// ─── Shutdown ───

function shutdown() {
  if (stdin) {
    stdin.setRawMode(false);
    stdin.pause();
  }
  ttyMode = false;
  process.exit(0);
}

// ─── Export ───

module.exports = {
  initTTY,
  get ttyMode() { return ttyMode; },
  get keyBuffer() { return [...keyBuffer]; },
  banner,
  renderNPR,
  renderChain,
  renderLayers,
};
