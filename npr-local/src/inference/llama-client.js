// @addr 10.05.4.0 | fd00:npr:0005:004::0 — Llama Client
// ═══════════════════════════════════════════════════
// Pure HTTP transport to llama.cpp :8765.
// No queue, no slot logic — just request → response.
// ═══════════════════════════════════════════════════

const http = require('http');

const LLAMA_HOST = process.env.LLAMA_HOST ?? '127.0.0.1';
const LLAMA_PORT = parseInt(process.env.LLAMA_PORT, 10) || 0x223D; // 8765

// @addr 10.05.4.1 | fd00:npr:0005:004::1 — post to llama completion
function postCompletion({ messages, slotId, signal }) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      prompt: typeof messages === 'string'
        ? messages
        : formatMessages(messages),
      ...(slotId !== undefined && { slot_id: slotId }),
      n_predict: 2048,
      temperature: 0.8,
      stream: false,
    });

    const req = http.request({
      hostname: LLAMA_HOST,
      port: LLAMA_PORT,
      path: '/completion',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      signal,
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          resolve({ content: data, raw: true });
        }
      });
    });

    req.on('error', err => reject(err));
    req.write(body);
    req.end();
  });
}

// @addr 10.05.4.2 | fd00:npr:0005:004::2 — format message array to prompt string
function formatMessages(messages) {
  if (typeof messages === 'string') return messages;
  return messages
    .map(m => `${m.role.toUpperCase()}: ${m.content ?? ''}`)
    .join('\n\n');
}

// @addr 10.05.4.3 | fd00:npr:0005:004::3 — health probe
function probe() {
  return new Promise(resolve => {
    const req = http.get({
      hostname: LLAMA_HOST,
      port: LLAMA_PORT,
      path: '/health',
      timeout: 2000,
    }, res => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', () => resolve({ status: 0, error: 'unreachable' }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, timeout: true }); });
  });
}

module.exports = {
  LLAMA_HOST,
  LLAMA_PORT,
  postCompletion,
  probe,
};
