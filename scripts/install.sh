#!/usr/bin/env bash
set -euo pipefail

log() {
  echo "[autotune-install] $*"
}

warn() {
  echo "[autotune-install] WARN: $*" >&2
}

die() {
  echo "[autotune-install] ERROR: $*" >&2
  exit 1
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

TARGET_USER="${SUDO_USER:-$USER}"
TARGET_HOME="$(getent passwd "$TARGET_USER" | cut -d: -f6 || true)"
if [[ -z "$TARGET_HOME" ]]; then
  TARGET_HOME="$HOME"
fi

run_as_user() {
  local cmd="$1"
  if [[ "$USER" == "$TARGET_USER" ]]; then
    bash -lc "$cmd"
  else
    sudo -u "$TARGET_USER" bash -lc "$cmd"
  fi
}

NODE_PATH=""
if [[ "$USER" == "root" && -n "${SUDO_USER:-}" ]]; then
  NODE_PATH="$(sudo -u "$TARGET_USER" bash -lc 'command -v node' || true)"
else
  NODE_PATH="$(command -v node || true)"
fi
if [[ -z "$NODE_PATH" ]]; then
  die "node not found in PATH. Install Node 20+ and rerun."
fi

AUTOTUNE_BIN=""
if [[ "$USER" == "$TARGET_USER" ]]; then
  AUTOTUNE_BIN="$(command -v autotune || true)"
else
  AUTOTUNE_BIN="$(sudo -u "$TARGET_USER" bash -lc 'command -v autotune' || true)"
fi

if [[ -z "$AUTOTUNE_BIN" && -d "$PROJECT_ROOT/dist" ]]; then
  AUTOTUNE_BIN="$NODE_PATH $PROJECT_ROOT/dist/cli.js"
fi

if [[ -z "$AUTOTUNE_BIN" ]]; then
  warn "autotune command not found."
  warn "If running from repo, run: npm install && npm run build"
  die "Cannot locate autotune executable."
fi

AUTOTUNE_HOME="${AUTOTUNE_HOME:-$TARGET_HOME/.config/dotclaw}"
AUTOTUNE_CONFIG_PATH="${AUTOTUNE_CONFIG_PATH:-$AUTOTUNE_HOME/autotune.json}"
AUTOTUNE_ENV_PATH="$AUTOTUNE_HOME/autotune.env"

log "Project root: $PROJECT_ROOT"
log "User: $TARGET_USER"
log "Home: $TARGET_HOME"
log "Node: $NODE_PATH"
log "Autotune bin: $AUTOTUNE_BIN"
log "Autotune home: $AUTOTUNE_HOME"
log "Config path: $AUTOTUNE_CONFIG_PATH"

mkdir -p "$AUTOTUNE_HOME"

if [[ ! -f "$AUTOTUNE_CONFIG_PATH" ]]; then
  log "Config not found; running autotune init"
  run_as_user "$AUTOTUNE_BIN init --config \"$AUTOTUNE_CONFIG_PATH\""
fi

cat > "$AUTOTUNE_ENV_PATH" <<EOF_ENV
AUTOTUNE_HOME=$AUTOTUNE_HOME
AUTOTUNE_CONFIG_PATH=$AUTOTUNE_CONFIG_PATH
EOF_ENV

chmod 600 "$AUTOTUNE_ENV_PATH" || true

if ! command -v systemctl >/dev/null 2>&1; then
  warn "systemctl not found; skipping systemd setup"
  exit 0
fi

SERVICE_PATH="/etc/systemd/system/autotune.service"
TIMER_PATH="/etc/systemd/system/autotune.timer"

SERVICE_CONTENT="[Unit]
Description=Autotune Self-Improvement Pipeline
After=network-online.target

[Service]
Type=oneshot
User=$TARGET_USER
WorkingDirectory=$PROJECT_ROOT
Environment=NODE_ENV=production
Environment=HOME=$TARGET_HOME
EnvironmentFile=-$AUTOTUNE_ENV_PATH
ExecStart=$AUTOTUNE_BIN once

[Install]
WantedBy=multi-user.target"

TIMER_CONTENT="[Unit]
Description=Run Autotune hourly

[Timer]
OnBootSec=5m
OnUnitActiveSec=1h
Persistent=true

[Install]
WantedBy=timers.target"

if [[ "$EUID" -ne 0 ]]; then
  if ! command -v sudo >/dev/null 2>&1; then
    die "sudo not available; re-run as root to install systemd units"
  fi
  sudo tee "$SERVICE_PATH" >/dev/null <<< "$SERVICE_CONTENT"
  sudo tee "$TIMER_PATH" >/dev/null <<< "$TIMER_CONTENT"
  sudo systemctl daemon-reload
  sudo systemctl enable --now autotune.timer
else
  tee "$SERVICE_PATH" >/dev/null <<< "$SERVICE_CONTENT"
  tee "$TIMER_PATH" >/dev/null <<< "$TIMER_CONTENT"
  systemctl daemon-reload
  systemctl enable --now autotune.timer
fi

log "Install complete"
log "Autotune timer status:"
if [[ "$EUID" -ne 0 ]]; then
  sudo systemctl status autotune.timer --no-pager || true
else
  systemctl status autotune.timer --no-pager || true
fi
