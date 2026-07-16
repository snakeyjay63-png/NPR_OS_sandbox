// ═══════════════════════════════════════════════════
// sources/system-scan.js — tool-00: Local System Scan
// ═══════════════════════════════════════════════════
//
// No hardcoded data. Everything discovered live.
// Scan the system → know what exists → route to it.
//
// "Geen data. Linux als route."
// ═══════════════════════════════════════════════════

const { execSync, spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

// ─── Helpers ───

function run(cmd, opts = {}) {
  try {
    const out = execSync(cmd, {
      encoding: 'utf-8',
      timeout: opts.timeout || 10000,
      shell: '/bin/bash',
      ...opts,
    });
    return out.trim();
  } catch (err) {
    return opts.failNull ? null : `error: ${err.message || err.stdout || ''}`;
  }
}

function parseLines(text) {
  if (!text) return [];
  return text.split('\n').filter(l => l.trim());
}

// ─── Scan Functions ───

function scanOS() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    release: os.release(),
    type: os.type(),
    uptime: os.uptime(),
    cpus: os.cpus().slice(0, 1).map(c => c.model),
    cpuCount: os.cpus().length,
    totalMem: os.totalmem(),
    freeMem: os.freemem(),
    home: os.homedir(),
    tmpdir: os.tmpdir(),
  };
}

function scanPackages() {
  const result = {};

  // APT (Debian/Ubuntu)
  result.apt = {
    count: run("dpkg-query -W -f='${Package}\n' 2>/dev/null | wc -l").trim(),
    packages: parseLines(run("dpkg-query -W -f='${Package} ${Version}\n' 2>/dev/null | head -100")),
  };

  // NPM global
  result.npm = {
    version: run('npm --version'),
    global: parseLines(run('npm list -g --depth=0 2>/dev/null')),
  };

  // Python
  result.python = {
    version: run('python3 --version 2>&1'),
    pip: parseLines(run('pip3 list --format=columns 2>/dev/null | tail -n +4 | head -50')),
    venvs: parseLines(run("find ~ -maxdepth 3 -name 'pyvenv.cfg' 2>/dev/null | head -10")),
  };

  // Node.js
  result.node = {
    version: run('node --version'),
    npm: run('npm --version'),
    npx: run('npx --version'),
  };

  return result;
}

function scanBinaries() {
  const binaries = {};

  // Common categories
  const categories = {
    compilers:    ['gcc', 'g++', 'clang', 'rustc', 'javac', 'go'],
    interpreters: ['python3', 'python', 'node', 'deno', 'ruby', 'perl', 'php', 'lua'],
    shells:       ['bash', 'zsh', 'fish', 'tcsh', 'sh'],
    editors:      ['vim', 'nano', 'emacs', 'micro', 'code'],
    databases:    ['sqlite3', 'mysql', 'psql', 'mongosh', 'redis-cli'],
    network:      ['curl', 'wget', 'ssh', 'scp', 'rsync', 'nginx', 'apache2'],
    media:        ['ffmpeg', 'ffprobe', 'imagemagick', 'convert', 'sox'],
    compression:  ['tar', 'gzip', 'bzip2', 'xz', 'zip', 'unzip', '7z'],
    devtools:     ['git', 'docker', 'kubectl', 'terraform', 'ansible', 'vagrant'],
    system:       ['systemctl', 'journalctl', 'top', 'htop', 'lsof', 'strace'],
  };

  for (const [cat, cmds] of Object.entries(categories)) {
    binaries[cat] = cmds.filter(cmd => run(`which ${cmd} 2>/dev/null`, { failNull: true }));
  }

  return binaries;
}

function scanServices() {
  return {
    running: parseLines(run('systemctl list-units --type=service --state=running --no-pager 2>/dev/null | head -50')),
    enabled: parseLines(run('systemctl list-unit-files --type=service --state=enabled --no-pager 2>/dev/null | head -50')),
  };
}

function scanNetwork() {
  return {
    interfaces: parseLines(run('ip -brief addr show 2>/dev/null')),
    listening: parseLines(run('ss -tlnp 2>/dev/null | head -30')),
    dns: run('cat /etc/resolv.conf 2>/dev/null | grep nameserver'),
    hostname: run('hostname'),
  };
}

function scanFileSystem() {
  return {
    disks: parseLines(run('df -h 2>/dev/null')),
    home: parseLines(run('ls -la ~ 2>/dev/null | head -30')),
    workspace: parseLines(run('ls -la /home/claw/.openclaw/workspace 2>/dev/null | head -30')),
  };
}

function scanEnvironment() {
  // Only safe/interesting env vars
  const vars = ['PATH', 'HOME', 'USER', 'SHELL', 'LANG', 'EDITOR', 'VISUAL',
                'NODE_ENV', 'npm_config_', 'PYTHONPATH', 'VIRTUAL_ENV',
                'OPENCLAW_', 'EDITOR', 'GIT_', 'DOCKER_'];
  
  const result = {};
  const env = process.env;
  for (const prefix of vars) {
    for (const key of Object.keys(env)) {
      if (key.startsWith(prefix) && !key.includes('KEY') && !key.includes('TOKEN') && !key.includes('SECRET')) {
        result[key] = env[key];
      }
    }
  }
  return result;
}

