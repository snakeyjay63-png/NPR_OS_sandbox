// SSE + REST endpoints for live runtime events
// SSE: GET /api/runtime/stream
// REST: GET /api/runtime/snapshot, /sessions, /slots, /events

function openRuntimeEventStream(runtimeMonitor) {
  return function handleRuntimeEvents(req, res) {
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    // Initial snapshot
    const snap = runtimeMonitor.snapshot();
    res.write(`event: snapshot\ndata: ${JSON.stringify(snap)}\n\n`);

    // Subscribe to live events
    const unsubscribe = runtimeMonitor.subscribe(event => {
      try {
        res.write(`event: runtime\ndata: ${JSON.stringify(event)}\n\n`);
      } catch (e) {
        // Client disconnected
      }
    });

    req.on('close', unsubscribe);
    req.on('error', unsubscribe);
  };
}

function handleRuntimeREST(runtimeMonitor) {
  return function(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (path === '/api/runtime/snapshot') {
      res.writeHead(200);
      res.end(JSON.stringify(runtimeMonitor.snapshot(), null, 2));
    } else if (path === '/api/runtime/sessions') {
      res.writeHead(200);
      res.end(JSON.stringify(runtimeMonitor.listSessions(), null, 2));
    } else if (path === '/api/runtime/slots') {
      res.writeHead(200);
      res.end(JSON.stringify(runtimeMonitor.listSlots(), null, 2));
    } else if (path === '/api/runtime/events') {
      res.writeHead(200);
      res.end(JSON.stringify(runtimeMonitor.getRecentEvents(50), null, 2));
    } else {
      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Not found' }));
    }
  };
}

module.exports = { openRuntimeEventStream, handleRuntimeREST };
