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

  if (behavior === 'tool-outcome') {
    return [
      'When tools are used, incorporate the results explicitly.',
      'Summarize tool outputs accurately and acknowledge any errors.',
      'If a tool failed or output was truncated, explain limitations and next steps.'
    ].join(' ');
  }

  if (behavior === 'memory-policy') {
    return [
      'Use memory facts only when relevant to the user request.',
      'Do not invent or assume memory that is not present.',
      'If memory is missing, ask a clarifying question.'
    ].join(' ');
  }

  if (behavior === 'memory-recall') {
    return [
      'Use recalled memory only when it is clearly relevant to the user request.',
      'Do not contradict recalled facts; prefer citing them explicitly.',
      'If recall is missing or ambiguous, ask a clarification instead of guessing.'
    ].join(' ');
  }

  return [
    'Answer directly and helpfully.',
    'Be concise unless detail is requested.',
    'If you use tools, summarize results clearly.'
  ].join(' ');
}
