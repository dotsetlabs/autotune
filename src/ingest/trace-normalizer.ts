import { z } from 'zod';
import { TraceEvent } from '../types.js';

const TRACE_SCHEMA = z.object({
  trace_id: z.string(),
  timestamp: z.string(),
  created_at: z.number(),
  chat_id: z.string(),
  group_folder: z.string(),
  user_id: z.string().optional(),
  input_text: z.string(),
  output_text: z.string().nullable(),
  model_id: z.string(),
  prompt_pack_versions: z.record(z.string(), z.string()).optional(),
  memory_summary: z.string().optional(),
  memory_facts: z.array(z.string()).optional(),
  memory_recall: z.array(z.string()).optional(),
  session_recall: z.array(z.string()).optional(),
  tool_calls: z.array(z.object({
    name: z.string(),
    ok: z.boolean(),
    args: z.any().optional(),
    duration_ms: z.number().optional(),
    error: z.string().optional(),
    output_bytes: z.number().optional(),
    output_truncated: z.boolean().optional()
  })).optional(),
  latency_ms: z.number().optional(),
  tokens_prompt: z.number().optional(),
  tokens_completion: z.number().optional(),
  cost_prompt_usd: z.number().optional(),
  cost_completion_usd: z.number().optional(),
  cost_total_usd: z.number().optional(),
  memory_recall_count: z.number().optional(),
  session_recall_count: z.number().optional(),
  memory_items_upserted: z.number().optional(),
  memory_items_extracted: z.number().optional(),
  error_code: z.string().optional(),
  source: z.string().optional()
});

function extractLastMessage(inputText: string): string {
  const matches = [...inputText.matchAll(/<message[^>]*>([\s\S]*?)<\/message>/g)];
  if (matches.length === 0) return inputText;
  const last = matches[matches.length - 1][1];
  return last
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .trim();
}

function normalizePromptPackVersions(raw: unknown): Record<string, string> | undefined {
  if (!raw) return undefined;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      return normalizePromptPackVersions(parsed);
    } catch {
      return undefined;
    }
  }
  if (typeof raw === 'object') {
    const entries = Object.entries(raw as Record<string, unknown>)
      .filter(([, value]) => typeof value === 'string')
      .map(([key, value]) => [key, value as string]);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  }
  return undefined;
}

function normalizeToolCalls(raw: unknown): Array<{ name: string; ok: boolean; args?: unknown; duration_ms?: number; error?: string; output_bytes?: number; output_truncated?: boolean }> | undefined {
  if (!raw) return undefined;
  if (Array.isArray(raw)) {
    const normalized = raw.map(item => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      if (typeof record.name !== 'string' || typeof record.ok !== 'boolean') return null;
      return {
        name: record.name,
        ok: record.ok,
        args: record.args,
        duration_ms: typeof record.duration_ms === 'number' ? record.duration_ms : undefined,
        error: typeof record.error === 'string' ? record.error : undefined,
        output_bytes: typeof record.output_bytes === 'number' ? record.output_bytes : undefined,
        output_truncated: typeof record.output_truncated === 'boolean' ? record.output_truncated : undefined
      };
    }).filter(Boolean) as Array<{ name: string; ok: boolean; args?: unknown; duration_ms?: number; error?: string; output_bytes?: number; output_truncated?: boolean }>;
    return normalized.length > 0 ? normalized : undefined;
  }
  return undefined;
}

export function normalizeTrace(raw: unknown): TraceEvent | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;

  const trace_id = String(record.trace_id || record.id || `trace-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const timestamp = String(record.timestamp || record.time || new Date().toISOString());
  const created_at = typeof record.created_at === 'number'
    ? record.created_at
    : Date.parse(timestamp) || Date.now();

  const inputCandidate = String(record.input_text || record.prompt || record.input || '');
  const input_text = inputCandidate.includes('<message')
    ? extractLastMessage(inputCandidate)
    : inputCandidate;

  const trace: TraceEvent = {
    trace_id,
    timestamp,
    created_at,
    chat_id: String(record.chat_id || record.chatId || 'unknown'),
    group_folder: String(record.group_folder || record.groupFolder || 'unknown'),
    user_id: record.user_id ? String(record.user_id) : undefined,
    input_text,
    output_text: record.output_text === undefined ? (record.response ? String(record.response) : null) : (record.output_text !== null ? String(record.output_text) : null),
    model_id: String(record.model_id || record.model || 'unknown'),
    prompt_pack_versions: normalizePromptPackVersions(record.prompt_pack_versions || record.prompt_pack_versions_json || record.prompt_pack_version),
    memory_summary: record.memory_summary ? String(record.memory_summary) : undefined,
    memory_facts: Array.isArray(record.memory_facts) ? record.memory_facts.map(String) : undefined,
    memory_recall: Array.isArray(record.memory_recall) ? record.memory_recall.map(String) : undefined,
    session_recall: Array.isArray(record.session_recall) ? record.session_recall.map(String) : undefined,
    tool_calls: normalizeToolCalls(record.tool_calls),
    latency_ms: typeof record.latency_ms === 'number' ? record.latency_ms : undefined,
    tokens_prompt: typeof record.tokens_prompt === 'number' ? record.tokens_prompt : undefined,
    tokens_completion: typeof record.tokens_completion === 'number' ? record.tokens_completion : undefined,
    cost_prompt_usd: typeof record.cost_prompt_usd === 'number' ? record.cost_prompt_usd : undefined,
    cost_completion_usd: typeof record.cost_completion_usd === 'number' ? record.cost_completion_usd : undefined,
    cost_total_usd: typeof record.cost_total_usd === 'number' ? record.cost_total_usd : undefined,
    memory_recall_count: typeof record.memory_recall_count === 'number' ? record.memory_recall_count : undefined,
    session_recall_count: typeof record.session_recall_count === 'number' ? record.session_recall_count : undefined,
    memory_items_upserted: typeof record.memory_items_upserted === 'number' ? record.memory_items_upserted : undefined,
    memory_items_extracted: typeof record.memory_items_extracted === 'number' ? record.memory_items_extracted : undefined,
    error_code: record.error_code ? String(record.error_code) : undefined,
    source: record.source ? String(record.source) : undefined
  };

  const parsed = TRACE_SCHEMA.safeParse(trace);
  if (!parsed.success) return null;
  return parsed.data;
}
