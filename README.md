# @dotsetlabs/autotune

Automatic self-improvement pipeline for DotClaw-style agents. Autotune ingests conversation traces, scores them with LLM-as-judge, generates improved prompt packs, deploys canary updates, and can optionally tune runtime behavior configs.

## What It Does
- Ingests JSONL traces written by the DotClaw host.
- Evaluates response quality, task extraction, tool calling, and memory policy using LLM-as-judge.
- Generates improved prompt instructions (two-stage: Haiku 4.5 -> Sonnet 4.5).
- Deploys prompt packs to a shared prompt directory with canary promotion.
- Optional behavior tuning pass that updates `behavior.json` and canary response/tool packs.

## Install
```bash
npm install -g @dotsetlabs/autotune
```

## Commands
```bash
autotune init
autotune ingest
autotune eval
autotune optimize
autotune deploy
autotune behavior
autotune once
autotune daemon
```

## Configuration
Autotune reads env vars or an optional JSON config. Defaults match DotClaw.

Quick start:
```bash
autotune init
autotune once
```

Use a custom config path:
```bash
autotune init --config /path/to/autotune.json
AUTOTUNE_CONFIG_PATH=/path/to/autotune.json autotune once
```

By default, `autotune init` writes `~/.config/dotclaw/autotune.json`. You can override with:
- `AUTOTUNE_CONFIG_PATH=/path/to/autotune.json`
- `AUTOTUNE_HOME=/path/to/config/root` (affects default trace/output/db paths)

Config precedence (highest to lowest): CLI flags → environment → config file → defaults.

Key env vars:
- `AUTOTUNE_CONFIG_PATH` (default `~/.config/dotclaw/autotune.json` if present)
- `AUTOTUNE_HOME` (default `~/.config/dotclaw`)
- `AUTOTUNE_TRACE_DIR` (default `~/.config/dotclaw/traces`)
- `AUTOTUNE_OUTPUT_DIR` (default `~/.config/dotclaw/prompts`)
- `AUTOTUNE_DB_PATH` (default `~/.config/dotclaw/autotune.db`)
- `AUTOTUNE_BEHAVIORS` (default `task-extraction,response-quality,tool-calling,tool-outcome,memory-policy,memory-recall`)
- `AUTOTUNE_INTERVAL_MINUTES` (default `60`)
- `AUTOTUNE_CANARY_FRACTION` (default `0.1`)
- `AUTOTUNE_CANARY_MIN_SAMPLES` (default `20`)
- `AUTOTUNE_CANARY_MIN_IMPROVEMENT` (default `0.02`)
- `AUTOTUNE_CANARY_HEALTH_WINDOW_HOURS` (default `24`)
- `AUTOTUNE_CANARY_MAX_ERROR_RATE` (default `0.12`)
- `AUTOTUNE_CANARY_MAX_TOOL_FAILURE_RATE` (default `0.25`)
- `AUTOTUNE_CANARY_MAX_ERROR_RATE_DELTA` (default `0.05`)
- `AUTOTUNE_CANARY_MAX_TOOL_FAILURE_RATE_DELTA` (default `0.12`)

Models:
- `AUTOTUNE_CANDIDATE_MODEL` (default `anthropic/claude-haiku-4-5`)
- `AUTOTUNE_RERANK_MODEL` (default `anthropic/claude-sonnet-4-5`)
- `AUTOTUNE_PREDICTOR_MODEL` (default `anthropic/claude-haiku-4-5`)
- `AUTOTUNE_JUDGE_STAGE1_MODEL` (default `anthropic/claude-haiku-4-5`)
- `AUTOTUNE_JUDGE_STAGE2_MODEL` (default `anthropic/claude-sonnet-4-5`)

Behavior tuning (optional):
- `AUTOTUNE_BEHAVIOR_ENABLED` (default `0`)
- `AUTOTUNE_BEHAVIOR_DAYS` (default `7`)
- `AUTOTUNE_BEHAVIOR_MIN_TRACES` (default `0`)
- `AUTOTUNE_BEHAVIOR_MAX_TRACES` (default `0` = no limit)
- `AUTOTUNE_BEHAVIOR_EVAL_MODEL` (default empty)
- `AUTOTUNE_BEHAVIOR_EVAL_SAMPLES` (default `6`)
- `AUTOTUNE_BEHAVIOR_PROMPT_PACKS` (default `0`)
- `AUTOTUNE_BEHAVIOR_CANARY_PERCENT` (default `20`)
- `AUTOTUNE_BEHAVIOR_CONFIG_PATH` (default `~/.config/dotclaw/behavior.json`)
- `AUTOTUNE_BEHAVIOR_REPORT_DIR` (default `~/.config/dotclaw/reports`)

## DotClaw Integration
DotClaw writes traces to `~/.config/dotclaw/traces` and mounts `~/.config/dotclaw/prompts` into the container as `/workspace/prompts`.

Autotune writes prompt packs to `~/.config/dotclaw/prompts`:
- `task-extraction.json`
- `response-quality.json`
- `tool-calling.json`
- `tool-outcome.json`
- `memory-policy.json`
- `memory-recall.json`

Canary packs are stored as:
- `task-extraction.canary.json`
- `response-quality.canary.json`
- `tool-calling.canary.json`
- `tool-outcome.canary.json`
- `memory-policy.canary.json`
- `memory-recall.canary.json`

Behavior tuning writes `behavior.json` to the configured path and emits daily reports under the configured report directory.


## One-click Install (Linux/systemd)
If you're running on a Linux host with systemd, you can automate setup with:
```bash
./scripts/install.sh
```
This will:
- Run `autotune init` if no config exists
- Write a systemd service + timer
- Enable the hourly timer

## Systemd (Ubuntu)
```bash
# Copy the unit files
sudo cp systemd/autotune.service /etc/systemd/system/autotune.service
sudo cp systemd/autotune.timer /etc/systemd/system/autotune.timer

# Enable the timer
sudo systemctl daemon-reload
sudo systemctl enable --now autotune.timer
```

If you are using a custom config path, set `AUTOTUNE_CONFIG_PATH` in your environment file or override the unit.

## Safety Notes
- Redaction is enabled by default. Set `AUTOTUNE_REDACT=0` to disable.
- Canary deployment will roll back if the new pack underperforms.

## License
MIT
