import { AutotuneConfig } from '../config.js';
import { AutotuneDb } from '../storage/sqlite.js';
import { judgeTrace } from './judge.js';
import { Rubric } from './rubrics.js';

export async function runEval(params: {
  db: AutotuneDb;
  config: AutotuneConfig;
  rubrics: Rubric[];
}): Promise<{ evaluated: number }>{
  let total = 0;

  for (const rubric of params.rubrics) {
    const traces = params.db.getTracesNeedingEval(rubric.name, params.config.evalMaxTraces);
    if (traces.length === 0) continue;

    const runId = params.db.createEvalRun({
      model: params.config.judge.stage1Model,
      rubric: rubric.name,
      traceCount: traces.length,
      costUsd: 0
    });

    try {
      for (const trace of traces) {
        const result = await judgeTrace({
          config: params.config,
          rubric,
          trace,
          model: params.config.judge.stage1Model
        });
        params.db.insertEvalScore({
          evalRunId: runId,
          traceId: trace.trace_id,
          metric: rubric.name,
          score: result.score,
          reason: result.reason
        });
        total += 1;
      }
      params.db.finishEvalRun(runId, 'success');
    } catch {
      params.db.finishEvalRun(runId, 'failed');
    }
  }

  return { evaluated: total };
}
