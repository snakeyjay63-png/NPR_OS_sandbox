// @net 10.13.0.0/24
// routes/tool-exec.js — System tool integration
//
// Security: allowlist tools only, spawnSync(shell:false), no shell interpolation.
// Detecteert geïnstalleerde tools en maakt ze bruikbaar als NPR capabilities.
// Elke tool = een executable + command syntax + NPR route mapping.

const { spawnSync } = require('child_process');
const path = require('path');

// ─── Tool Registry ───

const TOOLS = {
  bluetoothctl: {
    desc: 'Bluetooth device management',
    slot: 32,
    category: 'device',
    commands: {
      scan: {
        desc: 'Scan for Bluetooth devices',
        cmd: ['bluetoothctl', 'scan', 'on'],
        timeout: 10000,
      },
      devices: {
        desc: 'List known devices',
        cmd: ['bluetoothctl', 'devices'],
        timeout: 3000,
      },
      paired: {
        desc: 'List paired devices',
        cmd: ['bluetoothctl', 'paired-devices'],
        timeout: 3000,
      },
      info: {
        desc: 'Controller info',
        cmd: ['bluetoothctl', 'info'],
        timeout: 3000,
      },
      power: {
        desc: 'Toggle Bluetooth power',
        cmd: (action) => ['bluetoothctl', 'power', action || 'on'],
        timeout: 3000,
      },
    },
  },
  tmux: {
    desc: 'Terminal multiplexer',
    slot: 33,
    category: 'terminal',
    commands: {
      list: {
        desc: 'List sessions',
        cmd: ['tmux', 'list-sessions', '-F', '#{session_name}:#{window_count} windows, #{session_activity}'],
        timeout: 3000,
      },
      new: {
        desc: 'Create new session',
        cmd: (name = 'npr', cmd = '') => {
          const base = ['tmux', 'new-session', '-d', '-s', name];
          if (cmd) base.push('-c', cmd);
          return base;
        },
        timeout: 3000,
      },
      kill: {
        desc: 'Kill session',
        cmd: (name) => ['tmux', 'kill-session', '-t', name],
        timeout: 3000,
      },
      capture: {
        desc: 'Capture pane content',
        cmd: (target = ':0') => ['tmux', 'capture-pane', '-t', target, '-p'],
        timeout: 3000,
      },
      send: {
        desc: 'Send keys to pane',
        cmd: (target, keys) => ['tmux', 'send-keys', '-t', target, keys, 'Enter'],
        timeout: 3000,
      },
    },
  },
  lazygit: {
    desc: 'Git TUI',
    slot: 34,
    category: 'git',
    commands: {
      status: {
        desc: 'Git status (git CLI fallback)',
        cmd: ['git', 'status', '--short', '--branch'],
        timeout: 5000,
      },
      log: {
        desc: 'Git log (compact)',
        cmd: ['git', 'log', '--oneline', '-10', '--graph', '--decorate'],
        timeout: 5000,
      },
      diff: {
        desc: 'Git diff',
        cmd: ['git', 'diff', '--stat'],
        timeout: 5000,
      },
      branches: {
        desc: 'Git branches',
        cmd: ['git', 'branch', '-v', '--sort=-committerdate'],
        timeout: 5000,
      },
    },
  },
  ffmpeg: {
    desc: 'Audio/video processing',
    slot: 35,
    category: 'media',
    commands: {
      info: {
        desc: 'Show available decoders/encoders',
        cmd: ['ffmpeg', '-version'],
        timeout: 3000,
      },
      devices: {
        desc: 'List available devices',
        cmd: ['ffmpeg', '-devices'],
        timeout: 3000,
      },
    },
  },
  htop: {
    desc: 'Process monitor',
    slot: 36,
    category: 'system',
    commands: {
      top: {
        desc: 'Top 10 processes by memory',
        cmd: ['ps', 'aux', '--sort=-%mem', '--no-headers'],
        postProcess: (out) => out.trim().split('\n').slice(0, 10),
        timeout: 3000,
      },
      cpu: {
        desc: 'Top 10 processes by CPU',
        cmd: ['ps', 'aux', '--sort=-%cpu', '--no-headers'],
        postProcess: (out) => out.trim().split('\n').slice(0, 10),
        timeout: 3000,
      },
    },
  },
  git: {
    desc: 'Version control',
    slot: 37,
    category: 'git',
    commands: {
      status: {
        desc: 'Repo status',
        cmd: ['git', 'status', '--porcelain', '-b'],
        timeout: 5000,
      },
      log: {
        desc: 'Commit log',
        cmd: ['git', 'log', '--oneline', '-20'],
        timeout: 5000,
      },
    },
  },
};

