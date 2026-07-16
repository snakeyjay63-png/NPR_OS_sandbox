// system-scan/handler.js — Map = Skill
const { quickScan, fullScan } = require('./index');

function handle(req, res, ctx) {
  const url = new URL(ctx.url);
  const full = url.searchParams.get('full') === 'true';
  const save = url.searchParams.get('save') === 'true';

  (async () => {
    try {
      const result = full ? await fullScan(save) : quickScan(save);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result, null, 2));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  })();
}

module.exports = { handle, quickScan, fullScan };
