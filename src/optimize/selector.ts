import { CandidateScore } from './rerank.js';

export function selectBestCandidate(params: {
  scored: CandidateScore[];
  baselineInstructions: string;
  minImprovement: number;
}): { selected: CandidateScore | null; baselineScore: number } {
  const baseline = params.scored.find(item => item.instructions.trim() === params.baselineInstructions.trim());
  const baselineScore = baseline ? baseline.score : (params.scored[params.scored.length - 1]?.score || 0);
  const best = params.scored[0];
  if (!best) return { selected: null, baselineScore };
  if (best.instructions.trim() === params.baselineInstructions.trim()) {
    return { selected: null, baselineScore };
  }
  if (best.score - baselineScore < params.minImprovement) {
    return { selected: null, baselineScore };
  }
  return { selected: best, baselineScore };
}
