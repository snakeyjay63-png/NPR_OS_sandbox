// @net 10.04.1.0/24
// ─────────────────────────────────────────────────
// actions/execute.js — Action Executor
// ─────────────────────────────────────────────────
//
// Executes a resolved action handler with context.
// Raw timing via hrtime, no Math.round().

export async function executeAction(action, args = {}, context = {}) {
  const startedAt = process.hrtime.bigint();

  const result = await action.handler(args, context);

  const durationUs = Number(process.hrtime.bigint() - startedAt) / 1000;

  return {
    ...result,
    _meta: {
      durationUs,
      timestamp: process.hrtime.bigint().toString(),
    },
  };
}
