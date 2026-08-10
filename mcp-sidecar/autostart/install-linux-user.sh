#!/usr/bin/env bash
# Install chayuan-mcp as a systemd --user service (chayuan-mcp.service).
# 优先用 mcp-sidecar/bin 下的单文件二进制（无需本机 Node）；二进制缺失时回落 node server.mjs。
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
# Run dir = 装好 sidecar 的目录（同时含 server.mjs 与 bin/）
if [[ -f "$SIDECAR_DIR/server.mjs" ]]; then
  RUN_DIR="$SIDECAR_DIR"
elif [[ -f "$ROOT/server.mjs" ]]; then
  RUN_DIR="$ROOT"
else
  RUN_DIR="$SIDECAR_DIR"
fi

# 选当前架构二进制
case "$(uname -m)" in
  x86_64|amd64) BIN_ARCH="x64" ;;
  arm64|aarch64) BIN_ARCH="arm64" ;;
  *) BIN_ARCH="$(uname -m)" ;;
esac
BIN_PATH="$RUN_DIR/bin/chayuan-mcp-linux-$BIN_ARCH"
NODE_BIN="$(command -v node || true)"

# 优先二进制；缺失则回落 node server.mjs
if [[ -x "$BIN_PATH" ]]; then
  EXEC_START="$BIN_PATH"
  echo "[chayuan-mcp] systemd → native binary: $BIN_PATH" >&2
elif [[ -n "$NODE_BIN" && -f "$RUN_DIR/server.mjs" ]]; then
  EXEC_START="$NODE_BIN $RUN_DIR/server.mjs"
  echo "[chayuan-mcp] systemd → node server.mjs (binary not found at $BIN_PATH)" >&2
else
  echo "[chayuan-mcp] Neither binary nor node available; service not installed." >&2
  exit 0
fi

cat > "$UNIT" <<EOF
[Unit]
Description=Chayuan WPS MCP Sidecar
After=default.target

[Service]
Type=simple
ExecStart=$EXEC_START
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
