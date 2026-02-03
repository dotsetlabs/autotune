CREATE TABLE IF NOT EXISTS traces (
  trace_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  group_folder TEXT,
  chat_id TEXT,
  user_id TEXT,
  input_text TEXT,
  output_text TEXT,
  model_id TEXT,
  prompt_pack_versions_json TEXT,
  memory_summary TEXT,
  memory_facts_json TEXT,
  tool_calls_json TEXT,
  tool_results_json TEXT,
  latency_ms INTEGER,
  tokens_prompt INTEGER,
  tokens_completion INTEGER,
  error_code TEXT,
  source TEXT
);

CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);
CREATE INDEX IF NOT EXISTS idx_traces_group ON traces(group_folder);

CREATE TABLE IF NOT EXISTS eval_runs (
  run_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  rubric TEXT NOT NULL,
  model_id TEXT NOT NULL,
  status TEXT NOT NULL,
  trace_count INTEGER NOT NULL,
  cost_usd REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS eval_scores (
  trace_id TEXT NOT NULL,
  metric TEXT NOT NULL,
  run_id TEXT NOT NULL,
  score REAL NOT NULL,
  reason TEXT,
  PRIMARY KEY (trace_id, metric),
  FOREIGN KEY (run_id) REFERENCES eval_runs(run_id),
  FOREIGN KEY (trace_id) REFERENCES traces(trace_id)
);

CREATE INDEX IF NOT EXISTS idx_eval_scores_trace ON eval_scores(trace_id);
CREATE INDEX IF NOT EXISTS idx_eval_scores_metric ON eval_scores(metric);

CREATE TABLE IF NOT EXISTS prompt_packs (
  pack_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  pack_name TEXT NOT NULL,
  behavior TEXT NOT NULL,
  version TEXT NOT NULL,
  instructions TEXT NOT NULL,
  demos_json TEXT,
  metrics_json TEXT,
  source_run_id TEXT
);

CREATE TABLE IF NOT EXISTS prompt_deployments (
  deployment_id TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  pack_id TEXT NOT NULL,
  target TEXT NOT NULL,
  status TEXT NOT NULL,
  canary_pct INTEGER NOT NULL,
  rollout_note TEXT
);

CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);
