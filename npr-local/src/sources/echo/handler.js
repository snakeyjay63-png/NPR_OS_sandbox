// ═══════════════════════════════════════════════════
// sources/echo/handler.js — Voorbeeld Tool
// ═══════════════════════════════════════════════════
// Elke map = skill. Deze map = echo.
// ═══════════════════════════════════════════════════

function handle(req, res, ctx) {
  const url = new URL(ctx.url);
  const msg = url.searchParams.get('msg') || 'geen bericht';
  const repeat = parseInt(url.searchParams.get('repeat')) || 1;

  const result = {
    tool: 'echo',
    message: msg,
    repeated: Array(repeat).fill(msg),
    timestamp: new Date().toISOString(),
    route: ctx.pathname,
    slot: ctx.slot,
  };

  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(result, null, 2));
}

module.exports = { handle };
