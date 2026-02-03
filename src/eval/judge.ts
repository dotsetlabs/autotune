import { callOpenRouter } from '../openrouter.js';
import { AutotuneConfig } from '../config.js';
import { EvalResult, TraceEvent } from '../types.js';
import { Rubric } from './rubrics.js';

function extractJson(text: string): EvalResult | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.score !== 'number') return null;
    return {
      score: Math.max(0, Math.min(1, parsed.score)),
      reason: typeof parsed.reason === 'string' ? parsed.reason : ''
    };
  } catch {
    return null;
  }
}

export async function judgeTrace(params: {
  config: AutotuneConfig;
  rubric: Rubric;
  trace: TraceEvent;
  model: string;
}): Promise<EvalResult> {
  const prompt = params.rubric.buildPrompt(params.trace);
  const response = await callOpenRouter(params.config.openrouter, {
    model: params.model,
    messages: [
      { role: 'system', content: prompt.system },
      { role: 'user', content: prompt.user }
    ],
    temperature: params.config.judge.temperature,
    maxOutputTokens: params.config.judge.maxOutputTokens
  });

  const parsed = extractJson(response);
  if (!parsed) {
    return { score: 0, reason: 'Judge returned invalid JSON.' };
  }
  return parsed;
}
