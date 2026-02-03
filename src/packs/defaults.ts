export function getDefaultInstructions(behavior: string): string {
  if (behavior === 'task-extraction') {
    return [
      'Extract tasks only when the user clearly requests an action with a timeframe.',
      'Ignore vague or hypothetical statements.',
      'When scheduling, include the specific task and time.',
      'If no task is required, do not schedule anything.'
    ].join(' ');
  }

  if (behavior === 'tool-calling') {
    return [
      'Use tools only when necessary to answer the user.',
      'Prefer direct answers when no tool is needed.',
      'Choose the safest and most specific tool available.',
      'Avoid unnecessary or repeated tool calls.'
    ].join(' ');
  }

  if (behavior === 'memory-policy') {
    return [
      'Use memory facts only when relevant to the user request.',
      'Do not invent or assume memory that is not present.',
      'If memory is missing, ask a clarifying question.'
    ].join(' ');
  }

  return [
    'Answer directly and helpfully.',
    'Be concise unless detail is requested.',
    'If you use tools, summarize results clearly.'
  ].join(' ');
}
