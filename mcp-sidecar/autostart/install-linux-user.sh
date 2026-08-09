#!/usr/bin/env bash
# Install chayuan-mcp as a systemd --user service (Phase 2).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
UNIT_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
UNIT="$UNIT_DIR/chayuan-mcp.service"
DATA_DIR="${XDG_CONFIG_HOME:-$HOME/.config}/chayuan-wps/mcp"
mkdir -p "$UNIT_DIR" "$DATA_DIR"

# Prefer fixed install dir copy if present
SIDECAR_DIR="${CHAYUAN_MCP_HOME:-$DATA_DIR/runtime}"
mkdir -p "$SIDECAR_DIR"
cp -a "$ROOT/." "$SIDECAR_DIR/" 2>/dev/null || true
# Keep using repo/runtime path that has server.mjs
if [[ -f "$ROOT/server.mjs" ]]; then
  RUN_DIR="$ROOT"
else
  RUN_DIR="$SIDECAR_DIR"
fi

cat > "$UNIT" <<EOF
[Unit]
Description=Chayuan WPS MCP Sidecar
After=default.target

[Service]
Type=simple
ExecStart=$(command -v node) $RUN_DIR/server.mjs
Restart=on-failure
RestartSec=3
Environment=CHAYUAN_MCP_DATA_DIR=$DATA_DIR

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now chayuan-mcp.service
echo "Installed: $UNIT"
systemctl --user status chayuan-mcp.service --no-pager || true
