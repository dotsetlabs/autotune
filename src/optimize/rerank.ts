import { callOpenRouter } from '../openrouter.js';
import { AutotuneConfig } from '../config.js';
import { TraceEvent } from '../types.js';
import { Rubric } from '../eval/rubrics.js';
import { judgeTrace } from '../eval/judge.js';

export type CandidateScore = {
  instructions: string;
  score: number;
  details: number[];
};

async function runPrediction(params: {
  config: AutotuneConfig;
  behavior: string;
  instructions: string;
  trace: TraceEvent;
}): Promise<string> {
  if (params.behavior === 'task-extraction') {
    const response = await callOpenRouter(params.config.openrouter, {
      model: params.config.optimize.predictorModel,
      messages: [
        {
          role: 'system',
          content: `You are a task extraction module. Follow these instructions:\n${params.instructions}\nReturn JSON: {"tasks": [{"task": string, "due": string}]} or null.`
        },
        { role: 'user', content: params.trace.input_text }
      ],
      temperature: 0,
      maxOutputTokens: 500
    });
    return response;
  }

  const response = await callOpenRouter(params.config.openrouter, {
    model: params.config.optimize.predictorModel,
    messages: [
      {
        role: 'system',
        content: `You are DotClaw. Follow these response-quality instructions:\n${params.instructions}`
      },
      { role: 'user', content: params.trace.input_text }
    ],
    temperature: 0.2,
    maxOutputTokens: 800
  });

  return response;
}

export async function scoreCandidates(params: {
  config: AutotuneConfig;
  behavior: string;
  rubric: Rubric;
  candidates: string[];
  traces: TraceEvent[];
  judgeModel: string;
}): Promise<CandidateScore[]> {
  const results: CandidateScore[] = [];

  for (const instructions of params.candidates) {
    const scores: number[] = [];
    for (const trace of params.traces) {
      const predicted = await runPrediction({
        config: params.config,
        behavior: params.behavior,
        instructions,
        trace
      });
      const evalTrace: TraceEvent = {
        ...trace,
        output_text: predicted
      };
      const judged = await judgeTrace({
        config: params.config,
        rubric: params.rubric,
        trace: evalTrace,
        model: params.judgeModel
      });
      scores.push(judged.score);
    }
    const avg = scores.length === 0 ? 0 : scores.reduce((a, b) => a + b, 0) / scores.length;
    results.push({ instructions, score: avg, details: scores });
  }

  return results.sort((a, b) => b.score - a.score);
}
