import { AutotuneDb } from '../storage/sqlite.js';

export function getAverageScoreForPack(params: {
  db: AutotuneDb;
  behavior: string;
  version: string;
  metric: string;
}): { average: number; count: number } {
  const rows = params.db.getScoresWithTraces(params.metric);
  const scores = rows
    .filter(row => row.packVersions && row.packVersions[params.behavior] === params.version)
    .map(row => row.score);

  if (scores.length === 0) return { average: 0, count: 0 };
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return { average: avg, count: scores.length };
}

export function getPackHealthMetrics(params: {
  db: AutotuneDb;
  behavior: string;
  version: string;
  sinceMs: number;
  limit?: number;
}): { count: number; errorRate: number; toolFailureRate: number } {
  const traces = params.db.getRecentTraces({ since: params.sinceMs, limit: params.limit });
  const filtered = traces.filter(trace => trace.prompt_pack_versions && trace.prompt_pack_versions[params.behavior] === params.version);
  if (filtered.length === 0) {
    return { count: 0, errorRate: 0, toolFailureRate: 0 };
  }
  let errorCount = 0;
  let toolCalls = 0;
  let toolFailures = 0;
  for (const trace of filtered) {
    if (trace.error_code) errorCount += 1;
    if (trace.tool_calls && trace.tool_calls.length > 0) {
      toolCalls += trace.tool_calls.length;
      toolFailures += trace.tool_calls.filter(call => !call.ok).length;
    }
  }
  return {
    count: filtered.length,
    errorRate: errorCount / filtered.length,
    toolFailureRate: toolCalls > 0 ? toolFailures / toolCalls : 0
  };
}
