// @net 10.00.4.0/24
// browser.js — NPR File Browser Service
//
// Klein internet-browser binnen NPR-Local:
// - Directory navigation
// - File viewer (code, images, JSON, text)
// - Service viewer (bekijk andere NPR-services)
// - Syntax highlighting
// - Zoeken in files

const fs = require('fs');
const path = require('path');
const { NPRService } = require('./service');

const BROWSER = new NPRService('browser', {
  description: 'File & service browser',
  capabilities: ['browser', 'files', 'viewer', 'search'],
});

const MAX_FILE = 1024 * 1024; // 1MB
const MAX_DEPTH = 20;

// ─── Safe path resolution ───

function safeJoin(base, userPath) {
  const resolved = path.resolve(base, userPath);
  if (!resolved.startsWith(base)) {
    return null; // path traversal
  }
  return resolved;
}

// ─── Syntax highlighting ───

function highlight(code, lang) {
  // Simple highlighting (no deps)
  let esc = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  if (['js', 'ts', 'json', 'jsx', 'tsx'].includes(lang)) {
    esc = esc
      .replace(/\b(const|let|var|function|return|if|else|for|while|async|await|import|export|require|module|class|new|this|try|catch|throw)\b/g, '<span style="color:#c792ea">$1</span>')
      .replace(/\b(\d+\.?\d*)\b/g, '<span style="color:#ecc48d">$1</span>')
      .replace(/(['"`])(.*?)\1/g, '<span style="color:#c3e88d">$1$2$1</span>')
      .replace(/(\/\/.*$)/gm, '<span style="color:#546e7a">$1</span>')
      .replace(/(\/\*[\s\S]*?\*\/)/g, '<span style="color:#546e7a">$1</span>')
      .replace(/\b(require|process|console|document|window)\b/g, '<span style="color:#82aaff">$1</span>');
  } else if (['md', 'txt'].includes(lang)) {
    esc = esc
      .replace(/^(#{1,6}\s.*)$/gm, '<span style="color:#82aaff">$1</span>')
      .replace(/(\*\*[^*]+\*\*)/g, '<span style="color:#e0e0e8; font-weight:bold">$1</span>')
      .replace(/(`[^`]+`)/g, '<span style="color:#c3e88d">$1</span>');
  } else if (['sh', 'bash'].includes(lang)) {
    esc = esc
      .replace(/\b(if|then|else|fi|for|while|do|done|case|esac|function|return|exit|echo)\b/g, '<span style="color:#c792ea">$1</span>')
      .replace(/(['"])(.*?)\1/g, '<span style="color:#c3e88d">$1$2$1</span>')
      .replace(/(#.*$)/gm, '<span style="color:#546e7a">$1</span>');
  }

  return esc;
}

// ─── File type detection ───

function fileType(name) {
  const ext = name.split('.').pop().toLowerCase();
  if (['js', 'ts', 'json', 'jsx', 'tsx'].includes(ext)) return 'code';
  if (['md', 'txt', 'log'].includes(ext)) return 'text';
  if (['html', 'css', 'scss'].includes(ext)) return 'code';
  if (['sh', 'bash', 'py'].includes(ext)) return 'code';
  if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return 'image';
  if (['yml', 'yaml', 'toml', 'ini', 'conf'].includes(ext)) return 'code';
  return 'text';
}

// ─── Directory listing ───

function listDir(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    return entries.map(e => ({
      name: e.name,
      type: e.isDirectory() ? 'dir' : fileType(e.name),
      size: e.isFile() ? fs.statSync(path.join(dir, e.name)).size : 0,
      path: e.name,
    }));
  } catch {
    return [];
  }
}

// ─── File search ───

function searchFiles(dir, query, depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const results = [];
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...searchFiles(full, query, depth + 1));
      } else if (entry.name.toLowerCase().includes(query.toLowerCase())) {
        results.push({ name: entry.name, path: full, type: fileType(entry.name) });
      }
    }
  } catch {}
  return results.slice(0, 100);
}

// ─── Routes ───

BROWSER.get('/', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(browserHTML());
});

BROWSER.get('/dir', (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const dir = url.searchParams.get('path') || path.resolve(__dirname, '../../');
  const safe = safeJoin('/home/claw/.openclaw/workspace', dir);
  if (!safe || !fs.existsSync(safe) || !fs.statSync(safe).isDirectory()) {
    return this.json(res, { error: 'directory not found' }, 404);
  }

  const rel = path.relative('/home/claw/.openclaw/workspace', safe);
  const entries = listDir(safe);
  this.json(res, { dir: rel, entries });
});

BROWSER.get('/file', (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const fp = url.searchParams.get('path');
  const raw = url.searchParams.has('raw');
  const safe = safeJoin('/home/claw/.openclaw/workspace', fp);

  if (!safe || !fs.existsSync(safe)) {
    return this.json(res, { error: 'file not found' }, 404);
  }

  const stat = fs.statSync(safe);
  if (stat.isDirectory() || stat.size > MAX_FILE) {
    return this.json(res, { error: 'cannot read file' }, 400);
  }

  const content = fs.readFileSync(safe, 'utf8');
  const ext = path.extname(safe).slice(1);
  const type = fileType(safe);

  if (raw) {
    return this.text(res, content);
  }

  this.json(res, {
    path: fp,
    name: path.basename(safe),
    size: stat.size,
    type,
    lang: ext,
    content: highlight(content, ext),
    raw: content,
    lines: content.split('\n').length,
  });
});

BROWSER.get('/search', (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const q = url.searchParams.get('q') || '';
  const results = searchFiles('/home/claw/.openclaw/workspace', q);
  this.json(res, { query: q, results, count: results.length });
});

// ─── Browser HTML ───

function browserHTML() {
  return `<!DOCTYPE html>
<html lang="nl"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>NPR Browser</title>
<style>
:root{--bg:#0a0a0f;--fg:#e0e0e8;--dim:#666680;--cyan:#00e5ff;--green:#00e676;--yellow:#ffea00;--red:#ff1744;--purple:#d500f9;--border:#222240;--panel:#101018}
*{margin:0;padding:0;box-sizing:border-box}
body{background:var(--bg);color:var(--fg);font-family:'JetBrains Mono','Fira Code',monospace;font-size:13px;display:flex;flex-direction:column;height:100vh}
#toolbar{display:flex;gap:4px;padding:8px 12px;background:var(--panel);border-bottom:1px solid var(--border);align-items:center}
#toolbar input{flex:1;background:#0a0a0f;border:1px solid var(--border);color:var(--fg);padding:6px 10px;border-radius:4px;font-family:inherit;font-size:13px}
#toolbar input:focus{outline:none;border-color:var(--cyan)}
#toolbar button{background:#1a1a30;border:1px solid var(--border);color:var(--cyan);padding:6px 12px;border-radius:4px;cursor:pointer;font-family:inherit;font-size:11px}
#toolbar button:hover{background:#222240;border-color:var(--cyan)}
#breadcrumb{padding:4px 12px;font-size:11px;color:var(--dim);border-bottom:1px solid var(--border)}
#breadcrumb span{cursor:pointer}
#breadcrumb span:hover{color:var(--cyan)}
#main{display:flex;flex:1;overflow:hidden}
#sidebar{width:280px;border-right:1px solid var(--border);overflow-y:auto;background:var(--panel)}
#content{flex:1;overflow-y:auto;padding:16px}
.entry{display:flex;justify-content:space-between;padding:6px 12px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border)}
.entry:hover{background:#1a1a30}
.entry .name{color:var(--cyan)}
.entry .name.dir{color:var(--yellow)}
.entry .meta{color:var(--dim);font-size:10px}
.entry .type{color:var(--purple);font-size:10px;margin-left:8px}
pre{background:var(--panel);border:1px solid var(--border);border-radius:4px;padding:16px;overflow-x:auto;font-size:12px;line-height:1.6}
pre code{font-family:inherit}
img{max-width:100%;border:1px solid var(--border);border-radius:4px}
#searchResults{position:fixed;top:50px;right:20px;width:400px;max-height:400px;background:var(--panel);border:1px solid var(--border);border-radius:4px;overflow-y:auto;z-index:10;display:none}
#searchResults .entry{padding:8px 12px}
#searchResults .path{color:var(--dim);font-size:10px}
</style></head><body>

<div id="toolbar">
  <button onclick="goBack()">←</button>
  <input id="pathInput" value="/home/claw/.openclaw/workspace" onkeydown="if(event.key==='Enter')navigate()">
  <button onclick="navigate()">→</button>
  <button onclick="goUp()">↑</button>
  <button onclick="search()">⌕ zoek</button>
</div>
<div id="breadcrumb"></div>
<div id="main">
  <div id="sidebar"></div>
  <div id="content"><div style="padding:40px;text-align:center;color:var(--dim)">NPR Browser — browse files & services</div></div>
</div>
<div id="searchResults"></div>

<script>
let currentDir = '/home/claw/.openclaw/workspace';
let history = [];

async function navigate(p) {
  currentDir = p || document.getElementById('pathInput').value;
  document.getElementById('pathInput').value = currentDir;
  history.push(currentDir);
  loadDir(currentDir);
}

async function loadDir(dir) {
  try {
    const r = await fetch('/dir?path=' + encodeURIComponent(dir));
    const d = await r.json();
    document.getElementById('breadcrumb').innerHTML = d.dir.split('/').filter(Boolean).map((p,i,all) => {
      const path = '/home/claw/.openclaw/workspace/' + all.slice(0,i+1).join('/');
      return '<span onclick="navigate(\\'' + path + '\\')">' + p + '</span>/';
    }).join('');
    
    const sidebar = document.getElementById('sidebar');
    const dirs = d.entries.filter(e => e.type === 'dir').slice(0, 30);
    sidebar.innerHTML = dirs.map(e =>
      '<div class="entry" onclick="navigate(\\'' + currentDir + '/' + e.name + '\\')">' +
      '<span class="name dir">📁 ' + e.name + '</span></div>'
    ).join('');

    const content = document.getElementById('content');
    const files = d.entries.filter(e => e.type !== 'dir').slice(0, 100);
    content.innerHTML = files.map(e => {
      const size = e.size > 1024 ? (e.size/1024).toFixed(1) + 'KB' : e.size + 'B';
      return '<div class="entry" onclick="openFile(\\'' + currentDir + '/' + e.name + '\\')">' +
        '<span class="name">📄 ' + e.name + '</span>' +
        '<span class="meta">' + size + '</span>' +
        '<span class="type">' + e.type + '</span></div>';
    }).join('') || '<div style="padding:20px;color:var(--dim)">Geen files</div>';
  } catch(e) {
    document.getElementById('content').innerHTML = '<div style="padding:20px;color:var(--red)">Error: ' + e.message + '</div>';
  }
}

async function openFile(fp) {
  try {
    const r = await fetch('/file?path=' + encodeURIComponent(fp));
    const d = await r.json();
    if (!r.ok) return;
    
    const content = document.getElementById('content');
    if (d.type === 'image') {
      const raw = await fetch('/file?path=' + encodeURIComponent(fp) + '&raw=1');
      const blob = await raw.blob();
      content.innerHTML = '<img src="' + URL.createObjectURL(blob) + '" style="max-width:100%">';
    } else {
      content.innerHTML = '<pre><code>' + d.content + '</code></pre>';
    }
  } catch(e) {
    document.getElementById('content').innerHTML = '<div style="padding:20px;color:var(--red)">Error: ' + e.message + '</div>';
  }
}

async function search() {
  const q = prompt('Zoeken in files:');
  if (!q) return;
  const r = await fetch('/search?q=' + encodeURIComponent(q));
  const d = await r.json();
  const sr = document.getElementById('searchResults');
  sr.style.display = 'block';
  sr.innerHTML = '<div style="padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px">Zoeken: ' + q + ' (' + d.count + ' results)</div>' +
    d.results.map(r =>
      '<div class="entry" onclick="openFile(\\'' + r.path.replace(/.*workspace\\//, '') + '\\')">' +
      '<div class="name">' + r.name + '</div><div class="path">' + r.path + '</div></div>'
    ).join('');
}

function goBack() { if(history.length > 1) { history.pop(); navigate(history[history.length-1]); } }
function goUp() { if(currentDir !== '/') navigate(currentDir.split('/').slice(0,-1).join('/') || '/'); }

navigate('/home/claw/.openclaw/workspace/NPR_OS_sandbox/npr-local');
</script>
</body></html>`;
}

// ─── Export ───

module.exports = BROWSER;
