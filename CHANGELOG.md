# Changelog

## 1.1.0 - 2026-02-03
- Added tool-outcome and memory-recall evaluation rubrics and default prompt pack guidance.
- Added canary health gating using error/tool-failure rates and new deploy thresholds.
- Expanded trace schema with memory recall, cost, and tool output metrics; added SQLite migrations.
- Improved trace normalization and redaction (more token/secret patterns).
- Added pack health metrics and defaults for new canary envs/behaviors.

### Upgrade Notes
- Existing SQLite DBs are migrated automatically with new columns.
- New behaviors are enabled by default in `AUTOTUNE_BEHAVIORS`; disable if undesired.
- Canary health gates may roll back packs if error/tool failure rates exceed thresholds; tune env vars if needed.

## 1.0.0 - 2026-02-03
- Added behavior tuning pipeline that updates `behavior.json` and optional canary prompt packs.
- Added config-file support with `AUTOTUNE_HOME` defaults and CLI `--config`.
- Added interactive setup via `autotune init`.
- Improved CLI ergonomics and help output.
- Added systemd env file support and a one-click Linux installer script.
- Fixed eval score storage ordering in SQLite.

### Upgrade Notes
- If you previously ran Autotune without a config file, `autotune init` can generate one at `~/.config/dotclaw/autotune.json`.
- If you have existing evaluation data from pre-1.0 builds, consider resetting `autotune.db` to avoid mixed/invalid eval rows.