function scanSkills() {
  // Scan OpenClaw skills
  const skillDirs = [
    '~/.openclaw/workspace/skills',
    '~/.local/lib/node_modules/openclaw/skills',
    '/home/claw/.openclaw/workspace/skills',
  ];

  const skills = [];
  for (const dir of skillDirs) {
    const resolved = path.resolve(dir);
    if (fs.existsSync(resolved)) {
      try {
        const entries = fs.readdirSync(resolved, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const skillMd = path.join(resolved, entry.name, 'SKILL.md');
            if (fs.existsSync(skillMd)) {
              skills.push({
                name: entry.name,
                path: skillMd,
                dir: path.join(resolved, entry.name),
              });
            }
          }
        }
      } catch { /* skip */ }
    }
  }
  return skills;
}

function scanTools() {
  // Discover all tools in PATH
  const pathDirs = (process.env.PATH || '').split(':');
  const tools = new Set();

  for (const dir of pathDirs) {
    if (!fs.existsSync(dir)) continue;
    try {
      const entries = fs.readdirSync(dir);
      for (const entry of entries) {
        const fullPath = path.join(dir, entry);
        try {
          const stat = fs.statSync(fullPath);
          if (stat.isFile() || stat.isSymbolicLink()) {
            // Check executable
            try {
              fs.accessSync(fullPath, fs.constants.X_OK);
              tools.add(entry);
            } catch { /* not executable */ }
          }
        } catch { /* skip */ }
      }
    } catch { /* skip dir */ }
  }

  return {
    total: tools.size,
    tools: [...tools].sort(),
    pathDirs: pathDirs.filter(d => fs.existsSync(d)),
  };
}

// ─── Storage ───

const PRIVATE_DIR = path.join(os.homedir(), '.openclaw', 'npr-local', 'scans');

function ensureScanDir() {
  if (!fs.existsSync(PRIVATE_DIR)) {
    fs.mkdirSync(PRIVATE_DIR, { recursive: true, mode: 0o700 });
  }
  return PRIVATE_DIR;
}

function saveScan(scan) {
  const dir = ensureScanDir();
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `scan-${ts}.json`;
  const filepath = path.join(dir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(scan, null, 2), { mode: 0o600 });
  return filepath;
}

// ─── Full Scan ───

async function fullScan(save = false) {
  const start = Date.now();
  const scan = {
    timestamp: new Date().toISOString(),
    origin: '0.0.0.0',
  };

  scan.os = scanOS();
  scan.packages = scanPackages();
  scan.binaries = scanBinaries();
  scan.services = scanServices();
  scan.network = scanNetwork();
  scan.filesystem = scanFileSystem();
  scan.environment = scanEnvironment();
  scan.skills = scanSkills();
  scan.tools = scanTools();

  scan.scanDuration = Date.now() - start;

  // NPR route
  const totalItems = Object.keys(scan.os).length + 
                     scan.packages.apt.count + 
                     scan.tools.total +
                     scan.skills.length;
  const dr = ((totalItems - 1) % 9) + 1;
  
  scan.route = {
    totalDiscovered: totalItems,
    digitalRoot: dr,
    slot: (dr * 7) % 64,
    origin: '0.0.0.0',
    return: '0.0.0.0',
  };

  // Save to private directory if requested
  if (save) {
    scan.savedPath = saveScan(scan);
  }

  return scan;
}

// ─── Quick Scan (lightweight) ───

function quickScan(save = false) {
  const start = Date.now();
  const scan = {
    timestamp: new Date().toISOString(),
    os: {
      platform: os.platform(),
      hostname: os.hostname(),
      uptime: os.uptime(),
    },
    node: run('node --version'),
    python: run('python3 --version 2>&1'),
    tools: scanTools().total,
    scanDuration: Date.now() - start,
    origin: '0.0.0.0',
  };

  if (save) {
    scan.savedPath = saveScan(scan);
  }

  return scan;
}

// ─── Cron Schedule ───

function scheduleScan(intervalMs, full = false) {
  // Run scan at interval, save to private directory
  const timer = setInterval(() => {
    const scanFn = full ? fullScan : quickScan;
    scanFn(true).catch(err => {
      console.error(`[scan-cron] Error: ${err.message}`);
    });
  }, intervalMs);

  return {
    timer,
    intervalMs,
    full,
    stop: () => clearInterval(timer),
  };
}

module.exports = { fullScan, quickScan, scanOS, scanPackages, scanBinaries, scanServices, scanNetwork, scanFileSystem, scanEnvironment, scanSkills, scanTools, scheduleScan };
