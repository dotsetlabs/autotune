export type ToolCallRecord = {
  name: string;
  args?: unknown;
  ok: boolean;
  duration_ms?: number;
  error?: string;
  output_bytes?: number;
  output_truncated?: boolean;
};

export type TraceEvent = {
  trace_id: string;
  timestamp: string;
  created_at: number;
  chat_id: string;
  group_folder: string;
  user_id?: string;
  input_text: string;
  output_text: string | null;
  model_id: string;
  prompt_pack_versions?: Record<string, string>;
  memory_summary?: string;
  memory_facts?: string[];
  memory_recall?: string[];
  session_recall?: string[];
  tool_calls?: ToolCallRecord[];
  latency_ms?: number;
  tokens_prompt?: number;
  tokens_completion?: number;
  cost_prompt_usd?: number;
  cost_completion_usd?: number;
  cost_total_usd?: number;
  memory_recall_count?: number;
  session_recall_count?: number;
  memory_items_upserted?: number;
  memory_items_extracted?: number;
  error_code?: string;
  source?: string;
};

export type EvalResult = {
  score: number;
  reason: string;
};

export type PromptPack = {
  name: string;
  version: string;
  behavior: string;
  instructions: string;
  demos: Array<{ input: string; output: unknown }>;
  metric?: {
    name: string;
    model: string;
    score: number;
  };
  metadata?: Record<string, unknown>;
};
