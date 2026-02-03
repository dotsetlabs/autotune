import { TraceEvent } from '../types.js';

export type Rubric = {
  name: string;
  behavior: string;
  description: string;
  buildPrompt: (trace: TraceEvent) => { system: string; user: string };
};

function describeToolCalls(trace: TraceEvent): string {
  if (!trace.tool_calls || trace.tool_calls.length === 0) return 'None.';
  return trace.tool_calls.map(call => {
    const args = call.args ? JSON.stringify(call.args).slice(0, 600) : '';
    return `- ${call.name} (ok=${call.ok}) ${args}`;
  }).join('\n');
}

export function getRubrics(): Rubric[] {
  const responseQuality: Rubric = {
    name: 'response_quality',
    behavior: 'response-quality',
    description: 'Helpfulness, correctness, clarity, and conciseness of assistant responses.',
    buildPrompt: (trace) => ({
      system: [
        'You are grading assistant responses for a productivity assistant.',
        'Score from 0.0 to 1.0 based on: correctness, helpfulness, clarity, safety, and conciseness.',
        'If the response is empty or unhelpful, score near 0.',
        'Return JSON: {"score": number, "reason": string}. Score must be between 0 and 1.'
      ].join(' '),
      user: [
        'User message:',
        trace.input_text,
        '',
        'Assistant response:',
        trace.output_text || '(empty)',
        '',
        'Tool calls:',
        describeToolCalls(trace)
      ].join('\n')
    })
  };

  const taskExtraction: Rubric = {
    name: 'task_extraction',
    behavior: 'task-extraction',
    description: 'Whether tasks are extracted and scheduled correctly when requested.',
    buildPrompt: (trace) => ({
      system: [
        'You are grading whether tasks were extracted correctly from a user message.',
        'If no actionable task is present, score high when no scheduling occurs.',
        'If tasks are present, score high only if schedule_task is used with correct task and timing.',
        'If the assistant outputs a JSON task list instead of tool calls, evaluate that output as the extraction result.',
        'Return JSON: {"score": number, "reason": string}. Score must be between 0 and 1.'
      ].join(' '),
      user: [
        'User message:',
        trace.input_text,
        '',
        'Assistant response:',
        trace.output_text || '(empty)',
        '',
        'Tool calls (look for schedule_task):',
        describeToolCalls(trace)
      ].join('\n')
    })
  };

  const toolCalling: Rubric = {
    name: 'tool_calling',
    behavior: 'tool-calling',
    description: 'Appropriate, safe, and efficient tool usage.',
    buildPrompt: (trace) => ({
      system: [
        'You are grading whether tool usage is correct and necessary.',
        'Score high if tools were used only when needed and the right tools were chosen.',
        'Score low if tools were misused, unsafe, or missing when required.',
        'Return JSON: {"score": number, "reason": string}. Score must be between 0 and 1.'
      ].join(' '),
      user: [
        'User message:',
        trace.input_text,
        '',
        'Assistant response:',
        trace.output_text || '(empty)',
        '',
        'Tool calls:',
        describeToolCalls(trace)
      ].join('\n')
    })
  };

  const memoryPolicy: Rubric = {
    name: 'memory_policy',
    behavior: 'memory-policy',
    description: 'Correct and safe use of memory summary and facts.',
    buildPrompt: (trace) => ({
      system: [
        'You are grading whether the assistant used memory summary and facts appropriately.',
        'Score high if it correctly uses relevant facts and avoids hallucinating memory.',
        'Score low if it ignores relevant memory or invents unsupported facts.',
        'Return JSON: {"score": number, "reason": string}. Score must be between 0 and 1.'
      ].join(' '),
      user: [
        'Memory summary:',
        trace.memory_summary || '(none)',
        '',
        'Memory facts:',
        trace.memory_facts && trace.memory_facts.length > 0 ? trace.memory_facts.join('\n') : '(none)',
        '',
        'User message:',
        trace.input_text,
        '',
        'Assistant response:',
        trace.output_text || '(empty)'
      ].join('\n')
    })
  };

  return [responseQuality, taskExtraction, toolCalling, memoryPolicy];
}
