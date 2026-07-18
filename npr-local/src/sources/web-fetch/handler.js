// @net 10.11.0.0/24
// ═══════════════════════════════════════════════════
// sources/web-fetch/handler.js — Web Fetch Tool
// ═══════════════════════════════════════════════════
// Haalt webpagina's op via HTTP(S) GET/POST
// ═══════════════════════════════════════════════════

const http = require('http');
const https = require('https');

function handle(req, res, ctx) {
  const url = new URL(ctx.url);
  const targetUrl = url.searchParams.get('url');
  const method = (url.searchParams.get('method') || 'GET').toUpperCase();
  const headers = parseHeaders(url.searchParams.get('headers'));
  const body = url.searchParams.get('body') || '';
  const timeout = parseInt(url.searchParams.get('timeout')) || 15000;
  const raw = url.searchParams.get('raw') === 'true';

  if (!targetUrl) {
    sendJson(res, {
      tool: 'web-fetch',
      error: 'url parameter is vereist',
      usage: 'tool:web-fetch --url=<url> [--method=GET|POST] [--headers=...] [--body=...] [--timeout=15000] [--raw]',
      slot: ctx.slot,
    });
    return;
  }

  // Validate URL
  let parsedUrl;
  try {
    parsedUrl = new URL(targetUrl);
  } catch (e) {
    sendJson(res, {
      tool: 'web-fetch',
      error: `Ongeldige URL: ${e.message}`,
      slot: ctx.slot,
    });
    return;
  }

  // Only allow http/https
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    sendJson(res, {
      tool: 'web-fetch',
      error: `Protocol niet toegestaan: ${parsedUrl.protocol} (alleen http/https)`,
      slot: ctx.slot,
    });
    return;
  }

  const transport = parsedUrl.protocol === 'https:' ? https : http;

  // Handle IPv6 brackets
  let hostname = parsedUrl.hostname;
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    hostname = hostname.slice(1, -1); // Remove brackets for http.request
  }

  const options = {
    method,
    hostname,
    port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
    path: parsedUrl.pathname + parsedUrl.search,
    headers: { ...headers },
    timeout,
    family: hostname.includes(':') ? 6 : undefined, // IPv6
  };

  const startTime = Date.now();

  const request = transport.request(options, (response) => {
    let data = '';
    response.on('data', (chunk) => { data += chunk; });
    response.on('end', () => {
      const elapsed = Date.now() - startTime;

      const result = {
        tool: 'web-fetch',
        url: targetUrl,
        method,
        status: response.statusCode,
        statusText: response.statusMessage,
        headers: sanitizeHeaders(response.headers),
        contentLength: Buffer.byteLength(data, 'utf8'),
        elapsed: elapsed,
        slot: ctx.slot,
      };

      if (raw) {
        result.raw = data;
      } else {
        // Try JSON parse
        try {
          result.json = JSON.parse(data);
          result.type = 'json';
        } catch {
          result.text = data.length > 2000 ? data.slice(0, 2000) + '\n\n... [geknipt, totaal ' + Buffer.byteLength(data, 'utf8') + ' bytes]' : data;
          result.type = 'text';
        }
      }

      sendJson(res, result);
    });
  });

  request.on('error', (e) => {
    sendJson(res, {
      tool: 'web-fetch',
      error: e.message,
      code: e.code,
      url: targetUrl,
      slot: ctx.slot,
    });
  });

  request.on('timeout', () => {
    request.destroy();
    sendJson(res, {
      tool: 'web-fetch',
      error: `Timeout na ${timeout}ms`,
      url: targetUrl,
      slot: ctx.slot,
    });
  });

  if (body) {
    request.write(body);
  }

  request.end();
}

// ─── Helpers ───

function sendJson(res, obj) {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj, null, 2));
}

function parseHeaders(str) {
  if (!str) return {};
  try {
    return JSON.parse(str);
  } catch {
    // Fallback: simple key=value
    const headers = {};
    str.split(',').forEach(pair => {
      const [k, ...v] = pair.split(':');
      if (k && v.length) headers[k.trim()] = v.join(':').trim();
    });
    return headers;
  }
}

function sanitizeHeaders(headers) {
  // Remove sensitive headers
  const clean = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!['authorization', 'cookie', 'set-cookie'].includes(k.toLowerCase())) {
      clean[k] = v;
    }
  }
  return clean;
}

module.exports = { handle };
