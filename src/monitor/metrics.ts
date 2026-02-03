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