// ─── Tool Detection ───

// P0-1 fix: spawnSync(shell:false) instead of execSync with shell interpolation
function isInstalled(toolName) {
  try {
    const r1 = spawnSync('which', [toolName], { encoding: 'utf8', timeout: 2000, shell: false, maxBuffer: 8192 });
    if (r1.status === 0) return r1.stdout.trim();
  } catch {}
  try {
    const r2 = spawnSync('command', ['-v', toolName], { encoding: 'utf8', timeout: 2000, shell: false, maxBuffer: 8192 });
    if (r2.status === 0) return r2.stdout.trim();
  } catch {}
  return null;
}

function scanTools() {
  const result = [];
  for (const [name, tool] of Object.entries(TOOLS)) {
    const binPath = isInstalled(name);
    result.push({
      name,
      desc: tool.desc,
      slot: tool.slot,
      category: tool.category,
      installed: !!binPath,
      path: binPath || null,
      commands: Object.keys(tool.commands),
    });
  }
  return result;
}

// ─── Execute Tool Command ───

function execute(toolName, commandName, args = {}) {
  const tool = TOOLS[toolName];
  if (!tool) return { error: `Unknown tool: ${toolName}` };
  
  const cmdDef = tool.commands[commandName];
  if (!cmdDef) return { error: `Unknown command: ${toolName}.${commandName}` };
  
  const binPath = isInstalled(toolName);
  if (!binPath) return { error: `Tool not installed: ${toolName}` };
  
  // Resolve command
  let cmd, cmdArgs;
  if (typeof cmdDef.cmd === 'function') {
    const resolved = cmdDef.cmd(args);
    cmd = resolved[0];
    cmdArgs = resolved.slice(1);
  } else {
    cmd = cmdDef.cmd[0];
    cmdArgs = cmdDef.cmd.slice(1);
  }
  
  // Execute — spawnSync with shell:false (P0-1 fix: prevent command injection)
  try {
    const { spawnSync } = require('child_process');
    const output = spawnSync(cmd, cmdArgs, {
      encoding: 'utf8',
      timeout: cmdDef.timeout || 5000,
      cwd: process.cwd(),
      shell: false,
      maxBuffer: 1 * 1024 * 1024, // 1MB cap
    });
    if (output.error) {
      return { error: `Execution failed: ${output.error.message || output.error.code || 'spawn error'}` };
    }
    const resultStr = output.stdout?.toString().trim() || '';
    
    let result = resultStr;
    if (cmdDef.postProcess) {
      result = cmdDef.postProcess(result);
    }
    
    return { tool: toolName, command: commandName, output: result };
  } catch (e) {
    return { error: `Execution failed: ${e.message || e.code || 'timeout'}` };
  }
}

// ─── HTTP Handler ───

function handler(req, res, ctx = {}) {
  const url = ctx.url || new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const params = new URLSearchParams(url.search);
  const toolName = url.pathname.split('/').filter(Boolean).pop() || params.get('tool');
  const commandName = params.get('cmd') || params.get('command');
  
  // P0-1 fix: validate toolName against allowlist BEFORE any exec
  if (toolName && !TOOLS[toolName]) {
    return res.status(404).json({ error: `Unknown tool: ${toolName}` });
  }

  // GET /tool/exec — list available tools
  if (!toolName || url.pathname === '/tool/exec') {
    const tools = scanTools();
    return res.json({
      tools,
      installed: tools.filter(t => t.installed).length,
      total: tools.length,
    });
  }
  
  // Specific tool — show capabilities
  if (!commandName && req.method === 'GET') {
    const tool = TOOLS[toolName];
    if (!tool) {
      return res.status(404).json({ error: `Unknown tool: ${toolName}` });
    }
    
    const binPath = isInstalled(toolName);
    return res.json({
      name: toolName,
      desc: tool.desc,
      slot: tool.slot,
      category: tool.category,
      installed: !!binPath,
      path: binPath,
      commands: Object.entries(tool.commands).map(([k, v]) => ({
        name: k,
        desc: v.desc,
      })),
    });
  }
  
  // Execute command
  if (req.method === 'POST' || commandName) {
    const body = req.body || {};
    const cmd = commandName || body.command || body.cmd;
    const result = execute(toolName, cmd, body);
    return res.json(result);
  }
  
  res.status(405).json({ error: 'GET for listing, POST {command} for execution' });
}

module.exports = { handler, scanTools, execute, TOOLS };
