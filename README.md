# @dotsetlabs/autotune

Automatic self-improvement pipeline for DotClaw-style agents. Autotune ingests conversation traces, scores them with LLM-as-judge, generates improved prompt packs, and deploys them with canary/rollback logic.

## What It Does
- Ingests JSONL traces written by the DotClaw host.
- Evaluates response quality and task extraction using LLM-as-judge.
- Generates improved prompt instructions (two-stage: Haiku 4.5 -> Sonnet 4.5).
- Deploys prompt packs to a shared prompt directory with canary promotion.

## Install
```bash
npm install -g @dotsetlabs/autotune
```

## Commands
```bash
autotune ingest
autotune eval
autotune optimize
autotune deploy
autotune once
autotune daemon
```

## Configuration
Autotune reads env vars or an optional JSON config. Defaults match DotClaw.

Key env vars:
- `AUTOTUNE_TRACE_DIR` (default `~/.config/dotclaw/traces`)
- `AUTOTUNE_OUTPUT_DIR` (default `~/.config/dotclaw/prompts`)
- `AUTOTUNE_DB_PATH` (default `~/.config/dotclaw/autotune.db`)
- `AUTOTUNE_BEHAVIORS` (default `task-extraction,response-quality`)
- `AUTOTUNE_INTERVAL_MINUTES` (default `60`)
- `AUTOTUNE_CANARY_FRACTION` (default `0.1`)
- `AUTOTUNE_CANARY_MIN_SAMPLES` (default `20`)

Models:
- `AUTOTUNE_CANDIDATE_MODEL` (default `anthropic/claude-haiku-4-5`)
- `AUTOTUNE_RERANK_MODEL` (default `anthropic/claude-sonnet-4-5`)
- `AUTOTUNE_PREDICTOR_MODEL` (default `anthropic/claude-haiku-4-5`)
- `AUTOTUNE_JUDGE_STAGE1_MODEL` (default `anthropic/claude-haiku-4-5`)
- `AUTOTUNE_JUDGE_STAGE2_MODEL` (default `anthropic/claude-sonnet-4-5`)

## DotClaw Integration
DotClaw writes traces to `~/.config/dotclaw/traces` and mounts `~/.config/dotclaw/prompts` into the container as `/workspace/prompts`.

Autotune writes prompt packs to `~/.config/dotclaw/prompts`:
- `task-extraction.json`
- `response-quality.json`

Canary packs are stored as:
- `task-extraction.canary.json`
- `response-quality.canary.json`

## Safety Notes
- Redaction is enabled by default. Set `AUTOTUNE_REDACT=0` to disable.
- Canary deployment will roll back if the new pack underperforms.

## License
MIT
