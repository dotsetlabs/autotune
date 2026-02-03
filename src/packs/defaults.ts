export function getDefaultInstructions(behavior: string): string {
  if (behavior === 'task-extraction') {
    return [
      'Extract tasks only when the user clearly requests an action with a timeframe.',
      'Ignore vague or hypothetical statements.',
      'When scheduling, include the specific task and time.',
      'If no task is required, do not schedule anything.'
    ].join(' ');
  }

  return [
    'Answer directly and helpfully.',
    'Be concise unless detail is requested.',
    'If you use tools, summarize results clearly.'
  ].join(' ');
}
