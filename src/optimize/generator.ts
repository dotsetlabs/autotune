import { callOpenRouter } from '../openrouter.js';
import { AutotuneConfig } from '../config.js';
import { TraceEvent } from '../types.js';

function sampleTraces(traces: TraceEvent[], limit: number): TraceEvent[] {
  if (traces.length <= limit) return traces;
  return traces.slice(0, limit);
}

export async function generateCandidates(params: {
  config: AutotuneConfig;
  behavior: string;
  traces: TraceEvent[];
  currentInstructions: string;
}): Promise<string[]> {
  const examples = sampleTraces(params.traces, 8).map(trace => {
    return `User: ${trace.input_text}\nAssistant: ${trace.output_text || '(empty)'}\n`;
  }).join('\n');

  const prompt = [
    `You are improving instructions for the behavior: ${params.behavior}.`,
    'Current instructions:',
    params.currentInstructions,
    '',
    'Examples of recent interactions:',
    examples,
    '',
    `Propose ${params.config.optimize.maxCandidates} improved instruction variants.`,
    'Keep them short and specific. Return JSON: {"candidates": ["..."]}.'
  ].join('\n');

  const response = await callOpenRouter(params.config.openrouter, {
    model: params.config.optimize.candidateModel,
    messages: [
      { role: 'system', content: 'Return only JSON.' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.4,
    maxOutputTokens: 800
  });

  const match = response.match(/\{[\s\S]*\}/);
  if (!match) return [];
  try {
    const parsed = JSON.parse(match[0]) as { candidates?: string[] };
    const candidates = Array.isArray(parsed.candidates) ? parsed.candidates.filter(Boolean) : [];
    return candidates;
  } catch {
    return [];
  }
}
