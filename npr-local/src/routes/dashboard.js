// Dashboard routes — NPR Local system overview
const fs = require('fs');
const path = require('path');
const { getMetrics, recordInference } = require('./models');

// ─── GET /system — full system snapshot (HTML) ───
function handlerDashboard(req, res) {
  const dashboardPath = path.join(__dirname, '..', '..', 'public', 'dashboard.html');
  try {
    const html = fs.readFileSync(dashboardPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } catch {
    res.writeHead(500, { 'Content-Type': 'text/html' });
    res.end('<h1>Dashboard not found</h1>');
  }
}

// ─── GET /dashboard/data — JSON snapshot ───
function handlerDashboardData(req, res) {
  const { listSessions } = require('../agent/loop');

  const sessions = listSessions();
  const metrics = getMetrics();
  const modelMetrics = Object.values(metrics).flat();

  // Aggregate token usage across all models
  const totalTokens = modelMetrics.reduce((sum, m) => sum + (m.totalTokens || 0), 0);
  const totalRequests = modelMetrics.reduce((sum, m) => sum + (m.requests || 0), 0);
  const avgLatency = modelMetrics.length
    ? modelMetrics.reduce((sum, m) => sum + (m.avgLatencyMs || 0), 0) / modelMetrics.length
    : 0;

  // Build recent activity from session history
  const recentActivity = [];
  for (const s of sessions) {
    const messages = s.messages || [];
    for (let i = messages.length - 1; i >= 0 && recentActivity.length < 20; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant') continue;
      recentActivity.push({
        sessionId: s.id,
        label: s.label || s.id,
        time: msg.timestamp,
        model: msg.model,
        tokens: msg.tokenUsage,
        toolCalls: msg.toolCalls || 0,
        preview: (msg.content || '').slice(0, 120),
      });
    }
  }

  res.json({
    uptime: process.uptime(),
    uptimeFormatted: formatUptime(process.uptime()),
    memory: process.memoryUsage(),
    sessions: {
      active: sessions.length,
      totalMessages: sessions.reduce((s, sess) => s + (sess.messages?.length || 0), 0),
    },
    models: modelMetrics.map(m => ({
      name: m.name,
      model: m.model || m.name,
      requests: m.requests,
      totalTokens: m.totalTokens,
      avgLatencyMs: parseFloat((m.avgLatencyMs || 0).toFixed(1)),
      tokensPerSecond: m.tokensPerSecond,
    })),
    totalTokens,
    totalRequests,
    avgLatencyMs: parseFloat(avgLatency.toFixed(1)),
    recentActivity,
    hexVm: null, // filled separately
  });
}

// ─── GET /dashboard/hex-grid — NPR slot map ───
function handlerHexGrid(req, res) {
  const core = require('./core');
  const SLOT_COUNT = 0x40;
  const PHASE_SIZE = 0x10;

  const mf = core.manifest(); // { "0x00": { paths: [...] }, ... }

  const slots = [];
  for (let i = 0; i < SLOT_COUNT; i++) {
    const hex = `0x${i.toString(16).padStart(2, '0')}`;
    const phase = Math.floor(i / PHASE_SIZE);
    const slotData = mf[hex] || null;
    slots.push({
      index: i,
      hex,
      phase,
      registered: !!slotData,
      paths: slotData?.paths || [],
    });
  }

  res.json({ slots, slotCount: SLOT_COUNT, phaseSize: PHASE_SIZE });
}

// ─── GET /dashboard/sessions — live session list ───
function handlerDashboardSessions(req, res) {
  const { listSessions } = require('../agent/loop');
  const sessions = listSessions();

  res.json({
    sessions: sessions.map(s => ({
      id: s.id,
      label: s.label,
      messages: s.messages?.length || 0,
      lastActivity: s.messages?.[s.messages.length - 1]?.timestamp,
      model: s.model,
    })),
    total: sessions.length,
  });
}

// ─── GET /dashboard/tools — recent tool calls ───
function handlerDashboardTools(req, res) {
  const { listSessions } = require('../agent/loop');
  const sessions = listSessions();

  const toolCalls = [];
  for (const s of sessions) {
    const messages = s.messages || [];
    for (let i = messages.length - 1; i >= 0 && toolCalls.length < 50; i--) {
      const msg = messages[i];
      if (msg.role !== 'assistant' || !msg.toolCalls) continue;
      for (const tc of msg.toolCalls) {
        toolCalls.push({
          sessionId: s.id,
          time: msg.timestamp,
          tool: tc.name,
          args: tc.arguments,
          status: tc.status || 'executed',
        });
      }
    }
  }

  res.json({ toolCalls, total: toolCalls.length });
}

// ─── GET /dashboard/metrics/timeseries — token usage over time ───
function handlerDashboardMetricsTimeSeries(req, res) {
  const { listSessions } = require('../agent/loop');
  const sessions = listSessions();

  // Group tokens by hour
  const hourly = {};
  for (const s of sessions) {
    for (const msg of (s.messages || [])) {
      if (!msg.tokenUsage) continue;
      const hour = msg.timestamp?.slice(0, 13) || 'unknown';
      if (!hourly[hour]) hourly[hour] = { tokens: 0, requests: 0 };
      hourly[hour].tokens += msg.tokenUsage;
      hourly[hour].requests += 1;
    }
  }

  const series = Object.entries(hourly)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([time, data]) => ({
      time,
      tokens: data.tokens,
      requests: data.requests,
    }));

  res.json({ series, totalPoints: series.length });
}

// ─── Utility ───
function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

module.exports = {
  handlerDashboard,
  handlerDashboardData,
  handlerHexGrid,
  handlerDashboardSessions,
  handlerDashboardTools,
  handlerDashboardMetricsTimeSeries,
};
