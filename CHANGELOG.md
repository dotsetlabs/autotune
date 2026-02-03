# Changelog

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
