import { AutotuneConfig } from '../config.js';
import { AutotuneDb } from '../storage/sqlite.js';
import { PromptPack } from '../types.js';
import { getRubrics } from '../eval/rubrics.js';
import { generateCandidates } from './generator.js';
import { scoreCandidates } from './rerank.js';
import { selectBestCandidate } from './selector.js';
import { getDefaultInstructions } from '../packs/defaults.js';

function nextVersion(current?: string): string {
  if (!current) return String(Date.now());
  const parsed = Number(current);
  if (!Number.isNaN(parsed)) return String(parsed + 1);
  return String(Date.now());
}

export async function runOptimize(params: {
  db: AutotuneDb;
  config: AutotuneConfig;
  behavior: string;
}): Promise<PromptPack | null> {
  const rubrics = getRubrics();
  const rubric = rubrics.find(r => r.behavior === params.behavior);
  if (!rubric) return null;

  const scoredTraces = params.db.getTracesWithScores(rubric.name, params.config.optimize.sampleSize);
  if (scoredTraces.length === 0) return null;

  const traces = scoredTraces.map(item => item.trace);
  const latestPack = params.db.getLatestPromptPack(params.behavior);
  const baselineInstructions = latestPack?.instructions || getDefaultInstructions(params.behavior);

  const candidates = await generateCandidates({
    config: params.config,
    behavior: params.behavior,
    traces,
    currentInstructions: baselineInstructions
  });

  const uniqueCandidates = Array.from(new Set([baselineInstructions, ...candidates]))
    .filter(item => item.trim().length > 0)
    .slice(0, params.config.optimize.maxCandidates + 1);

  if (uniqueCandidates.length === 0) return null;

  const stage1Scores = await scoreCandidates({
    config: params.config,
    behavior: params.behavior,
    rubric,
    candidates: uniqueCandidates,
    traces,
    judgeModel: params.config.judge.stage1Model
  });

  const top = stage1Scores.slice(0, Math.min(3, stage1Scores.length));
  const stage2Scores = await scoreCandidates({
    config: params.config,
    behavior: params.behavior,
    rubric,
    candidates: top.map(item => item.instructions),
    traces,
    judgeModel: params.config.judge.stage2Model
  });

  const { selected } = selectBestCandidate({
    scored: stage2Scores,
    baselineInstructions,
    minImprovement: params.config.optimize.minImprovement
  });

  if (!selected) return null;

  const version = nextVersion(latestPack?.version);
  const pack: PromptPack = {
    name: `Autotune ${params.behavior}`,
    version,
    behavior: params.behavior,
    instructions: selected.instructions,
    demos: [],
    metric: {
      name: rubric.name,
      model: params.config.judge.stage2Model,
      score: selected.score
    },
    metadata: {
      baseline_version: latestPack?.version || null,
      created_by: 'autotune'
    }
  };

  params.db.insertPromptPack({ pack, score: selected.score });
  return pack;
}
