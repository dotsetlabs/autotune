import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { TraceEvent, PromptPack } from '../types.js';

export class AutotuneDb {
  private db: Database.Database;

  constructor(dbPath: string) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    const schema = fs.readFileSync(new URL('./schema.sql', import.meta.url), 'utf-8');
    this.db.exec(schema);
  }

  insertTrace(trace: TraceEvent): void {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO traces (
        trace_id, created_at, timestamp, group_folder, chat_id, user_id,
        input_text, output_text, model_id, prompt_pack_versions_json,
        memory_summary, memory_facts_json, tool_calls_json, tool_results_json,
        latency_ms, tokens_prompt, tokens_completion, error_code, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      trace.trace_id,
      trace.created_at,
      trace.timestamp,
      trace.group_folder,
      trace.chat_id,
      trace.user_id || null,
      trace.input_text,
      trace.output_text,
      trace.model_id,
      trace.prompt_pack_versions ? JSON.stringify(trace.prompt_pack_versions) : null,
      trace.memory_summary || null,
      trace.memory_facts ? JSON.stringify(trace.memory_facts) : null,
      trace.tool_calls ? JSON.stringify(trace.tool_calls) : null,
      null,
      trace.latency_ms ?? null,
      trace.tokens_prompt ?? null,
      trace.tokens_completion ?? null,
      trace.error_code || null,
      trace.source || null
    );
  }

  getTracesNeedingEval(metric: string, limit = 200): TraceEvent[] {
    const rows = this.db.prepare(`
      SELECT t.* FROM traces t
      LEFT JOIN eval_scores s ON s.trace_id = t.trace_id AND s.metric = ?
      WHERE s.trace_id IS NULL
      ORDER BY t.created_at DESC
      LIMIT ?
    `).all(metric, limit) as Array<Record<string, unknown>>;

    return rows.map(row => this.mapTraceRow(row));
  }

  getTracesWithScores(metric: string, limit: number): Array<{ trace: TraceEvent; score: number }>{
    const rows = this.db.prepare(`
      SELECT t.*, s.score AS score FROM eval_scores s
      JOIN traces t ON t.trace_id = s.trace_id
      WHERE s.metric = ?
      ORDER BY s.score ASC
      LIMIT ?
    `).all(metric, limit) as Array<Record<string, unknown>>;

    return rows.map(row => ({
      trace: this.mapTraceRow(row),
      score: typeof row.score === 'number' ? row.score : Number(row.score || 0)
    }));
  }

  createEvalRun(params: { model: string; rubric: string; traceCount: number; costUsd: number }): string {
    const id = `eval-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(`
      INSERT INTO eval_runs (run_id, created_at, rubric, model_id, status, trace_count, cost_usd)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, Date.now(), params.rubric, params.model, 'running', params.traceCount, params.costUsd);
    return id;
  }

  finishEvalRun(id: string, status: string): void {
    this.db.prepare(`
      UPDATE eval_runs SET status = ? WHERE run_id = ?
    `).run(status, id);
  }

  insertEvalScore(params: { evalRunId: string; traceId: string; metric: string; score: number; reason: string }): void {
    this.db.prepare(`
      INSERT OR REPLACE INTO eval_scores (run_id, trace_id, metric, score, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(params.traceId, params.metric, params.evalRunId, params.score, params.reason);
  }

  getLatestPromptPack(behavior: string): PromptPack | null {
    const row = this.db.prepare(`
      SELECT * FROM prompt_packs
      WHERE behavior = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).get(behavior) as Record<string, unknown> | undefined;
    if (!row) return null;

    return {
      name: String(row.pack_name),
      version: String(row.version),
      behavior: String(row.behavior),
      instructions: String(row.instructions),
      demos: row.demos_json ? JSON.parse(String(row.demos_json)) : [],
      metric: row.metrics_json ? JSON.parse(String(row.metrics_json)) : undefined,
      metadata: {}
    };
  }

  insertPromptPack(params: { pack: PromptPack; score: number; sourceRunId?: string }): string {
    const id = params.pack.version;
    const metrics = params.pack.metric ? params.pack.metric : { name: 'score', model: 'unknown', score: params.score };
    this.db.prepare(`
      INSERT INTO prompt_packs (pack_id, created_at, pack_name, behavior, version, instructions, demos_json, metrics_json, source_run_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      Date.now(),
      params.pack.name,
      params.pack.behavior,
      params.pack.version,
      params.pack.instructions,
      JSON.stringify(params.pack.demos || []),
      JSON.stringify(metrics),
      params.sourceRunId || null
    );
    return id;
  }

  deployPromptPack(params: { packId: string; target: string; status: string; canaryPct: number; note?: string }): void {
    const id = `deploy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.db.prepare(`
      INSERT INTO prompt_deployments (deployment_id, created_at, pack_id, target, status, canary_pct, rollout_note)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, Date.now(), params.packId, params.target, params.status, params.canaryPct, params.note || null);
  }

  getScoresWithTraces(metric: string): Array<{ traceId: string; score: number; packVersions: Record<string, string> | null }>{
    const rows = this.db.prepare(`
      SELECT s.trace_id as trace_id, s.score as score, t.prompt_pack_versions_json as prompt_pack_versions_json
      FROM eval_scores s
      JOIN traces t ON t.trace_id = s.trace_id
      WHERE s.metric = ?
    `).all(metric) as Array<Record<string, unknown>>;

    return rows.map(row => ({
      traceId: String(row.trace_id),
      score: typeof row.score === 'number' ? row.score : Number(row.score || 0),
      packVersions: row.prompt_pack_versions_json ? JSON.parse(String(row.prompt_pack_versions_json)) : null
    }));
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare(`SELECT value FROM meta WHERE key = ?`).get(key) as { value?: string } | undefined;
    return row?.value ?? null;
  }

  setMeta(key: string, value: string): void {
    this.db.prepare(`INSERT INTO meta (key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(key, value);
  }

  private mapTraceRow(row: Record<string, unknown>): TraceEvent {
    return {
      trace_id: String(row.trace_id),
      timestamp: String(row.timestamp),
      created_at: Number(row.created_at),
      group_folder: row.group_folder ? String(row.group_folder) : 'unknown',
      chat_id: row.chat_id ? String(row.chat_id) : 'unknown',
      user_id: row.user_id ? String(row.user_id) : undefined,
      input_text: row.input_text ? String(row.input_text) : '',
      output_text: row.output_text ? String(row.output_text) : null,
      model_id: row.model_id ? String(row.model_id) : 'unknown',
      prompt_pack_versions: row.prompt_pack_versions_json ? JSON.parse(String(row.prompt_pack_versions_json)) : undefined,
      memory_summary: row.memory_summary ? String(row.memory_summary) : undefined,
      memory_facts: row.memory_facts_json ? JSON.parse(String(row.memory_facts_json)) : undefined,
      tool_calls: row.tool_calls_json ? JSON.parse(String(row.tool_calls_json)) : undefined,
      latency_ms: row.latency_ms ? Number(row.latency_ms) : undefined,
      tokens_prompt: row.tokens_prompt ? Number(row.tokens_prompt) : undefined,
      tokens_completion: row.tokens_completion ? Number(row.tokens_completion) : undefined,
      error_code: row.error_code ? String(row.error_code) : undefined,
      source: row.source ? String(row.source) : undefined
    };
  }
}
